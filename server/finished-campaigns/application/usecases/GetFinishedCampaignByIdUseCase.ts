import { IFinishedCampaignRepository } from '../../domain/interfaces/IFinishedCampaignRepository';
import { FinishedCampaign } from '../../domain/entities/FinishedCampaign';

/**
 * Caso de uso: Obtener una campaña finalizada específica por ID
 */
export class GetFinishedCampaignByIdUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(id: number): Promise<FinishedCampaign | null> {
    console.log(`🔍 [GetFinishedCampaignByIdUseCase] Buscando campaña ID: ${id}`);

    try {
      const campaign = await this.repository.findById(id);

      if (!campaign) {
        console.log(`⚠️ [GetFinishedCampaignByIdUseCase] Campaña ${id} no encontrada`);
        return null;
      }

      console.log(`✅ [GetFinishedCampaignByIdUseCase] Campaña encontrada: ${campaign.clienteNombre}`);
      return campaign;
    } catch (error: any) {
      console.error(`❌ [GetFinishedCampaignByIdUseCase] Error:`, error);
      throw new Error(`Error al obtener campaña: ${error.message}`);
    }
  }
}
