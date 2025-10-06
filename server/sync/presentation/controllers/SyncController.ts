import { Request, Response } from 'express';
import { GoogleSheetsGateway } from '../../infrastructure/gateways/GoogleSheetsGateway';
import { migrateSmartFast } from '../../sync-smart-fast/migrate-smart-fast';

/**
 * Controlador para sincronización de Google Sheets usando Smart-Fast
 *
 * Sistema anterior deprecado - Ver SyncSmartUseCase.ts para detalles
 */
export class SyncController {
  constructor(
    private sheetsGateway: GoogleSheetsGateway
  ) {}

  /**
   * POST /api/sync/smart
   * Sincronización inteligente usando Smart-Fast (ID estable + UPSERT)
   */
  async syncSmart(req: Request, res: Response): Promise<void> {
    try {
      console.log('🚀 SyncController: Iniciando sincronización Smart-Fast...');

      const startTime = Date.now();
      const stats = await migrateSmartFast();
      const duration = Date.now() - startTime;

      console.log(`✅ SyncController: Sincronización Smart-Fast exitosa en ${(duration / 1000).toFixed(2)}s`);

      res.status(200).json({
        success: true,
        message: `Sincronización completada: ${stats.inserted} insertados, ${stats.updated} actualizados`,
        timestamp: new Date().toISOString(),
        leadsProcessed: stats.totalProcessed,
        duration: duration,
        durationFormatted: `${(duration / 1000).toFixed(2)}s`,
        stats: {
          totalProcessed: stats.totalProcessed,
          inserted: stats.inserted,
          updated: stats.updated,
          skipped: stats.skipped,
          errors: stats.errors
        },
        details: stats.details
      });
    } catch (error: any) {
      console.error('❌ SyncController: Error en sincronización Smart-Fast:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message,
        timestamp: new Date().toISOString(),
        leadsProcessed: 0,
        duration: 0,
        durationFormatted: '0s'
      });
    }
  }

  /**
   * GET /api/sync/sheets/available
   * Obtiene lista de sheets disponibles
   */
  async getAvailableSheets(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 SyncController: Obteniendo sheets disponibles...');
      
      const sheetNames = await this.sheetsGateway.getAvailableSheetNames();
      const result = {
        available: sheetNames,
        total: sheetNames.length,
        lastChecked: new Date().toISOString()
      };
      
      console.log(`✅ SyncController: Encontrados ${result.total} sheets disponibles`);
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error('❌ SyncController: Error obteniendo sheets disponibles:', error);
      res.status(500).json({
        available: [],
        total: 0,
        lastChecked: new Date().toISOString(),
        error: error.message
      });
    }
  }

  /**
   * GET /api/sync/status
   * Obtiene estado actual de sincronización
   */
  async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 SyncController: Obteniendo estado de sincronización...');
      
      // Obtener estado desde el repositorio (a implementar en PostgresSyncRepository)
      const status = {
        isRunning: false,
        lastSyncTime: null,
        uptime: null,
        currentOperation: null,
        progress: null
      };
      
      console.log('✅ SyncController: Estado de sincronización obtenido');
      
      res.status(200).json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ SyncController: Error obteniendo estado:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}