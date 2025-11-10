import { PendingCampaignStats, PendingCampaignFilters } from '../../domain/entities/PendingCampaign';
import { IPendingCampaignRepository } from '../../domain/interfaces/IPendingCampaignRepository';

/**
 * Caso de uso: Obtener estadísticas de campañas pendientes
 */
export class GetPendingCampaignStatsUseCase {
  constructor(private repository: IPendingCampaignRepository) {}

  /**
   * Ejecuta el cálculo de estadísticas
   * @param filters - Filtros opcionales
   * @returns Estadísticas agregadas
   */
  async execute(filters?: PendingCampaignFilters): Promise<PendingCampaignStats> {
    console.log('📊 [GetPendingCampaignStats] Calculando estadísticas...');
    console.log('📋 [GetPendingCampaignStats] Filtros:', JSON.stringify(filters, null, 2));

    try {
      const stats = await this.repository.getStatistics(filters);

      console.log('✅ [GetPendingCampaignStats] Estadísticas calculadas:', {
        totalCampaigns: stats.totalCampaigns,
        totalInvestment: stats.totalInvestment,
        averageProgress: stats.averageProgress
      });

      return stats;
    } catch (error: any) {
      console.error('❌ [GetPendingCampaignStats] Error al calcular estadísticas:', error);
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }
}
