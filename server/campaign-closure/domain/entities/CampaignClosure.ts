/**
 * Entidad que representa una campaña a procesar para cierre
 */
export interface CampaignClosure {
  id: number;
  clientName: string;
  brandName: string; // Marca principal (retrocompatibilidad)
  marca?: string; // Alias de brandName para compatibilidad con buildCampaignLeadFilters
  campaignNumber: number;
  startDate: Date;
  fechaCampana?: string | null; // Fecha de inicio de campaña (para filtrado SQL)
  targetLeads: number; // cantidad_datos_solicitados
  currentLeads: number; // leads ya asignados
  zone: string;
  zona?: string; // Alias de zone para compatibilidad con buildCampaignLeadFilters
  status: 'En proceso' | 'Finalizada';
  fechaFin?: Date | string | null;

  // Campos multi-marca
  marca2?: string | null;
  marca3?: string | null;
  marca4?: string | null;
  marca5?: string | null;
  porcentaje?: number | null;
  porcentaje2?: number | null;
  porcentaje3?: number | null;
  porcentaje4?: number | null;
  porcentaje5?: number | null;
  asignacionAutomatica?: boolean | null;
}

/**
 * Lead único disponible para asignación
 */
export interface AvailableLead {
  id: number;
  metaLeadId: string;
  nombre: string;
  telefono: string;
  email?: string;
  marca: string;
  cliente: string;
  localizacion: string;
  fechaCreacion: Date;
  campaignId?: number; // null si no está asignado
  duplicateIds?: number[]; // IDs de todos los duplicados de este lead único
}

/**
 * Detalle de campaña cerrada
 */
export interface ClosedCampaignDetail {
  campaignId: number;
  clientName: string;
  brandName: string;
  leadsAssigned: number;
  targetLeads: number;
  closureDate: Date;
  finalLeadDate: Date;
}

/**
 * Resultado de procesamiento por cliente
 */
export interface ClientProcessingResult {
  clientName: string;
  campaignsProcessed: number;
  leadsAssigned: number;
  campaignsClosed: ClosedCampaignDetail[];
}