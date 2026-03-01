import type { Express } from "express";
import { MetaAdsService, type CampaignSpendData } from "./meta-ads-service";
import { metaTokenRefreshService } from "./meta-token-refresh-service";

let metaAdsService: MetaAdsService | null = null;

// Función para obtener la instancia configurada globalmente o crear una nueva
export function getMetaAdsService(): MetaAdsService | null {
  // Si hay una instancia global configurada, usarla
  if (global.metaAdsService) {
    return global.metaAdsService;
  }
  
  // Si no, usar la instancia local
  return metaAdsService;
}
let autoSyncInterval: NodeJS.Timeout | null = null;

export function registerMetaAdsRoutes(app: Express) {
  // Configurar Meta Ads Service
  app.post('/api/meta-ads/config', async (req, res) => {
    try {
      const { accessToken, accountId, appSecret } = req.body;
      
      if (!accessToken || !accountId) {
        return res.status(400).json({ 
          error: 'Access token and account ID are required' 
        });
      }

      metaAdsService = new MetaAdsService({
        accessToken,
        accountId,
        appSecret
      });

      // Validar token
      const isValid = await metaAdsService.validateToken();
      if (!isValid) {
        metaAdsService = null;
        return res.status(401).json({ 
          error: 'Invalid access token or account ID' 
        });
      }

      // Iniciar sincronización automática
      if (autoSyncInterval) {
        clearInterval(autoSyncInterval);
      }
      
      autoSyncInterval = metaAdsService.startAutoSync((data: CampaignSpendData[]) => {
        console.log(`Meta Ads auto-sync: ${data.length} campaigns updated`);
      });

      res.json({ 
        success: true, 
        message: 'Meta Ads API configured successfully',
        autoSyncEnabled: true
      });
    } catch (error) {
      res.status(500).json({ 
        error: `Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Obtener métricas de campañas
  app.get('/api/meta-ads/campaigns', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured. Please configure first.' 
        });
      }

      const { timeRange } = req.query;
      let parsedTimeRange;

      if (timeRange && typeof timeRange === 'string') {
        try {
          parsedTimeRange = JSON.parse(timeRange);
        } catch (e) {
          return res.status(400).json({ 
            error: 'Invalid time range format. Expected JSON string.' 
          });
        }
      }

      const campaigns = await service.getCampaignSpendData(parsedTimeRange);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ 
        error: `Failed to fetch campaigns: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Obtener métricas en tiempo real (últimas 24h)
  app.get('/api/meta-ads/realtime', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured' 
        });
      }

      const metrics = await service.getRealTimeMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ 
        error: `Failed to fetch real-time metrics: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Obtener presupuestos de campañas
  app.get('/api/meta-ads/budgets', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured' 
        });
      }

      const { campaignIds } = req.query;
      let ids: string[] | undefined;

      if (campaignIds && typeof campaignIds === 'string') {
        ids = campaignIds.split(',');
      }

      const budgets = await service.getCampaignBudgets(ids);
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ 
        error: `Failed to fetch budgets: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Obtener resumen de gasto de cuenta
  app.get('/api/meta-ads/account-summary', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured' 
        });
      }

      const { timeRange } = req.query;
      let parsedTimeRange;

      if (timeRange && typeof timeRange === 'string') {
        try {
          parsedTimeRange = JSON.parse(timeRange);
        } catch (e) {
          return res.status(400).json({ 
            error: 'Invalid time range format' 
          });
        }
      }

      const summary = await service.getAccountSpendSummary(parsedTimeRange);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ 
        error: `Failed to fetch account summary: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Calcular CPA (Cost Per Acquisition) por campaña y fecha
  app.post('/api/meta-ads/calculate-cpa', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured' 
        });
      }

      const { campaignName, dateRange, leadCount } = req.body;

      if (!campaignName || !dateRange || !leadCount) {
        return res.status(400).json({ 
          error: 'Campaign name, date range, and lead count are required' 
        });
      }

      const cpa = await service.calculateCPA(campaignName, dateRange, leadCount);
      
      res.json({
        campaignName,
        dateRange,
        leadCount,
        cpa,
        currency: 'ARS'
      });
    } catch (error) {
      res.status(500).json({ 
        error: `Failed to calculate CPA: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Obtener datos de adsets por campaña
  app.get('/api/meta-ads/adsets', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured' 
        });
      }

      const { campaignName, timeRange } = req.query;
      let parsedTimeRange;

      if (timeRange && typeof timeRange === 'string') {
        try {
          parsedTimeRange = JSON.parse(timeRange);
        } catch (e) {
          return res.status(400).json({ 
            error: 'Invalid time range format' 
          });
        }
      }

      const adsets = await service.getAdsetSpendData({
        campaignName: campaignName as string,
        dateRange: parsedTimeRange
      });
      
      res.json(adsets);
    } catch (error) {
      res.status(500).json({ 
        error: `Failed to fetch adsets: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Obtener estado del servicio
  app.get('/api/meta-ads/status', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.json({ 
          configured: false,
          autoSyncEnabled: false,
          cacheStats: null
        });
      }

      const isValid = await service.validateToken();
      const cacheStats = service.getCacheStats();

      res.json({
        configured: true,
        tokenValid: isValid,
        autoSyncEnabled: !!autoSyncInterval,
        cacheStats
      });
    } catch (error) {
      res.status(500).json({ 
        error: `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Forzar sincronización manual
  app.post('/api/meta-ads/sync', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured' 
        });
      }

      const data = await service.getRealTimeMetrics();
      res.json({
        success: true,
        message: `Synced ${data.length} campaigns`,
        data,
        syncTime: new Date()
      });
    } catch (error) {
      res.status(500).json({ 
        error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  });

  // Detener sincronización automática
  app.post('/api/meta-ads/stop-sync', (req, res) => {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
      res.json({ success: true, message: 'Auto-sync stopped' });
    } else {
      res.json({ success: false, message: 'Auto-sync was not running' });
    }
  });

  // Audit report endpoint
  app.post('/api/meta-ads/audit-report', async (req, res) => {
    try {
      const { fechaInicio, fechaFin, campanaId } = req.body;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ error: 'fechaInicio and fechaFin are required' });
      }

      const service = getMetaAdsService();
      if (!service) {
        return res.status(400).json({ 
          error: 'Meta Ads service not configured. Please configure first.' 
        });
      }

      const auditReport = await service.generateAuditReport({
        fechaInicio,
        fechaFin,
        campanaId: campanaId || null
      });

      res.json(auditReport);
    } catch (error) {
      console.error('Meta Ads audit report error:', error);
      res.status(500).json({ error: 'Failed to generate audit report' });
    }
  });

  // Gasto acumulado de Meta Ads para una campaña específica (por marca + zona + fechas)
  app.get('/api/meta-ads/campaign-spend', async (req, res) => {
    try {
      const service = getMetaAdsService();
      if (!service) {
        return res.json({ spend: 0, results: 0, cpl: 0, available: false });
      }
      const { marca, zona, fechaInicio, fechaFin, metaCampanaFiltro } = req.query as Record<string, string>;
      if (!marca || !fechaInicio) {
        return res.status(400).json({ error: 'marca y fechaInicio son requeridos' });
      }
      const today = new Date().toISOString().split('T')[0];
      // Usar metaCampanaFiltro si está definido, si no usar marca
      const campanaFiltro = metaCampanaFiltro && metaCampanaFiltro.trim() ? metaCampanaFiltro.trim() : marca;
      const result = await service.getSpendByCampaign(
        campanaFiltro,
        zona || 'NACIONAL',
        fechaInicio,
        fechaFin || today
      );
      res.json({ ...result, available: true });
    } catch (error) {
      res.json({ spend: 0, results: 0, cpl: 0, available: false });
    }
  });

  // Estado del token de Meta Ads (vencimiento, días restantes)
  app.get('/api/meta-ads/token-status', async (req, res) => {
    try {
      const status = await metaTokenRefreshService.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get token status' });
    }
  });

  // Forzar refresco manual del token
  app.post('/api/meta-ads/token-refresh', async (req, res) => {
    try {
      await metaTokenRefreshService.refreshIfNeeded();
      const status = await metaTokenRefreshService.getStatus();
      res.json({ success: true, ...status });
    } catch (error) {
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });

  // Actualizar token manualmente (cuando el token vence y el usuario pega uno nuevo)
  app.post('/api/meta-ads/update-token', async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken || typeof accessToken !== 'string' || accessToken.trim().length < 10) {
        return res.status(400).json({ error: 'Se requiere un access token válido' });
      }

      const result = await metaTokenRefreshService.updateToken(accessToken.trim());
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      // Reinicializar el servicio de Meta Ads con el nuevo token
      const storedToken = await metaTokenRefreshService.getToken();
      const accountId = process.env.META_AD_ACCOUNT_ID;
      if (storedToken && accountId) {
        const { MetaAdsService } = await import('./meta-ads-service');
        const newService = new MetaAdsService({
          accessToken: storedToken,
          accountId,
          appSecret: process.env.META_APP_SECRET,
        });
        global.metaAdsService = newService;
        console.log('✅ Servicio Meta Ads reinicializado con nuevo token');
      }

      const status = await metaTokenRefreshService.getStatus();
      res.json({ success: true, message: result.message, ...status });
    } catch (error) {
      console.error('Error actualizando token:', error);
      res.status(500).json({ error: `Error actualizando token: ${error instanceof Error ? error.message : 'Error desconocido'}` });
    }
  });

  // Verificar token con Meta (debug_token)
  app.get('/api/meta-ads/verify-token', async (req, res) => {
    try {
      const stored = await metaTokenRefreshService.getToken();
      if (!stored) {
        return res.json({ valid: false, message: 'No hay token almacenado' });
      }
      const debugInfo = await metaTokenRefreshService.debugToken(stored);
      if (!debugInfo) {
        return res.json({ valid: false, message: 'No se pudo verificar con Meta (APP_ID/SECRET no configurados)' });
      }
      res.json({
        valid: debugInfo.is_valid,
        expiresAt: debugInfo.expires_at ? new Date(debugInfo.expires_at * 1000) : null,
        type: debugInfo.type,
        error: debugInfo.error?.message || null,
      });
    } catch (error) {
      res.status(500).json({ error: 'Error verificando token' });
    }
  });
}

// Cleanup function para cerrar recursos
export function cleanupMetaAds() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  metaTokenRefreshService.stopAutoRefresh();
}