import type { Express } from "express";
import { MetaAdsService, type CampaignSpendData } from "./meta-ads-service";

let metaAdsService: MetaAdsService | null = null;

// Función para obtener la instancia configurada globalmente o crear una nueva
function getMetaAdsService(): MetaAdsService | null {
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
}

// Cleanup function para cerrar recursos
export function cleanupMetaAds() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}