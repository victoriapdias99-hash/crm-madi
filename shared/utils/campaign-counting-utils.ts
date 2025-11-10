import { sql, eq, and, inArray } from 'drizzle-orm';
import { buildCampaignLeadFilters } from './multi-brand-utils';
import { normalizeClientName } from './client-normalization';

/**
 * ============================================================================
 * UTILIDADES CENTRALIZADAS PARA CONTEO DE LEADS EN CAMPAÑAS
 * ============================================================================
 *
 * Este módulo unifica la lógica de conteo de leads únicos y duplicados
 * para garantizar consistencia entre:
 * - Campañas pendientes (sin fecha_fin)
 * - Campañas finalizadas (con fecha_fin)
 * - Dashboard y reportes
 *
 * ARQUITECTURA:
 * - Campañas FINALIZADAS: Query directa por campaign_id en op_leads_rep
 * - Campañas EN PROCESO: Filtros genéricos (marca, cliente, zona) en op_leads_rep
 *
 * GARANTÍAS:
 * ✅ Misma fuente de datos: op_leads_rep (tabla de análisis consolidada)
 * ✅ Misma lógica de duplicados: campo cantidad_duplicados o duplicate_ids[]
 * ✅ Consistencia en transición: pendiente → finalizada mantiene números
 * ============================================================================
 */

/**
 * Interfaz para el resultado del conteo
 */
export interface CampaignLeadsCount {
  enviados: number;
  duplicados: number;
}

/**
 * ============================================================================
 * FUNCIÓN PRINCIPAL: Conteo Unificado de Leads
 * ============================================================================
 *
 * Cuenta leads únicos y duplicados con la lógica apropiada según el estado
 * de la campaña (pendiente o finalizada).
 *
 * @param campaign - Datos de la campaña (debe incluir id, fechaFin, marca, zona, etc.)
 * @param cliente - Datos del cliente (incluye nombreComercial para normalización)
 * @param db - Instancia de base de datos (Drizzle)
 * @param opLeadsRep - Schema de tabla op_leads_rep
 * @param opLead - Schema de tabla op_lead
 * @param count - Función count de Drizzle ORM
 * @param todasLasCampanas - Array de todas las campañas (para validaciones)
 * @returns Promise con { enviados, duplicados }
 *
 * EJEMPLO DE USO:
 * ```typescript
 * const { enviados, duplicados } = await contarLeadsYDuplicadosUnificado(
 *   campana,
 *   clienteData,
 *   db,
 *   opLeadsRep,
 *   opLead,
 *   count,
 *   todasLasCampanas
 * );
 * ```
 */
export async function contarLeadsYDuplicadosUnificado(
  campaign: any,
  cliente: any,
  db: any,
  opLeadsRep: any,
  opLead: any,
  count: any,
  todasLasCampanas: any[]
): Promise<CampaignLeadsCount> {

  console.log(`🔢 [CampaignCounting] Contando leads para campaña ID:${campaign.id} - ${campaign.marca} #${campaign.numeroCampana}`);

  // Determinar si la campaña está finalizada
  const estaFinalizada = !!campaign.fechaFin;

  console.log(`📊 [CampaignCounting] Estado: ${estaFinalizada ? 'FINALIZADA' : 'EN PROCESO'}`);

  if (estaFinalizada) {
    // CAMPAÑA FINALIZADA: Usar lógica simple por campaign_id
    return await contarLeadsFinalizados(campaign, db, opLeadsRep, opLead, count);
  } else {
    // CAMPAÑA EN PROCESO: Usar filtros genéricos
    return await contarLeadsPendientes(campaign, cliente, db, opLeadsRep, count, todasLasCampanas);
  }
}

