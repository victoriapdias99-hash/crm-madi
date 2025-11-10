import { AvailableLead } from '../entities/CampaignClosure';
import { ILeadRepository } from '../interfaces/ILeadRepository';
import { extractBrandsFromCampaign, calculateLeadDistribution, validateBrandPercentages, BrandInfo } from '../../../../shared/utils/multi-brand-utils';

/**
 * Servicio especializado en asignación de leads
 * Maneja la lógica específica de asignar leads únicos a campañas
 */
export class LeadAssigner {
  constructor(private leadRepository: ILeadRepository) {}

  /**
   * NUEVO: Asigna leads con distribución por múltiples marcas según porcentajes
   */
  async assignLeadsWithMultiBrands(
    campaignData: any,
    clientName: string,
    zone: string,
    campaignId: number,
    targetCount: number
  ): Promise<{
    success: boolean;
    totalAssigned: number;
    brandDistribution: { [marca: string]: number };
    details: any[];
    mode: 'automatica' | 'manual';
  }> {
    try {
      console.log(`🎯 ASIGNACIÓN MULTI-MARCA INICIADA: ${targetCount} leads para campaña ${campaignId}`);

      // 1. Determinar modo de asignación
      const isAutomatic = campaignData.asignacionAutomatica === true;
      const mode = isAutomatic ? 'automatica' : 'manual';

      console.log(`⚙️ MODO DE ASIGNACIÓN: ${mode.toUpperCase()}`);

      if (isAutomatic) {
        return await this.assignLeadsAutomatically(campaignData, clientName, zone, campaignId, targetCount);
      } else {
        return await this.assignLeadsManually(campaignData, clientName, zone, campaignId, targetCount);
      }

    } catch (error: any) {
      console.error(`❌ Error en asignación multi-marca:`, error);
      throw new Error(`Multi-brand assignment failed: ${error.message}`);
    }
  }

  /**
   * MODO AUTOMÁTICO: Pool unificado ordenado cronológicamente (ignora porcentajes)
   */
  private async assignLeadsAutomatically(
    campaignData: any,
    clientName: string,
    zone: string,
    campaignId: number,
    targetCount: number
  ): Promise<{
    success: boolean;
    totalAssigned: number;
    brandDistribution: { [marca: string]: number };
    details: any[];
    mode: 'automatica';
  }> {
    console.log(`🤖 MODO AUTOMÁTICO: Pool unificado cronológico`);

    // 1. Extraer marcas (TODAS, sin considerar porcentajes)
    const brands = extractBrandsFromCampaign(campaignData, true); // automaticMode = true
    const brandNames = brands.map(b => b.marca);

    console.log(`🏷️ Marcas disponibles: ${brandNames.join(', ')}`);
    console.log(`❌ Porcentajes IGNORADOS en modo automático`);

    // 2. Obtener pool unificado ordenado cronológicamente
    const availableLeads = await this.leadRepository.getUnifiedLeadsPoolChronologically(
      clientName,
      brandNames,
      zone,
      campaignId,
      targetCount
    );

    console.log(`📊 Pool unificado disponible: ${availableLeads.length}/${targetCount} leads`);

    // 3. Asignar en bloque cronológico
    const result = await this.leadRepository.assignLeadsChronologically(
      availableLeads,
      campaignId
    );

    // 4. Construir detalles por marca
    const details = brandNames.map(marca => ({
      marca,
      porcentaje: 0, // Ignorado en modo automático
      solicitados: 0, // No aplica en modo automático
      asignados: result.brandDistribution[marca] || 0,
      exito: true // Siempre exitoso si hay leads
    }));

    const success = result.assigned === targetCount;

    console.log(`✅ ASIGNACIÓN AUTOMÁTICA COMPLETADA:`);
    console.log(`   Total asignado: ${result.assigned}/${targetCount}`);
    console.log(`   Distribución real:`, result.brandDistribution);
    console.log(`   Éxito: ${success ? '✅' : '❌'} (${success ? 'completo' : 'parcial'})`);

    return {
      success,
      totalAssigned: result.assigned,
      brandDistribution: result.brandDistribution,
      details,
      mode: 'automatica'
    };
  }

