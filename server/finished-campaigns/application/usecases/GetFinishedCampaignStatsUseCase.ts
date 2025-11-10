import { IFinishedCampaignRepository } from '../../domain/interfaces/IFinishedCampaignRepository';
import { FinishedCampaignStats, FinishedCampaignFilters } from '../../domain/entities/FinishedCampaign';

/**
 * Caso de uso: Obtener estadísticas agregadas de campañas finalizadas
 */
export class GetFinishedCampaignStatsUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(filters?: FinishedCampaignFilters): Promise<FinishedCampaignStats> {
    console.log('📊 [GetFinishedCampaignStatsUseCase] Calculando estadísticas...');
    console.log('📋 Filtros:', filters);

    try {
      const stats = await this.repository.getStatistics(filters);

      console.log('✅ [GetFinishedCampaignStatsUseCase] Estadísticas calculadas:', stats);
      return stats;
    } catch (error: any) {
      console.error('❌ [GetFinishedCampaignStatsUseCase] Error:', error);
      throw new Error(`Error al calcular estadísticas: ${error.message}`);
    }
  }
}
