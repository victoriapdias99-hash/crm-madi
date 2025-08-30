import { Request, Response } from 'express';
import { SyncFullUseCase } from '../../application/usecases/SyncFullUseCase';
import { SyncIncrementalUseCase } from '../../application/usecases/SyncIncrementalUseCase';
import { SyncSpecificSheetsUseCase } from '../../application/usecases/SyncSpecificSheetsUseCase';
import { SyncSmartUseCase } from '../../application/usecases/SyncSmartUseCase';
import { mapSyncRequestToOptions, SyncRequestDto } from '../../application/dto/SyncOptions';
import { mapSyncResultToResponse } from '../../application/dto/SyncResultDto';

/**
 * Controlador para endpoints de sincronización
 * Orquesta las operaciones de sync usando los casos de uso
 */
export class SyncController {
  constructor(
    private syncFullUseCase: SyncFullUseCase,
    private syncIncrementalUseCase: SyncIncrementalUseCase,
    private syncSpecificSheetsUseCase: SyncSpecificSheetsUseCase,
    private syncSmartUseCase: SyncSmartUseCase
  ) {}

  /**
   * POST /api/sync/full
   * Sincronización completa de todos los datos
   */
  async syncFull(req: Request, res: Response): Promise<void> {
    try {
      const requestDto: SyncRequestDto = req.body;
      const options = mapSyncRequestToOptions(requestDto);
      
      console.log('🔄 SyncController: Iniciando sincronización completa...', options);
      
      const result = await this.syncFullUseCase.execute(options);
      const response = mapSyncResultToResponse(result);
      
      console.log(`${result.success ? '✅' : '❌'} SyncController: Sincronización completa ${result.success ? 'exitosa' : 'fallida'}`);
      
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('❌ SyncController: Error en sincronización completa:', error);
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
   * POST /api/sync/incremental
   * Sincronización incremental desde última actualización
   */
  async syncIncremental(req: Request, res: Response): Promise<void> {
    try {
      const requestDto: SyncRequestDto = req.body;
      const options = mapSyncRequestToOptions(requestDto);
      
      console.log('🔄 SyncController: Iniciando sincronización incremental...', options);
      
      const result = await this.syncIncrementalUseCase.execute(options);
      const response = mapSyncResultToResponse(result);
      
      console.log(`${result.success ? '✅' : '❌'} SyncController: Sincronización incremental ${result.success ? 'exitosa' : 'fallida'}`);
      
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('❌ SyncController: Error en sincronización incremental:', error);
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
   * POST /api/sync/smart
   * Sincronización inteligente que continúa desde donde se quedó cada marca
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
   * POST /api/sync/sheets/:sheetNames
   * Sincronización de sheets específicos
   */
  async syncSpecificSheets(req: Request, res: Response): Promise<void> {
    try {
      const sheetNamesParam = req.params.sheetNames;
      const sheetNames = sheetNamesParam.split(',').map(name => name.trim());
      
      const requestDto: SyncRequestDto = req.body;
      const options = mapSyncRequestToOptions(requestDto);
      
      console.log(`🔄 SyncController: Iniciando sincronización de sheets específicos: ${sheetNames.join(', ')}`);
      
      const result = await this.syncSpecificSheetsUseCase.execute(sheetNames, options);
      const response = mapSyncResultToResponse(result);
      
      console.log(`${result.success ? '✅' : '❌'} SyncController: Sincronización de sheets ${result.success ? 'exitosa' : 'fallida'}`);
      
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('❌ SyncController: Error en sincronización de sheets específicos:', error);
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
      
      const result = await this.syncSpecificSheetsUseCase.getAvailableSheets();
      
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
   * POST /api/sync/sheets/validate
   * Valida que los sheets especificados existen
   */
  async validateSheets(req: Request, res: Response): Promise<void> {
    try {
      const { sheetNames } = req.body;
      
      if (!Array.isArray(sheetNames)) {
        res.status(400).json({
          valid: [],
          invalid: [],
          available: [],
          error: 'sheetNames debe ser un array'
        });
        return;
      }
      
      console.log(`🔍 SyncController: Validando sheets: ${sheetNames.join(', ')}`);
      
      const result = await this.syncSpecificSheetsUseCase.validateSheets(sheetNames);
      
      console.log(`✅ SyncController: Validación completada - ${result.valid.length} válidos, ${result.invalid.length} inválidos`);
      
      res.status(200).json(result);
    } catch (error: any) {
      console.error('❌ SyncController: Error validando sheets:', error);
      res.status(500).json({
        valid: [],
        invalid: [],
        available: [],
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