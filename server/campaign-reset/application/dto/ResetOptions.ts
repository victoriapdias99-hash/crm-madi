/**
 * Opciones para resetear una campaña individual
 */
export interface ResetCampaignOptions {
  campaignId?: number;
  clientName?: string;
  campaignNumber?: number;
  dryRun?: boolean;
}

/**
 * Opciones para resetear campañas en batch
 */
export interface BatchResetOptions {
  beforeDate?: string;
  afterDate?: string;
  onlyFinished?: boolean;
  dryRun?: boolean;
}

/**
 * Opciones para reabrir campañas (solo fecha_fin)
 */
export interface ReopenOptions {
  campaignIds?: number[];
  allFinished?: boolean;
  dryRun?: boolean;
}
