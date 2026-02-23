import { sql, eq, gte } from 'drizzle-orm';

/**
 * Utilidades para manejo de campañas con múltiples marcas
 */

export interface BrandInfo {
  marca: string;
  porcentaje: number;
}

/**
 * Extrae todas las marcas configuradas de una campaña con sus porcentajes
 * @param campana - Datos de la campaña
 * @param automaticMode - Si true, incluye TODAS las marcas (ignora porcentajes 0). Si false, solo marcas con porcentaje > 0
 */
export function extractBrandsFromCampaign(campana: any, automaticMode: boolean = false): BrandInfo[] {
  // console.log(`🔧 [extractBrandsFromCampaign] Campaña ${campana.id} - automaticMode: ${automaticMode}`);

  const brands: BrandInfo[] = [];

  // Marca 1 (principal)
  if (campana.marca) {
    const porcentaje = campana.porcentaje || 100;
    const incluir = automaticMode || porcentaje > 0;
    // console.log(`  🏷️ Marca 1: ${campana.marca} - Porcentaje: ${porcentaje} - Incluir: ${incluir} (automaticMode: ${automaticMode}, porcentaje > 0: ${porcentaje > 0})`);

    if (incluir) {
      brands.push({
        marca: campana.marca,
        porcentaje: porcentaje
      });
    }
  }

  // Marcas adicionales (2-5)
  for (let i = 2; i <= 5; i++) {
    const marca = campana[`marca${i}`];
    const porcentaje = campana[`porcentaje${i}`] || 0;
    const incluir = marca && (automaticMode || porcentaje > 0);

    // if (marca) {
    //   console.log(`  🏷️ Marca ${i}: ${marca} - Porcentaje: ${porcentaje} - Incluir: ${incluir} (automaticMode: ${automaticMode}, porcentaje > 0: ${porcentaje > 0})`);
    // }

    if (incluir) {
      brands.push({
        marca: marca,
        porcentaje: porcentaje
      });
    }
  }

  const filteredBrands = brands.filter(brand => brand.marca);
  // console.log(`🔧 [extractBrandsFromCampaign] Resultado final:`, filteredBrands);

  return filteredBrands;
}

/**
 * Crea condiciones SQL para buscar leads que coincidan con cualquiera de las marcas
 */
export function createMultiBrandCondition(brands: BrandInfo[], campaignField: any) {
  if (brands.length === 0) {
    throw new Error('No hay marcas válidas para crear condición');
  }

  if (brands.length === 1) {
    // Una sola marca - usar ILIKE simple
    return sql`lower(${campaignField}) LIKE ${`%${brands[0].marca.toLowerCase()}%`}`;
  }

  // Múltiples marcas - usar OR con ILIKE para cada una
  const conditions = brands.map(brand =>
    sql`lower(${campaignField}) LIKE ${`%${brand.marca.toLowerCase()}%`}`
  );

  // Combinar con OR: (marca1 OR marca2 OR marca3 OR marca4)
  return sql`(${sql.join(conditions, sql` OR `)})`;
}

/**
 * Valida que los porcentajes de las marcas sumen 100%
 */
export function validateBrandPercentages(brands: BrandInfo[]): { valid: boolean; total: number; error?: string } {
  if (brands.length === 0) {
    return { valid: false, total: 0, error: 'No hay marcas configuradas' };
  }

  const total = brands.reduce((sum, brand) => sum + brand.porcentaje, 0);

  if (total !== 100) {
    return {
      valid: false,
      total,
      error: `Los porcentajes deben sumar 100%, actualmente suman ${total}%`
    };
  }

  return { valid: true, total };
}

/**
 * Calcula la distribución de leads por marca según porcentajes
 */
export function calculateLeadDistribution(totalLeads: number, brands: BrandInfo[]): { [marca: string]: number } {
  const distribution: { [marca: string]: number } = {};
  let assigned = 0;

  // Asignar leads proporcionalmente
  for (let i = 0; i < brands.length - 1; i++) {
    const brand = brands[i];
    const leadsForBrand = Math.floor((totalLeads * brand.porcentaje) / 100);
    distribution[brand.marca] = leadsForBrand;
    assigned += leadsForBrand;
  }

  // La última marca recibe todos los leads restantes para evitar errores de redondeo
  if (brands.length > 0) {
    const lastBrand = brands[brands.length - 1];
    distribution[lastBrand.marca] = totalLeads - assigned;
  }

  return distribution;
}

/**
 * Obtiene información de debug para múltiples marcas
 */
export function getMultiBrandDebugInfo(campana: any): string {
  const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);
  const validation = validateBrandPercentages(brands);

  let info = `Campaña ${campana.numeroCampana} - Marcas configuradas: ${brands.length}\n`;

  brands.forEach((brand, index) => {
    info += `  ${index + 1}. ${brand.marca}: ${brand.porcentaje}%\n`;
  });

  info += `  Validación: ${validation.valid ? '✅' : '❌'} (Total: ${validation.total}%)`;
  if (validation.error) {
    info += `\n  Error: ${validation.error}`;
  }

  return info;
}

/**
 * Mapeo de zonas de campaña a localización en datos sincronizados
 */
const MAPEO_ZONAS: Record<string, string> = {
  'NACIONAL': 'Pais',
  'AMBA': 'Amba',
  'Córdoba': 'Cordoba',
  'Santa Fe': 'Santa Fe',
  'Mendoza': 'Mendoza'
};

/**
 * Mapea zona de campaña a localización
 */
export function mapZonaToLocalizacion(zona: string): string {
  return MAPEO_ZONAS[zona] || zona || 'Pais';
}

