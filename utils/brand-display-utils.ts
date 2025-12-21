import { extractBrandsFromCampaign, type BrandInfo } from './multi-brand-utils';

/**
 * Interfaz extendida para información de marca con datos de zona
 */
export interface ExtendedBrandInfo extends BrandInfo {
  zona: string;
}

/**
 * Función mejorada para obtener información de marcas de campañas
 * Compatible con la función existente getCampaignBrandInfo pero con mejor tipado
 */
export function getCampaignBrandInfo(
  data: any,
  campanasComerciales?: any[]
): ExtendedBrandInfo[] {
  // Función helper para extraer marca de cliente (fallback)
  const extractMarcaFallback = (cliente: string): string => {
    const match = cliente.match(/^([A-Z]+)/);
    return match ? match[1] : cliente.split(' ')[0] || 'UNKNOWN';
  };

  if (!campanasComerciales || campanasComerciales.length === 0) {
    // Si no hay datos de campañas comerciales, usar datos básicos
    return [{
      marca: data.marca || extractMarcaFallback(data.cliente),
      zona: data.zona || 'N/A',
      porcentaje: 100
    }];
  }

  // Buscar la campaña correspondiente
  const campana = campanasComerciales.find((c: any) =>
    c.numeroCampana === data.numeroCampana.toString() &&
    c.marca.toLowerCase() === (data.marca || extractMarcaFallback(data.cliente)).toLowerCase() &&
    c.zona === data.zona
  );

  if (!campana) {
    // Si no encuentra la campaña, usar datos de la fila actual
    return [{
      marca: data.marca || extractMarcaFallback(data.cliente),
      zona: data.zona || 'N/A',
      porcentaje: 100
    }];
  }

  // Usar la función existente para extraer marcas y agregar zona
  const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);

  const extendedBrands: ExtendedBrandInfo[] = [];

  // Marca principal
  if (campana.marca) {
    const mainBrand = brands.find(b => b.marca === campana.marca);
    if (mainBrand) {
      extendedBrands.push({
        ...mainBrand,
        zona: campana.zona || 'N/A'
      });
    }
  }

  // Marcas adicionales (2-5) con sus zonas respectivas
  for (let i = 2; i <= 5; i++) {
    const marca = campana[`marca${i}`];
    const zona = campana[`zona${i}`];

    if (marca) {
      const brand = brands.find(b => b.marca === marca);
      if (brand) {
        extendedBrands.push({
          ...brand,
          zona: zona || campana.zona || 'N/A' // Usar zona específica o principal como fallback
        });
      }
    }
  }

  // Si no se encontraron marcas, usar fallback
  if (extendedBrands.length === 0) {
    return [{
      marca: data.marca || extractMarcaFallback(data.cliente),
      zona: data.zona || 'N/A',
      porcentaje: 100
    }];
  }

  return extendedBrands;
}

/**
 * Determina si una campaña tiene asignación automática
 */
export function isAutomaticAssignment(campaignData: any): boolean {
  return campaignData?.asignacionAutomatica === true;
}

/**
 * Genera texto de display para marcas según el modo de asignación
 */
export function getBrandDisplayText(
  brands: ExtendedBrandInfo[],
  isAutomatic: boolean = false,
  includeZones: boolean = false
): string {
  if (!brands || brands.length === 0) {
    return 'Sin marcas';
  }

  if (isAutomatic) {
    // Modo automático: "Marca1, Marca2, Marca3 (AUTO)"
    const marcasStr = brands.map(b => b.marca).join(', ');
    return `${marcasStr} (AUTO)`;
  }

  if (brands.length === 1) {
    // Una sola marca
    const brand = brands[0];
    const zoneInfo = includeZones ? ` - ${brand.zona}` : '';
    return `${brand.marca}${zoneInfo}`;
  }

  // Múltiples marcas con porcentajes
  return brands.map(brand => {
    const zoneInfo = includeZones ? ` - ${brand.zona}` : '';
    return `${brand.marca} (${brand.porcentaje}%)${zoneInfo}`;
  }).join(', ');
}

/**
 * Obtiene estadísticas de marcas para una campaña
 */
export function getBrandStats(brands: ExtendedBrandInfo[]): {
  totalBrands: number;
  totalPercentage: number;
  isValidDistribution: boolean;
  mainBrand: string;
} {
  const totalBrands = brands.length;
  const totalPercentage = brands.reduce((sum, brand) => sum + brand.porcentaje, 0);
  const isValidDistribution = totalPercentage === 100;
  const mainBrand = brands.length > 0 ? brands[0].marca : '';

  return {
    totalBrands,
    totalPercentage,
    isValidDistribution,
    mainBrand
  };
}