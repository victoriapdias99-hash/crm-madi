/**
 * Entidad que representa una campaña pendiente (sin fecha de finalización)
 * Campaña activa que aún está en proceso
 */
export interface PendingCampaign {
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
  status: 'En proceso';
  estadoCampana: string;
  fechaFin?: null; // Siempre null para campañas pendientes
  fechaFinReal?: null; // Siempre null para campañas pendientes
  campaignId?: number;
  esSuperior100?: boolean;
  faltantes?: number | string;
}

/**
 * Datos agregados de campañas pendientes
 */
export interface PendingCampaignStats {
  totalCampaigns: number;
  totalInvestment: number;
  totalPendingInvestment: number;
  totalLeadsAssigned: number;
  totalLeadsRemaining: number;
  averageProgress: number;
}

/**
 * Filtros para consultar campañas pendientes
 */
export interface PendingCampaignFilters {
  zona?: string;
  marca?: string;
  cliente?: string;
  clienteNombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  showDuplicatesOnly?: boolean;
  sortBy?: 'fecha' | 'cliente' | 'marca';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Resultado de actualización de campaña pendiente
 */
export interface UpdatePendingCampaignResult {
  success: boolean;
  campaign?: PendingCampaign;
  message: string;
  errors?: string[];
}
