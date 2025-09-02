import { sql, desc, eq, and, ilike, isNull } from 'drizzle-orm';
import { CampaignClosure } from '../../domain/entities/CampaignClosure';
import { ICampaignRepository } from '../../domain/interfaces/ICampaignRepository';
import { campanasComerciales, clientes } from '@shared/schema';

/**
 * Implementación PostgreSQL del repositorio de campañas
 * Accede a la tabla dashboard_campaigns para obtener información de campañas
 */
export class PostgresCampaignRepository implements ICampaignRepository {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      const { db } = await import('../../../db');
      this.db = db;
    } catch (error) {
      console.error('Error initializing database for campaign repository:', error);
      throw new Error('Failed to initialize campaign repository');
    }
  }

  private async ensureDbInitialized() {
    if (!this.db) {
      await this.initializeDb();
    }
  }

  /**
   * Obtiene todas las campañas pendientes de cierre (estado "En proceso")
   */
  async getPendingCampaigns(): Promise<CampaignClosure[]> {
    await this.ensureDbInitialized();
    
    try {
      // Buscar campañas que no tengan fecha_fin (están en proceso)
      const campaigns = await this.db
        .select({
          id: campanasComerciales.id,
          numeroCampana: campanasComerciales.numeroCampana,
          cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados,
          marca: campanasComerciales.marca,
          zona: campanasComerciales.zona,
          fechaCampana: campanasComerciales.fechaCampana,
          fechaFin: campanasComerciales.fechaFin,
          clienteId: campanasComerciales.clienteId,
          nombreComercial: clientes.nombreComercial
        })
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
        .where(isNull(campanasComerciales.fechaFin))
        .orderBy(campanasComerciales.clienteId, campanasComerciales.numeroCampana);

      console.log(`📋 Campañas pendientes encontradas: ${campaigns.length}`);

      return campaigns.map(this.mapCampanaComercialToCampaignClosure);
    } catch (error: any) {
      console.error('Error getting pending campaigns:', error);
      throw new Error(`Failed to get pending campaigns: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas por cliente ordenadas por fecha de inicio
   */
  async getCampaignsByClient(clientName: string): Promise<CampaignClosure[]> {
    await this.ensureDbInitialized();
    
    try {
      const campaigns = await this.db
        .select({
          id: campanasComerciales.id,
          numeroCampana: campanasComerciales.numeroCampana,
          cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados,
          marca: campanasComerciales.marca,
          zona: campanasComerciales.zona,
          fechaCampana: campanasComerciales.fechaCampana,
          fechaFin: campanasComerciales.fechaFin,
          clienteId: campanasComerciales.clienteId,
          nombreComercial: clientes.nombreComercial
        })
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
        .where(
          and(
            ilike(clientes.nombreComercial, `%${clientName}%`),
            isNull(campanasComerciales.fechaFin) // Solo campañas en proceso
          )
        )
        .orderBy(campanasComerciales.fechaCampana, campanasComerciales.numeroCampana);

      console.log(`📋 Campañas para cliente "${clientName}": ${campaigns.length}`);

      return campaigns.map(this.mapCampanaComercialToCampaignClosure);
    } catch (error: any) {
      console.error(`Error getting campaigns for client ${clientName}:`, error);
      throw new Error(`Failed to get campaigns for client: ${error.message}`);
    }
  }

  /**
   * Marca una campaña como finalizada con fecha específica
   */
  async closeCampaign(campaignId: number, finalLeadDate: Date): Promise<void> {
    await this.ensureDbInitialized();
    
    try {
      await this.db
        .update(campanasComerciales)
        .set({
          fechaFin: finalLeadDate,
          updatedAt: new Date()
        })
        .where(eq(campanasComerciales.id, campaignId));

      console.log(`✅ Campaña ${campaignId} cerrada con fecha: ${finalLeadDate.toISOString()}`);
    } catch (error: any) {
      console.error(`Error closing campaign ${campaignId}:`, error);
      throw new Error(`Failed to close campaign: ${error.message}`);
    }
  }

  /**
   * Obtiene una campaña por ID
   */
  async getCampaignById(campaignId: number): Promise<CampaignClosure | null> {
    await this.ensureDbInitialized();
    
    try {
      const campaigns = await this.db
        .select({
          id: campanasComerciales.id,
          numeroCampana: campanasComerciales.numeroCampana,
          cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados,
          marca: campanasComerciales.marca,
          zona: campanasComerciales.zona,
          fechaCampana: campanasComerciales.fechaCampana,
          fechaFin: campanasComerciales.fechaFin,
          clienteId: campanasComerciales.clienteId,
          nombreComercial: clientes.nombreComercial
        })
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
        .where(eq(campanasComerciales.id, campaignId))
        .limit(1);

      if (campaigns.length === 0) {
        return null;
      }

      return this.mapCampanaComercialToCampaignClosure(campaigns[0]);
    } catch (error: any) {
      console.error(`Error getting campaign ${campaignId}:`, error);
      throw new Error(`Failed to get campaign: ${error.message}`);
    }
  }

  /**
   * Verifica si una campaña está cerrada
   */
  async isCampaignClosed(campaignId: number): Promise<boolean> {
    await this.ensureDbInitialized();
    
    try {
      const result = await this.db
        .select({ fechaFin: campanasComerciales.fechaFin })
        .from(campanasComerciales)
        .where(eq(campanasComerciales.id, campaignId))
        .limit(1);

      if (result.length === 0) {
        return false;
      }

      return result[0].fechaFin !== null;
    } catch (error: any) {
      console.error(`Error checking campaign status ${campaignId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene lista de clientes únicos con campañas pendientes
   */
  async getClientsWithPendingCampaigns(): Promise<string[]> {
    await this.ensureDbInitialized();
    
    try {
      const clients = await this.db
        .selectDistinct({ nombreComercial: clientes.nombreComercial })
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
        .where(isNull(campanasComerciales.fechaFin))
        .orderBy(clientes.nombreComercial);

      const clientNames = clients.map((c: any) => c.nombreComercial);
      console.log(`👥 Clientes con campañas pendientes: ${clientNames.length}`);
      
      return clientNames;
    } catch (error: any) {
      console.error('Error getting clients with pending campaigns:', error);
      throw new Error(`Failed to get clients: ${error.message}`);
    }
  }

  /**
   * Mapea de campanas_comerciales a CampaignClosure
   */
  private mapCampanaComercialToCampaignClosure(campaign: any): CampaignClosure {
    const campaignNumber = parseInt(campaign.numeroCampana) || 1;
    
    return {
      id: campaign.id,
      clientName: campaign.nombreComercial || 'UNKNOWN CLIENT',
      brandName: campaign.marca || 'UNKNOWN',
      campaignNumber,
      startDate: campaign.fechaCampana || new Date(),
      targetLeads: campaign.cantidadDatosSolicitados || 0,
      currentLeads: 0, // Será calculado por el LeadRepository
      zone: campaign.zona || 'NACIONAL',
      status: campaign.fechaFin ? 'Finalizada' : 'En proceso',
      fechaFin: campaign.fechaFin
    };
  }
}