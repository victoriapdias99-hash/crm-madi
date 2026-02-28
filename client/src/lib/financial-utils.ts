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

export function makeSpendKey(marca: string, zona: string, fechaInicio: string, fechaFin: string): string {
  return `${marca}|${zona}|${fechaInicio}|${fechaFin}`;
}
