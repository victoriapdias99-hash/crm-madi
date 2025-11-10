import { IFinishedCampaignRepository } from '../../domain/interfaces/IFinishedCampaignRepository';
import { ReopenFinishedCampaignResult } from '../../domain/entities/FinishedCampaign';

/**
 * Caso de uso: Reabrir una campaña finalizada
 * Elimina la fecha de finalización para que vuelva a estar activa
 */
export class ReopenFinishedCampaignUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(id: number): Promise<ReopenFinishedCampaignResult> {
    console.log(`🔄 [ReopenFinishedCampaignUseCase] Iniciando reapertura de campaña ID: ${id}`);

    try {
      // Verificar que la campaña existe y está finalizada
      const campaign = await this.repository.findById(id);

      if (!campaign) {
        console.log(`⚠️ [ReopenFinishedCampaignUseCase] Campaña ${id} no encontrada`);
        return {
          success: false,
          message: `Campaña ${id} no encontrada o no está finalizada`,
          errors: ['CAMPAIGN_NOT_FOUND']
        };
      }

      // Reabrir la campaña
      await this.repository.reopen(id);

      console.log(`✅ [ReopenFinishedCampaignUseCase] Campaña ${id} reabierta exitosamente`);

      return {
        success: true,
        message: `Campaña ${campaign.clienteNombre} #${campaign.numeroCampana} reabierta exitosamente`,
        campaign
      };
    } catch (error: any) {
      console.error(`❌ [ReopenFinishedCampaignUseCase] Error:`, error);
      return {
        success: false,
        message: `Error al reabrir campaña: ${error.message}`,
        errors: [error.message]
      };
    }
  }
}
