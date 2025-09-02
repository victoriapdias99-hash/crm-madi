import { sql, eq, and, ilike, isNull, desc, asc } from 'drizzle-orm';
import { AvailableLead } from '../../domain/entities/CampaignClosure';
import { ILeadRepository } from '../../domain/interfaces/ILeadRepository';

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
   */
  async getAvailableLeadsForClient(clientName: string, brandName: string, zone: string): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();
    
    try {
      const { opLeadsRep } = await import('../../../shared/schema');
      
      // Normalizar nombres para matching
      const normalizedClient = this.normalizeClientName(clientName);
      const normalizedBrand = brandName.toLowerCase();
      const normalizedZone = this.normalizeZoneName(zone);

      console.log(`🔍 Buscando leads para: cliente=${normalizedClient}, marca=${normalizedBrand}, zona=${normalizedZone}`);

      const leads = await this.db
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

      console.log(`📊 Leads únicos encontrados: ${leads.length}`);

      return leads.map(this.mapOpLeadRepToAvailableLead);
    } catch (error: any) {
      console.error(`Error getting available leads for ${clientName}:`, error);
      throw new Error(`Failed to get available leads: ${error.message}`);
    }
  }

  /**
   * Cuenta leads únicos disponibles para un cliente específico (usando op_leads_rep)
   */
  async countUniqueLeadsForClient(clientName: string, brandName: string, zone: string): Promise<number> {
    await this.ensureDbInitialized();
    
    try {
      const { opLeadsRep } = await import('../../../shared/schema');
      
      const normalizedClient = this.normalizeClientName(clientName);
      const normalizedBrand = brandName.toLowerCase();
      const normalizedZone = this.normalizeZoneName(zone);

      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLeadsRep)
        .where(
          and(
            ilike(opLeadsRep.marca, `%${normalizedBrand}%`),
            ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
            ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
          )
        );

      const count = result[0]?.count || 0;
      console.log(`📊 Count de leads únicos: ${count} para ${clientName} (${brandName}, ${zone})`);
      
      return count;
    } catch (error: any) {
      console.error(`Error counting leads for ${clientName}:`, error);
      return 0;
    }
  }

  /**
   * Asigna leads a una campaña específica (actualizar campaign_id en op_lead)
   */
  async assignLeadsToCampaign(leadIds: number[], campaignId: number): Promise<number> {
    await this.ensureDbInitialized();
    
    try {
      const { opLead } = await import('../../../shared/schema');
      
      if (leadIds.length === 0) {
        return 0;
      }

      console.log(`🎯 Asignando ${leadIds.length} leads a campaña ${campaignId}`);

      // Actualizar campaign_id para los leads especificados
      const result = await this.db
        .update(opLead)
        .set({ 
          campaignId: campaignId,
          updatedAt: new Date()
        })
        .where(sql`${opLead.id} = ANY(${leadIds})`);

      console.log(`✅ Leads asignados exitosamente a campaña ${campaignId}`);
      
      return leadIds.length;
    } catch (error: any) {
      console.error(`Error assigning leads to campaign ${campaignId}:`, error);
      throw new Error(`Failed to assign leads: ${error.message}`);
    }
  }

  /**
   * Obtiene leads asignados a una campaña
   */
  async getLeadsAssignedToCampaign(campaignId: number): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();
    
    try {
      const { opLead } = await import('../../../shared/schema');
      
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
   * Verifica si un lead ya está asignado a alguna campaña
   */
  async isLeadAssigned(leadId: number): Promise<boolean> {
    await this.ensureDbInitialized();
    
    try {
      const { opLead } = await import('../../../shared/schema');
      
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
      const { opLead } = await import('../../../shared/schema');
      
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
    
    // Fallback: normalizar espacios a guiones bajos
    return clientName.replace(/\s+/g, '_').toLowerCase();
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