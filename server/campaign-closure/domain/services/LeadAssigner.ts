import { AvailableLead } from '../entities/CampaignClosure';
import { ILeadRepository } from '../interfaces/ILeadRepository';

/**
 * Servicio especializado en asignación de leads
 * Maneja la lógica específica de asignar leads únicos a campañas
 */
export class LeadAssigner {
  constructor(private leadRepository: ILeadRepository) {}

  /**
   * Asigna leads únicos a una campaña específica
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
      console.log(`🎯 Asignando hasta ${targetCount} leads para campaña ${campaignId}`);
      console.log(`📋 Filtros: cliente=${clientName}, marca=${brandName}, zona=${zone}`);

      // Obtener leads únicos disponibles
      const availableLeads = await this.leadRepository.getAvailableLeadsForClient(
        clientName,
        brandName,
        zone
      );

      console.log(`📊 Leads únicos disponibles: ${availableLeads.length}`);

      if (availableLeads.length === 0) {
        return { assigned: 0, leads: [] };
      }

      // Filtrar solo leads no asignados
      const unassignedLeads = [];
      for (const lead of availableLeads) {
        const isAssigned = await this.leadRepository.isLeadAssigned(lead.id);
        if (!isAssigned) {
          unassignedLeads.push(lead);
        }
      }

      console.log(`📋 Leads no asignados: ${unassignedLeads.length}`);

      // Ordenar por fecha de creación (más antiguos primero)
      const sortedLeads = unassignedLeads.sort((a, b) => 
        a.fechaCreacion.getTime() - b.fechaCreacion.getTime()
      );

      // Tomar solo los leads necesarios
      const leadsToAssign = sortedLeads.slice(0, targetCount);
      const leadIds = leadsToAssign.map(lead => lead.id);

      if (leadIds.length === 0) {
        return { assigned: 0, leads: [] };
      }

      // Asignar leads a la campaña
      const assignedCount = await this.leadRepository.assignLeadsToCampaign(leadsToAssign, campaignId);

      const finalLeadDate = leadsToAssign.length > 0 
        ? leadsToAssign[leadsToAssign.length - 1].fechaCreacion 
        : undefined;

      console.log(`✅ Asignados ${assignedCount} leads. Fecha final: ${finalLeadDate?.toISOString()}`);

      return {
        assigned: assignedCount,
        finalLeadDate,
        leads: leadsToAssign
      };
    } catch (error: any) {
      console.error(`❌ Error en asignación de leads:`, error);
      throw new Error(`Failed to assign leads: ${error.message}`);
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