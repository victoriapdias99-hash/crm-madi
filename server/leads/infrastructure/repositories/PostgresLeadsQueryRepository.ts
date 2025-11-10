import { eq, and } from 'drizzle-orm';
import { opLeadsRep, campanasComerciales, clientes } from '@shared/schema';
import type { SentLeadsByCampaignResponse, SentLeadDTO } from '../../application/use-cases/GetSentLeadsByCampaignUseCase';
import { normalizeClientName } from '../../../../shared/utils/client-normalization';
import { buildCampaignLeadFilters } from '../../../../shared/utils/multi-brand-utils';

/**
 * Repositorio para consultas de leads enviados (solo lectura)
 *
 * PROPÓSITO:
 * - Obtener el listado completo de leads enviados de una campaña específica
 * - Usa la MISMA lógica de filtrado que contarLeadsPorCampana() en routes.ts
 *
 * LÓGICA DE NEGOCIO:
 * 1. Campañas FINALIZADAS (con fecha_fin):
 *    - Busca leads directamente por campaign_id
 *    - Solo incluye leads que fueron asignados a esa campaña
 *
 * 2. Campañas EN PROCESO (sin fecha_fin):
 *    - Usa filtros genéricos: cliente, marca(s), zona, fechas
 *    - Incluye leads ASIGNADOS (campaign_id = X) + DISPONIBLES (campaign_id IS NULL)
 *    - Esto permite ver todos los leads elegibles para la campaña
 *
 * NORMALIZACIÓN:
 * - Usa normalizeClientName() centralizada de shared/utils/client-normalization.ts
 * - Convierte espacios a underscores: "Giorgi automotores" → "giorgi_automotores"
 * - Garantiza consistencia con proceso de sincronización
 */
