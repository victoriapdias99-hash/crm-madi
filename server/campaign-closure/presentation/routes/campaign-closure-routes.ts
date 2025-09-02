import { Router } from 'express';
import { CampaignClosureController } from '../controllers/CampaignClosureController';

/**
 * Rutas para el sistema de cierre manual de campañas
 * Expone endpoints para ejecutar, validar y monitorear el cierre de campañas
 */
export function createCampaignClosureRoutes(): Router {
  const router = Router();
  const controller = new CampaignClosureController();

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

  console.log('✅ Rutas de cierre de campañas configuradas:');
  console.log('   POST /api/campaign-closure/execute');
  console.log('   POST /api/campaign-closure/validate');
  console.log('   GET  /api/campaign-closure/status');
  console.log('   GET  /api/campaign-closure/pending-campaigns');
  console.log('   GET  /api/campaign-closure/clients');

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