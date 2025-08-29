/**
 * Resultado de una operación de sincronización
 */
export interface SyncResult {
  success: boolean;
  leadsProcessed: number;
  timestamp: string;
  duration: number;
  error?: string;
  details?: SyncDetails;
}

export interface SyncDetails {
  newLeads: number;
  updatedLeads: number;
  skippedLeads: number;
  duplicatesFound: number;
  validationErrors: number;
  sheetsProcessed?: string[];
  clientsMatched?: Record<string, number>;
}

/**
 * Estado de sincronización del sistema
 */
export interface SyncStatus {
  isRunning: boolean;
  lastSyncTime: Date | null;
  uptime: number | null;
  currentOperation?: string;
  progress?: {
    current: number;
    total: number;
    stage: string;
  };
}

/**
 * Opciones para operaciones de sincronización
 */
export interface SyncOptions {
  // Tipo de sincronización
  forceFullSync?: boolean;
  
  // Actualizaciones post-sync
  includeDashboardUpdate?: boolean;
  includeMetricsUpdate?: boolean;
  
  // Filtros
  specificSheets?: string[];
  since?: Date;
  
  // Validación
  validateData?: boolean;
  skipDuplicateDetection?: boolean;
}