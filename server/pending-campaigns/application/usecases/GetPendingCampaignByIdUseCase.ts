import { PendingCampaign } from '../../domain/entities/PendingCampaign';
import { IPendingCampaignRepository } from '../../domain/interfaces/IPendingCampaignRepository';

/**
 * Caso de uso: Obtener una campaña pendiente específica por ID
 */
export class GetPendingCampaignByIdUseCase {
  constructor(private repository: IPendingCampaignRepository) {}

  /**
   * Ejecuta la consulta de una campaña pendiente por ID
   * @param id - ID de la campaña
   * @returns Campaña pendiente o null si no existe
   */
  async execute(id: number): Promise<PendingCampaign | null> {
    console.log(`🔍 [GetPendingCampaignById] Buscando campaña con ID: ${id}`);

    try {
      const campaign = await this.repository.findById(id);

      if (!campaign) {
        console.log(`⚠️ [GetPendingCampaignById] No se encontró campaña con ID: ${id}`);
        return null;
      }

      console.log(`✅ [GetPendingCampaignById] Campaña encontrada: ${campaign.clienteNombre} #${campaign.numeroCampana}`);
      return campaign;
    } catch (error: any) {
      console.error(`❌ [GetPendingCampaignById] Error al buscar campaña ${id}:`, error);
      throw new Error(`Error al obtener campaña: ${error.message}`);
    }
  }
}
