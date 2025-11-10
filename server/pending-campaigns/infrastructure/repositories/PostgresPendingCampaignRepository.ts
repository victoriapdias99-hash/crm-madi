import { sql, desc, eq, and, ilike, isNull, asc, or } from 'drizzle-orm';
import { PendingCampaign, PendingCampaignFilters, PendingCampaignStats } from '../../domain/entities/PendingCampaign';
import { IPendingCampaignRepository } from '../../domain/interfaces/IPendingCampaignRepository';

/**
 * Implementación PostgreSQL del repositorio de campañas pendientes
 *
 * Accede directamente a las tablas:
 * - campanas_comerciales: Datos de las campañas
 * - clientes: Información de clientes
 *
 * IMPORTANTE: Este repositorio NO calcula los leads enviados. Los campos
 * enviados/duplicados se obtienen del endpoint principal /api/datos-diarios
 * que usa la función contarLeadsPorCampana() para calcular dinámicamente
 * el conteo desde op_leads_rep con filtros de cliente, marca, zona y fechas.
 */
export class PostgresPendingCampaignRepository implements IPendingCampaignRepository {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      const { db } = await import('../../../db');
      this.db = db;
    } catch (error) {
      console.error('❌ Error initializing database for pending campaign repository:', error);
      throw new Error('Failed to initialize pending campaign repository');
    }
  }

  private async ensureDbInitialized() {
    if (!this.db) {
      await this.initializeDb();
    }
  }

  /**
   * Obtiene todas las campañas pendientes (fechaFin = null)
   */
  async findAllPending(filters?: PendingCampaignFilters): Promise<PendingCampaign[]> {
    await this.ensureDbInitialized();

    console.log('🔍 [PostgresPendingCampaignRepository] Consultando campañas pendientes...');
    console.log('📋 [PostgresPendingCampaignRepository] Filtros aplicados:', JSON.stringify(filters, null, 2));

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
        WHERE cc.fecha_fin IS NULL
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

      // Ordenar
      const sortBy = filters?.sortBy || 'fecha';
      const sortOrder = filters?.sortOrder || 'desc';

      switch (sortBy) {
        case 'fecha':
          query += ` ORDER BY cc.fecha_campana ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        case 'cliente':
          query += ` ORDER BY cl.nombre_cliente ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        case 'marca':
          query += ` ORDER BY cc.marca ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
          break;
        default:
          query += ` ORDER BY cc.fecha_campana DESC`;
      }

      const result = await this.db.execute(sql.raw(query, params));
      const campaigns = result.rows.map(this.mapRowToPendingCampaign);

      console.log(`✅ [PostgresPendingCampaignRepository] ${campaigns.length} campañas pendientes encontradas`);

      return campaigns;
    } catch (error: any) {
      console.error('❌ [PostgresPendingCampaignRepository] Error en findAllPending:', error);
      throw new Error(`Error al consultar campañas pendientes: ${error.message}`);
    }
  }

  /**
   * Obtiene una campaña pendiente por ID
   */
  async findById(id: number): Promise<PendingCampaign | null> {
    await this.ensureDbInitialized();

    console.log(`🔍 [PostgresPendingCampaignRepository] Buscando campaña ID: ${id}`);

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
        WHERE cc.id = $1 AND cc.fecha_fin IS NULL
        LIMIT 1
      `;

      const result = await this.db.execute(sql.raw(query, [id]));

      if (result.rows.length === 0) {
        console.log(`⚠️ [PostgresPendingCampaignRepository] No se encontró campaña ID: ${id}`);
        return null;
      }

      const campaign = this.mapRowToPendingCampaign(result.rows[0]);
      console.log(`✅ [PostgresPendingCampaignRepository] Campaña encontrada: ${campaign.clienteNombre}`);

      return campaign;
    } catch (error: any) {
      console.error(`❌ [PostgresPendingCampaignRepository] Error en findById(${id}):`, error);
      throw new Error(`Error al buscar campaña: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas pendientes por cliente
   */
  async findByClient(clientName: string): Promise<PendingCampaign[]> {
    await this.ensureDbInitialized();

    console.log(`🔍 [PostgresPendingCampaignRepository] Buscando campañas del cliente: ${clientName}`);

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
        WHERE cl.nombre_cliente ILIKE $1 AND cc.fecha_fin IS NULL
        ORDER BY cc.fecha_campana DESC
      `;

      const result = await this.db.execute(sql.raw(query, [`%${clientName}%`]));
      const campaigns = result.rows.map(this.mapRowToPendingCampaign);

      console.log(`✅ [PostgresPendingCampaignRepository] ${campaigns.length} campañas del cliente ${clientName}`);

      return campaigns;
    } catch (error: any) {
      console.error(`❌ [PostgresPendingCampaignRepository] Error en findByClient:`, error);
      throw new Error(`Error al buscar campañas por cliente: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas pendientes por marca
   */
  async findByBrand(brandName: string): Promise<PendingCampaign[]> {
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
        WHERE cc.marca ILIKE $1 AND cc.fecha_fin IS NULL
        ORDER BY cc.fecha_campana DESC
      `;

      const result = await this.db.execute(sql.raw(query, [`%${brandName}%`]));
      return result.rows.map(this.mapRowToPendingCampaign);
    } catch (error: any) {
      console.error(`❌ [PostgresPendingCampaignRepository] Error en findByBrand:`, error);
      throw new Error(`Error al buscar campañas por marca: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas pendientes por zona
   */
  async findByZone(zone: string): Promise<PendingCampaign[]> {
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
        WHERE cc.zona = $1 AND cc.fecha_fin IS NULL
        ORDER BY cc.fecha_campana DESC
      `;

      const result = await this.db.execute(sql.raw(query, [zone]));
      return result.rows.map(this.mapRowToPendingCampaign);
    } catch (error: any) {
      console.error(`❌ [PostgresPendingCampaignRepository] Error en findByZone:`, error);
      throw new Error(`Error al buscar campañas por zona: ${error.message}`);
    }
  }

  /**
   * Actualiza una campaña pendiente
   */
  async update(id: number, data: Partial<PendingCampaign>): Promise<void> {
    await this.ensureDbInitialized();

    console.log(`🔄 [PostgresPendingCampaignRepository] Actualizando campaña ID: ${id}`);

    try {
      // Esta operación debe hacerse sobre la tabla campanas_comerciales, no la vista
      const { campanasComerciales } = await import('@shared/schema');

      const updates: any = {};

      if (data.cpl !== undefined) updates.cpl = data.cpl;
      if (data.pedidosPorDia !== undefined) updates.pedidosPorDia = data.pedidosPorDia;
      if (data.cantidadDatosSolicitados !== undefined) updates.cantidadDatosSolicitados = data.cantidadDatosSolicitados;
      if (data.zona !== undefined) updates.zona = data.zona;
      if (data.marca !== undefined) updates.marca = data.marca;

      if (Object.keys(updates).length === 0) {
        console.log(`⚠️ [PostgresPendingCampaignRepository] No hay campos para actualizar`);
        return;
      }

      await this.db.update(campanasComerciales)
        .set(updates)
        .where(eq(campanasComerciales.id, id));

      console.log(`✅ [PostgresPendingCampaignRepository] Campaña ${id} actualizada exitosamente`);
    } catch (error: any) {
      console.error(`❌ [PostgresPendingCampaignRepository] Error en update(${id}):`, error);
      throw new Error(`Error al actualizar campaña: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas agregadas
   */
  async getStatistics(filters?: PendingCampaignFilters): Promise<PendingCampaignStats> {
    await this.ensureDbInitialized();

    console.log('📊 [PostgresPendingCampaignRepository] Calculando estadísticas...');

    try {
      // Obtener todas las campañas con filtros
      const campaigns = await this.findAllPending(filters);

      // Calcular agregados
      const stats: PendingCampaignStats = {
        totalCampaigns: campaigns.length,
        totalInvestment: 0,
        totalPendingInvestment: 0,
        totalLeadsAssigned: 0,
        totalLeadsRemaining: 0,
        averageProgress: 0
      };

      if (campaigns.length === 0) {
        return stats;
      }

      let totalProgress = 0;

      campaigns.forEach(campaign => {
        const enviados = typeof campaign.enviados === 'number' ? campaign.enviados : 0;
        const inversion = typeof campaign.inversionRealizada === 'number' ? campaign.inversionRealizada : 0;
        const pendiente = typeof campaign.inversionPendiente === 'number' ? campaign.inversionPendiente : 0;
        const faltantes = typeof campaign.faltantes === 'number' ? campaign.faltantes : 0;

        stats.totalLeadsAssigned += enviados;
        stats.totalInvestment += inversion;
        stats.totalPendingInvestment += pendiente;
        stats.totalLeadsRemaining += faltantes;
        totalProgress += campaign.porcentajeDatosEnviados || 0;
      });

      stats.averageProgress = totalProgress / campaigns.length;

      console.log('✅ [PostgresPendingCampaignRepository] Estadísticas calculadas:', stats);

      return stats;
    } catch (error: any) {
      console.error('❌ [PostgresPendingCampaignRepository] Error en getStatistics:', error);
      throw new Error(`Error al calcular estadísticas: ${error.message}`);
    }
  }

  /**
   * Cuenta campañas pendientes
   */
  async count(filters?: PendingCampaignFilters): Promise<number> {
    await this.ensureDbInitialized();

    try {
      const campaigns = await this.findAllPending(filters);
      return campaigns.length;
    } catch (error: any) {
      console.error('❌ [PostgresPendingCampaignRepository] Error en count:', error);
      throw new Error(`Error al contar campañas: ${error.message}`);
    }
  }

  /**
   * Verifica si existe una campaña
   */
  async exists(id: number): Promise<boolean> {
    const campaign = await this.findById(id);
    return campaign !== null;
  }

  /**
   * Obtiene clientes con campañas pendientes
   */
  async getClientsWithPendingCampaigns(): Promise<string[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT DISTINCT cl.nombre_cliente
        FROM campanas_comerciales cc
        LEFT JOIN clientes cl ON cl.id = cc.cliente_id
        WHERE cc.fecha_fin IS NULL AND cl.nombre_cliente IS NOT NULL
        ORDER BY cl.nombre_cliente ASC
      `;

      const result = await this.db.execute(sql.raw(query));
      return result.rows.map((row: any) => row.nombre_cliente).filter(Boolean);
    } catch (error: any) {
      console.error('❌ [PostgresPendingCampaignRepository] Error en getClientsWithPendingCampaigns:', error);
      throw new Error(`Error al obtener clientes: ${error.message}`);
    }
  }

  /**
   * Obtiene marcas con campañas pendientes
   */
  async getBrandsWithPendingCampaigns(): Promise<string[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT DISTINCT cc.marca
        FROM campanas_comerciales cc
        WHERE cc.fecha_fin IS NULL AND cc.marca IS NOT NULL
        ORDER BY cc.marca ASC
      `;

      const result = await this.db.execute(sql.raw(query));
      return result.rows.map((row: any) => row.marca).filter(Boolean);
    } catch (error: any) {
      console.error('❌ [PostgresPendingCampaignRepository] Error en getBrandsWithPendingCampaigns:', error);
      throw new Error(`Error al obtener marcas: ${error.message}`);
    }
  }

  /**
   * Obtiene zonas con campañas pendientes
   */
  async getZonesWithPendingCampaigns(): Promise<string[]> {
    await this.ensureDbInitialized();

    try {
      const query = `
        SELECT DISTINCT cc.zona
        FROM campanas_comerciales cc
        WHERE cc.fecha_fin IS NULL AND cc.zona IS NOT NULL
        ORDER BY cc.zona ASC
      `;

      const result = await this.db.execute(sql.raw(query));
      return result.rows.map((row: any) => row.zona).filter(Boolean);
    } catch (error: any) {
      console.error('❌ [PostgresPendingCampaignRepository] Error en getZonesWithPendingCampaigns:', error);
      throw new Error(`Error al obtener zonas: ${error.message}`);
    }
  }

  /**
   * Mapea row de base de datos a entidad de dominio
   *
   * NOTA: Los campos calculados (enviados, duplicados, porcentajes, inversión)
   * se establecen con valores por defecto (0) porque NO están en campanas_comerciales.
   * Estos valores se calculan dinámicamente en el frontend o mediante el endpoint
   * /api/datos-diarios que usa contarLeadsPorCampana() con op_leads_rep.
   */
  private mapRowToPendingCampaign(row: any): PendingCampaign {
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
      totalOrders: row.cantidad_datos_solicitados || 0, // Usar cantidad solicitada como pedidos total
      pedidosTotal: row.cantidad_datos_solicitados || 0,
      percentageDeviation: 0,
      porcentajeDesvio: 0,
      percentageSent: 0,
      porcentajeDatosEnviados: 0,
      remaining: row.cantidad_datos_solicitados || 0, // Faltantes = total solicitado (sin enviados calculados)
      faltantesAEnviar: row.cantidad_datos_solicitados || 0,
      faltantes: row.cantidad_datos_solicitados || 0,
      cpl: 0, // CPL se calcula en el endpoint principal
      salesPerCampaign: row.facturacion_bruta || 0,
      ventaPorCampaign: row.facturacion_bruta || 0,
      investment: 0, // Inversión se calcula: CPL × enviados
      inversionRealizada: 0,
      pendingInvestment: 0, // Inversión pendiente se calcula: CPL × faltantes
      inversionPendiente: 0,
      processedDays: 0, // Días procesados se calcula desde leads
      diasProcesados: 0,
      status: 'En proceso',
      estadoCampana: 'En proceso',
      fechaFin: null,
      fechaFinReal: null,
      campaignId: row.id,
      esSuperior100: false // Se calcula cuando se conoce el porcentaje real
    };
  }
}
