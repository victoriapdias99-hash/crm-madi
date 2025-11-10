import { Request, Response } from 'express';
import { FinishedCampaignFactory } from '../../infrastructure/factories/FinishedCampaignFactory';
import { FinishedCampaignFilters } from '../../domain/entities/FinishedCampaign';

/**
 * Controlador REST para campañas finalizadas
 * Maneja las peticiones HTTP y delega la lógica a los casos de uso
 */
export class FinishedCampaignController {
  /**
   * GET /api/finished-campaigns
   * Obtiene todas las campañas finalizadas con filtros opcionales
   * NUEVO: Enriquece los datos con métricas calculadas desde op_leads_rep
   */
  async getFinishedCampaigns(req: Request, res: Response): Promise<void> {
    try {
      console.log('📥 [FinishedCampaignController] GET /api/finished-campaigns');
      console.log('📋 Query params:', req.query);

      // Construir filtros desde query params
      const filters: FinishedCampaignFilters = {};

      if (req.query.zona) filters.zona = req.query.zona as string;
      if (req.query.marca) filters.marca = req.query.marca as string;
      if (req.query.cliente) filters.cliente = req.query.cliente as string;
      if (req.query.clienteNombre) filters.clienteNombre = req.query.clienteNombre as string;
      if (req.query.fechaInicio) filters.fechaInicio = req.query.fechaInicio as string;
      if (req.query.fechaFin) filters.fechaFin = req.query.fechaFin as string;
      if (req.query.fechaCierreInicio) filters.fechaCierreInicio = req.query.fechaCierreInicio as string;
      if (req.query.fechaCierreFin) filters.fechaCierreFin = req.query.fechaCierreFin as string;
      if (req.query.showDuplicatesOnly) filters.showDuplicatesOnly = req.query.showDuplicatesOnly === 'true';
      if (req.query.sortBy) filters.sortBy = req.query.sortBy as any;
      if (req.query.sortOrder) filters.sortOrder = req.query.sortOrder as any;

      const includeStats = req.query.includeStats === 'true';

      // Ejecutar caso de uso
      const useCase = FinishedCampaignFactory.createGetFinishedCampaignsUseCase();
      const result = await useCase.execute(filters, includeStats);

      // 🔥 NUEVO: Enriquecer campañas con datos reales desde op_leads_rep
      console.log('🔄 [FinishedCampaignController] Enriqueciendo campañas con datos de leads...');
      const enrichmentService = FinishedCampaignFactory.getEnrichmentService();

      // Obtener todos los clientes necesarios
      const { storage } = await import('../../../storage');
      const clienteIds = [...new Set(result.campaigns.map(c => c.clienteId))];
      const clientesMap = new Map();

      for (const clienteId of clienteIds) {
        const cliente = await storage.getCliente(clienteId);
        if (cliente) {
          clientesMap.set(clienteId, cliente);
        }
      }

      // Obtener todas las campañas comerciales para contexto de cálculo
      const campanasComerciales = await storage.getAllCampanasComerciales();

      // Enriquecer todas las campañas en paralelo
      const enrichedCampaigns = await enrichmentService.enrichCampaigns(
        result.campaigns,
        clientesMap,
        campanasComerciales
      );

      console.log(`✅ [FinishedCampaignController] ${enrichedCampaigns.length} campañas enriquecidas`);

      res.json({
        success: true,
        data: enrichedCampaigns,
        count: enrichedCampaigns.length,
        stats: result.stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [FinishedCampaignController] Error en getFinishedCampaigns:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/finished-campaigns/stats
   * Obtiene estadísticas agregadas de campañas finalizadas
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      console.log('📊 [FinishedCampaignController] GET /api/finished-campaigns/stats');

      // Construir filtros desde query params
      const filters: FinishedCampaignFilters = {};
      if (req.query.zona) filters.zona = req.query.zona as string;
      if (req.query.marca) filters.marca = req.query.marca as string;
      if (req.query.cliente) filters.cliente = req.query.cliente as string;

      // Ejecutar caso de uso
      const useCase = FinishedCampaignFactory.createGetFinishedCampaignStatsUseCase();
      const stats = await useCase.execute(filters);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [FinishedCampaignController] Error en getStatistics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/finished-campaigns/filters/options
   * Obtiene opciones disponibles para filtros
   */
  async getFilterOptions(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔧 [FinishedCampaignController] GET /api/finished-campaigns/filters/options');

      const repository = FinishedCampaignFactory.getRepository();

      const [clientes, marcas, zonas] = await Promise.all([
        repository.getClientsWithFinishedCampaigns(),
        repository.getBrandsWithFinishedCampaigns(),
        repository.getZonesWithFinishedCampaigns()
      ]);

      res.json({
        success: true,
        data: {
          clientes,
          marcas,
          zonas
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [FinishedCampaignController] Error en getFilterOptions:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/finished-campaigns/:id
   * Obtiene una campaña finalizada específica
   */
  async getCampaignById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      console.log(`🔍 [FinishedCampaignController] GET /api/finished-campaigns/${id}`);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'ID de campaña inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Ejecutar caso de uso
      const useCase = FinishedCampaignFactory.createGetFinishedCampaignByIdUseCase();
      const campaign = await useCase.execute(id);

      if (!campaign) {
        res.status(404).json({
          success: false,
          error: 'Campaña no encontrada',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        data: campaign,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [FinishedCampaignController] Error en getCampaignById:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/finished-campaigns/:id/can-reopen
   * Verifica si una campaña puede ser reabierta
   */
  async canReopenCampaign(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      console.log(`🔍 [FinishedCampaignController] GET /api/finished-campaigns/${id}/can-reopen`);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'ID de campaña inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validar si se puede reabrir
      const service = FinishedCampaignFactory.getService();
      const validation = await service.canReopen(id);

      res.json({
        success: true,
        data: {
          canReopen: validation.canReopen,
          reason: validation.reason || 'La campaña puede ser reabierta'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [FinishedCampaignController] Error en canReopenCampaign:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * POST /api/finished-campaigns/:id/reopen
   * Reabre una campaña finalizada
   */
  async reopenCampaign(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      console.log(`🔄 [FinishedCampaignController] POST /api/finished-campaigns/${id}/reopen`);

      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'ID de campaña inválido',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validar si se puede reabrir
      const service = FinishedCampaignFactory.getService();
      const validation = await service.canReopen(id);

      if (!validation.canReopen) {
        res.status(400).json({
          success: false,
          error: validation.reason,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Ejecutar caso de uso
      const useCase = FinishedCampaignFactory.createReopenFinishedCampaignUseCase();
      const result = await useCase.execute(id);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.message,
          errors: result.errors,
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        campaignId: id,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ [FinishedCampaignController] Error en reopenCampaign:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}
