import { LeadAssigner } from '../../domain/services/LeadAssigner';
import { ICampaignRepository } from '../../domain/interfaces/ICampaignRepository';
import { ILeadRepository } from '../../domain/interfaces/ILeadRepository';
import { extractBrandsFromCampaign, validateBrandPercentages } from '../../../../shared/utils/multi-brand-utils';
import { normalizeClientName } from '../../../../shared/utils/client-normalization';

export interface MultiBrandClosureResult {
  success: boolean;
  campaignId: number;
  clientName: string;
  totalRequested: number;
  totalAssigned: number;
  brandDetails: {
    marca: string;
    porcentaje: number;
    solicitados: number;
    asignados: number;
    exito: boolean;
  }[];
  mode: 'automatica' | 'manual';
  message: string;
  timestamp: string;
}

/**
 * Caso de uso específico para cierre de campañas con múltiples marcas
 */
export class MultiBrandCampaignClosureUseCase {
  private leadAssigner: LeadAssigner;

  constructor(
    private campaignRepository: ICampaignRepository,
    private leadRepository: ILeadRepository
  ) {
    this.leadAssigner = new LeadAssigner(leadRepository);
  }

  /**
   * Cierra una campaña específica distribuyendo leads según porcentajes de marca
   */
  async closeCampaignWithMultiBrands(
    campaignId: number,
    clientName: string
  ): Promise<MultiBrandClosureResult> {
    const timestamp = new Date().toISOString();

    try {
      console.log(`🎯 CIERRE MULTI-MARCA INICIADO - Campaña: ${campaignId}, Cliente: ${clientName}`);

      // 1. Obtener datos raw de la campaña
      const campaign = await this.getRawCampaignData(campaignId);
      if (!campaign) {
        throw new Error(`Campaña ${campaignId} no encontrada`);
      }

      console.log(`📋 Campaña encontrada: ${campaign.marca} ${campaign.numeroCampana}`);
      console.log(`   Solicitados: ${campaign.cantidadDatosSolicitados} leads`);
      console.log(`   Zona: ${campaign.zona}`);
      console.log(`   Asignación automática: ${campaign.asignacionAutomatica ? '✅' : '❌'}`);

      // 1.5. Verificar si la asignación automática está habilitada
      if (!campaign.asignacionAutomatica) {
        throw new Error('La campaña no tiene habilitada la asignación automática');
      }

      // 2. Analizar configuración de múltiples marcas (modo automático usa TODAS las marcas)
      console.log(`🔧 [DEBUG] Datos RAW de campaña:`, JSON.stringify({
        id: campaign.id,
        marca: campaign.marca,
        porcentaje: campaign.porcentaje,
        marca2: campaign.marca2,
        porcentaje2: campaign.porcentaje2,
        marca3: campaign.marca3,
        porcentaje3: campaign.porcentaje3,
        marca4: campaign.marca4,
        porcentaje4: campaign.porcentaje4,
        marca5: campaign.marca5,
        porcentaje5: campaign.porcentaje5,
        asignacionAutomatica: campaign.asignacionAutomatica,
        zona: campaign.zona
      }, null, 2));

      const brands = extractBrandsFromCampaign(campaign, campaign.asignacionAutomatica);
      console.log(`🏷️ Marcas configuradas: ${brands.length}`);

      if (brands.length === 1) {
        console.log('ℹ️ Campaña con una sola marca - usando lógica estándar');
        return await this.closeSingleBrandCampaign(campaign, clientName, timestamp);
      }

      // 3. Validar configuración de marcas
      const validation = validateBrandPercentages(brands);
      if (!validation.valid) {
        throw new Error(`Configuración inválida de marcas: ${validation.error}`);
      }

      console.log('✅ Configuración de marcas válida');
      brands.forEach((brand, i) => {
        console.log(`   ${i + 1}. ${brand.marca}: ${brand.porcentaje}%`);
      });

      // 4. Normalizar nombre del cliente
      const normalizedClientName = normalizeClientName(clientName);

      // 5. Ejecutar asignación multi-marca
      const assignmentResult = await this.leadAssigner.assignLeadsWithMultiBrands(
        campaign,
        normalizedClientName,
        campaign.zona,
        campaignId,
        campaign.cantidadDatosSolicitados
      );

      console.log(`📋 Modo utilizado: ${assignmentResult.mode}`);

      // 6. Procesar resultado según modo
      if (assignmentResult.success) {
        // Marcar campaña como finalizada
        await this.campaignRepository.closeCampaign(campaignId, new Date());
        console.log(`✅ Campaña ${campaignId} marcada como finalizada`);
      }

      // 7. Formatear resultado
      const result: MultiBrandClosureResult = {
        success: assignmentResult.success,
        campaignId,
        clientName,
        totalRequested: campaign.cantidadDatosSolicitados,
        totalAssigned: assignmentResult.totalAssigned,
        brandDetails: assignmentResult.details,
        mode: assignmentResult.mode,
        message: this.buildMessage(assignmentResult, campaign.cantidadDatosSolicitados),
        timestamp
      };

      console.log(`\n✅ CIERRE MULTI-MARCA COMPLETADO:`);
      console.log(`   🎯 Éxito: ${result.success ? '✅' : '❌'}`);
      console.log(`   📊 Asignados: ${result.totalAssigned}/${result.totalRequested}`);

      return result;

    } catch (error: any) {
      console.error(`❌ Error en cierre multi-marca:`, error);

      return {
        success: false,
        campaignId,
        clientName,
        totalRequested: 0,
        totalAssigned: 0,
        brandDetails: [],
        message: `Error: ${error.message}`,
        timestamp
      };
    }
  }

