import { IFinishedCampaignRepository } from '../../domain/interfaces/IFinishedCampaignRepository';
import { FinishedCampaign, FinishedCampaignFilters, FinishedCampaignStats } from '../../domain/entities/FinishedCampaign';

/**
 * Caso de uso: Obtener campañas finalizadas con filtros opcionales
 */
export class GetFinishedCampaignsUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(filters?: FinishedCampaignFilters, includeStats: boolean = false): Promise<{
    campaigns: FinishedCampaign[];
    stats?: FinishedCampaignStats;
  }> {
    console.log('🔍 [GetFinishedCampaignsUseCase] Ejecutando...');
    console.log('📋 Filtros:', filters);
    console.log('📊 Incluir stats:', includeStats);

    try {
      // Obtener campañas con filtros
      const campaigns = await this.repository.findAllFinished(filters);

      const result: {
        campaigns: FinishedCampaign[];
        stats?: FinishedCampaignStats;
      } = {
        campaigns
      };

      // Calcular estadísticas si se solicitan
      if (includeStats) {
        const stats = await this.repository.getStatistics(filters);
        result.stats = stats;
      }

      console.log(`✅ [GetFinishedCampaignsUseCase] ${campaigns.length} campañas encontradas`);

      return result;
    } catch (error: any) {
      console.error('❌ [GetFinishedCampaignsUseCase] Error:', error);
      throw new Error(`Error al obtener campañas finalizadas: ${error.message}`);
    }
  }
}
