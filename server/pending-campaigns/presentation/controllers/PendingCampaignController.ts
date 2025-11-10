import { Request, Response } from 'express';
import { PendingCampaignFactory } from '../../infrastructure/factories/PendingCampaignFactory';
import {
  GetPendingCampaignsRequestDto,
  mapRequestToFilters,
  mapCampaignsToResponse,
  mapCampaignToResponse,
  mapStatsToResponse
} from '../../application/dto/PendingCampaignDto';

/**
 * Controlador para gestión de campañas pendientes
 * Maneja requests HTTP y coordina con los Use Cases
 */
export class PendingCampaignController {
  private factory: PendingCampaignFactory;

  constructor() {
    this.factory = PendingCampaignFactory.getInstance();
  }

  /**
   * GET /api/pending-campaigns
   * Obtiene todas las campañas pendientes con filtros opcionales
   */
  async getPendingCampaigns(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 [${requestId}] GET /api/pending-campaigns - Iniciando request`);
    console.log(`📋 [${requestId}] Query params:`, req.query);

    try {
      // Convertir query params a DTO
      const requestDto: GetPendingCampaignsRequestDto = req.query as any;

      // Mapear a filtros de dominio
      const filters = mapRequestToFilters(requestDto);
      console.log(`🔧 [${requestId}] Filtros mapeados:`, filters);

      // Ejecutar use case
      const useCase = this.factory.getGetPendingCampaignsUseCase();
      const campaigns = await useCase.execute(filters);

      // Obtener estadísticas si se solicita
      let stats;
      if (req.query.includeStats === 'true') {
        const statsUseCase = this.factory.getGetPendingCampaignStatsUseCase();
        stats = await statsUseCase.execute(filters);
      }

      // Mapear a response DTO
      const response = mapCampaignsToResponse(campaigns, filters, stats);

      const duration = Date.now() - startTime;
      console.log(`✅ [${requestId}] Request completada en ${duration}ms`);
      console.log(`📊 [${requestId}] Retornando ${campaigns.length} campañas`);

      res.json(response);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${requestId}] Error en request (${duration}ms):`, error);

      res.status(500).json({
        success: false,
        error: error.message || 'Error al obtener campañas pendientes',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/pending-campaigns/:id
   * Obtiene una campaña pendiente específica por ID
   */
  async getCampaignById(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id);
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 [${requestId}] GET /api/pending-campaigns/${id}`);

    try {
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'ID de campaña inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const useCase = this.factory.getGetPendingCampaignByIdUseCase();
      const campaign = await useCase.execute(id);

      const response = mapCampaignToResponse(campaign);

      if (!campaign) {
        res.status(404).json(response);
        return;
      }

      console.log(`✅ [${requestId}] Campaña encontrada: ${campaign.clienteNombre}`);
      res.json(response);
    } catch (error: any) {
      console.error(`❌ [${requestId}] Error:`, error);

      res.status(500).json({
        success: false,
        error: error.message || 'Error al obtener campaña',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/pending-campaigns/stats/summary
   * Obtiene estadísticas agregadas de campañas pendientes
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 [${requestId}] GET /api/pending-campaigns/stats/summary`);

    try {
      const requestDto: GetPendingCampaignsRequestDto = req.query as any;
      const filters = mapRequestToFilters(requestDto);

      const useCase = this.factory.getGetPendingCampaignStatsUseCase();
      const stats = await useCase.execute(filters);

      const countUseCase = this.factory.getGetPendingCampaignsUseCase();
      const campaigns = await countUseCase.execute(filters);
      const totalCampaigns = campaigns.length;

      const response = mapStatsToResponse(stats, totalCampaigns, filters);

      console.log(`✅ [${requestId}] Estadísticas calculadas:`, {
        totalCampaigns: stats.totalCampaigns,
        totalInvestment: stats.totalInvestment
      });

      res.json(response);
    } catch (error: any) {
      console.error(`❌ [${requestId}] Error:`, error);

      res.status(500).json({
        success: false,
        error: error.message || 'Error al calcular estadísticas',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * PUT /api/pending-campaigns/:id
   * Actualiza una campaña pendiente
   */
  async updateCampaign(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id);
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 [${requestId}] PUT /api/pending-campaigns/${id}`);
    console.log(`📋 [${requestId}] Body:`, req.body);

    try {
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'ID de campaña inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Verificar que la campaña existe
      const repository = this.factory.getRepository();
      const exists = await repository.exists(id);

      if (!exists) {
        res.status(404).json({
          success: false,
          error: 'Campaña no encontrada',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Actualizar
      await repository.update(id, req.body);

      // Obtener campaña actualizada
      const campaign = await repository.findById(id);

      console.log(`✅ [${requestId}] Campaña ${id} actualizada exitosamente`);

      res.json({
        success: true,
        campaign,
        message: 'Campaña actualizada exitosamente',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Error:`, error);

      res.status(500).json({
        success: false,
        error: error.message || 'Error al actualizar campaña',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/pending-campaigns/filters/options
   * Obtiene opciones disponibles para filtros (clientes, marcas, zonas)
   */
  async getFilterOptions(req: Request, res: Response): Promise<void> {
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🚀 [${requestId}] GET /api/pending-campaigns/filters/options`);

    try {
      const repository = this.factory.getRepository();

      const [clientes, marcas, zonas] = await Promise.all([
        repository.getClientsWithPendingCampaigns(),
        repository.getBrandsWithPendingCampaigns(),
        repository.getZonesWithPendingCampaigns()
      ]);

      console.log(`✅ [${requestId}] Opciones de filtros:`, {
        clientes: clientes.length,
        marcas: marcas.length,
        zonas: zonas.length
      });

      res.json({
        success: true,
        clientes,
        marcas,
        zonas,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`❌ [${requestId}] Error:`, error);

      res.status(500).json({
        success: false,
        error: error.message || 'Error al obtener opciones de filtros',
        timestamp: new Date().toISOString()
      });
    }
  }
}
