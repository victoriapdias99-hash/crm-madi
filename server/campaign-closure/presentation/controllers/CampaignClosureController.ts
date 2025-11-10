import { Request, Response } from 'express';
import { ClosureFactory } from '../../infrastructure/factories/ClosureFactory';
import { 
  ClosureRequestDto, 
  ClosureResponseDto, 
  mapClosureRequestToOptions, 
  mapClosureResultToResponse 
} from '../../application/dto/ClosureOptions';
import { realtimeSync } from '../../../realtime-sync';

/**
 * Controlador para el cierre manual de campañas
 * Maneja las requests HTTP y coordina con el Use Case
 */
export class CampaignClosureController {
  private closureFactory: ClosureFactory;

  constructor() {
    this.closureFactory = ClosureFactory.getInstance();
  }

  /**
   * POST /api/campaign-closure/execute
   * Ejecuta el proceso de cierre de campañas
   */
  public async executeClosure(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 [${requestId}] INICIO - Campaign closure request iniciada`);
    console.log(`📋 [${requestId}] Request details:`, {
      method: req.method,
      url: req.url,
      query: req.query,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      }
    });

    try {
      console.log(`⚙️ [${requestId}] PASO 1 - Procesando parámetros de entrada`);

      // Convertir query params y body a DTO
      const requestDto: ClosureRequestDto = {
        ...req.query as any,
        ...req.body
      };

      console.log(`📊 [${requestId}] DTO creado:`, requestDto);

      // Mapear a opciones del dominio
      const options = mapClosureRequestToOptions(requestDto);
      console.log(`🔧 [${requestId}] PASO 2 - Opciones mapeadas:`, options);

      // Obtener el use case y ejecutar
      console.log(`🏭 [${requestId}] PASO 3 - Obteniendo use case del factory`);
      const useCase = this.closureFactory.getCampaignClosureUseCase();

      console.log(`⏱️ [${requestId}] PASO 4 - Ejecutando use case (tiempo transcurrido: ${Date.now() - startTime}ms)`);
      const result = await useCase.execute(options);
      console.log(`✅ [${requestId}] PASO 5 - Use case completado exitosamente (tiempo: ${Date.now() - startTime}ms)`);


      console.log(`🔄 [${requestId}] PASO 6 - Mapeando resultado a response DTO`);
      // Mapear resultado a response DTO
      const response: ClosureResponseDto = mapClosureResultToResponse(result);
      console.log(`📊 [${requestId}] Response DTO creado:`, {
        success: response.success,
        campaignsProcessed: response.campaignsProcessed,
        campaignsClosed: response.campaignsClosed,
        leadsAssigned: response.leadsAssigned,
        duration: response.duration
      });

      // Si el cierre fue exitoso, emitir evento de actualización del dashboard
      if (result.success && result.campaignsClosed > 0) {
        console.log(`📡 [${requestId}] PASO 7 - Emitiendo eventos WebSocket (${result.campaignsClosed} campañas cerradas)`);

        try {
          // Invalidar caché de campañas pendientes
          console.log(`🗑️ [${requestId}] Invalidando caché de campañas pendientes`);
          // Importar y resetear el caché directamente
          const routesModule = await import('../../../routes');
          if (routesModule.invalidateCampanasCache) {
            routesModule.invalidateCampanasCache();
          }

          // Emitir evento de refresco del dashboard a todos los clientes conectados
          console.log(`📢 [${requestId}] Broadcasting dashboard refresh`);
          realtimeSync.broadcastDashboardRefresh();

          // Emitir eventos específicos por cada campaña cerrada
          if (result.closedCampaigns) {
            console.log(`📢 [${requestId}] Broadcasting ${result.closedCampaigns.length} campaign updates`);
            result.closedCampaigns.forEach((campaign, index) => {
              console.log(`📢 [${requestId}] Broadcasting campaign ${index + 1}/${result.closedCampaigns!.length}: ${campaign.campaignId}`);
              realtimeSync.broadcastCampaignUpdate('updated', campaign.campaignId);
            });
          }
          console.log(`✅ [${requestId}] PASO 7 - Eventos WebSocket enviados exitosamente`);
        } catch (wsError: any) {
          console.error(`❌ [${requestId}] ERROR en notificaciones WebSocket:`, {
            error: wsError.message,
            stack: wsError.stack,
            campaignsClosed: result.campaignsClosed,
            timestamp: new Date().toISOString()
          });
          // No fallar la request por errores de WebSocket
        }
      } else {
        console.log(`ℹ️ [${requestId}] No se emiten eventos WebSocket (success: ${result.success}, closed: ${result.campaignsClosed})`);
      }

      console.log(`🎉 [${requestId}] PASO 8 - Enviando respuesta exitosa (tiempo total: ${Date.now() - startTime}ms)`);
      res.status(200).json(response);

    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`💥 [${requestId}] ERROR CRÍTICO en campaign closure:`, {
        errorMessage: error.message || 'Sin mensaje',
        errorName: error.name || 'Sin nombre',
        errorCode: error.code || 'Sin código',
        errorStack: error.stack || 'Sin stack trace',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        requestDetails: {
          method: req.method,
          url: req.url,
          query: req.query,
          body: req.body
        },
        systemState: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      });

      // Log específicos por tipo de error
      if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
        console.error(`⏱️ [${requestId}] TIMEOUT ERROR detectado después de ${duration}ms`);
      }
      if (error.message?.includes('database') || error.message?.includes('sql') || error.message?.includes('connection')) {
        console.error(`🗄️ [${requestId}] DATABASE ERROR detectado`);
      }
      if (error.message?.includes('websocket') || error.message?.includes('broadcast')) {
        console.error(`📡 [${requestId}] WEBSOCKET ERROR detectado`);
      }

      const errorResponse: ClosureResponseDto = {
        success: false,
        message: `Error en el procesamiento: ${error.message}`,
        campaignsProcessed: 0,
        campaignsClosed: 0,
        leadsAssigned: 0,
        timestamp: new Date().toISOString(),
        duration,
        durationFormatted: `${Math.round(duration / 1000)}s`,
        error: error.message
      };

      console.error(`📤 [${requestId}] Enviando respuesta de error 500 (duración final: ${duration}ms)`);
      res.status(500).json(errorResponse);
    }
  }

  /**
   * GET /api/campaign-closure/status
   * Obtiene el estado del sistema de cierre
   */
  public async getClosureStatus(req: Request, res: Response): Promise<void> {
    try {
      const factoryStatus = this.closureFactory.getStatus();
      
      const status = {
        systemStatus: 'active',
        factoryInitialized: factoryStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      res.status(200).json(status);

    } catch (error: any) {
      res.status(500).json({
        systemStatus: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/campaign-closure/processing-status
   * Obtiene campañas que están siendo procesadas actualmente
   */
  public async getProcessingStatus(req: Request, res: Response): Promise<void> {
    try {
      // Obtener las campañas que están siendo procesadas desde el ProgressManager
      const processor = this.closureFactory.getCampaignProcessor();
      const processingCampaigns = processor.getProcessingCampaigns();
      
      res.status(200).json({
        success: true,
        processingCampaigns,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/campaign-closure/pending-campaigns
   * Obtiene las campañas pendientes de cierre
   */
  public async getPendingCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const campaignRepo = this.closureFactory.getCampaignRepository();
      const pendingCampaigns = await campaignRepo.getPendingCampaigns();

      const response = {
        success: true,
        count: pendingCampaigns.length,
        campaigns: pendingCampaigns,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/campaign-closure/clients
   * Obtiene los clientes con campañas pendientes
   */
  public async getClientsWithPendingCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const campaignRepo = this.closureFactory.getCampaignRepository();
      const clients = await campaignRepo.getClientsWithPendingCampaigns();

      const response = {
        success: true,
        count: clients.length,
        clients,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/campaign-closure/validate
   * Valida el proceso sin ejecutar cambios
   */
  public async validateClosure(req: Request, res: Response): Promise<void> {
    try {

      const requestDto: ClosureRequestDto = {
        ...req.query as any,
        ...req.body,
        validateOnly: 'true'
      };

      const options = mapClosureRequestToOptions(requestDto);
      
      const useCase = this.closureFactory.getCampaignClosureUseCase();
      const result = await useCase.execute(options);

      const response: ClosureResponseDto = mapClosureResultToResponse(result);

      res.status(200).json(response);

    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: `Error en la validación: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}