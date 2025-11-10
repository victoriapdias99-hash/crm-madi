import { FinishedCampaign } from '../entities/FinishedCampaign';
import { contarLeadsYDuplicadosUnificado } from '../../../../shared/utils/campaign-counting-utils';

/**
 * Servicio de enriquecimiento de datos para campañas finalizadas
 *
 * REFACTORIZADO: Ahora usa la lógica centralizada de campaign-counting-utils.ts
 *
 * Calcula métricas dinámicas desde op_leads_rep (tabla consolidada de análisis):
 * - enviados: Conteo real de leads asignados a la campaña
 * - duplicados: Suma de duplicate_ids[] de leads asignados
 * - diasProcesados: Días únicos con datos
 * - entregadosPorDia: Promedio de leads por día
 * - porcentajeDatosEnviados: Porcentaje de completitud
 * - inversionRealizada: Inversión basada en CPL
 * - inversionPendiente: Inversión pendiente (siempre 0 para finalizadas)
 *
 * VENTAJAS DEL REFACTOR:
 * ✅ Usa MISMA lógica que campañas pendientes
 * ✅ Fuente de datos consistente (op_leads_rep)
 * ✅ Duplicados calculados correctamente (duplicate_ids[])
 * ✅ Transición pendiente→finalizada mantiene números idénticos
 */
export class FinishedCampaignEnrichmentService {
  private db: any;
  private opLead: any;
  private opLeadsRep: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      const dbModule = await import('../../../db');
      this.db = dbModule.db;

