import { sql, eq, and, ilike, isNull, desc, asc, inArray } from 'drizzle-orm';
import { AvailableLead } from '../../domain/entities/CampaignClosure';
import { ILeadRepository } from '../../domain/interfaces/ILeadRepository';
import { opLeadsRep, opLead } from '@shared/schema';

/**
 * Implementación PostgreSQL del repositorio de leads
 * Maneja operaciones con op_lead (writes) y op_leads_rep (reads optimizados)
 */
export class PostgresLeadRepository implements ILeadRepository {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      const { db } = await import('../../../db');
      this.db = db;
    } catch (error) {
      console.error('Error initializing database for lead repository:', error);
      throw new Error('Failed to initialize lead repository');
    }
  }

  private async ensureDbInitialized() {
    if (!this.db) {
      await this.initializeDb();
    }
  }

  /**
   * Obtiene leads únicos disponibles para un cliente específico (usando op_leads_rep)
   * NUEVO: Retorna leads únicos con sus duplicate_ids para asignación precisa
   */
  async getAvailableLeadsForClient(clientName: string, brandName: string, zone: string): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();
    
    try {
      // Normalizar nombres para matching
      const normalizedClient = this.normalizeClientName(clientName);
      const normalizedBrand = brandName.toLowerCase();
      const normalizedZone = this.normalizeZoneName(zone);

      console.log(`🔍 Buscando leads únicos NO asignados desde op_leads_rep: cliente=${normalizedClient}, marca=${normalizedBrand}, zona=${normalizedZone}`);

      // NUEVA LÓGICA: Buscar desde op_leads_rep para obtener leads únicos con duplicate_ids
      const uniqueLeads = await this.db
        .select()
        .from(opLeadsRep)
        .where(
          and(
            ilike(opLeadsRep.marca, `%${normalizedBrand}%`),
            ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
            ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
          )
        )
        .orderBy(asc(opLeadsRep.fechaCreacion));

      console.log(`📊 Leads únicos encontrados: ${uniqueLeads.length}`);
      
      // Filtrar solo los que no tienen ninguno de sus duplicados asignados
      const availableUniqueLeads: any[] = [];
      
      for (const uniqueLead of uniqueLeads) {
        // Verificar si alguno de los duplicados ya está asignado
        const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
        
        const assignedCount = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(opLead)
          .where(
            and(
              inArray(opLead.id, duplicateIds),
              sql`${opLead.campaignId} IS NOT NULL`
            )
          );

        const alreadyAssigned = assignedCount[0]?.count || 0;
        
        if (alreadyAssigned === 0) {
          // Ningún duplicado está asignado, incluir este lead único
          availableUniqueLeads.push({
            ...this.mapOpLeadRepToAvailableLead(uniqueLead),
            duplicateIds: duplicateIds
          });
        }
      }

      console.log(`📊 Leads únicos disponibles (sin duplicados asignados): ${availableUniqueLeads.length}`);

      return availableUniqueLeads;
    } catch (error: any) {
      console.error(`Error getting available unique leads for ${clientName}:`, error);
      throw new Error(`Failed to get available unique leads: ${error.message}`);
    }
  }

  /**
   * Cuenta leads únicos disponibles para un cliente específico (usando op_leads_rep)
   */
  async countUniqueLeadsForClient(clientName: string, brandName: string, zone: string): Promise<number> {
    await this.ensureDbInitialized();
    
    try {

      
      const normalizedClient = this.normalizeClientName(clientName);
      const normalizedBrand = brandName.toLowerCase();
      const normalizedZone = this.normalizeZoneName(zone);

      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLead)
        .where(
          and(
            ilike(opLead.marca, `%${normalizedBrand}%`),
            ilike(opLead.cliente, `%${normalizedClient}%`),
            ilike(opLead.localizacion, `%${normalizedZone}%`),
            isNull(opLead.campaignId) // Solo leads NO asignados
          )
        );

      const count = result[0]?.count || 0;
      console.log(`📊 Leads disponibles (no asignados): ${count} para ${clientName} (${brandName}, ${zone})`);
      
      return count;
    } catch (error: any) {
      console.error(`Error counting leads for ${clientName}:`, error);
      return 0;
    }
  }

  /**
   * Asigna leads únicos a una campaña usando duplicate_ids para consistencia total
   * Nuevo parámetro: uniqueLeadsWithDuplicates[] contiene {id, duplicateIds}
   */
  async assignLeadsToCampaign(uniqueLeadsWithDuplicates: any[], campaignId: number): Promise<number> {
    await this.ensureDbInitialized();
    
    try {
      if (uniqueLeadsWithDuplicates.length === 0) {
        return 0;
      }

      // Extraer todos los duplicate_ids de los leads únicos seleccionados
      const allDuplicateIds: number[] = [];
      for (const uniqueLead of uniqueLeadsWithDuplicates) {
        const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
        allDuplicateIds.push(...duplicateIds);
      }

      console.log(`🎯 Asignando ${uniqueLeadsWithDuplicates.length} leads únicos (${allDuplicateIds.length} duplicados totales) a campaña ${campaignId}`);

      // Actualizar campaign_id para TODOS los duplicados
      const result = await this.db
        .update(opLead)
        .set({ 
          campaignId: campaignId,
          updatedAt: new Date()
        })
        .where(inArray(opLead.id, allDuplicateIds));

      console.log(`✅ Leads asignados exitosamente: ${uniqueLeadsWithDuplicates.length} únicos → ${allDuplicateIds.length} duplicados a campaña ${campaignId}`);
      
      return allDuplicateIds.length; // Retornar el total de duplicados asignados
    } catch (error: any) {
      console.error(`Error assigning unique leads to campaign ${campaignId}:`, error);
      throw new Error(`Failed to assign unique leads: ${error.message}`);
    }
  }

  /**
   * Obtiene leads asignados a una campaña
   */
  async getLeadsAssignedToCampaign(campaignId: number): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();
    
    try {

      
      const leads = await this.db
        .select()
        .from(opLead)
        .where(eq(opLead.campaignId, campaignId))
        .orderBy(asc(opLead.fechaCreacion));

      console.log(`📋 Leads asignados a campaña ${campaignId}: ${leads.length}`);

      return leads.map(this.mapOpLeadToAvailableLead);
    } catch (error: any) {
      console.error(`Error getting leads for campaign ${campaignId}:`, error);
      throw new Error(`Failed to get assigned leads: ${error.message}`);
    }
  }

  /**
   * Cuenta leads YA asignados a una campaña específica
   */
  async countAssignedLeadsForCampaign(campaignId: number): Promise<number> {
    await this.ensureDbInitialized();
    
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLead)
        .where(eq(opLead.campaignId, campaignId));

      const count = result[0]?.count || 0;
      console.log(`📊 Leads ya asignados a campaña ${campaignId}: ${count}`);
      
      return count;
    } catch (error: any) {
      console.error(`Error counting assigned leads for campaign ${campaignId}:`, error);
      return 0;
    }
  }

  /**
   * Verifica si un lead ya está asignado a alguna campaña
   */
  async isLeadAssigned(leadId: number): Promise<boolean> {
    await this.ensureDbInitialized();
    
    try {

      
      const result = await this.db
        .select({ campaignId: opLead.campaignId })
        .from(opLead)
        .where(eq(opLead.id, leadId))
        .limit(1);

      if (result.length === 0) {
        return false;
      }

      return result[0].campaignId !== null;
    } catch (error: any) {
      console.error(`Error checking if lead ${leadId} is assigned:`, error);
      return false;
    }
  }

  /**
   * Obtiene fecha del último lead asignado a una campaña
   */
  async getLastLeadDateForCampaign(campaignId: number): Promise<Date | null> {
    await this.ensureDbInitialized();
    
    try {

      
      const result = await this.db
        .select({ fechaCreacion: opLead.fechaCreacion })
        .from(opLead)
        .where(eq(opLead.campaignId, campaignId))
        .orderBy(desc(opLead.fechaCreacion))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0].fechaCreacion;
    } catch (error: any) {
      console.error(`Error getting last lead date for campaign ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Normaliza nombres de clientes para matching consistente
   */
  private normalizeClientName(clientName: string): string {
    // Extraer el nombre real del cliente si tiene formato "MARCA # #cliente"
    const parts = clientName.split(' ');
    if (parts.length > 2 && parts[1] === '#' && parts[2] === '#') {
      return parts.slice(3).join('_').toLowerCase();
    }
    
    // Normalizar IGUAL que en la sincronización:
    // 1. Remover caracteres especiales (incluye guiones)
    // 2. Reemplazar espacios con underscores  
    return clientName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remover guiones y caracteres especiales
      .replace(/\s+/g, '_');   // Reemplazar espacios con _
  }

  /**
   * Normaliza nombres de zonas para matching consistente
   */
  private normalizeZoneName(zone: string): string {
    const zoneMapping: Record<string, string> = {
      'NACIONAL': 'Pais',
      'AMBA': 'Amba', 
      'Córdoba': 'Cordoba',
      'CORDOBA': 'Cordoba',
      'Santa Fe': 'Santa Fe',
      'SANTA FE': 'Santa Fe'
    };

    return zoneMapping[zone] || zone;
  }

  /**
   * Mapea de op_leads_rep a AvailableLead
   */
  private mapOpLeadRepToAvailableLead(lead: any): AvailableLead {
    return {
      id: lead.id,
      metaLeadId: lead.metaLeadId,
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      marca: lead.marca,
      cliente: lead.cliente,
      localizacion: lead.localizacion,
      fechaCreacion: lead.fechaCreacion,
      campaignId: undefined // op_leads_rep no tiene campaign_id
    };
  }

  /**
   * Mapea de op_lead a AvailableLead
   */
  private mapOpLeadToAvailableLead(lead: any): AvailableLead {
    return {
      id: lead.id,
      metaLeadId: lead.metaLeadId,
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      marca: lead.marca,
      cliente: lead.cliente,
      localizacion: lead.localizacion,
      fechaCreacion: lead.fechaCreacion,
      campaignId: lead.campaignId
    };
  }
}