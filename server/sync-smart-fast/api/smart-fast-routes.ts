/**
 * Smart-Fast API Routes
 *
 * Rutas para el sistema de migración simplificado
 */

import { Router } from 'express';
import { smartFastController } from './smart-fast-controller';

const router = Router();

/**
 * POST /api/sync/smart-fast
 * Ejecuta migración completa con ID estable
 *
 * Response:
 * {
 *   "success": true,
 *   "duration": "15.3s",
 *   "stats": {
 *     "totalProcessed": 450,
 *     "inserted": 80,
 *     "updated": 370,
 *     "skipped": 0,
 *     "errors": 0
 *   },
 *   "details": [...]
 * }
 */
router.post('/smart-fast', async (req, res) => {
  await smartFastController.executeMigration(req, res);
});

/**
 * GET /api/sync/smart-fast/status
 * Obtiene estadísticas de la BD
 *
 * Response:
 * {
 *   "success": true,
 *   "stats": {
 *     "totalLeads": 1250,
 *     "recentlyUpdated": 450,
 *     "newToday": 30,
 *     "byMarca": [...]
 *   }
 * }
 */
router.get('/smart-fast/status', async (req, res) => {
  await smartFastController.getStatus(req, res);
});

/**
 * GET /api/sync/smart-fast/validate
 * Valida integridad (sin duplicados)
 *
 * Response:
 * {
 *   "success": true,
 *   "integrity": {
 *     "isValid": true,
 *     "duplicatesFound": 0
 *   }
 * }
 */
router.get('/smart-fast/validate', async (req, res) => {
  await smartFastController.validateIntegrity(req, res);
});

export default router;
