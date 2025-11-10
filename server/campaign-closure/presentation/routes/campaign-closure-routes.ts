import { Router } from 'express';
import { CampaignClosureController } from '../controllers/CampaignClosureController';
import { MultiBrandCampaignClosureController } from '../controllers/MultiBrandCampaignClosureController';
import { CampaignReopenController } from '../controllers/CampaignReopenController';
import { CampaignAvailabilityController } from '../controllers/CampaignAvailabilityController';
import { debugCampaignData } from '../../../debug-campaign-data';

/**
 * Rutas para el sistema de cierre manual de campañas
 * Expone endpoints para ejecutar, validar y monitorear el cierre de campañas
 */
export function createCampaignClosureRoutes(): Router {
  const router = Router();
  const controller = new CampaignClosureController();
  const multiBrandController = new MultiBrandCampaignClosureController();
  const reopenController = new CampaignReopenController();
  const availabilityController = new CampaignAvailabilityController();

  console.log('🔄 Configurando rutas de cierre de campañas...');

  /**
   * POST /api/campaign-closure/execute
   * Ejecuta el proceso de cierre de campañas
   * 
   * Query Params:
   * - clients: string (opcional) - Lista de clientes separados por coma
   * - brands: string (opcional) - Lista de marcas separadas por coma  
   * - dryRun: 'true'|'false' (opcional) - Solo simular sin ejecutar
   * 
   * Response: ClosureResponseDto
   */
  router.post('/execute', async (req, res) => {
    await controller.executeClosure(req, res);
  });

  /**
   * POST /api/campaign-closure/validate
   * Valida el proceso sin ejecutar cambios reales
   * 
   * Query Params: (mismo que execute)
   * Response: ClosureResponseDto con validationErrors
   */
  router.post('/validate', async (req, res) => {
    await controller.validateClosure(req, res);
  });

  /**
   * GET /api/campaign-closure/status
   * Obtiene el estado del sistema de cierre
   * 
   * Response: SystemStatus
   */
  router.get('/status', async (req, res) => {
    await controller.getClosureStatus(req, res);
  });

  /**
   * GET /api/campaign-closure/pending-campaigns  
   * Obtiene todas las campañas pendientes de cierre
   * 
   * Response: { success: boolean, count: number, campaigns: CampaignClosure[] }
   */
  router.get('/pending-campaigns', async (req, res) => {
    await controller.getPendingCampaigns(req, res);
  });

  /**
   * GET /api/campaign-closure/clients
   * Obtiene los clientes con campañas pendientes
   * 
   * Response: { success: boolean, count: number, clients: string[] }
   */
  router.get('/clients', async (req, res) => {
    await controller.getClientsWithPendingCampaigns(req, res);
  });

  /**
   * GET /api/campaign-closure/processing-status
   * Obtiene las campañas que están siendo procesadas actualmente
   * 
   * Response: { success: boolean, processingCampaigns: Record<string, {...}> }
   */
  router.get('/processing-status', async (req, res) => {
    await controller.getProcessingStatus(req, res);
  });

  /**
   * POST /api/campaign-closure/multi-brand/execute/:id
   * Cierra una campaña específica con distribución multi-marca
   *
   * Params:
   * - id: number - ID de la campaña a cerrar
   *
   * Body:
   * - clientName: string - Nombre del cliente
   *
   * Response: MultiBrandClosureResult
   */
  router.post('/multi-brand/execute/:id', async (req, res) => {
    await multiBrandController.executeMultiBrandClosure(req, res);
  });

  /**
   * GET /api/campaign-closure/multi-brand/validate/:id
   * Valida si una campaña puede cerrarse con múltiples marcas
   *
   * Params:
   * - id: number - ID de la campaña a validar
   *
   * Response: MultiBrandValidationResult
   */
  router.get('/multi-brand/validate/:id', async (req, res) => {
    await multiBrandController.validateMultiBrandClosure(req, res);
  });

  /**
   * GET /api/campaign-closure/debug/:id
   * Endpoint temporal para debug de datos de campaña
   *
   * Params:
   * - id: number - ID de la campaña a analizar
   *
   * Response: Datos completos de la campaña con análisis de datos diarios
   */
  router.get('/debug/:id', async (req, res) => {
    await debugCampaignData(req, res);
  });

  /**
   * POST /api/campaign-closure/reopen/:id
   * Reabre una campaña cerrada y desasigna sus leads
   *
   * Params:
   * - id: number - ID de la campaña a reabrir
   *
   * Response: { success: boolean, message: string, campaign: {...}, leadsUnassigned: number }
   */
  router.post('/reopen/:id', async (req, res) => {
    await reopenController.reopenCampaign(req, res);
  });

  /**
   * GET /api/campaign-closure/can-reopen/:id
   * Verifica si una campaña puede ser reabierta
   *
   * Params:
   * - id: number - ID de la campaña a verificar
   *
   * Response: { canReopen: boolean, reason: string, campaign: {...} }
   */
  router.get('/can-reopen/:id', async (req, res) => {
    await reopenController.canReopen(req, res);
  });

  /**
   * GET /api/campaign-closure/availability/:id
   * Verifica la disponibilidad de leads para una campaña sin cerrarla
   *
   * Params:
   * - id: number - ID de la campaña a verificar
   *
   * Response: { success: boolean, campaign: {...}, leads: {...}, analisis: {...} }
   */
  router.get('/availability/:id', async (req, res) => {
    await availabilityController.checkAvailability(req, res);
  });

  console.log('✅ Rutas de cierre de campañas configuradas:');
  console.log('   POST /api/campaign-closure/execute');
  console.log('   POST /api/campaign-closure/validate');
  console.log('   GET  /api/campaign-closure/status');
  console.log('   GET  /api/campaign-closure/pending-campaigns');
  console.log('   GET  /api/campaign-closure/clients');
  console.log('   GET  /api/campaign-closure/processing-status');
  console.log('   POST /api/campaign-closure/multi-brand/execute/:id');
  console.log('   GET  /api/campaign-closure/multi-brand/validate/:id');
  console.log('   GET  /api/campaign-closure/debug/:id');
  console.log('   POST /api/campaign-closure/reopen/:id');
  console.log('   GET  /api/campaign-closure/can-reopen/:id');
  console.log('   GET  /api/campaign-closure/availability/:id');

  return router;
}

/**
 * Middleware de logging para las rutas de cierre
 */
export function campaignClosureLoggingMiddleware(req: any, res: any, next: any) {
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