  /**
   * Fallback para campañas con una sola marca
   */
  private async closeSingleBrandCampaign(
    campaign: any,
    clientName: string,
    timestamp: string
  ): Promise<MultiBrandClosureResult> {

    const normalizedClientName = normalizeClientName(clientName);

    const assignmentResult = await this.leadAssigner.assignLeadsToTarget(
      normalizedClientName,
      campaign.marca,
      campaign.zona,
      campaign.id,
      campaign.cantidadDatosSolicitados
    );

    if (assignmentResult.assigned === campaign.cantidadDatosSolicitados) {
      await this.campaignRepository.closeCampaign(campaign.id, new Date());
    }

    return {
      success: assignmentResult.assigned === campaign.cantidadDatosSolicitados,
      campaignId: campaign.id,
      clientName,
      totalRequested: campaign.cantidadDatosSolicitados,
      totalAssigned: assignmentResult.assigned,
      brandDetails: [{
        marca: campaign.marca,
        porcentaje: 100,
        solicitados: campaign.cantidadDatosSolicitados,
        asignados: assignmentResult.assigned,
        exito: assignmentResult.assigned === campaign.cantidadDatosSolicitados
      }],
      message: assignmentResult.assigned === campaign.cantidadDatosSolicitados
        ? `Campaña cerrada exitosamente con ${assignmentResult.assigned} leads`
        : `Cierre parcial: ${assignmentResult.assigned}/${campaign.cantidadDatosSolicitados} leads asignados`,
      timestamp
    };
  }

  /**
   * Valida si una campaña puede cerrarse con múltiples marcas
   */
  async validateMultiBrandClosure(campaignId: number): Promise<{
    valid: boolean;
    hasMultipleBrands: boolean;
    brands: any[];
    validation: any;
    availabilityByBrand: { [marca: string]: number };
    message: string;
  }> {
    try {
      // Obtener datos raw de la campaña para acceder a campos multi-marca
      const rawCampaign = await this.getRawCampaignData(campaignId);
      if (!rawCampaign) {
        return {
          valid: false,
          hasMultipleBrands: false,
          brands: [],
          validation: { valid: false, error: 'Campaña no encontrada' },
          availabilityByBrand: {},
          message: 'Campaña no encontrada'
        };
      }

      const campaign = rawCampaign;

      // Verificar si la asignación automática está habilitada
      if (!campaign.asignacionAutomatica) {
        return {
          valid: false,
          hasMultipleBrands: false,
          brands: [],
          validation: { valid: false, error: 'Asignación automática no está habilitada para esta campaña' },
          availabilityByBrand: {},
          message: 'Asignación automática requerida para cierre multi-marca'
        };
      }

      const brands = extractBrandsFromCampaign(campaign, campaign.asignacionAutomatica);
      const validation = validateBrandPercentages(brands);
      const hasMultipleBrands = brands.length > 1;

      // Verificar disponibilidad por marca
      const availabilityByBrand: { [marca: string]: number } = {};

      if (hasMultipleBrands) {
        for (const brand of brands) {
          const stats = await this.leadAssigner.getAvailabilityStats(
            campaign.clientName,
            brand.marca,
            campaign.zona
          );
          availabilityByBrand[brand.marca] = stats.available;
        }
      }

      return {
        valid: validation.valid && hasMultipleBrands,
        hasMultipleBrands,
        brands,
        validation,
        availabilityByBrand,
        message: hasMultipleBrands
          ? (validation.valid ? 'Campaña válida para cierre multi-marca' : validation.error || 'Configuración inválida')
          : 'Campaña con una sola marca - usar cierre estándar'
      };

    } catch (error: any) {
      return {
        valid: false,
        hasMultipleBrands: false,
        brands: [],
        validation: { valid: false, error: error.message },
        availabilityByBrand: {},
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Construye mensaje apropiado según el modo de asignación
   */
  private buildMessage(assignmentResult: any, totalRequested: number): string {
    if (assignmentResult.mode === 'automatica') {
      return assignmentResult.success
        ? `Campaña cerrada exitosamente con ${assignmentResult.totalAssigned} leads asignados (modo automático)`
        : `Cierre parcial: ${assignmentResult.totalAssigned}/${totalRequested} leads asignados (modo automático)`;
    } else {
      return assignmentResult.success
        ? `Campaña cerrada exitosamente con ${assignmentResult.totalAssigned} leads asignados (porcentajes exactos)`
        : `Cierre fallido: porcentajes no cumplidos ${assignmentResult.totalAssigned}/${totalRequested} leads (modo manual)`;
    }
  }

  /**
   * Obtiene los datos raw de la campaña directamente de la base de datos
   */
  private async getRawCampaignData(campaignId: number): Promise<any> {
    try {
      // Acceder directamente a la base de datos para obtener los datos raw
      const { db } = await import('../../../db');
      const { campanasComerciales, clientes } = await import('../../../../shared/schema');
      const { eq } = await import('drizzle-orm');

      const campaigns = await db
        .select()
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
        .where(eq(campanasComerciales.id, campaignId))
        .limit(1);

      if (campaigns.length === 0) {
        return null;
      }

      // Combinar datos de campaña y cliente
      const campaign = campaigns[0];
      return {
        ...campaign.campanas_comerciales,
        clientName: campaign.clientes?.nombreComercial || 'UNKNOWN',
      };
    } catch (error: any) {
      console.error(`Error getting raw campaign data for ${campaignId}:`, error);
      return null;
    }
  }
}