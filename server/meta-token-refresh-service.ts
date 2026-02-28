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
}

class MetaTokenRefreshService {
  private refreshInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const envToken = process.env.META_ACCESS_TOKEN;

    if (!envToken) {
      console.log('⚠️ META_ACCESS_TOKEN no configurado, omitiendo inicialización del token');
      return;
    }

    if (!appId || !appSecret) {
      console.log('⚠️ META_APP_ID o META_APP_SECRET no configurados, omitiendo exchange de token');
      const existing = await this.getStoredToken();
      if (!existing) {
        await this.saveToken(envToken, null, 'user');
        console.log('💾 Token Meta guardado en BD (sin exchange)');
      }
      return;
    }

    try {
      const longLivedToken = await this.exchangeForLongLived(envToken, appId, appSecret);
      const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
      await this.saveToken(longLivedToken, expiresAt, 'user');
      const days = TOKEN_LIFETIME_DAYS;
      console.log(`✅ Token Meta guardado en BD, vence en ~${days} días (${expiresAt.toISOString().slice(0, 10)})`);
    } catch (error) {
      console.warn('⚠️ No se pudo hacer exchange del token, guardando token actual:', (error as Error).message);
      const existing = await this.getStoredToken();
      if (!existing) {
        await this.saveToken(envToken, null, 'user');
        console.log('💾 Token Meta guardado en BD (sin exchange)');
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
      console.log('🔑 Token de tipo sistema (sin vencimiento), no requiere refresco');
      return;
    }

    const msRemaining = stored.expiresAt.getTime() - Date.now();
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

    if (daysRemaining > REFRESH_THRESHOLD_DAYS) {
      console.log(`🔑 Token Meta válido, vence en ${Math.floor(daysRemaining)} días`);
      return;
    }

    console.log(`⚡ Token Meta vence en ${Math.floor(daysRemaining)} días, refrescando...`);

    try {
      const newToken = await this.exchangeForLongLived(stored.accessToken, appId, appSecret);
      const newExpiresAt = new Date(Date.now() + TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
      await this.saveToken(newToken, newExpiresAt, stored.tokenType);
      console.log(`✅ Token Meta refrescado exitosamente, nuevo vencimiento: ${newExpiresAt.toISOString().slice(0, 10)}`);
    } catch (error) {
      console.error('❌ Error refrescando token Meta:', (error as Error).message);
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
      };
    }

    let daysRemaining: number | null = null;
    if (stored.expiresAt) {
      const msRemaining = stored.expiresAt.getTime() - Date.now();
      daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
    }

    return {
      expiresAt: stored.expiresAt,
      daysRemaining,
      lastRefreshed: stored.updatedAt,
      tokenType: stored.tokenType,
      hasToken: true,
    };
  }
}

export const metaTokenRefreshService = new MetaTokenRefreshService();
