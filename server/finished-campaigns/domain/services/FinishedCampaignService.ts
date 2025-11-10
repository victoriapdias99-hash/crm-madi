import { IFinishedCampaignRepository } from '../interfaces/IFinishedCampaignRepository';
import { FinishedCampaign, FinishedCampaignFilters } from '../entities/FinishedCampaign';
import { extractBrandsFromCampaign } from '../../../../shared/utils/multi-brand-utils';

/**
 * Servicio de dominio para campañas finalizadas
 * Contiene lógica de negocio que no pertenece a entidades ni repositorios
 */
export class FinishedCampaignService {
  constructor(private repository: IFinishedCampaignRepository) {}

  /**
   * Valida si una campaña puede ser reabierta
   *
   * REGLA DE NEGOCIO:
   * - Solo puede reabrirse la última campaña finalizada de cada cliente+marca
   * - Para campañas multimarca, TODAS las marcas deben ser las últimas
   *
   * Ejemplo:
   * Red Finance - Campaña #1: Fiat 50% + Peugeot 50% (finalizada)
   * Red Finance - Campaña #2: Fiat 100% (finalizada)
   * Red Finance - Campaña #3: Peugeot 100% (finalizada)
   *
   * Resultado:
   * - Campaña #1 NO puede reabrirse (Fiat tiene #2, Peugeot tiene #3)
   * - Campaña #2 SÍ puede reabrirse (última de Red Finance + Fiat)
   * - Campaña #3 SÍ puede reabrirse (última de Red Finance + Peugeot)
   */
  async canReopen(campaignId: number): Promise<{ canReopen: boolean; reason?: string }> {
    // Buscar directamente en la tabla de campañas comerciales
    const rawCampaign = await this.getRawCampaignData(campaignId);

    if (!rawCampaign) {
      return {
        canReopen: false,
        reason: 'Campaña no encontrada'
      };
    }

    // Verificar que tenga fecha de finalización
    if (!rawCampaign.fechaFin) {
      return {
        canReopen: false,
        reason: 'La campaña no está finalizada'
      };
    }

    // ✅ VALIDACIÓN: Verificar que sea la última campaña para TODAS sus marcas
    const isLastForAllBrands = await this.isLastFinishedCampaignForAllBrands({ id: campaignId, campaignId });

    if (!isLastForAllBrands.isLast) {
      return {
        canReopen: false,
        reason: isLastForAllBrands.reason || 'Esta campaña no es la última finalizada para una o más de sus marcas'
      };
    }

    return { canReopen: true };
  }

  /**
   * Verifica si una campaña es la última finalizada para TODAS sus marcas
   *
   * @param campaign - Campaña a validar
   * @returns Objeto con resultado de validación y razón si no es la última
   */
  private async isLastFinishedCampaignForAllBrands(
    campaign: any
  ): Promise<{ isLast: boolean; reason?: string }> {
    try {
      // Obtener datos raw de la campaña para acceder a campos multimarca
      const rawCampaign = await this.getRawCampaignData(campaign.id || campaign.campaignId);

      if (!rawCampaign) {
        return { isLast: false, reason: 'No se pudo obtener información completa de la campaña' };
      }

      // Extraer todas las marcas configuradas (hasta 5 marcas posibles)
      const brands = extractBrandsFromCampaign(rawCampaign, true);

      if (brands.length === 0) {
        return { isLast: false, reason: 'La campaña no tiene marcas configuradas' };
      }

      console.log(`🔍 [FinishedCampaignService] Validando campaña #${rawCampaign.numeroCampana}`);
      console.log(`   Cliente ID: ${rawCampaign.clienteId}`);
      console.log(`   Marcas: ${brands.map(b => b.marca).join(', ')}`);

      // Para cada marca, verificar si existe una campaña posterior
      for (const brand of brands) {
        const hasNewerCampaign = await this.hasNewerFinishedCampaignForBrand(
          rawCampaign.clienteId,
          brand.marca,
          parseInt(rawCampaign.numeroCampana)
        );

        if (hasNewerCampaign) {
          console.log(`   ❌ Marca ${brand.marca}: Existe campaña posterior`);
          return {
            isLast: false,
            reason: `Existe una campaña posterior finalizada para la marca ${brand.marca}. Solo puede reabrirse la última campaña de cada marca.`
          };
        }

        console.log(`   ✅ Marca ${brand.marca}: Es la última`);
      }

      console.log(`✅ [FinishedCampaignService] Campaña #${rawCampaign.numeroCampana} es la última para TODAS sus marcas`);
      return { isLast: true };

    } catch (error: any) {
      console.error('❌ [FinishedCampaignService] Error validando última campaña:', error);
      return { isLast: false, reason: `Error en validación: ${error.message}` };
    }
  }

