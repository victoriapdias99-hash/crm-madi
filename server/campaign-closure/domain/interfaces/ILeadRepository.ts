import { AvailableLead } from '../entities/CampaignClosure';

/**
 * Interface para repositorio de leads
 * Define las operaciones de acceso a datos para leads en el proceso de cierre
 */
export interface ILeadRepository {
  // Obtener leads únicos disponibles para un cliente específico
  getAvailableLeadsForClient(clientName: string, brandName: string, zone: string): Promise<AvailableLead[]>;
  
  // Contar leads únicos disponibles (usando op_leads_rep)
  countUniqueLeadsForClient(clientName: string, brandName: string, zone: string): Promise<number>;
  
  // Contar leads ya asignados a una campaña específica
  countAssignedLeadsForCampaign(campaignId: number): Promise<number>;
  
  // Asignar leads únicos a una campaña usando duplicate_ids para consistencia total
  assignLeadsToCampaign(uniqueLeadsWithDuplicates: any[], campaignId: number): Promise<number>;
  
  // Obtener leads asignados a una campaña
  getLeadsAssignedToCampaign(campaignId: number): Promise<AvailableLead[]>;
  
  // Verificar si un lead ya está asignado a alguna campaña
  isLeadAssigned(leadId: number): Promise<boolean>;
  
  // Obtener fecha del último lead asignado a una campaña
  getLastLeadDateForCampaign(campaignId: number): Promise<Date | null>;
  
  // NUEVO: Obtener leads optimizado con límite
  getLeadsForAssignment(
    clientName: string,
    brandName: string,
    zone: string,
    limit: number
  ): Promise<AvailableLead[]>;
  
  // NUEVO: Asignar leads en lotes con progreso
  assignLeadsInBatches(
    leads: AvailableLead[],
    campaignId: number,
    batchSize?: number,
    onProgress?: (processed: number, total: number) => void
  ): Promise<number>;
  
  // NUEVO: Asignación atómica de leads con verificación de continuidad
  assignLeadsAtomically(
    clientName: string, 
    brandName: string, 
    zone: string, 
    campaignId: number, 
    targetCount: number
  ): Promise<{
    assigned: number;
    finalLeadDate?: Date;
    leads: AvailableLead[];
    continuityVerified: boolean;
    exactCountVerified: boolean;
  }>;
}