/**
 * ============================================================================
 * Conteo para Campañas FINALIZADAS (con fecha_fin)
 * ============================================================================
 *
 * ESTRATEGIA:
 * 1. Los leads ya están asignados con campaign_id en op_lead
 * 2. Consultar op_leads_rep usando los meta_lead_id de op_lead
 * 3. Esto garantiza que usamos la MISMA tabla de análisis consolidada
 *
 * ÚNICOS:
 * - Contar registros en op_leads_rep que corresponden a leads asignados
 *
 * DUPLICADOS:
 * - Sumar duplicate_ids.length de cada lead asignado
 * - O usar campo cantidad_duplicados si está disponible
 *
 * Esta es la lógica CORRECTA que debe reemplazar la actual en
 * FinishedCampaignEnrichmentService.ts que usa op_lead directamente.
 */
async function contarLeadsFinalizados(
  campaign: any,
  db: any,
  opLeadsRep: any,
  opLead: any,
  count: any
): Promise<CampaignLeadsCount> {

  console.log(`✅ [CampaignCounting] Contando leads FINALIZADOS para campaña ID:${campaign.id}`);

  try {
    // ========================================
    // PASO 1: Contar ÚNICOS
    // ========================================
    // Query directa a op_leads_rep por campaign_id
    // Esta es la misma lógica que routes.ts:473-490

    const leadsCountResult = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(eq(opLeadsRep.campaignId, campaign.id));

    const enviados = leadsCountResult[0]?.count || 0;

    console.log(`📈 [CampaignCounting] Únicos encontrados: ${enviados}`);

    // ========================================
    // PASO 2: Contar DUPLICADOS
    // ========================================
    // Estrategia: Obtener meta_lead_ids de op_lead, luego buscar en op_leads_rep
    // Esta es la misma lógica que routes.ts:361-416

    // 2.1: Obtener meta_lead_ids de leads asignados a esta campaña
    const leadsAsignados = await db
      .select({
        metaLeadId: opLead.metaLeadId
      })
      .from(opLead)
      .where(eq(opLead.campaignId, campaign.id));

    if (leadsAsignados.length === 0) {
      console.log(`⚠️ [CampaignCounting] No hay leads asignados en op_lead`);
      return { enviados: 0, duplicados: 0 };
    }

    // 2.2: Extraer meta_lead_ids y filtrar nulls
    const metaLeadIds = leadsAsignados
      .map((lead: any) => lead.metaLeadId)
      .filter((id: any) => id !== null);

    if (metaLeadIds.length === 0) {
      console.log(`⚠️ [CampaignCounting] No hay meta_lead_ids válidos`);
      return { enviados, duplicados: 0 };
    }

    // 2.3: Buscar en op_leads_rep y sumar duplicate_ids
    const leadsUnicos = await db
      .select({
        duplicateIds: opLeadsRep.duplicateIds
      })
      .from(opLeadsRep)
      .where(inArray(opLeadsRep.metaLeadId, metaLeadIds));

    // 2.4: Sumar longitud de arrays duplicate_ids
    let totalDuplicados = 0;
    for (const lead of leadsUnicos) {
      const arrayLength = lead.duplicateIds ? lead.duplicateIds.length : 0;
      totalDuplicados += arrayLength;
    }

    console.log(`📊 [CampaignCounting] Duplicados encontrados: ${totalDuplicados}`);
    console.log(`✅ [CampaignCounting] Conteo finalizado - Enviados: ${enviados}, Duplicados: ${totalDuplicados}`);

    return { enviados, duplicados: totalDuplicados };

  } catch (error: any) {
    console.error(`❌ [CampaignCounting] Error contando leads finalizados:`, error);
    return { enviados: 0, duplicados: 0 };
  }
}

/**
 * ============================================================================
 * Conteo para Campañas EN PROCESO (sin fecha_fin)
 * ============================================================================
 *
 * ESTRATEGIA:
 * 1. Los leads NO están asignados aún (campaign_id IS NULL o = esta campaña)
 * 2. Usar filtros genéricos: marca(s), cliente, zona, localización
 * 3. buildCampaignLeadFilters() centraliza todas las condiciones
 *
 * ÚNICOS:
 * - Contar registros que cumplen los filtros
 *
 * DUPLICADOS:
 * - Sumar campo cantidad_duplicados de registros que cumplen filtros
 *
 * Esta lógica ya funciona correctamente en routes.ts y la reutilizamos.
 */