export class PostgresLeadsQueryRepository {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      const { db } = await import('../../../db');
      this.db = db;
    } catch (error) {
      console.error('Error initializing database for leads query repository:', error);
      throw new Error('Failed to initialize leads query repository');
    }
  }

  private async ensureDbInitialized() {
    if (!this.db) {
      await this.initializeDb();
    }
  }

  /**
   * Obtiene los leads enviados de una campaña específica
   *
   * FLUJO:
   * 1. Busca información de la campaña (marcas, zona, fechas, cliente)
   * 2. Busca información del cliente (nombre comercial para normalización)
   * 3. Aplica lógica según estado:
   *    - FINALIZADA: WHERE campaign_id = X
   *    - EN PROCESO: WHERE filtros múltiples (marca, cliente, zona, fechas)
   * 4. Retorna listado completo de leads con metadata de campaña
   *
   * EJEMPLO DE USO:
   * const response = await repository.getSentLeadsByCampaign(38);
   * // response.totalSent: 44
   * // response.leads: [{ id, nombre, telefono, ... }, ...]
   *
   * @param campaignId - ID de la campaña a consultar
   * @returns Respuesta con metadata de campaña y listado de leads
   */
  async getSentLeadsByCampaign(campaignId: number): Promise<SentLeadsByCampaignResponse> {
    await this.ensureDbInitialized();

    // 1. Obtener información de la campaña
    // Incluye todas las marcas (marca1-5) para campañas multi-marca
    const [campaign] = await this.db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        clienteId: campanasComerciales.clienteId,
        marca: campanasComerciales.marca,
        marca2: campanasComerciales.marca2,
        marca3: campanasComerciales.marca3,
        marca4: campanasComerciales.marca4,
        marca5: campanasComerciales.marca5,
        zona: campanasComerciales.zona,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
        asignacionAutomatica: campanasComerciales.asignacionAutomatica,
      })
      .from(campanasComerciales)
      .where(eq(campanasComerciales.id, campaignId))
      .limit(1);

    // Si no existe la campaña, retornar respuesta vacía
    if (!campaign) {
      return {
        campaignId,
        campaignName: null,
        clientName: null,
        marca: null,
        marca2: null,
        marca3: null,
        marca4: null,
        marca5: null,
        zona: null,
        totalSent: 0,
        leads: []
      };
    }

    // 2. Obtener información del cliente
    // Necesitamos nombreComercial para normalización en filtros
    let clientName: string | null = null;
    let nombreComercial: string | null = null;

    if (campaign.clienteId) {
      const [client] = await this.db
        .select({
          nombreCliente: clientes.nombreCliente,
          nombreComercial: clientes.nombreComercial,
        })
        .from(clientes)
        .where(eq(clientes.id, campaign.clienteId))
        .limit(1);

      if (client) {
        clientName = client.nombreCliente;
        nombreComercial = client.nombreComercial;
      }
    }

    let sentLeads: any[] = [];

    // 3. Aplicar lógica según estado de campaña
    if (campaign.fechaFin) {
      // ========================================
      // CAMPAÑA FINALIZADA: Query simple
      // ========================================
      // Solo busca leads que tienen campaign_id = X
      // Esto incluye únicamente los leads que fueron asignados
      sentLeads = await this.db
        .select()
        .from(opLeadsRep)
        .where(eq(opLeadsRep.campaignId, campaignId))
        .orderBy(opLeadsRep.marca, opLeadsRep.fechaCreacion);
    } else {
      // ========================================
      // CAMPAÑA EN PROCESO: Query con filtros múltiples
      // ========================================
      // Busca leads usando las mismas condiciones que el conteo
      // Incluye leads asignados + disponibles que coinciden con filtros

      if (!nombreComercial) {
        // Sin nombre comercial no podemos aplicar filtros
        return {
          campaignId,
          campaignName: `Campaña #${campaign.numeroCampana}`,
          clientName,
          marca: campaign.marca,
          marca2: campaign.marca2,
          marca3: campaign.marca3,
          marca4: campaign.marca4,
          marca5: campaign.marca5,
          zona: campaign.zona,
          totalSent: 0,
          leads: []
        };
      }

      // Normalizar nombre comercial para comparación
      // Ejemplo: "Giorgi automotores" → "giorgi_automotores"
      const nombreComercialNormalizado = normalizeClientName(nombreComercial);

      // Usar función centralizada para construir condiciones
      // Aplica:
      // - Multi-marca: campaign IN (marca1, marca2, ...)
      // - Cliente: cliente = nombreComercialNormalizado
      // - Zona: localizacion = mapZonaToLocalizacion(zona)
      // - Disponibilidad: campaign_id IS NULL OR campaign_id = X
      // - Fechas: fecha_creacion >= fechaCampana (y <= fechaFin si existe)
      const conditions = buildCampaignLeadFilters({
        campaign,
        normalizedClientName: nombreComercialNormalizado,
        campaignField: opLeadsRep.campaign,
        clienteField: opLeadsRep.cliente,
        localizacionField: opLeadsRep.localizacion,
        campaignIdField: opLeadsRep.campaignId,
        fechaCreacionField: opLeadsRep.fechaCreacion
      });

      sentLeads = await this.db
        .select()
        .from(opLeadsRep)
        .where(and(...conditions))
        .orderBy(opLeadsRep.marca, opLeadsRep.fechaCreacion);
    }

    // 4. Mapear resultados a DTOs
    // Convierte registros de BD a objetos con estructura definida
    const leadsDTO: SentLeadDTO[] = sentLeads.map((lead: any) => ({
      id: lead.id,
      metaLeadId: lead.metaLeadId,
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      ciudad: lead.ciudad,
      modelo: lead.modelo,
      marca: lead.marca,
      campaign: lead.campaign,
      origen: lead.origen,
      localizacion: lead.localizacion,
      cliente: lead.cliente,
      fechaCreacion: lead.fechaCreacion,
      sentAt: lead.updatedAt || lead.fechaCreacion, // Fecha de envío o creación
    }));

    // 5. Retornar respuesta completa
    return {
      campaignId,
      campaignName: `Campaña #${campaign.numeroCampana}`,
      clientName,
      marca: campaign.marca,
      marca2: campaign.marca2,
      marca3: campaign.marca3,
      marca4: campaign.marca4,
      marca5: campaign.marca5,
      zona: campaign.zona,
      totalSent: leadsDTO.length, // Total de leads en el listado
      leads: leadsDTO
    };
  }
}
