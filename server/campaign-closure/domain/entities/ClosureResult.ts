/**
 * Resultado de una operación de cierre de campañas
 */
export interface ClosureResult {
  success: boolean;
  campaignsProcessed: number;
  campaignsClosed: number;
  leadsAssigned: number;
  timestamp: string;
  duration: number;
  error?: string;
  details?: ClosureDetails;
}

export interface ClosureDetails {
  closedCampaigns: ClosedCampaignDetail[];
  clientsProcessed: string[];
  totalLeadsAvailable: number;
  validationErrors?: string[];
}

export interface ClosedCampaignDetail {
  campaignId: number;
  clientName: string;
  brandName: string;
  leadsAssigned: number;
  targetLeads: number;
  closureDate: Date;
  finalLeadDate: Date; // Fecha del último lead asignado
}

/**
 * Estado del procesamiento de cierre
 */
export interface ClosureStatus {
  isRunning: boolean;
  lastClosureTime: Date | null;
  currentOperation?: string;
  progress?: {
    current: number;
    total: number;
    stage: string;
  };
}