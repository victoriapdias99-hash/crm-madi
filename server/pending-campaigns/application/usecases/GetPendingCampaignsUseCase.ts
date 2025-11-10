import { PendingCampaign, PendingCampaignFilters } from '../../domain/entities/PendingCampaign';
import { IPendingCampaignRepository } from '../../domain/interfaces/IPendingCampaignRepository';
import { PendingCampaignService } from '../../domain/services/PendingCampaignService';

/**
 * Caso de uso: Obtener campañas pendientes con filtros
 */
export class GetPendingCampaignsUseCase {
  private service: PendingCampaignService;

  constructor(private repository: IPendingCampaignRepository) {
    this.service = new PendingCampaignService();
  }

  /**
   * Ejecuta la consulta de campañas pendientes
   * @param filters - Filtros opcionales
   * @returns Array de campañas pendientes filtradas y ordenadas
   */
  async execute(filters?: PendingCampaignFilters): Promise<PendingCampaign[]> {
    const startTime = Date.now();
    console.log('🔍 [GetPendingCampaigns] Iniciando consulta de campañas pendientes...');
    console.log('📋 [GetPendingCampaigns] Filtros aplicados:', JSON.stringify(filters, null, 2));

    try {
      // 1. Obtener campañas pendientes desde el repositorio
      console.log('🔄 [GetPendingCampaigns] Consultando repositorio...');
      const campaigns = await this.repository.findAllPending(filters);
      console.log(`✅ [GetPendingCampaigns] Se encontraron ${campaigns.length} campañas pendientes`);

      // 2. Filtrar duplicados si está activado
      let filteredCampaigns = campaigns;
      if (filters?.showDuplicatesOnly) {
        console.log('🔍 [GetPendingCampaigns] Filtrando solo campañas con duplicados...');
        filteredCampaigns = campaigns.filter(c => {
          const duplicados = typeof c.duplicados === 'number' ? c.duplicados : 0;
          return duplicados > 0;
        });
        console.log(`✅ [GetPendingCampaigns] ${filteredCampaigns.length} campañas con duplicados`);
      }

      // 3. Ordenar según criterio
      console.log('📊 [GetPendingCampaigns] Ordenando resultados...');
      filteredCampaigns = this.sortCampaigns(filteredCampaigns, filters);

      // 4. Enriquecer con cálculos adicionales
      console.log('🧮 [GetPendingCampaigns] Calculando métricas adicionales...');
      filteredCampaigns = filteredCampaigns.map(campaign => ({
        ...campaign,
        esSuperior100: this.service.isSuperior100(campaign)
      }));

      const duration = Date.now() - startTime;
      console.log(`✅ [GetPendingCampaigns] Consulta completada en ${duration}ms`);
      console.log(`📊 [GetPendingCampaigns] Retornando ${filteredCampaigns.length} campañas`);

      return filteredCampaigns;
    } catch (error: any) {
      console.error('❌ [GetPendingCampaigns] Error en consulta:', error);
      throw new Error(`Error al obtener campañas pendientes: ${error.message}`);
    }
  }

  /**
   * Ordena las campañas según criterio
   */
  private sortCampaigns(campaigns: PendingCampaign[], filters?: PendingCampaignFilters): PendingCampaign[] {
    const sortBy = filters?.sortBy || 'fecha';
    const sortOrder = filters?.sortOrder || 'desc';

    const sorted = [...campaigns].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'fecha':
          const fechaA = new Date(a.fechaCampana || '1970-01-01').getTime();
          const fechaB = new Date(b.fechaCampana || '1970-01-01').getTime();
          comparison = fechaB - fechaA;
          break;

        case 'cliente':
          comparison = (a.clienteNombre || '').localeCompare(b.clienteNombre || '');
          break;

        case 'marca':
          comparison = (a.marca || '').localeCompare(b.marca || '');
          break;

        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }
}