      const schemaModule = await import('../../../../shared/schema');
      this.opLead = schemaModule.opLead;
      this.opLeadsRep = schemaModule.opLeadsRep; // ✅ NUEVO: Importar opLeadsRep
    } catch (error) {
      console.error('❌ Error initializing database for enrichment service:', error);
      throw new Error('Failed to initialize enrichment service');
    }
  }

  private async ensureDbInitialized() {
    if (!this.db || !this.opLead || !this.opLeadsRep) {
      await this.initializeDb();
    }
  }

  /**
   * Enriquece una campaña finalizada con datos reales desde op_leads_rep
   */
  async enrichCampaign(campaign: FinishedCampaign, cliente: any, campanasComerciales: any[]): Promise<FinishedCampaign> {
    await this.ensureDbInitialized();

    try {
      console.log(`🔍 [FinishedEnrichment] Enriqueciendo campaña ID:${campaign.id} - ${campaign.clienteNombre} #${campaign.numeroCampana}`);

      // 1. Calcular enviados y duplicados usando la misma lógica que UpdateEnviadosService
      const { enviados, duplicados, diasProcesados } = await this.calculateLeadsMetrics(campaign, cliente, campanasComerciales);

      // 2. Calcular métricas derivadas
      const entregadosPorDia = diasProcesados > 0 ? enviados / diasProcesados : 0;
      const porcentajeDatosEnviados = campaign.cantidadDatosSolicitados > 0
        ? (enviados / campaign.cantidadDatosSolicitados) * 100
        : 0;
      const faltantes = Math.max(0, campaign.cantidadDatosSolicitados - enviados);

      // 3. Calcular inversión (CPL * enviados * 1.02)
      const cpl = campaign.cpl || 0;
      const inversionRealizada = enviados * cpl * 1.02;
      const inversionPendiente = 0; // Campañas finalizadas no tienen inversión pendiente

      // 4. Calcular desvío porcentual
      const porcentajeDesvio = campaign.pedidosPorDia > 0
        ? ((entregadosPorDia - campaign.pedidosPorDia) / campaign.pedidosPorDia) * 100
        : 0;

      // 5. Retornar campaña enriquecida
      const enrichedCampaign: FinishedCampaign = {
        ...campaign,
        // Métricas calculadas desde op_leads_rep
        enviados,
        sentLeads: enviados,
        duplicados,
        duplicates: duplicados,
        diasProcesados,
        processedDays: diasProcesados,

        // Métricas derivadas
        entregadosPorDia,
        deliveredPerDay: entregadosPorDia,
        porcentajeDatosEnviados,
        percentageSent: porcentajeDatosEnviados,
        faltantesAEnviar: faltantes,
        remaining: faltantes,
        faltantes: faltantes,

        // Inversión
        inversionRealizada,
        investment: inversionRealizada,
        inversionPendiente,
        pendingInvestment: inversionPendiente,

        // Desvío
        porcentajeDesvio,
        percentageDeviation: porcentajeDesvio,

        // Estado
        esSuperior100: porcentajeDatosEnviados > 100,

        // Leads actuales (igual a enviados para campañas finalizadas)
        currentLeads: enviados
      };

      console.log(`✅ [FinishedEnrichment] Campaña enriquecida - Enviados: ${enviados}, Duplicados: ${duplicados}, Progreso: ${porcentajeDatosEnviados.toFixed(1)}%`);

      return enrichedCampaign;

    } catch (error: any) {
      console.error(`❌ [FinishedEnrichment] Error enriqueciendo campaña ${campaign.id}:`, error);
      // En caso de error, retornar la campaña sin cambios
      return campaign;
    }
  }

  /**
   * Enriquece múltiples campañas en paralelo
   */
  async enrichCampaigns(campaigns: FinishedCampaign[], clientes: Map<number, any>, campanasComerciales: any[]): Promise<FinishedCampaign[]> {
    console.log(`🔄 [FinishedEnrichment] Enriqueciendo ${campaigns.length} campañas finalizadas...`);

    const enrichedCampaigns = await Promise.all(
      campaigns.map(async (campaign) => {
        const cliente = clientes.get(campaign.clienteId);
        if (!cliente) {
          console.warn(`⚠️ [FinishedEnrichment] Cliente no encontrado para campaña ${campaign.id}`);
          return campaign;
        }
        return this.enrichCampaign(campaign, cliente, campanasComerciales);
      })
    );

    console.log(`✅ [FinishedEnrichment] ${enrichedCampaigns.length} campañas enriquecidas exitosamente`);
    return enrichedCampaigns;
  }

  /**
   * Calcula métricas de leads usando la lógica centralizada
   *
   * REFACTORIZADO: Ahora usa contarLeadsYDuplicadosUnificado() de campaign-counting-utils.ts
   *
   * VENTAJAS:
   * ✅ Usa op_leads_rep (tabla de análisis consolidada)
   * ✅ Duplicados desde duplicate_ids[] (precisos)
   * ✅ Consistencia con campañas pendientes
   * ✅ Transición pendiente→finalizada mantiene números
   */
  private async calculateLeadsMetrics(
    campaign: FinishedCampaign,
    cliente: any,
    campanasComerciales: any[]
  ): Promise<{ enviados: number; duplicados: number; diasProcesados: number }> {
    try {
      // Asegurar que DB esté inicializado
      await this.ensureDbInitialized();

      // Importar Drizzle ORM
      const { count, sql, eq, countDistinct } = await import('drizzle-orm');

      console.log(`🎯 [FinishedEnrichment] Calculando leads para campaña finalizada ID:${campaign.id}`);

      // ✅ USAR FUNCIÓN CENTRALIZADA para conteo consistente
      const resultado = await contarLeadsYDuplicadosUnificado(
        campaign,
        cliente,
        this.db,
        this.opLeadsRep,
        this.opLead,
        count,
        campanasComerciales
      );

      const enviados = resultado.enviados;
      const duplicados = resultado.duplicados;

      // Contar días procesados (días únicos con datos)
      // Nota: Esto se mantiene desde op_lead porque fecha_creacion está ahí
      const diasProcesadosResult = await this.db
        .select({
          count: countDistinct(sql`date(${this.opLead.fechaCreacion})`)
        })
        .from(this.opLead)
        .where(eq(this.opLead.campaignId, campaign.id));

      const diasProcesados = diasProcesadosResult[0]?.count || 0;

      console.log(`✅ [FinishedEnrichment] Leads encontrados: ${enviados}, Duplicados: ${duplicados}, Días: ${diasProcesados}`);

      return { enviados, duplicados, diasProcesados };

    } catch (error: any) {
      console.error(`❌ [FinishedEnrichment] Error calculando métricas para campaña ${campaign.id}:`, error);
      return { enviados: 0, duplicados: 0, diasProcesados: 0 };
    }
  }
}