async function contarLeadsPendientes(
  campaign: any,
  cliente: any,
  db: any,
  opLeadsRep: any,
  count: any,
  todasLasCampanas: any[]
): Promise<CampaignLeadsCount> {

  console.log(`⏳ [CampaignCounting] Contando leads PENDIENTES para campaña ID:${campaign.id}`);

  try {
    // Normalizar nombre comercial del cliente
    const nombreComercialRaw = cliente?.nombreComercial || '';
    const nombreComercial = normalizeClientName(nombreComercialRaw);

    console.log(`🏢 [CampaignCounting] Cliente normalizado: ${nombreComercial}`);

    // ========================================
    // PASO 1: Contar ÚNICOS
    // ========================================
    // Usar función centralizada para construir condiciones
    const conditionsUnicos = buildCampaignLeadFilters({
      campaign,
      normalizedClientName: nombreComercial,
      campaignField: opLeadsRep.campaign,
      clienteField: opLeadsRep.cliente,
      localizacionField: opLeadsRep.localizacion,
      campaignIdField: opLeadsRep.campaignId,
      fechaCreacionField: opLeadsRep.fechaCreacion
    });

    const leadsCountResult = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(and(...conditionsUnicos));

    const enviados = leadsCountResult[0]?.count || 0;

    console.log(`📈 [CampaignCounting] Únicos encontrados: ${enviados}`);

    // ========================================
    // PASO 2: Contar DUPLICADOS
    // ========================================
    // Usar MISMAS condiciones que para únicos, pero sumar cantidad_duplicados
    const conditionsDuplicados = buildCampaignLeadFilters({
      campaign,
      normalizedClientName: nombreComercial,
      campaignField: opLeadsRep.campaign,
      clienteField: opLeadsRep.cliente,
      localizacionField: opLeadsRep.localizacion,
      campaignIdField: opLeadsRep.campaignId,
      fechaCreacionField: opLeadsRep.fechaCreacion
    });

    const duplicadosResult = await db
      .select({ totalDuplicados: sql<number>`SUM(${opLeadsRep.cantidadDuplicados})` })
      .from(opLeadsRep)
      .where(and(...conditionsDuplicados));

    const duplicados = duplicadosResult[0]?.totalDuplicados || 0;

    console.log(`📊 [CampaignCounting] Duplicados encontrados: ${duplicados}`);
    console.log(`✅ [CampaignCounting] Conteo finalizado - Enviados: ${enviados}, Duplicados: ${duplicados}`);

    return { enviados, duplicados };

  } catch (error: any) {
    console.error(`❌ [CampaignCounting] Error contando leads pendientes:`, error);
    return { enviados: 0, duplicados: 0 };
  }
}

/**
 * ============================================================================
 * FUNCIÓN HELPER: Conteo Solo de Únicos
 * ============================================================================
 *
 * Utilidad para obtener solo el conteo de leads únicos sin duplicados.
 * Útil para optimización cuando no se necesitan duplicados.
 */
export async function contarSoloUnicos(
  campaign: any,
  cliente: any,
  db: any,
  opLeadsRep: any,
  opLead: any,
  count: any,
  todasLasCampanas: any[]
): Promise<number> {

  const resultado = await contarLeadsYDuplicadosUnificado(
    campaign,
    cliente,
    db,
    opLeadsRep,
    opLead,
    count,
    todasLasCampanas
  );

  return resultado.enviados;
}

/**
 * ============================================================================
 * FUNCIÓN HELPER: Conteo Solo de Duplicados
 * ============================================================================
 *
 * Utilidad para obtener solo el conteo de duplicados sin únicos.
 * Útil para optimización cuando no se necesitan únicos.
 */
export async function contarSoloDuplicados(
  campaign: any,
  cliente: any,
  db: any,
  opLeadsRep: any,
  opLead: any,
  count: any,
  todasLasCampanas: any[]
): Promise<number> {

  const resultado = await contarLeadsYDuplicadosUnificado(
    campaign,
    cliente,
    db,
    opLeadsRep,
    opLead,
    count,
    todasLasCampanas
  );

  return resultado.duplicados;
}
