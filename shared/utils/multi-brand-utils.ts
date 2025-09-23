import { sql } from 'drizzle-orm';

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
  console.log(`🔧 [extractBrandsFromCampaign] Campaña ${campana.id} - automaticMode: ${automaticMode}`);

  const brands: BrandInfo[] = [];

  // Marca 1 (principal)
  if (campana.marca) {
    const porcentaje = campana.porcentaje || 100;
    const incluir = automaticMode || porcentaje > 0;
    console.log(`  🏷️ Marca 1: ${campana.marca} - Porcentaje: ${porcentaje} - Incluir: ${incluir} (automaticMode: ${automaticMode}, porcentaje > 0: ${porcentaje > 0})`);

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

    if (marca) {
      console.log(`  🏷️ Marca ${i}: ${marca} - Porcentaje: ${porcentaje} - Incluir: ${incluir} (automaticMode: ${automaticMode}, porcentaje > 0: ${porcentaje > 0})`);
    }

    if (incluir) {
      brands.push({
        marca: marca,
        porcentaje: porcentaje
      });
    }
  }

  const filteredBrands = brands.filter(brand => brand.marca);
  console.log(`🔧 [extractBrandsFromCampaign] Resultado final:`, filteredBrands);

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