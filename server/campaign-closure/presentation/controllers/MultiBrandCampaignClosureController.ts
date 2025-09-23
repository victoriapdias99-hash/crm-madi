import { Request, Response } from 'express';
import { MultiBrandCampaignClosureUseCase } from '../../application/usecases/MultiBrandCampaignClosureUseCase';
import { PostgresCampaignRepository } from '../../infrastructure/repositories/PostgresCampaignRepository';
import { PostgresLeadRepository } from '../../infrastructure/repositories/PostgresLeadRepository';
import { db } from '../../../db';

/**
 * Controlador para el sistema de cierre de campañas con múltiples marcas
 */
export class MultiBrandCampaignClosureController {
  private useCase: MultiBrandCampaignClosureUseCase;

  constructor() {
    const campaignRepository = new PostgresCampaignRepository(db);
    const leadRepository = new PostgresLeadRepository(db);
    this.useCase = new MultiBrandCampaignClosureUseCase(campaignRepository, leadRepository);
  }

  /**
   * POST /api/campaign-closure/multi-brand/execute/:id
   * Ejecuta el cierre de una campaña específica con distribución multi-marca
   */
  async executeMultiBrandClosure(req: Request, res: Response): Promise<void> {
    try {
      const campaignId = parseInt(req.params.id);
      const { clientName } = req.body;

      console.log(`🎯 EJECUTANDO CIERRE MULTI-MARCA - Campaña: ${campaignId}, Cliente: ${clientName}`);

      if (!campaignId || isNaN(campaignId)) {
        res.status(400).json({
          success: false,
          error: 'ID de campaña inválido'
        });
        return;
      }

      if (!clientName || typeof clientName !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Nombre del cliente es requerido'
        });
        return;
      }

      const result = await this.useCase.closeCampaignWithMultiBrands(campaignId, clientName);

      const statusCode = result.success ? 200 : 207; // 207 para éxito parcial
      res.status(statusCode).json(result);

    } catch (error: any) {
      console.error('❌ Error en executeMultiBrandClosure:', error);
      res.status(500).json({
        success: false,
        error: `Error interno: ${error.message}`,
        campaignId: parseInt(req.params.id) || null,
        clientName: req.body?.clientName || null,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * GET /api/campaign-closure/multi-brand/validate/:id
   * Valida si una campaña puede cerrarse con múltiples marcas
   */
  async validateMultiBrandClosure(req: Request, res: Response): Promise<void> {
    try {
      const campaignId = parseInt(req.params.id);

      console.log(`🔍 VALIDANDO CIERRE MULTI-MARCA - Campaña: ${campaignId}`);

      if (!campaignId || isNaN(campaignId)) {
        res.status(400).json({
          valid: false,
          error: 'ID de campaña inválido'
        });
        return;
      }

      const result = await this.useCase.validateMultiBrandClosure(campaignId);

      res.status(200).json(result);

    } catch (error: any) {
      console.error('❌ Error en validateMultiBrandClosure:', error);
      res.status(500).json({
        valid: false,
        error: `Error interno: ${error.message}`,
        campaignId: parseInt(req.params.id) || null,
        timestamp: new Date().toISOString()
      });
    }
  }
}