import { PendingCampaign } from '../entities/PendingCampaign';

/**
 * Servicio de dominio para lógica de negocio de campañas pendientes
 * Contiene cálculos y validaciones complejas
 */
export class PendingCampaignService {
  /**
   * Calcula inversiones basadas en CPL
   * @param campaign - Campaña pendiente
   * @param cpl - Costo por lead
   * @returns Inversión realizada, pendiente y faltantes
   */
  calculateInversions(campaign: PendingCampaign, cpl: number): {
    inversionRealizada: number;
    inversionPendiente: number;
    faltantes: number;
    porcentajeDesvio: number;
  } {
    const safeCpl = isNaN(cpl) || !cpl ? 0 : cpl;
    const safeEnviados = this.getSafeNumber(campaign.enviados);
    const safePedidosTotal = isNaN(campaign.pedidosTotal) || !campaign.pedidosTotal ? 0 : campaign.pedidosTotal;
    const safePorcentaje = isNaN(campaign.porcentajeDatosEnviados) || !campaign.porcentajeDatosEnviados ? 0 : campaign.porcentajeDatosEnviados;

    const inversionRealizada = safeEnviados * safeCpl * 1.02; // +2% impuestos
    const faltantes = Math.max(0, safePedidosTotal - safeEnviados);
    const inversionPendiente = safePorcentaje >= 100 ? 0 : faltantes * safeCpl * 1.02;

    // Corregir porcentaje de desvío: (Pedidos Total / Enviados)
    const porcentajeDesvio = safeEnviados > 0 ? (safePedidosTotal / safeEnviados) : 0;

    return {
      inversionRealizada: isNaN(inversionRealizada) ? 0 : inversionRealizada,
      inversionPendiente: isNaN(inversionPendiente) ? 0 : inversionPendiente,
      faltantes: isNaN(faltantes) ? 0 : faltantes,
      porcentajeDesvio: isNaN(porcentajeDesvio) ? 0 : porcentajeDesvio
    };
  }

  /**
   * Valida si una campaña puede ser cerrada
   * @param campaign - Campaña a validar
   * @returns true si puede cerrarse, false en caso contrario
   */
  canBeClosed(campaign: PendingCampaign): { canClose: boolean; reason?: string } {
    // Verificar que tenga datos enviados
    const enviados = this.getSafeNumber(campaign.enviados);

    if (enviados === 0) {
      return {
        canClose: false,
        reason: 'La campaña no tiene datos enviados'
      };
    }

    // Verificar que tenga conteo activo
    if (!this.hasActiveCounting(campaign)) {
      return {
        canClose: false,
        reason: 'La campaña no tiene conteo activo de datos'
      };
    }

    return { canClose: true };
  }

  /**
   * Determina si una campaña tiene conteo activo
   * @param campaign - Campaña a verificar
   * @returns true si tiene conteo activo
   */
  hasActiveCounting(campaign: PendingCampaign): boolean {
    const enviados = campaign.enviados;
    const entregados = campaign.entregadosPorDia;

    // Verificar que enviados sea un número real mayor que 0
    const enviadosActive = (
      enviados !== "-" &&
      enviados !== null &&
      enviados !== undefined &&
      typeof enviados === "number" &&
      enviados > 0
    );

    // Verificar que entregados por día sea un número real
    const entregadosActive = (
      entregados !== "-" &&
      entregados !== null &&
      entregados !== undefined &&
      (typeof entregados === "number" || (typeof entregados === "string" && !isNaN(parseFloat(entregados))))
    );

    return enviadosActive || entregadosActive;
  }

  /**
   * Calcula el porcentaje de progreso de una campaña
   * @param campaign - Campaña
   * @returns Porcentaje de 0 a 100
   */
  calculateProgress(campaign: PendingCampaign): number {
    const enviados = this.getSafeNumber(campaign.enviados);
    const solicitados = campaign.cantidadDatosSolicitados || campaign.pedidosTotal || 0;

    if (solicitados === 0) return 0;

    const progress = (enviados / solicitados) * 100;
    return Math.min(Math.max(progress, 0), 100); // Clamp entre 0 y 100
  }

  /**
   * Verifica si una campaña superó el 100% de datos enviados
   * @param campaign - Campaña
   * @returns true si superó el 100%
   */
  isSuperior100(campaign: PendingCampaign): boolean {
    return (campaign.porcentajeDatosEnviados || 0) > 100;
  }

  /**
   * Obtiene el valor numérico seguro de enviados
   * @param value - Valor que puede ser número, string o "-"
   * @returns Número seguro
   */
  private getSafeNumber(value: number | string | undefined | null): number {
    if (value === "-" || value === null || value === undefined) return 0;
    if (typeof value === "string" && value !== "-") {
      const numValue = parseFloat(value);
      return isNaN(numValue) ? 0 : numValue;
    }
    if (typeof value === "number") {
      return isNaN(value) ? 0 : value;
    }
    return 0;
  }

  /**
   * Formatea un valor numérico o "-"
   * @param value - Valor a formatear
   * @param decimals - Número de decimales
   * @returns String formateado
   */
  formatNumber(value: number | string | undefined | null, decimals: number = 2): string {
    if (value === "-" || value === null || value === undefined) return "-";
    if (typeof value === "string" && value !== "-") {
      const numValue = parseFloat(value);
      return isNaN(numValue) ? "-" : numValue.toFixed(decimals);
    }
    if (typeof value === "number") {
      return value.toFixed(decimals);
    }
    return "-";
  }

  /**
   * Calcula estadísticas agregadas de múltiples campañas
   * @param campaigns - Array de campañas pendientes
   * @param cplMap - Mapa de CPL por campaña
   * @returns Estadísticas agregadas
   */
  calculateAggregateStats(campaigns: PendingCampaign[], cplMap: Map<string, number>): {
    totalInversionRealizada: number;
    totalInversionPendiente: number;
    totalFaltantes: number;
    averageProgress: number;
  } {
    let totalInversionRealizada = 0;
    let totalInversionPendiente = 0;
    let totalFaltantes = 0;
    let totalProgress = 0;

    campaigns.forEach(campaign => {
      const campaignKey = `${campaign.clientName}-${campaign.numeroCampana}`;
      const cpl = cplMap.get(campaignKey) || campaign.cpl || 0;
      const inversions = this.calculateInversions(campaign, cpl);

      totalInversionRealizada += inversions.inversionRealizada;
      totalInversionPendiente += inversions.inversionPendiente;
      totalFaltantes += inversions.faltantes;
      totalProgress += this.calculateProgress(campaign);
    });

    return {
      totalInversionRealizada,
      totalInversionPendiente,
      totalFaltantes,
      averageProgress: campaigns.length > 0 ? totalProgress / campaigns.length : 0
    };
  }
}
