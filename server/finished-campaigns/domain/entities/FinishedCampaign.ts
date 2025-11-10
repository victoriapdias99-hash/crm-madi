/**
 * Entidad que representa una campaña finalizada (con fecha de finalización)
 * Campaña que ya completó su ciclo y fue cerrada
 */
export interface FinishedCampaign {
  id: number;
  clienteId: number;
  clientName: string;
  clienteNombre: string;
  brandName: string;
  marca: string;
  campaignNumber: number;
  numeroCampana: number;
  zone: string;
  zona: string;
  startDate: Date;
  fechaCampana: string;
  endDate: Date;
  fechaFin: string;
  realEndDate?: Date;
  fechaFinReal?: string;
  targetLeads: number;
  cantidadDatosSolicitados: number;
  currentLeads: number;
  sentLeads: number;
  enviados: number | string;
  duplicates: number;
  duplicados: number | string;
  deliveredPerDay: number | string;
  entregadosPorDia: number | string;
  ordersPerDay: number;
  pedidosPorDia: number;
  totalOrders: number;
  pedidosTotal: number;
  percentageDeviation: number;
  porcentajeDesvio: number;
  percentageSent: number;
  porcentajeDatosEnviados: number;
  remaining: number;
  faltantesAEnviar: number;
  cpl: number;
  salesPerCampaign: number;
  ventaPorCampaign: number;
  investment: number;
  inversionRealizada: number | string;
  pendingInvestment: number;
  inversionPendiente: number | string;
  processedDays: number;
  diasProcesados: number;
  status: 'Finalizada';
  estadoCampana: string;
  campaignId?: number;
  esSuperior100?: boolean;
  faltantes?: number | string;
}

/**
 * Datos agregados de campañas finalizadas
 */
export interface FinishedCampaignStats {
  totalCampaigns: number;
  totalInvestment: number;
  totalLeadsAssigned: number;
  averageProgress: number;
  totalDuplicates: number;
  averageCompletionDays: number;
}

/**
 * Filtros para consultar campañas finalizadas
 */
export interface FinishedCampaignFilters {
  zona?: string;
  marca?: string;
  cliente?: string;
  clienteNombre?: string;
  fechaInicio?: string;        // Filtro por fecha de inicio de campaña
  fechaFin?: string;           // Filtro por fecha de fin de campaña
  fechaCierreInicio?: string;  // Filtro por fecha de cierre (inicio)
  fechaCierreFin?: string;     // Filtro por fecha de cierre (fin)
  showDuplicatesOnly?: boolean;
  sortBy?: 'fecha' | 'fechaCierre' | 'cliente' | 'marca';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Resultado de reapertura de campaña
 */
export interface ReopenFinishedCampaignResult {
  success: boolean;
  campaign?: FinishedCampaign;
  message: string;
  errors?: string[];
}