/**
 * ============================================================================
 * FUNCIÓN CENTRALIZADA DE FILTRADO DE LEADS
 * ============================================================================
 *
 * Esta función es el ÚNICO punto de filtrado para TODAS las operaciones con leads:
 *
 * 1. Conteo de duplicados (routes.ts - dashboard de campañas pendientes)
 * 2. Conteo de leads disponibles (PostgresLeadRepository.countUniqueLeadsForClient)
 * 3. Obtención de leads para asignar (PostgresLeadRepository.getLeadsForAssignment)
 * 4. Conteo de leads asignados con filtros genéricos (PostgresLeadRepository.countAssignedLeadsForCampaign)
 *
 * ============================================================================
 * CONDICIONES QUE APLICA:
 * ============================================================================
 *
 * ✅ 1. MULTI-MARCA (OR con ILIKE):
 *    - Extrae todas las marcas configuradas (marca, marca2, marca3, marca4, marca5)
 *    - Crea: (lower(campaign) LIKE '%peugeot%' OR lower(campaign) LIKE '%fiat%' ...)
 *    - Respeta porcentajes si asignacionAutomatica=false
 *    - Ignora porcentajes si asignacionAutomatica=true (pool unificado)
 *
 * ✅ 2. CLIENTE (igualdad exacta):
 *    - cliente = {normalizedClientName}
 *    - Normalizado a snake_case (ej: "red_finance")
 *    - Sin marcas en el nombre (se extraen antes de normalizar)
 *
 * ✅ 3. LOCALIZACIÓN (mapeo de zona):
 *    - localizacion = {mappedZone}
 *    - Mapeo: NACIONAL→Pais, AMBA→Amba, Córdoba→Cordoba, etc.
 *
 * ✅ 4. DISPONIBILIDAD (incluye asignados a esta campaña):
 *    - (campaign_id IS NULL OR campaign_id = {campaign.id})
 *    - Permite reasignación si se reabre una campaña
 *    - Cuenta leads disponibles + ya asignados a esta campaña específica
 *
 * ✅ 5. FILTRO POR FECHA DE CAMPAÑA:
 *    - fecha_creacion >= fechaCampana
 *    - Cada campaña solo cuenta leads creados desde su fecha de inicio
 *    - Campañas del mismo cliente son independientes entre sí
 *
 * ❌ 6. SIN FILTRO DE SOURCE:
 *    - NO filtra por source = 'google_sheets'
 *    - Todos los leads en op_leads_rep vienen de Google Sheets actualmente
 *    - Filtrar por source sería redundante
 *
 * ============================================================================
 * GARANTÍAS DE CONSISTENCIA:
 * ============================================================================
 *
 * - MISMO filtrado en conteo vs asignación
 * - MISMO filtrado en duplicados vs disponibles
 * - MISMO filtrado en dashboard vs cierre de campañas
 * - NO hay discrepancias entre "lo que se ve" y "lo que se asigna"
 *
 * @param campaign - Objeto campaña completo con marcas, zona, fechas, etc.
 * @param normalizedClientName - Nombre del cliente normalizado (ej: "red_finance")
 * @param campaignField - Campo de campaign en la tabla (ej: opLeadsRep.campaign)
 * @param clienteField - Campo de cliente en la tabla (ej: opLeadsRep.cliente)
 * @param localizacionField - Campo de localización en la tabla (ej: opLeadsRep.localizacion)
 * @param campaignIdField - Campo de campaignId en la tabla (ej: opLeadsRep.campaignId)
 * @param fechaCreacionField - Campo de fecha creación (filtro >= fechaCampana)
 * @returns Array de condiciones SQL para usar con and()
 */
export function buildCampaignLeadFilters(params: {
  campaign: any;
  normalizedClientName: string;
  campaignField: any;
  clienteField: any;
  localizacionField: any;
  campaignIdField: any;
  fechaCreacionField: any;
}): any[] {
  const {
    campaign,
    normalizedClientName,
    campaignField,
    clienteField,
    localizacionField,
    campaignIdField,
    fechaCreacionField
  } = params;

  // Obtener localización filtrada
  const localizacionFiltro = mapZonaToLocalizacion(campaign.zona);

  // Extraer marcas y crear condición multi-marca
  const brands = extractBrandsFromCampaign(campaign, campaign.asignacionAutomatica);

  // Validar que haya marcas configuradas
  if (brands.length === 0) {
    throw new Error(`No hay marcas configuradas para la campaña ${campaign.id || campaign.numeroCampana}`);
  }

  const multiBrandCondition = createMultiBrandCondition(brands, campaignField);

  const conditions: any[] = [
    multiBrandCondition,
    eq(clienteField, normalizedClientName),
    eq(localizacionField, localizacionFiltro),
    sql`(campaign_ids IS NULL OR NOT (${campaign.id} = ANY(campaign_ids)))`
  ];

  if (campaign.fechaCampana) {
    conditions.push(gte(fechaCreacionField, new Date(campaign.fechaCampana)));
  }

  return conditions;
}

/**
 * @deprecated Usar buildCampaignLeadFilters() en su lugar
 * Mantenido por compatibilidad temporal
 */
export function buildPendingCampaignConditions(params: {
  campaign: any;
  normalizedClientName: string;
  campaignField: any;
  clienteField: any;
  localizacionField: any;
  sourceField?: any;  // Ahora opcional para compatibilidad
  campaignIdField: any;
  fechaCreacionField: any;
}): any[] {
  return buildCampaignLeadFilters(params);
}