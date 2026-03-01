export function calcularIIBB(facturacionBruta: number): number {
  return facturacionBruta * 0.045;
}

export function calcularIVA(facturacionBruta: number, tipoFacturacion: string): number {
  if (tipoFacturacion === 'A') {
    return facturacionBruta * (21 / 121);
  }
  return 0;
}

export function calcularImpuestoTarjeta(gastoAcumulado: number): number {
  return gastoAcumulado * 0.055;
}

export function calcularBeneficio(
  facturacionBruta: number,
  gastoAcumulado: number,
  iibb: number,
  iva: number,
  impTarjeta: number
): number {
  return facturacionBruta - gastoAcumulado - iibb - iva - impTarjeta;
}

export function calcularMargenReal(beneficio: number, facturacionBruta: number): number {
  if (facturacionBruta <= 0) return 0;
  return (beneficio / facturacionBruta) * 100;
}

export function formatCurrency(value: number): string {
  if (value === 0) return '$0';
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export interface CampaignSpendKey {
  marca: string;
  zona: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface CampaignSpendResult {
  spend: number;
  results: number;
  cpl: number;
  available: boolean;
}

export function makeSpendKey(marca: string, zona: string, fechaInicio: string, fechaFin: string, metaCampanaFiltro?: string | null): string {
  const filtro = metaCampanaFiltro && metaCampanaFiltro.trim() ? metaCampanaFiltro.trim() : marca;
  return `${filtro}|${zona}|${fechaInicio}|${fechaFin}`;
}

/**
 * Calcula la fecha fin predeterminada para una consulta de Meta Ads.
 * - Si la campaña es de un mes pasado: usa el último día de ese mes (no acumula meses siguientes).
 * - Si la campaña es del mes actual o futuro: usa hoy.
 * Siempre puede ser sobreescrita por metaFechaFin o fechaFin del backend.
 */
/**
 * Calcula el valor por lead actual: Facturación Bruta / leads enviados al cliente.
 */
export function calcularValorLead(facturacionBruta: number, enviados: number): number {
  if (enviados <= 0 || facturacionBruta <= 0) return 0;
  return facturacionBruta / enviados;
}

/**
 * Calcula el precio mínimo por lead (Valor Objetivo) para alcanzar un margen objetivo.
 * Fórmula: FB_min = (GM × 1.055) / (1 - 0.045 - IVA_rate - margenObj)
 *          Valor_obj = FB_min / enviados
 * Donde IVA_rate = 21/121 si tipo A, 0 si tipo C.
 */
export function calcularValorObjetivo(
  spend: number,
  enviados: number,
  margenObjetivo: number,
  tipoFacturacion: string
): number {
  if (enviados <= 0 || spend <= 0) return 0;
  const ivaRate = tipoFacturacion === 'A' ? 21 / 121 : 0;
  const denominador = 1 - 0.045 - ivaRate - margenObjetivo;
  if (denominador <= 0) return 0;
  const fbMin = (spend * 1.055) / denominador;
  return fbMin / enviados;
}

/**
 * Calcula el CPL máximo permitido para alcanzar un margen objetivo.
 * Fórmula: GM_max = (FB × (1 - 0.045 - margenObj) - IVA) / 1.055
 *          CPL_obj = GM_max / leads
 */
export function calcularCPLObjetivo(
  facturacionBruta: number,
  results: number,
  margenObjetivo: number,
  tipoFacturacion: string
): number {
  if (results <= 0 || facturacionBruta <= 0) return 0;
  const iva = calcularIVA(facturacionBruta, tipoFacturacion);
  const gmMax = (facturacionBruta * (1 - 0.045 - margenObjetivo) - iva) / 1.055;
  if (gmMax <= 0) return 0;
  return gmMax / results;
}

export function getDefaultFechaFin(fechaCampana: string | null | undefined): string {
  const today = new Date().toISOString().split('T')[0];
  if (!fechaCampana) return today;
  const [year, month] = fechaCampana.split('-').map(Number);
  if (isNaN(year) || isNaN(month)) return today;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    const lastDay = new Date(year, month, 0);
    return lastDay.toISOString().split('T')[0];
  }
  return today;
}
