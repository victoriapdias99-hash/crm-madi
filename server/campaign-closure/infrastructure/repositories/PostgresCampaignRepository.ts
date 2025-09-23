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

    const dbTrackingId = `DB-CLOSE-${campaignId}-${Date.now()}`;
    const startTime = Date.now();

    try {
      console.log(`🔧 [${dbTrackingId}] INICIO - Intentando cerrar campaña ${campaignId}`);
      console.log(`📅 [${dbTrackingId}] Fecha final: ${finalLeadDate.toISOString()}`);
      console.log(`⏱️ [${dbTrackingId}] Timestamp del intento: ${new Date().toISOString()}`);

      // Log estado inicial de la campaña
      console.log(`🔍 [${dbTrackingId}] Verificando estado actual de la campaña...`);
      const currentState = await this.db
        .select({
          id: campanasComerciales.id,
          fechaFin: campanasComerciales.fechaFin,
          numeroCampana: campanasComerciales.numeroCampana,
          marca: campanasComerciales.marca
        })
        .from(campanasComerciales)
        .where(eq(campanasComerciales.id, campaignId))
        .limit(1);

      if (currentState.length === 0) {
        throw new Error(`Campaña ${campaignId} no encontrada en la base de datos`);
      }

      const campaign = currentState[0];
      console.log(`📋 [${dbTrackingId}] Estado actual:`, {
        id: campaign.id,
        numeroCampana: campaign.numeroCampana,
        marca: campaign.marca,
        fechaFinActual: campaign.fechaFin?.toISOString() || 'null',
        yaEstaCerrada: !!campaign.fechaFin
      });

      if (campaign.fechaFin) {
        console.warn(`⚠️ [${dbTrackingId}] ADVERTENCIA: Campaña ya estaba cerrada con fecha ${campaign.fechaFin.toISOString()}`);
      }

      console.log(`💾 [${dbTrackingId}] Ejecutando UPDATE en campanasComerciales...`);
      const updateStartTime = Date.now();

      const result = await this.db
        .update(campanasComerciales)
        .set({
          fechaFin: finalLeadDate,
          updatedAt: new Date()
        })
        .where(eq(campanasComerciales.id, campaignId));

      const updateDuration = Date.now() - updateStartTime;
      console.log(`✅ [${dbTrackingId}] UPDATE completado en ${updateDuration}ms`);

      // Verificar que el cierre fue exitoso
      console.log(`🔍 [${dbTrackingId}] Verificando cierre exitoso...`);
      const verificationResult = await this.db
        .select({ fechaFin: campanasComerciales.fechaFin })
        .from(campanasComerciales)
        .where(eq(campanasComerciales.id, campaignId))
        .limit(1);

      if (verificationResult.length === 0) {
        throw new Error(`Verificación falló: Campaña ${campaignId} no encontrada después del UPDATE`);
      }

      const updatedFechaFin = verificationResult[0].fechaFin;
      if (!updatedFechaFin) {
        throw new Error(`Verificación falló: fechaFin sigue siendo null después del UPDATE`);
      }

      const totalDuration = Date.now() - startTime;
      console.log(`🎉 [${dbTrackingId}] ÉXITO TOTAL en ${totalDuration}ms`);
      console.log(`✅ [${dbTrackingId}] Campaña ${campaignId} cerrada exitosamente`);
      console.log(`📅 [${dbTrackingId}] Fecha final verificada: ${updatedFechaFin.toISOString()}`);

    } catch (error: any) {
      const errorDuration = Date.now() - startTime;
      console.error(`💥 [${dbTrackingId}] ERROR CRÍTICO después de ${errorDuration}ms:`, {
        campaignId,
        finalLeadDate: finalLeadDate.toISOString(),
        errorDuration: `${errorDuration}ms`,
        errorMessage: error.message || 'Sin mensaje',
        errorName: error.name || 'Sin nombre',
        errorCode: error.code || 'Sin código',
        errorDetail: error.detail || 'Sin detalle',
        errorHint: error.hint || 'Sin hint',
        errorConstraint: error.constraint || 'Sin constraint',
        errorTable: error.table || 'Sin tabla',
        errorColumn: error.column || 'Sin columna',
        errorDataType: error.dataType || 'Sin dataType',
        errorSeverity: error.severity || 'Sin severity',
        errorPosition: error.position || 'Sin position',
        errorWhere: error.where || 'Sin where',
        errorSchema: error.schema || 'Sin schema',
        errorRoutine: error.routine || 'Sin routine',
        errorType: typeof error,
        errorConstructor: error.constructor?.name || 'Sin constructor',
        stackTrace: error.stack || 'Sin stack trace',
        timestamp: new Date().toISOString(),
        systemState: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      });

      // Logs específicos por tipo de error de base de datos
      if (error.code === '23503') {
        console.error(`🔗 [${dbTrackingId}] FOREIGN KEY CONSTRAINT ERROR`);
      } else if (error.code === '23505') {
        console.error(`🔑 [${dbTrackingId}] UNIQUE CONSTRAINT ERROR`);
      } else if (error.code === '08P01') {
        console.error(`🔌 [${dbTrackingId}] CONNECTION ERROR`);
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        console.error(`⏱️ [${dbTrackingId}] DATABASE TIMEOUT ERROR`);
      } else if (error.message?.includes('connection')) {
        console.error(`🔌 [${dbTrackingId}] CONNECTION-RELATED ERROR`);
      }

      throw new Error(`Failed to close campaign ${campaignId}: ${error.message || 'Unknown database error'}`);
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
          nombreComercial: clientes.nombreComercial,
          // Campos multi-marca
          porcentaje: campanasComerciales.porcentaje,
          marca2: campanasComerciales.marca2,
          porcentaje2: campanasComerciales.porcentaje2,
          marca3: campanasComerciales.marca3,
          porcentaje3: campanasComerciales.porcentaje3,
          marca4: campanasComerciales.marca4,
          porcentaje4: campanasComerciales.porcentaje4,
          marca5: campanasComerciales.marca5,
          porcentaje5: campanasComerciales.porcentaje5
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