  /**
   * Verifica si existe una campaña posterior finalizada para un cliente+marca específicos
   *
   * @param clienteId - ID del cliente
   * @param marca - Nombre de la marca
   * @param numeroCampana - Número de la campaña actual
   * @returns true si existe una campaña posterior finalizada
   */
  private async hasNewerFinishedCampaignForBrand(
    clienteId: number,
    marca: string,
    numeroCampana: number
  ): Promise<boolean> {
    try {
      const { db } = await import('../../../db');
      const { campanasComerciales } = await import('../../../../shared/schema');
      const { eq, and, sql, gt, or } = await import('drizzle-orm');

      // Buscar campañas del mismo cliente con número mayor
      // La marca puede estar en cualquiera de los 5 campos (marca, marca2, marca3, marca4, marca5)
      const newerCampaigns = await db
        .select()
        .from(campanasComerciales)
        .where(
          and(
            eq(campanasComerciales.clienteId, clienteId),
            // Número de campaña mayor (convertir a entero para comparación correcta)
            sql`CAST(${campanasComerciales.numeroCampana} AS INTEGER) > ${numeroCampana}`,
            // Debe estar finalizada
            sql`${campanasComerciales.fechaFin} IS NOT NULL`,
            // La marca debe estar en alguno de los 5 campos de marca
            or(
              eq(campanasComerciales.marca, marca),
              eq(campanasComerciales.marca2, marca),
              eq(campanasComerciales.marca3, marca),
              eq(campanasComerciales.marca4, marca),
              eq(campanasComerciales.marca5, marca)
            )
          )
        )
        .limit(1);

      return newerCampaigns.length > 0;
    } catch (error: any) {
      console.error(`❌ Error verificando campañas posteriores para ${marca}:`, error);
      return false; // En caso de error, no bloquear la reapertura
    }
  }

  /**
   * Obtiene los datos raw de la campaña directamente de la base de datos
   * Incluye todos los campos multimarca (marca2, marca3, etc.)
   */
  private async getRawCampaignData(campaignId: number): Promise<any> {
    try {
      const { db } = await import('../../../db');
      const { campanasComerciales } = await import('../../../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const campaigns = await db
        .select()
        .from(campanasComerciales)
        .where(eq(campanasComerciales.id, campaignId))
        .limit(1);

      if (campaigns.length === 0) {
        return null;
      }

      return campaigns[0];
    } catch (error: any) {
      console.error(`Error getting raw campaign data for ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene campañas finalizadas recientemente (últimos 30 días)
   */
  async getRecentlyFinished(): Promise<FinishedCampaign[]> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const fechaCierreInicio = thirtyDaysAgo.toISOString().split('T')[0];
    const fechaCierreFin = now.toISOString().split('T')[0];

    const filters: FinishedCampaignFilters = {
      fechaCierreInicio,
      fechaCierreFin,
      sortBy: 'fechaCierre',
      sortOrder: 'desc'
    };

    return await this.repository.findAllFinished(filters);
  }

  /**
   * Obtiene campañas con duplicados
   */
  async getCampaignsWithDuplicates(): Promise<FinishedCampaign[]> {
    const allCampaigns = await this.repository.findAllFinished();

    return allCampaigns.filter(campaign => {
      const duplicados = typeof campaign.duplicados === 'number' ? campaign.duplicados : 0;
      return duplicados > 0;
    });
  }
}
