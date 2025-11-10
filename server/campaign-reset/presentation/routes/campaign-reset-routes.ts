import { Router } from 'express';
import { PostgresCampaignResetRepository } from '../../infrastructure/repositories/PostgresCampaignResetRepository';
import { ResetCampaignUseCase } from '../../application/usecases/ResetCampaignUseCase';
import { BatchResetUseCase } from '../../application/usecases/BatchResetUseCase';
import { ResetCampaignController } from '../controllers/ResetCampaignController';
import { BatchResetController } from '../controllers/BatchResetController';

/**
 * Crea y configura las rutas del sistema de reset de campañas
 * @returns Router configurado con todas las rutas
 */
export function createCampaignResetRoutes(): Router {
  const router = Router();

  console.log('🔄 Configurando rutas de reset de campañas...');

  // Instanciar repositorios
  const campaignResetRepository = new PostgresCampaignResetRepository();

  // Instanciar use cases
  const resetCampaignUseCase = new ResetCampaignUseCase(campaignResetRepository);
  const batchResetUseCase = new BatchResetUseCase(campaignResetRepository);

  // Instanciar controllers
  const resetCampaignController = new ResetCampaignController(resetCampaignUseCase);
  const batchResetController = new BatchResetController(batchResetUseCase);

  /**
   * POST /api/campaign-reset/batch
   * Reset múltiples campañas finalizadas
   * Query params:
   *   - beforeDate: string (ISO date)
   *   - afterDate: string (ISO date)
   *   - onlyFinished: boolean (default: true)
   *   - dryRun: boolean (default: false)
   *
   * IMPORTANTE: Esta ruta debe ir ANTES de /:campaignId para que no sea capturada
   */
  router.post('/batch', (req, res) => {
    batchResetController.execute(req, res);
  });

  /**
   * POST /api/campaign-reset/:campaignId
   * Reset una campaña específica
   * Query params:
   *   - dryRun: boolean (default: false)
   */
  router.post('/:campaignId', (req, res) => {
    resetCampaignController.execute(req, res);
  });

  console.log('   POST /batch');
  console.log('   POST /:campaignId');

  return router;
}
