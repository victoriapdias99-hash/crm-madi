import { Router } from 'express';
import { SyncFactory } from '../../infrastructure/config/SyncFactory';

/**
 * Rutas simplificadas para sincronización inteligente de Google Sheets
 */
export function createSyncRoutes(): Router {
  const router = Router();
  
  // Inicializar dependencias usando factory
  const syncController = SyncFactory.createSyncController();

  // ========== RUTA PRINCIPAL DE SINCRONIZACIÓN ==========

  /**
   * POST /api/sync/smart
   * Sincronización inteligente que analiza automáticamente qué datos sincronizar
   */
  router.post('/smart', (req, res) => {
    syncController.syncSmart(req, res);
  });

  // ========== RUTAS DE INFORMACIÓN ==========

  /**
   * GET /api/sync/sheets/available
   * Obtiene lista de sheets disponibles en Google Sheets
   */
  router.get('/sheets/available', (req, res) => {
    syncController.getAvailableSheets(req, res);
  });

  /**
   * GET /api/sync/status
   * Obtiene estado actual de sincronización
   */
  router.get('/status', (req, res) => {
    syncController.getSyncStatus(req, res);
  });

  return router;
}

/**
 * Middleware para logging de operaciones de sync
 */
export function syncLoggingMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  const originalUrl = req.originalUrl;
  
  console.log(`🔄 SYNC REQUEST: ${req.method} ${originalUrl}`);
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 200 && statusCode < 400 ? '✅' : '❌';
    
    console.log(`${statusEmoji} SYNC RESPONSE: ${req.method} ${originalUrl} ${statusCode} in ${duration}ms`);
  });
  
  next();
}