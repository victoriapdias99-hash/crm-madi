/**
 * Entidad que representa una campaña a procesar para cierre
 */
export interface CampaignClosure {
  id: number;
  clientName: string;
  brandName: string;
  campaignNumber: number;
  startDate: Date;
  targetLeads: number; // cantidad_datos_solicitados
  currentLeads: number; // leads ya asignados
  zone: string;
  status: 'En proceso' | 'Finalizada';
  fechaFin?: Date;
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