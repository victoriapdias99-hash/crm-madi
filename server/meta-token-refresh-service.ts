import axios from 'axios';
import { db } from './db';
import { metaTokenStore } from '../shared/schema';
import { desc, eq } from 'drizzle-orm';

const REFRESH_THRESHOLD_DAYS = 15;
const TOKEN_LIFETIME_DAYS = 60;

interface TokenStatus {
  expiresAt: Date | null;
  daysRemaining: number | null;
  lastRefreshed: Date | null;
  tokenType: string;
  hasToken: boolean;
  isExpired?: boolean;
  debugInfo?: string | null;
}

interface MetaDebugTokenData {
  is_valid: boolean;
  expires_at?: number;
  data_access_expires_at?: number;
  type?: string;
  app_id?: string;
  error?: { message: string; code: number };
}

class MetaTokenRefreshService {
  private refreshInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const envToken = process.env.META_ACCESS_TOKEN;

    // Verificar si ya hay un token válido en la base de datos
    const existing = await this.getStoredToken();
    if (existing?.accessToken) {
      // Si el token en DB existe y no está vencido, usarlo directamente
      const isDbTokenExpired = existing.expiresAt && existing.expiresAt.getTime() < Date.now();
      if (!isDbTokenExpired) {
        const daysLeft = existing.expiresAt
          ? Math.floor((existing.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
        console.log(`✅ Usando token almacenado en BD${daysLeft !== null ? ` (${daysLeft} días restantes)` : ' (sin vencimiento conocido)'}`);
        return;
      }
      console.log('⚠️ Token en BD está vencido, intentando renovar desde variable de entorno...');
    }

    if (!envToken) {
      console.log('⚠️ META_ACCESS_TOKEN no configurado y no hay token válido en BD');
      return;
    }

    if (!appId || !appSecret) {
      console.log('⚠️ META_APP_ID o META_APP_SECRET no configurados, omitiendo exchange de token');
      if (!existing) {
        await this.saveToken(envToken, null, 'user');
        console.log('💾 Token Meta guardado en BD (sin exchange)');
      }
      return;
    }

    // El token en BD no existe o está vencido — intentar usar el token del entorno
    const tokenToUse = envToken;

    try {
      const longLivedToken = await this.exchangeForLongLived(tokenToUse, appId, appSecret);
      const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
      await this.saveToken(longLivedToken, expiresAt, 'user_long_lived');
      console.log(`✅ Token Meta canjeado exitosamente, vence en ~${TOKEN_LIFETIME_DAYS} días (${expiresAt.toISOString().slice(0, 10)})`);
    } catch (exchangeError) {
      console.warn('⚠️ No se pudo hacer exchange del token:', (exchangeError as Error).message);

      // Consultar a Meta la info real del token
      const debugInfo = await this.debugToken(tokenToUse, appId, appSecret);

      if (debugInfo) {
        if (!debugInfo.is_valid) {
          console.error('❌ El token de META_ACCESS_TOKEN está INVÁLIDO o VENCIDO. Debe actualizarse manualmente.');
          // Guardar el token env con expiración pasada para que el status muestre error
          if (existing) {
            await this.saveToken(existing.accessToken, existing.expiresAt, existing.tokenType);
          } else {
            const pastDate = new Date(Date.now() - 1000);
            await this.saveToken(tokenToUse, pastDate, 'expired');
          }
          return;
        }

        const expiresAtUnix = debugInfo.expires_at || debugInfo.data_access_expires_at;
        if (expiresAtUnix && expiresAtUnix > 0) {
          const expiresAt = new Date(expiresAtUnix * 1000);
          await this.saveToken(tokenToUse, expiresAt, debugInfo.type || 'user');
          const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          console.log(`💾 Token Meta guardado con expiración real de Meta: ${expiresAt.toISOString().slice(0, 10)} (${daysLeft} días restantes)`);
        } else {
          // Token sin vencimiento (system user token)
          await this.saveToken(tokenToUse, null, debugInfo.type || 'system');
          console.log(`💾 Token Meta guardado (tipo: ${debugInfo.type || 'system'}, sin vencimiento explícito)`);
        }
      } else {
        // No se pudo debuggear, guardar como estaba
        console.warn('⚠️ No se pudo verificar el token con Meta. Guardando token sin información de expiración.');
        await this.saveToken(tokenToUse, null, 'user');
        console.log('💾 Token Meta actualizado en BD (sin exchange ni debug)');
      }
    }
  }

  private async exchangeForLongLived(token: string, appId: string, appSecret: string): Promise<string> {
    const url = 'https://graph.facebook.com/oauth/access_token';
    const response = await axios.get(url, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: token,
      },
      timeout: 10000,
    });

