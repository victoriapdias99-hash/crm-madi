import { sql, eq } from 'drizzle-orm';
import { FinishedCampaign, FinishedCampaignFilters, FinishedCampaignStats } from '../../domain/entities/FinishedCampaign';
import { IFinishedCampaignRepository } from '../../domain/interfaces/IFinishedCampaignRepository';

/**
 * Implementación PostgreSQL del repositorio de campañas finalizadas
 *
 * Accede directamente a las tablas:
 * - campanas_comerciales: Datos de las campañas
 * - clientes: Información de clientes
 *
 * DIFERENCIA CLAVE con PendingCampaignRepository:
 * WHERE cc.fecha_fin IS NOT NULL (solo campañas cerradas)
 *
 * IMPORTANTE: Los campos calculados (enviados, duplicados, etc.)
 * se obtienen del endpoint principal que usa contarLeadsPorCampana()
 */
export class PostgresFinishedCampaignRepository implements IFinishedCampaignRepository {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      const { db } = await import('../../../db');
      this.db = db;
    } catch (error) {
      console.error('❌ Error initializing database for finished campaign repository:', error);
      throw new Error('Failed to initialize finished campaign repository');
    }
  }

  private async ensureDbInitialized() {
    if (!this.db) {
      await this.initializeDb();
    }
  }

  /**
   * Obtiene todas las campañas finalizadas (fechaFin IS NOT NULL)
   */
  async findAllFinished(filters?: FinishedCampaignFilters): Promise<FinishedCampaign[]> {
    await this.ensureDbInitialized();

    console.log('🔍 [PostgresFinishedCampaignRepository] Consultando campañas finalizadas...');
    console.log('📋 [PostgresFinishedCampaignRepository] Filtros aplicados:', JSON.stringify(filters, null, 2));

    try {
      // Query directa a tablas reales con JOIN
      let query = `
        SELECT
          cc.*,
          cl.nombre_cliente,
          cl.nombre_comercial,
          cl.tipo_facturacion,
          cl.tipo_cliente
        FROM campanas_comerciales cc
        LEFT JOIN clientes cl ON cl.id = cc.cliente_id
        WHERE cc.fecha_fin IS NOT NULL
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Aplicar filtros
      if (filters?.zona) {
        query += ` AND cc.zona = $${paramIndex}`;
        params.push(filters.zona);
        paramIndex++;
      }

      if (filters?.marca) {
        query += ` AND cc.marca = $${paramIndex}`;
        params.push(filters.marca);
        paramIndex++;
      }

      if (filters?.cliente || filters?.clienteNombre) {
        const clienteFilter = filters?.cliente || filters?.clienteNombre;
        query += ` AND cl.nombre_cliente ILIKE $${paramIndex}`;
        params.push(`%${clienteFilter}%`);
        paramIndex++;
      }

      // Filtros por fecha de inicio de campaña
      if (filters?.fechaInicio) {
        query += ` AND cc.fecha_campana >= $${paramIndex}`;
        params.push(filters.fechaInicio);
        paramIndex++;
      }

      if (filters?.fechaFin) {
        query += ` AND cc.fecha_campana <= $${paramIndex}`;
        params.push(filters.fechaFin);
        paramIndex++;
      }

      // Filtros por fecha de cierre
      if (filters?.fechaCierreInicio) {
        query += ` AND cc.fecha_fin >= $${paramIndex}`;
        params.push(filters.fechaCierreInicio);
        paramIndex++;
      }

      if (filters?.fechaCierreFin) {
        query += ` AND cc.fecha_fin <= $${paramIndex}`;
        params.push(filters.fechaCierreFin);
        paramIndex++;
      }

      // Ordenar
      const sortBy = filters?.sortBy || 'fechaCierre';
      const sortOrder = filters?.sortOrder || 'desc';

      switch (sortBy) {
        case 'fecha':
          query += ` ORDER BY cc.fecha_campana ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        case 'fechaCierre':
          query += ` ORDER BY cc.fecha_fin ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        case 'cliente':
          query += ` ORDER BY cl.nombre_cliente ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        case 'marca':
          query += ` ORDER BY cc.marca ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        default:
          query += ` ORDER BY cc.fecha_fin DESC`;
      }

      const result = await this.db.execute(sql.raw(query, params));
      const campaigns = result.rows.map(this.mapRowToFinishedCampaign);

      console.log(`✅ [PostgresFinishedCampaignRepository] ${campaigns.length} campañas finalizadas encontradas`);

      return campaigns;
    } catch (error: any) {
      console.error('❌ [PostgresFinishedCampaignRepository] Error en findAllFinished:', error);
      throw new Error(`Error al consultar campañas finalizadas: ${error.message}`);
    }
  }

  /**
   * Obtiene una campaña finalizada por ID
   * Usa Drizzle Query Builder para evitar problemas con parámetros SQL
   */
  async findById(id: number): Promise<FinishedCampaign | null> {
    await this.ensureDbInitialized();

    console.log(`🔍 [PostgresFinishedCampaignRepository] Buscando campaña ID: ${id}`);

    try {
      const { campanasComerciales, clientes } = await import('@shared/schema');
      const { and, isNotNull } = await import('drizzle-orm');

      const result = await this.db
        .select({
          cc: campanasComerciales,
          cl: clientes
        })
        .from(campanasComerciales)
        .leftJoin(clientes, eq(clientes.id, campanasComerciales.clienteId))
        .where(
          and(
            eq(campanasComerciales.id, id),
            isNotNull(campanasComerciales.fechaFin)
          )
        )
        .limit(1);

      if (result.length === 0) {
        console.log(`⚠️ [PostgresFinishedCampaignRepository] No se encontró campaña finalizada ID: ${id}`);
        console.log(`   Verificando si existe en la tabla...`);
        const checkResult = await this.db.select().from(campanasComerciales).where(eq(campanasComerciales.id, id));
        if (checkResult.length > 0) {
          console.log(`   ⚠️ La campaña existe pero fechaFin es:`, checkResult[0].fechaFin);
        } else {
          console.log(`   ❌ La campaña no existe en la tabla`);
        }
        return null;
      }

      const row = { ...result[0].cc, nombre_cliente: result[0].cl?.nombreCliente };
      const campaign = this.mapRowToFinishedCampaign(row);
      console.log(`✅ [PostgresFinishedCampaignRepository] Campaña encontrada: ${campaign.clienteNombre}`);
      console.log(`   fechaFin:`, row.fecha_fin);

      return campaign;
    } catch (error: any) {
      console.error(`❌ [PostgresFinishedCampaignRepository] Error en findById(${id}):`, error);
      throw new Error(`Error al buscar campaña: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas finalizadas por cliente
   */
  async findByClient(clientName: string): Promise<FinishedCampaign[]> {
    await this.ensureDbInitialized();

    console.log(`🔍 [PostgresFinishedCampaignRepository] Buscando campañas del cliente: ${clientName}`);

    try {
      const query = `
        SELECT
          cc.*,
          cl.nombre_cliente,
          cl.nombre_comercial,
          cl.tipo_facturacion,
          cl.tipo_cliente
        FROM campanas_comerciales cc
        LEFT JOIN clientes cl ON cl.id = cc.cliente_id
        WHERE cl.nombre_cliente ILIKE $1 AND cc.fecha_fin IS NOT NULL
        ORDER BY cc.fecha_fin DESC
      `;

      const result = await this.db.execute(sql.raw(query, [`%${clientName}%`]));
      const campaigns = result.rows.map(this.mapRowToFinishedCampaign);

      console.log(`✅ [PostgresFinishedCampaignRepository] ${campaigns.length} campañas del cliente ${clientName}`);

      return campaigns;
    } catch (error: any) {
      console.error(`❌ [PostgresFinishedCampaignRepository] Error en findByClient:`, error);
      throw new Error(`Error al buscar campañas por cliente: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas finalizadas por marca
   */
  async findByBrand(brandName: string): Promise<FinishedCampaign[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT
          cc.*,
          cl.nombre_cliente,
          cl.nombre_comercial,
          cl.tipo_facturacion,
          cl.tipo_cliente
        FROM campanas_comerciales cc
        LEFT JOIN clientes cl ON cl.id = cc.cliente_id
        WHERE cc.marca ILIKE $1 AND cc.fecha_fin IS NOT NULL
        ORDER BY cc.fecha_fin DESC
      `;

      const result = await this.db.execute(sql.raw(query, [`%${brandName}%`]));
      return result.rows.map(this.mapRowToFinishedCampaign);
    } catch (error: any) {
      console.error(`❌ [PostgresFinishedCampaignRepository] Error en findByBrand:`, error);
      throw new Error(`Error al buscar campañas por marca: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas finalizadas por zona
   */
  async findByZone(zone: string): Promise<FinishedCampaign[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT
          cc.*,
          cl.nombre_cliente,
          cl.nombre_comercial,
          cl.tipo_facturacion,
          cl.tipo_cliente
        FROM campanas_comerciales cc
        LEFT JOIN clientes cl ON cl.id = cc.cliente_id
        WHERE cc.zona = $1 AND cc.fecha_fin IS NOT NULL
        ORDER BY cc.fecha_fin DESC
      `;

      const result = await this.db.execute(sql.raw(query, [zone]));
      return result.rows.map(this.mapRowToFinishedCampaign);
    } catch (error: any) {
      console.error(`❌ [PostgresFinishedCampaignRepository] Error en findByZone:`, error);
      throw new Error(`Error al buscar campañas por zona: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas finalizadas en un rango de fechas de cierre
   */
  async findByCloseDateRange(startDate: string, endDate: string): Promise<FinishedCampaign[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT
          cc.*,
          cl.nombre_cliente,
          cl.nombre_comercial,
          cl.tipo_facturacion,
          cl.tipo_cliente
        FROM campanas_comerciales cc
        LEFT JOIN clientes cl ON cl.id = cc.cliente_id
        WHERE cc.fecha_fin IS NOT NULL
          AND cc.fecha_fin >= $1
          AND cc.fecha_fin <= $2
        ORDER BY cc.fecha_fin DESC
      `;

      const result = await this.db.execute(sql.raw(query, [startDate, endDate]));
      return result.rows.map(this.mapRowToFinishedCampaign);
    } catch (error: any) {
      console.error(`❌ [PostgresFinishedCampaignRepository] Error en findByCloseDateRange:`, error);
      throw new Error(`Error al buscar campañas por rango de fechas: ${error.message}`);
    }
  }

  /**
   * Reabre una campaña finalizada (elimina fecha_fin)
   */
  async reopen(id: number): Promise<void> {
    await this.ensureDbInitialized();

    console.log(`🔄 [PostgresFinishedCampaignRepository] Reabriendo campaña ID: ${id}`);

    try {
      const { campanasComerciales } = await import('@shared/schema');

      await this.db.update(campanasComerciales)
        .set({ fechaFin: null })
        .where(eq(campanasComerciales.id, id));

      console.log(`✅ [PostgresFinishedCampaignRepository] Campaña ${id} reabierta exitosamente`);
    } catch (error: any) {
      console.error(`❌ [PostgresFinishedCampaignRepository] Error en reopen(${id}):`, error);
      throw new Error(`Error al reabrir campaña: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas agregadas
   */
  async getStatistics(filters?: FinishedCampaignFilters): Promise<FinishedCampaignStats> {
    await this.ensureDbInitialized();

    console.log('📊 [PostgresFinishedCampaignRepository] Calculando estadísticas...');

    try {
      const campaigns = await this.findAllFinished(filters);

      const stats: FinishedCampaignStats = {
        totalCampaigns: campaigns.length,
        totalInvestment: 0,
        totalLeadsAssigned: 0,
        averageProgress: 0,
        totalDuplicates: 0,
        averageCompletionDays: 0
      };

      if (campaigns.length === 0) {
        return stats;
      }

      let totalProgress = 0;
      let totalDays = 0;

      campaigns.forEach(campaign => {
        const enviados = typeof campaign.enviados === 'number' ? campaign.enviados : 0;
        const inversion = typeof campaign.inversionRealizada === 'number' ? campaign.inversionRealizada : 0;
        const duplicados = typeof campaign.duplicados === 'number' ? campaign.duplicados : 0;

        stats.totalLeadsAssigned += enviados;
        stats.totalInvestment += inversion;
        stats.totalDuplicates += duplicados;
        totalProgress += campaign.porcentajeDatosEnviados || 0;

        // Calcular días de duración
        if (campaign.fechaCampana && campaign.fechaFin) {
          const start = new Date(campaign.fechaCampana);
          const end = new Date(campaign.fechaFin);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          totalDays += days;
        }
      });

      stats.averageProgress = totalProgress / campaigns.length;
      stats.averageCompletionDays = totalDays / campaigns.length;

      console.log('✅ [PostgresFinishedCampaignRepository] Estadísticas calculadas:', stats);

      return stats;
    } catch (error: any) {
      console.error('❌ [PostgresFinishedCampaignRepository] Error en getStatistics:', error);
      throw new Error(`Error al calcular estadísticas: ${error.message}`);
    }
  }

  /**
   * Cuenta campañas finalizadas
   */
  async count(filters?: FinishedCampaignFilters): Promise<number> {
    await this.ensureDbInitialized();

    try {
      const campaigns = await this.findAllFinished(filters);
      return campaigns.length;
    } catch (error: any) {
      console.error('❌ [PostgresFinishedCampaignRepository] Error en count:', error);
      throw new Error(`Error al contar campañas: ${error.message}`);
    }
  }

  /**
   * Verifica si existe una campaña finalizada
   */
  async exists(id: number): Promise<boolean> {
    const campaign = await this.findById(id);
    return campaign !== null;
  }

  /**
   * Obtiene clientes con campañas finalizadas
   */
  async getClientsWithFinishedCampaigns(): Promise<string[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT DISTINCT cl.nombre_cliente
        FROM campanas_comerciales cc
        LEFT JOIN clientes cl ON cl.id = cc.cliente_id
        WHERE cc.fecha_fin IS NOT NULL AND cl.nombre_cliente IS NOT NULL
        ORDER BY cl.nombre_cliente ASC
      `;

      const result = await this.db.execute(sql.raw(query));
      return result.rows.map((row: any) => row.nombre_cliente).filter(Boolean);
    } catch (error: any) {
      console.error('❌ [PostgresFinishedCampaignRepository] Error en getClientsWithFinishedCampaigns:', error);
      throw new Error(`Error al obtener clientes: ${error.message}`);
    }
  }

  /**
   * Obtiene marcas con campañas finalizadas
   */
  async getBrandsWithFinishedCampaigns(): Promise<string[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT DISTINCT cc.marca
        FROM campanas_comerciales cc
        WHERE cc.fecha_fin IS NOT NULL AND cc.marca IS NOT NULL
        ORDER BY cc.marca ASC
      `;

      const result = await this.db.execute(sql.raw(query));
      return result.rows.map((row: any) => row.marca).filter(Boolean);
    } catch (error: any) {
      console.error('❌ [PostgresFinishedCampaignRepository] Error en getBrandsWithFinishedCampaigns:', error);
      throw new Error(`Error al obtener marcas: ${error.message}`);
    }
  }

  /**
   * Obtiene zonas con campañas finalizadas
   */
  async getZonesWithFinishedCampaigns(): Promise<string[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT DISTINCT cc.zona
        FROM campanas_comerciales cc
        WHERE cc.fecha_fin IS NOT NULL AND cc.zona IS NOT NULL
        ORDER BY cc.zona ASC
      `;

      const result = await this.db.execute(sql.raw(query));
      return result.rows.map((row: any) => row.zona).filter(Boolean);
    } catch (error: any) {
      console.error('❌ [PostgresFinishedCampaignRepository] Error en getZonesWithFinishedCampaigns:', error);
      throw new Error(`Error al obtener zonas: ${error.message}`);
    }
  }

  /**
   * Mapea row de base de datos a entidad de dominio
   */
  private mapRowToFinishedCampaign(row: any): FinishedCampaign {
    return {
      id: row.id,
      clienteId: row.cliente_id,
      clientName: row.nombre_cliente || '',
      clienteNombre: row.nombre_cliente || '',
      brandName: row.marca,
      marca: row.marca,
      campaignNumber: parseInt(row.numero_campana) || 0,
      numeroCampana: parseInt(row.numero_campana) || 0,
      zone: row.zona,
      zona: row.zona,
      startDate: new Date(row.fecha_campana),
      fechaCampana: row.fecha_campana,
      endDate: new Date(row.fecha_fin),
      fechaFin: row.fecha_fin,
      realEndDate: row.fecha_fin ? new Date(row.fecha_fin) : undefined,
      fechaFinReal: row.fecha_fin,
      targetLeads: row.cantidad_datos_solicitados || 0,
      cantidadDatosSolicitados: row.cantidad_datos_solicitados || 0,
      // Campos calculados: se establecen en 0 (se calculan en el endpoint principal)
      currentLeads: 0,
      sentLeads: 0,
      enviados: 0,
      duplicates: 0,
      duplicados: 0,
      deliveredPerDay: 0,
      entregadosPorDia: 0,
      ordersPerDay: row.pedidos_por_dia || 0,
      pedidosPorDia: row.pedidos_por_dia || 0,
      totalOrders: row.cantidad_datos_solicitados || 0,
      pedidosTotal: row.cantidad_datos_solicitados || 0,
      percentageDeviation: 0,
      porcentajeDesvio: 0,
      percentageSent: 0,
      porcentajeDatosEnviados: 0,
      remaining: 0,
      faltantesAEnviar: 0,
      faltantes: 0,
      cpl: 0,
      salesPerCampaign: row.facturacion_bruta || 0,
      ventaPorCampaign: row.facturacion_bruta || 0,
      investment: 0,
      inversionRealizada: 0,
      pendingInvestment: 0,
      inversionPendiente: 0,
      processedDays: 0,
      diasProcesados: 0,
      status: 'Finalizada',
      estadoCampana: 'Finalizada',
      campaignId: row.id,
      esSuperior100: false
    };
  }
}
