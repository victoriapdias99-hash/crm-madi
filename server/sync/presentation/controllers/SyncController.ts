import { Request, Response } from 'express';
import { SyncSmartUseCase } from '../../application/usecases/SyncSmartUseCase';
import { mapSyncRequestToOptions, SyncRequestDto } from '../../application/dto/SyncOptions';
import { mapSyncResultToResponse } from '../../application/dto/SyncResultDto';
import { GoogleSheetsGateway } from '../../infrastructure/gateways/GoogleSheetsGateway';

/**
 * Controlador simplificado para sincronización inteligente de Google Sheets
 */
export class SyncController {
  constructor(
    private syncSmartUseCase: SyncSmartUseCase,
    private sheetsGateway: GoogleSheetsGateway
  ) {}

  /**
   * POST /api/sync/smart
   * Sincronización inteligente que analiza y sincroniza automáticamente
   */
  async syncSmart(req: Request, res: Response): Promise<void> {
    try {
      const requestDto: SyncRequestDto = req.body;
      const options = mapSyncRequestToOptions(requestDto);
      
      console.log('🧠 SyncController: Iniciando sincronización inteligente...', options);
      
      const result = await this.syncSmartUseCase.execute(options);
      const response = mapSyncResultToResponse(result);
      
      console.log(`${result.success ? '✅' : '❌'} SyncController: Sincronización inteligente ${result.success ? 'exitosa' : 'fallida'}`);
      
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('❌ SyncController: Error en sincronización inteligente:', error);
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