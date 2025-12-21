/**
 * Utilidades centralizadas para cálculos de porcentajes
 * Factorización de la fórmula % Datos Enviados
 */

export interface PercentageCalculationResult {
  percentage: number;
  isComplete: boolean;
  isOverTarget: boolean;
  decimal: number;
}

/**
 * Calcula el porcentaje de datos enviados de forma consistente
 * @param enviados - Cantidad de datos enviados
 * @param solicitados - Cantidad de datos solicitados
 * @param options - Opciones de cálculo
 * @returns Resultado del cálculo con metadata adicional
 */
export function calculateDatosEnviadosPercentage(
  enviados: number,
  solicitados: number,
  options: {
    roundToInteger?: boolean;
    capAt100?: boolean;
  } = {}
): PercentageCalculationResult {
  const { roundToInteger = true, capAt100 = false } = options;

  // Validación de inputs
  if (solicitados <= 0) {
    return {
      percentage: 0,
      isComplete: false,
      isOverTarget: false,
      decimal: 0
    };
  }

  // Cálculo base como decimal
  const decimal = enviados / solicitados;

  // Convertir a porcentaje
  let percentage = decimal * 100;

  // Aplicar redondeo si se solicita
  if (roundToInteger) {
    percentage = Math.round(percentage);
  }

  // Aplicar límite si se solicita
  if (capAt100) {
    percentage = Math.min(100, percentage);
  }

  return {
    percentage,
    isComplete: percentage >= 100,
    isOverTarget: percentage > 100,
    decimal: capAt100 ? Math.min(1, decimal) : decimal
  };
}

/**
 * Calcula faltantes a enviar
 * @param enviados - Cantidad enviada
 * @param solicitados - Cantidad solicitada
 * @returns Cantidad faltante (nunca negativa)
 */
export function calculateFaltantesAEnviar(enviados: number, solicitados: number): number {
  return Math.max(0, solicitados - enviados);
}

/**
 * Calcula el porcentaje de desvío: Pedidos/día ÷ Entregados/día
 * @param pedidosPorDia - Pedidos por día
 * @param entregadosPorDia - Entregados por día
 * @param options - Opciones de cálculo
 * @returns Resultado del cálculo de desvío
 */
export function calculatePorcentajeDesvio(
  pedidosPorDia: number,
  entregadosPorDia: number,
  options: {
    roundToInteger?: boolean;
    returnAsPercentage?: boolean;
  } = {}
): number {
  const { roundToInteger = true, returnAsPercentage = false } = options;

  // Validación de inputs
  if (entregadosPorDia <= 0) {
    return 0;
  }

  // Cálculo: Pedidos/día ÷ Entregados/día
  let desvio = pedidosPorDia / entregadosPorDia;

  // Convertir a porcentaje si se solicita
  if (returnAsPercentage) {
    desvio = desvio * 100;
  }

  // Aplicar redondeo si se solicita
  if (roundToInteger) {
    desvio = Math.round(desvio);
  }

  return desvio;
}

/**
 * Formatea el porcentaje para display
 * @param percentage - Porcentaje a formatear
 * @param decimals - Cantidad de decimales
 * @returns String formateado con símbolo %
 */
export function formatPercentage(percentage: number, decimals: number = 1): string {
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Versiones legacy para compatibilidad - DEPRECADAS
 * @deprecated Usar calculateDatosEnviadosPercentage en su lugar
 */
export const legacyCalculations = {
  /**
   * @deprecated - Inconsistente, falta * 100
   */
  routesV1: (enviados: number, solicitados: number) =>
    solicitados > 0 ? Math.round(enviados / solicitados) : 0,

  /**
   * @deprecated - Retorna decimal en lugar de porcentaje
   */
  routesV2: (enviados: number, solicitados: number) =>
    Math.min(1, enviados / solicitados),

  /**
   * Versión correcta de quick-optimized
   */
  quickOptimized: (enviados: number, solicitados: number) =>
    solicitados > 0 ? Math.round((enviados / solicitados) * 100) : 0
};