import { AvailableLead } from '../entities/CampaignClosure';
import { ILeadRepository } from '../interfaces/ILeadRepository';

/**
 * Servicio especializado en asignación de leads
 * Maneja la lógica específica de asignar leads únicos a campañas
 */
export class LeadAssigner {
  constructor(private leadRepository: ILeadRepository) {}

  /**
   * NUEVO: Asigna leads usando función atómica que previene race conditions
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
      console.log(`   📅 Continuidad verificada: ${result.continuityVerified ? '✅' : '⚠️'}`);
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