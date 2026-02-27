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
 * Contar directamente desde op_lead usando campaign_ids array.
 * op_leads_rep.campaign_id NO se actualiza al cerrar campañas (solo al hacer
 * sync de Google Sheets), por eso op_lead es la fuente confiable.
 *
 * ÚNICOS:
 * - COUNT(DISTINCT telefono) FROM op_lead WHERE campaignId = ANY(campaign_ids)
 *
 * DUPLICADOS:
 * - COUNT(*) total de filas asignadas a la campaña (incluyendo duplicados de teléfono)
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
    const campId = campaign.id;

    // PASO 1: Contar ÚNICOS (teléfonos distintos)
    const unicosResult = await db.execute(
      sql`SELECT COUNT(DISTINCT telefono)::int AS cnt FROM op_lead WHERE ${campId} = ANY(campaign_ids)`
    );
    const enviados = (unicosResult as any).rows?.[0]?.cnt ?? (unicosResult as any)[0]?.cnt ?? 0;

    console.log(`📈 [CampaignCounting] Únicos encontrados: ${enviados}`);

    // PASO 2: Contar DUPLICADOS (total filas asignadas)
    const totalResult = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt FROM op_lead WHERE ${campId} = ANY(campaign_ids)`
    );
    const totalDuplicados = (totalResult as any).rows?.[0]?.cnt ?? (totalResult as any)[0]?.cnt ?? 0;

    console.log(`📊 [CampaignCounting] Total leads (incl. duplicados): ${totalDuplicados}`);
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
