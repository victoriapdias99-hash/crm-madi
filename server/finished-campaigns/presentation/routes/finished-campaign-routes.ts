import { Router } from 'express';
import { FinishedCampaignController } from '../controllers/FinishedCampaignController';

/**
 * Rutas para el sistema de gestión de campañas finalizadas
 * Expone endpoints para consultar, filtrar y reabrir campañas cerradas
 */
export function createFinishedCampaignRoutes(): Router {
  const router = Router();
  const controller = new FinishedCampaignController();

  console.log('🔄 Configurando rutas de campañas finalizadas...');

  /**
   * GET /api/finished-campaigns
   * Obtiene todas las campañas finalizadas con filtros opcionales
   *
   * Query Params:
   * - zona: string (opcional) - Filtrar por zona geográfica
   * - marca: string (opcional) - Filtrar por marca
   * - cliente: string (opcional) - Filtrar por nombre de cliente
   * - clienteNombre: string (opcional) - Alias para filtro de cliente
   * - fechaInicio: string (opcional) - Fecha inicio campaña en formato YYYY-MM-DD
   * - fechaFin: string (opcional) - Fecha fin campaña en formato YYYY-MM-DD
   * - fechaCierreInicio: string (opcional) - Fecha inicio cierre en formato YYYY-MM-DD
   * - fechaCierreFin: string (opcional) - Fecha fin cierre en formato YYYY-MM-DD
   * - showDuplicatesOnly: boolean (opcional) - Solo campañas con duplicados
   * - sortBy: 'fecha'|'fechaCierre'|'cliente'|'marca' (opcional) - Criterio de ordenamiento
   * - sortOrder: 'asc'|'desc' (opcional) - Orden ascendente o descendente
   * - includeStats: 'true'|'false' (opcional) - Incluir estadísticas agregadas
   *
   * Response: FinishedCampaignsResponseDto
   */
  router.get('/', async (req, res) => {
    await controller.getFinishedCampaigns(req, res);
  });

  /**
   * GET /api/finished-campaigns/stats
   * Obtiene estadísticas agregadas de campañas finalizadas
   *
   * Query Params: (mismo que GET /)
   * Response: FinishedCampaignStatsResponseDto
   */
  router.get('/stats', async (req, res) => {
    await controller.getStatistics(req, res);
  });

  /**
   * GET /api/finished-campaigns/filters/options
   * Obtiene opciones disponibles para filtros (clientes, marcas, zonas)
   *
   * Response: FilterOptionsResponseDto
   */
  router.get('/filters/options', async (req, res) => {
    await controller.getFilterOptions(req, res);
  });

  /**
   * GET /api/finished-campaigns/:id
   * Obtiene una campaña finalizada específica por ID
   *
   * Params:
   * - id: number - ID de la campaña
   *
   * Response: SingleFinishedCampaignResponseDto
   */
  router.get('/:id', async (req, res) => {
    await controller.getCampaignById(req, res);
  });

  /**
   * GET /api/finished-campaigns/:id/can-reopen
   * Verifica si una campaña puede ser reabierta
   *
   * Params:
   * - id: number - ID de la campaña
   *
   * Response: { success: boolean, data: { canReopen: boolean, reason: string } }
   */
  router.get('/:id/can-reopen', async (req, res) => {
    await controller.canReopenCampaign(req, res);
  });

  /**
   * POST /api/finished-campaigns/:id/reopen
   * Reabre una campaña finalizada
   *
   * Params:
   * - id: number - ID de la campaña a reabrir
   *
   * Response: ReopenFinishedCampaignResponseDto
   */
  router.post('/:id/reopen', async (req, res) => {
    await controller.reopenCampaign(req, res);
  });

  console.log('✅ Rutas de campañas finalizadas configuradas:');
  console.log('   GET    /api/finished-campaigns');
  console.log('   GET    /api/finished-campaigns/stats');
  console.log('   GET    /api/finished-campaigns/filters/options');
  console.log('   GET    /api/finished-campaigns/:id');
  console.log('   GET    /api/finished-campaigns/:id/can-reopen');
  console.log('   POST   /api/finished-campaigns/:id/reopen');

  return router;
}

/**
 * Middleware de logging para las rutas de campañas finalizadas
 */
export function finishedCampaignLoggingMiddleware(req: any, res: any, next: any) {
  const timestamp = new Date().toISOString();
  console.log(`🔧 [${timestamp}] ${req.method} ${req.originalUrl}`);

  if (Object.keys(req.query).length > 0) {
    console.log(`📋 Query params:`, req.query);
  }

  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`📋 Request body:`, req.body);
  }

  next();
}
