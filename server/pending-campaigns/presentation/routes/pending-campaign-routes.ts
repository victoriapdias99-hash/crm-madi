import { Router } from 'express';
import { PendingCampaignController } from '../controllers/PendingCampaignController';

/**
 * Rutas para el sistema de gestión de campañas pendientes
 * Expone endpoints para consultar, filtrar y actualizar campañas activas
 */
export function createPendingCampaignRoutes(): Router {
  const router = Router();
  const controller = new PendingCampaignController();

  console.log('🔄 Configurando rutas de campañas pendientes...');

  /**
   * GET /api/pending-campaigns
   * Obtiene todas las campañas pendientes con filtros opcionales
   *
   * Query Params:
   * - zona: string (opcional) - Filtrar por zona geográfica
   * - marca: string (opcional) - Filtrar por marca
   * - cliente: string (opcional) - Filtrar por nombre de cliente
   * - clienteNombre: string (opcional) - Alias para filtro de cliente
   * - fechaInicio: string (opcional) - Fecha inicio en formato YYYY-MM-DD
   * - fechaFin: string (opcional) - Fecha fin en formato YYYY-MM-DD
   * - showDuplicatesOnly: boolean (opcional) - Solo campañas con duplicados
   * - sortBy: 'fecha'|'cliente'|'marca' (opcional) - Criterio de ordenamiento
   * - sortOrder: 'asc'|'desc' (opcional) - Orden ascendente o descendente
   * - includeStats: 'true'|'false' (opcional) - Incluir estadísticas agregadas
   *
   * Response: PendingCampaignsResponseDto
   */
  router.get('/', async (req, res) => {
    await controller.getPendingCampaigns(req, res);
  });

  /**
   * GET /api/pending-campaigns/stats/summary
   * Obtiene estadísticas agregadas de campañas pendientes
   *
   * Query Params: (mismo que GET /)
   * Response: PendingCampaignStatsResponseDto
   */
  router.get('/stats/summary', async (req, res) => {
    await controller.getStatistics(req, res);
  });

  /**
   * GET /api/pending-campaigns/filters/options
   * Obtiene opciones disponibles para filtros (clientes, marcas, zonas)
   *
   * Response: FilterOptionsResponseDto
   */
  router.get('/filters/options', async (req, res) => {
    await controller.getFilterOptions(req, res);
  });

  /**
   * GET /api/pending-campaigns/:id
   * Obtiene una campaña pendiente específica por ID
   *
   * Params:
   * - id: number - ID de la campaña
   *
   * Response: SinglePendingCampaignResponseDto
   */
  router.get('/:id', async (req, res) => {
    await controller.getCampaignById(req, res);
  });

  /**
   * PUT /api/pending-campaigns/:id
   * Actualiza una campaña pendiente
   *
   * Params:
   * - id: number - ID de la campaña a actualizar
   *
   * Body: UpdatePendingCampaignRequestDto
   * - cpl?: number - Costo por lead
   * - pedidosPorDia?: number - Pedidos por día
   * - cantidadDatosSolicitados?: number - Cantidad de datos solicitados
   * - zona?: string - Zona geográfica
   * - marca?: string - Marca
   *
   * Response: UpdatePendingCampaignResponseDto
   */
  router.put('/:id', async (req, res) => {
    await controller.updateCampaign(req, res);
  });

  console.log('✅ Rutas de campañas pendientes configuradas:');
  console.log('   GET    /api/pending-campaigns');
  console.log('   GET    /api/pending-campaigns/stats/summary');
  console.log('   GET    /api/pending-campaigns/filters/options');
  console.log('   GET    /api/pending-campaigns/:id');
  console.log('   PUT    /api/pending-campaigns/:id');

  return router;
}

/**
 * Middleware de logging para las rutas de campañas pendientes
 */
export function pendingCampaignLoggingMiddleware(req: any, res: any, next: any) {
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
