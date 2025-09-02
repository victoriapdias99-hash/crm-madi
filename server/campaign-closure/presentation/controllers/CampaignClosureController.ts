import { Request, Response } from 'express';
import { ClosureFactory } from '../../infrastructure/factories/ClosureFactory';
import { 
  ClosureRequestDto, 
  ClosureResponseDto, 
  mapClosureRequestToOptions, 
  mapClosureResultToResponse 
} from '../../application/dto/ClosureOptions';

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
      console.log('🚀 === INICIANDO CIERRE MANUAL DE CAMPAÑAS ===');
      console.log('📋 Request params:', req.query);
      console.log('📋 Request body:', req.body);

      // Convertir query params y body a DTO
      const requestDto: ClosureRequestDto = {
        ...req.query as any,
        ...req.body
      };

      console.log('📋 Closure request DTO:', requestDto);

      // Mapear a opciones del dominio
      const options = mapClosureRequestToOptions(requestDto);
      console.log('⚙️ Closure options:', options);

      // Obtener el use case y ejecutar
      const useCase = this.closureFactory.getCampaignClosureUseCase();
      const result = await useCase.execute(options);

      console.log('📊 Resultado del cierre:', {
        success: result.success,
        campaignsProcessed: result.campaignsProcessed,
        campaignsClosed: result.campaignsClosed,
        leadsAssigned: result.leadsAssigned,
        duration: `${Math.round(result.duration / 1000)}s`
      });

      // Mapear resultado a response DTO
      const response: ClosureResponseDto = mapClosureResultToResponse(result);

      res.status(200).json(response);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('❌ Error en cierre de campañas:', error);

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
      console.error('❌ Error getting closure status:', error);
      res.status(500).json({
        systemStatus: 'error',
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
      console.error('❌ Error getting pending campaigns:', error);
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
      console.error('❌ Error getting clients with pending campaigns:', error);
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
      console.log('🔍 === VALIDANDO CIERRE DE CAMPAÑAS ===');

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
      console.error('❌ Error en validación:', error);
      res.status(500).json({
        success: false,
        message: `Error en la validación: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}