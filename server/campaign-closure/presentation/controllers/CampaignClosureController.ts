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
    
    try {

      // Convertir query params y body a DTO
      const requestDto: ClosureRequestDto = {
        ...req.query as any,
        ...req.body
      };


      // Mapear a opciones del dominio
      const options = mapClosureRequestToOptions(requestDto);

      // Obtener el use case y ejecutar
      const useCase = this.closureFactory.getCampaignClosureUseCase();
      const result = await useCase.execute(options);


      // Mapear resultado a response DTO
      const response: ClosureResponseDto = mapClosureResultToResponse(result);

      // Si el cierre fue exitoso, emitir evento de actualización del dashboard
      if (result.success && result.campaignsClosed > 0) {
        console.log('🔄 Emitiendo evento de actualización del dashboard tras cierre exitoso');
        
        // Emitir evento de refresco del dashboard a todos los clientes conectados
        realtimeSync.broadcastDashboardRefresh();
        
        // Emitir eventos específicos por cada campaña cerrada
        if (result.closedCampaigns) {
          result.closedCampaigns.forEach(campaign => {
            realtimeSync.broadcastCampaignUpdate('updated', campaign.campaignId);
          });
        }
      }

      res.status(200).json(response);

    } catch (error: any) {
      const duration = Date.now() - startTime;

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