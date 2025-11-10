/**
 * Resultado de una operación de reset de campaña
 */
export interface ResetResult {
  campaignId: number;
  campaignName: string;
  campaignNumber: number;
  leadsReset: number;
  fechaFinCleared: boolean;
  success: boolean;
  error?: string;
}

/**
 * Resultado de una operación batch de reset
 */
export interface BatchResetResult {
  totalCampaigns: number;
  successfulResets: number;
  failedResets: number;
  totalLeadsReset: number;
  campaignsReopened: number;
  results: ResetResult[];
  errors: Array<{
    campaignId: number;
    error: string;
  }>;
}
