import { Router } from 'express';
import { SyncController } from '../controllers/SyncController';
import { SyncFactory } from '../../infrastructure/config/SyncFactory';

/**
 * Rutas específicas para funcionalidad de sincronización
 * Separadas del routes.ts principal para mantener modularidad
 */
export function createSyncRoutes(): Router {
  const router = Router();
  
  // Inicializar dependencias usando factory
  const syncController = SyncFactory.createSyncController();

  // ========== RUTAS DE SINCRONIZACIÓN ==========

  /**
   * POST /api/sync/full
   * Sincronización completa de todos los datos desde Google Sheets
   */
  router.post('/full', (req, res) => {
    syncController.syncFull(req, res);
  });

  /**
   * POST /api/sync/incremental
   * Sincronización incremental desde última actualización
   */
  router.post('/incremental', (req, res) => {
    syncController.syncIncremental(req, res);
  });

  /**
   * POST /api/sync/smart
   * Sincronización inteligente que continúa desde donde se quedó cada marca
   */
  router.post('/smart', (req, res) => {
    syncController.syncSmart(req, res);
  });

  /**
   * POST /api/sync/sheets/:sheetNames
   * Sincronización de sheets específicos (separados por coma)
   * Ejemplo: /api/sync/sheets/Fiat,Peugeot,Toyota
   */
  router.post('/sheets/:sheetNames', (req, res) => {
    syncController.syncSpecificSheets(req, res);
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
   * POST /api/sync/sheets/validate
   * Valida que los sheets especificados existen
   * Body: { sheetNames: string[] }
   */
  router.post('/sheets/validate', (req, res) => {
    syncController.validateSheets(req, res);
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