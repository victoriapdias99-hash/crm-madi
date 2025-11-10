import { sql, eq, gte, lte } from 'drizzle-orm';

/**
 * Módulo compartido con funciones auxiliares para filtros de campañas
 * Usado tanto en conteo como en listado de leads
 *
 * NOTA: La función normalizeClientName fue movida a shared/utils/client-normalization.ts
 * para centralizar la normalización en un único lugar.
 */

/**
 * Mapeo de zonas de campaña a localización en datos sincronizados
 */
export const MAPEO_ZONAS: Record<string, string> = {
  'NACIONAL': 'Pais',
  'AMBA': 'Amba',
  'Córdoba': 'Cordoba',
  'Santa Fe': 'Santa Fe',
  'Mendoza': 'Mendoza'
};

/**
 * Extrae todas las marcas configuradas en una campaña
 * (marca, marca2, marca3, marca4, marca5)
 */
export function extractBrandsFromCampaign(
  campaign: any,
  asignacionAutomatica?: boolean
): string[] {
  const brands: string[] = [];

  // Marca principal (siempre existe)
  if (campaign.marca) {
    brands.push(campaign.marca);
  }

  // Si tiene asignación automática, incluir todas las marcas secundarias
  if (asignacionAutomatica) {
    if (campaign.marca2) brands.push(campaign.marca2);
    if (campaign.marca3) brands.push(campaign.marca3);
    if (campaign.marca4) brands.push(campaign.marca4);
    if (campaign.marca5) brands.push(campaign.marca5);
  }

  return brands;
}

/**
 * Crea una condición SQL para múltiples marcas (OR entre todas)
 */
export function createMultiBrandCondition(brands: string[], campaignField: any) {
  if (brands.length === 0) {
    return sql`1=0`; // No hay marcas, condición falsa
  }

  if (brands.length === 1) {
    // Una sola marca: LIKE simple
    return sql`${campaignField} LIKE ${`%${brands[0]}%`}`;
  }

  // Múltiples marcas: OR entre todas
  const conditions = brands.map(brand =>
    sql`${campaignField} LIKE ${`%${brand}%`}`
  );

  // Combinar con OR
  return sql`(${sql.join(conditions, sql` OR `)})`;
}

/**
 * Obtiene info para debug de múltiples marcas
 */
export function getMultiBrandDebugInfo(campaign: any): string {
  const brands = extractBrandsFromCampaign(campaign, campaign.asignacionAutomatica);
  return `[${brands.join(', ')}] (${brands.length} marcas)`;
}

/**
 * Mapea zona de campaña a localización
 */
export function mapZonaToLocalizacion(zona: string): string {
  return MAPEO_ZONAS[zona] || zona || 'Pais';
}

/**
 * Construye las condiciones del query para campañas en proceso
 * Esta función centraliza la lógica usada tanto en conteo como en listado de leads
 *
 * @param campaign - Datos de la campaña
 * @param normalizedClientName - Nombre del cliente normalizado
 * @param campaignField - Campo de campaign en la tabla (ej: opLeadsRep.campaign)
 * @param clienteField - Campo de cliente en la tabla (ej: opLeadsRep.cliente)
 * @param localizacionField - Campo de localización en la tabla (ej: opLeadsRep.localizacion)
 * @param sourceField - Campo de source en la tabla (ej: opLeadsRep.source)
 * @param campaignIdField - Campo de campaignId en la tabla (ej: opLeadsRep.campaignId)
 * @param fechaCreacionField - Campo de fecha creación en la tabla (ej: opLeadsRep.fechaCreacion)
 * @returns Array de condiciones SQL para usar con and()
 */
export function buildPendingCampaignConditions(params: {
  campaign: any;
  normalizedClientName: string;
  campaignField: any;
  clienteField: any;
  localizacionField: any;
  sourceField: any;
  campaignIdField: any;
  fechaCreacionField: any;
}): any[] {
  const {
    campaign,
    normalizedClientName,
    campaignField,
    clienteField,
    localizacionField,
    sourceField,
    campaignIdField,
    fechaCreacionField
  } = params;

  // Obtener localización filtrada
  const localizacionFiltro = mapZonaToLocalizacion(campaign.zona);

  // Extraer marcas y crear condición multi-marca
  const brands = extractBrandsFromCampaign(campaign, campaign.asignacionAutomatica);
  const multiBrandCondition = createMultiBrandCondition(brands, campaignField);

  // Construir condiciones base
  const conditions: any[] = [
    multiBrandCondition,
    eq(clienteField, normalizedClientName),
    eq(localizacionField, localizacionFiltro),
    eq(sourceField, 'google_sheets'),
    sql`(${campaignIdField} IS NULL OR ${campaignIdField} = ${campaign.id})`,
    gte(sql`date(${fechaCreacionField})`, campaign.fechaCampana)
  ];

  // Agregar filtro de fecha fin si existe
  if (campaign.fechaFin) {
    conditions.push(lte(sql`date(${fechaCreacionField})`, campaign.fechaFin));
  }

  return conditions;
}