    if (!response.data?.access_token) {
      throw new Error('Respuesta de Meta sin access_token: ' + JSON.stringify(response.data));
    }

    return response.data.access_token as string;
  }

  async debugToken(token: string, appId?: string, appSecret?: string): Promise<MetaDebugTokenData | null> {
    try {
      const id = appId || process.env.META_APP_ID;
      const secret = appSecret || process.env.META_APP_SECRET;
      if (!id || !secret) return null;

      const appAccessToken = `${id}|${secret}`;
      const url = 'https://graph.facebook.com/debug_token';
      const response = await axios.get(url, {
        params: {
          input_token: token,
          access_token: appAccessToken,
        },
        timeout: 10000,
      });

      return response.data?.data as MetaDebugTokenData;
    } catch (err) {
      console.warn('⚠️ Error al debuggear token Meta:', (err as Error).message);
      return null;
    }
  }

  private async saveToken(accessToken: string, expiresAt: Date | null, tokenType: string): Promise<void> {
    const appId = process.env.META_APP_ID || null;
    const existing = await this.getStoredToken();

    if (existing) {
      await db.update(metaTokenStore)
        .set({
          accessToken,
          tokenType,
          expiresAt,
          appId,
          updatedAt: new Date(),
        })
        .where(eq(metaTokenStore.id, existing.id));
    } else {
      await db.insert(metaTokenStore).values({
        accessToken,
        tokenType,
        expiresAt,
        appId,
      });
    }
  }

  private async getStoredToken() {
    const rows = await db.select()
      .from(metaTokenStore)
      .orderBy(desc(metaTokenStore.updatedAt))
      .limit(1);
    return rows[0] || null;
  }

  async getToken(): Promise<string> {
    const stored = await this.getStoredToken();
    if (stored?.accessToken) {
      return stored.accessToken;
    }
    return process.env.META_ACCESS_TOKEN || '';
  }

  async updateToken(newToken: string): Promise<{ success: boolean; expiresAt: Date | null; daysRemaining: number | null; message: string }> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    // Intentar canjear por token de larga duración
    if (appId && appSecret) {
      try {
        const longLivedToken = await this.exchangeForLongLived(newToken, appId, appSecret);
        const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
        await this.saveToken(longLivedToken, expiresAt, 'user_long_lived');
        const daysRemaining = TOKEN_LIFETIME_DAYS;
        console.log(`✅ Nuevo token canjeado y guardado, vence en ~${daysRemaining} días`);
        return { success: true, expiresAt, daysRemaining, message: `Token canjeado por token de larga duración. Vence en ~${daysRemaining} días.` };
      } catch (exchangeErr) {
        console.warn('⚠️ No se pudo canjear el nuevo token, verificando con debug_token...');
      }

      // Si falla el exchange, obtener info real de Meta
      const debugInfo = await this.debugToken(newToken, appId, appSecret);
      if (debugInfo && !debugInfo.is_valid) {
        return { success: false, expiresAt: null, daysRemaining: null, message: 'El token proporcionado es inválido o está vencido según Meta.' };
      }

      if (debugInfo) {
        const expiresAtUnix = debugInfo.expires_at || debugInfo.data_access_expires_at;
        if (expiresAtUnix && expiresAtUnix > 0) {
          const expiresAt = new Date(expiresAtUnix * 1000);
          await this.saveToken(newToken, expiresAt, debugInfo.type || 'user');
          const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return { success: true, expiresAt, daysRemaining, message: `Token guardado. Vence en ${daysRemaining} días.` };
        } else {
          await this.saveToken(newToken, null, debugInfo.type || 'system');
          return { success: true, expiresAt: null, daysRemaining: null, message: 'Token guardado (sin vencimiento explícito).' };
        }
      }
    }

    // Fallback: guardar sin verificar
    await this.saveToken(newToken, null, 'user');
    return { success: true, expiresAt: null, daysRemaining: null, message: 'Token guardado (no se pudo verificar expiración).' };
  }

  async refreshIfNeeded(): Promise<void> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      console.log('META_APP_ID/META_APP_SECRET no disponibles, no se puede refrescar el token');
      return;
    }

    const stored = await this.getStoredToken();
    if (!stored) {
      console.log('No hay token almacenado para refrescar');
      return;
    }

    if (!stored.expiresAt) {
      // Verificar con Meta si realmente no vence
      const debugInfo = await this.debugToken(stored.accessToken, appId, appSecret);
      if (debugInfo?.expires_at && debugInfo.expires_at > 0) {
        const expiresAt = new Date(debugInfo.expires_at * 1000);
        await db.update(metaTokenStore).set({ expiresAt, updatedAt: new Date() }).where(eq(metaTokenStore.id, stored.id));
        console.log(`🔑 Expiración real encontrada: ${expiresAt.toISOString().slice(0, 10)}`);
        // Reinvocar con la expiración actualizada
        return this.refreshIfNeeded();
      }
      console.log('🔑 Token sin vencimiento conocido, no requiere refresco');
      return;
    }

    const msRemaining = stored.expiresAt.getTime() - Date.now();
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

    if (daysRemaining <= 0) {
      console.error('❌ El token de Meta Ads ha VENCIDO. Debe actualizarse manualmente en la página de configuración.');
      return;
    }

    if (daysRemaining > REFRESH_THRESHOLD_DAYS) {
      console.log(`🔑 Token Meta válido, vence en ${Math.floor(daysRemaining)} días`);
      return;
    }

    console.log(`⚡ Token Meta vence en ${Math.floor(daysRemaining)} días, intentando extender...`);

    try {
      const newToken = await this.exchangeForLongLived(stored.accessToken, appId, appSecret);
      const newExpiresAt = new Date(Date.now() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
      await this.saveToken(newToken, newExpiresAt, stored.tokenType);
      console.log(`✅ Token Meta extendido exitosamente, nuevo vencimiento: ${newExpiresAt.toISOString().slice(0, 10)}`);
    } catch (error) {
      console.error('❌ Error extendiendo token Meta. Debe actualizarse manualmente:', (error as Error).message);
    }
  }

  scheduleAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    const INTERVAL_MS = 24 * 60 * 60 * 1000;
    this.refreshInterval = setInterval(async () => {
      console.log('⏰ Verificación automática de token Meta Ads...');
      await this.refreshIfNeeded();
    }, INTERVAL_MS);

    console.log('⏰ Auto-refresh de token Meta programado cada 24 horas');
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async getStatus(): Promise<TokenStatus> {
    const stored = await this.getStoredToken();

    if (!stored) {
      return {
        expiresAt: null,
        daysRemaining: null,
        lastRefreshed: null,
        tokenType: 'unknown',
        hasToken: !!process.env.META_ACCESS_TOKEN,
        isExpired: false,
      };
    }

    let daysRemaining: number | null = null;
    let isExpired = false;
    if (stored.expiresAt) {
      const msRemaining = stored.expiresAt.getTime() - Date.now();
      daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      isExpired = daysRemaining <= 0;
    }

    return {
      expiresAt: stored.expiresAt,
      daysRemaining,
      lastRefreshed: stored.updatedAt,
      tokenType: stored.tokenType,
      hasToken: true,
      isExpired,
    };
  }
}

export const metaTokenRefreshService = new MetaTokenRefreshService();
