/**
 * DTOs para opciones de sincronización
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
  
  // Validación y procesamiento
  validateData?: boolean;
  skipDuplicateDetection?: boolean;
  
  // Configuración de procesamiento
  batchSize?: number;
  concurrency?: number;
}

/**
 * DTO para request de sincronización desde API
 */
export interface SyncRequestDto {
  forceFullSync?: string; // 'true' | 'false'
  includeDashboard?: string; // 'true' | 'false'
  includeMetrics?: string; // 'true' | 'false'
  sheets?: string; // 'Fiat,Peugeot,Toyota'
  since?: string; // ISO date string
  validateData?: string; // 'true' | 'false'
}

/**
 * Mapea SyncRequestDto a SyncOptions
 */
export function mapSyncRequestToOptions(request: SyncRequestDto): SyncOptions {
  return {
    forceFullSync: request.forceFullSync === 'true',
    includeDashboardUpdate: request.includeDashboard === 'true',
    includeMetricsUpdate: request.includeMetrics === 'true',
    specificSheets: request.sheets ? request.sheets.split(',').map(s => s.trim()) : undefined,
    since: request.since ? new Date(request.since) : undefined,
    validateData: request.validateData !== 'false', // true por defecto
    skipDuplicateDetection: true, // Desactivar verificación de duplicados por defecto
    batchSize: 100,
    concurrency: 3
  };
}