  /**
   * MODO MANUAL: Asignación por porcentajes exactos
   */
  private async assignLeadsManually(
    campaignData: any,
    clientName: string,
    zone: string,
    campaignId: number,
    targetCount: number
  ): Promise<{
    success: boolean;
    totalAssigned: number;
    brandDistribution: { [marca: string]: number };
    details: any[];
    mode: 'manual';
  }> {
    console.log(`📊 MODO MANUAL: Asignación por porcentajes exactos`);

    // 1. Extraer y validar configuración de marcas (solo con porcentaje > 0)
    const brands = extractBrandsFromCampaign(campaignData, false); // automaticMode = false
    const validation = validateBrandPercentages(brands);

    if (!validation.valid) {
      throw new Error(`Configuración inválida de marcas: ${validation.error}`);
    }

    console.log(`🏷️ Marcas configuradas: ${brands.length}`);
    brands.forEach((brand, i) => {
      console.log(`   ${i + 1}. ${brand.marca}: ${brand.porcentaje}%`);
    });

    // 2. Calcular distribución exacta por porcentajes
    const distribution = calculateLeadDistribution(targetCount, brands);
    console.log(`📊 Distribución exacta:`, distribution);

    // 3. Asignar por cada marca individual (porcentajes exactos)
    const assignmentDetails = [];
    let totalAssigned = 0;

    for (const brand of brands) {
      const leadsForBrand = distribution[brand.marca];

      if (leadsForBrand > 0) {
        console.log(`\n🎯 Asignando ${leadsForBrand} leads para marca: ${brand.marca} (${brand.porcentaje}%)`);

        const result = await this.assignLeadsToTarget(
          clientName,
          brand.marca,
          zone,
          campaignId,
          leadsForBrand
        );

        const exactMatch = result.assigned === leadsForBrand;

        assignmentDetails.push({
          marca: brand.marca,
          porcentaje: brand.porcentaje,
          solicitados: leadsForBrand,
          asignados: result.assigned,
          exito: exactMatch
        });

        totalAssigned += result.assigned;

        console.log(`   ${exactMatch ? '✅' : '❌'} ${brand.marca}: ${result.assigned}/${leadsForBrand} leads`);

        // En modo manual, el fallo de una marca falla toda la operación INMEDIATAMENTE
        if (!exactMatch) {
          console.log(`❌ ERROR CRÍTICO: No se pudo asignar porcentaje exacto para ${brand.marca}`);
          throw new Error(`Modo manual falló: No se pueden asignar ${leadsForBrand} leads exactos para ${brand.marca} (solo ${result.assigned} disponibles)`);
        }
      } else {
        assignmentDetails.push({
          marca: brand.marca,
          porcentaje: brand.porcentaje,
          solicitados: 0,
          asignados: 0,
          exito: true
        });
      }
    }

    // 4. Evaluar éxito: debe asignar EXACTAMENTE lo solicitado por porcentaje
    const exactSuccess = totalAssigned === targetCount &&
                        assignmentDetails.every(detail => detail.exito);

    console.log(`\n📊 RESUMEN MODO MANUAL:`);
    console.log(`   Total asignado: ${totalAssigned}/${targetCount}`);
    console.log(`   Porcentajes exactos: ${exactSuccess ? '✅' : '❌'}`);

    // 5. Construir distribución final por marca
    const brandDistribution: { [marca: string]: number } = {};
    assignmentDetails.forEach(detail => {
      brandDistribution[detail.marca] = detail.asignados;
    });

    return {
      success: exactSuccess,
      totalAssigned,
      brandDistribution,
      details: assignmentDetails,
      mode: 'manual'
    };
  }

  /**
   * EXISTENTE: Asigna leads usando función atómica que previene race conditions
   */
  async assignLeadsToTarget(
    clientName: string,
    brandName: string,
    zone: string,
    campaignId: number,
    targetCount: number
  ): Promise<{
    assigned: number;
    finalLeadDate?: Date;
    leads: AvailableLead[];
  }> {
    try {
      console.log(`🎯 ASIGNACIÓN ATÓMICA INICIADA: ${targetCount} leads para campaña ${campaignId}`);
      console.log(`📋 Filtros: cliente=${clientName}, marca=${brandName}, zona=${zone}`);

      // USAR NUEVA FUNCIÓN ATÓMICA - Una sola operación, sin race conditions
      const result = await this.leadRepository.assignLeadsAtomically(
        clientName,
        brandName,
        zone,
        campaignId,
        targetCount
      );

      console.log(`✅ ASIGNACIÓN ATÓMICA COMPLETADA:`);
      console.log(`   📊 Leads asignados: ${result.assigned}`);
      console.log(`   🔢 Conteo exacto verificado: ${result.exactCountVerified ? '✅' : '⚠️'}`);
      console.log(`   📅 Fecha final: ${result.finalLeadDate?.toISOString()}`);

      // Verificar que la asignación fue exitosa
      if (!result.exactCountVerified) {
        throw new Error(`Error crítico: conteo inexacto en asignación atómica`);
      }

      return {
        assigned: result.assigned,
        finalLeadDate: result.finalLeadDate,
        leads: result.leads
      };
    } catch (error: any) {
      console.error(`❌ ERROR EN ASIGNACIÓN ATÓMICA:`, error);
      throw new Error(`Atomic lead assignment failed: ${error.message}`);
    }
  }

  /**
   * Valida que los leads están correctamente asignados
   */
  async validateAssignment(campaignId: number, expectedCount: number): Promise<boolean> {
    try {
      const assignedLeads = await this.leadRepository.getLeadsAssignedToCampaign(campaignId);
      const actualCount = assignedLeads.length;
      
      console.log(`✅ Validación: esperados ${expectedCount}, asignados ${actualCount}`);
      
      return actualCount === expectedCount;
    } catch (error: any) {
      console.error(`❌ Error validando asignación:`, error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas de leads disponibles por cliente
   */
  async getAvailabilityStats(clientName: string, brandName: string, zone: string): Promise<{
    total: number;
    available: number;
    assigned: number;
  }> {
    try {
      const allLeads = await this.leadRepository.getAvailableLeadsForClient(clientName, brandName, zone);
      const total = allLeads.length;
      
      let assigned = 0;
      for (const lead of allLeads) {
        const isAssigned = await this.leadRepository.isLeadAssigned(lead.id);
        if (isAssigned) assigned++;
      }
      
      const available = total - assigned;
      
      return { total, available, assigned };
    } catch (error: any) {
      console.error(`❌ Error obteniendo estadísticas:`, error);
      return { total: 0, available: 0, assigned: 0 };
    }
  }
}