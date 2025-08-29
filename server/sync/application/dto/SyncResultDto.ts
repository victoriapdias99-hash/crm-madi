import { SyncResult, SyncDetails } from '../../domain/entities/SyncResult';

/**
 * DTO para respuesta de sincronización hacia API
 */
export interface SyncResponseDto {
  success: boolean;
  message: string;
  leadsProcessed: number;
  timestamp: string;
  duration: number;
  durationFormatted: string;
  error?: string;
  details?: SyncDetailsDto;
}

export interface SyncDetailsDto {
  newLeads: number;
  updatedLeads: number;
  skippedLeads: number;
  duplicatesFound: number;
  validationErrors: number;
  sheetsProcessed: string[];
  clientsMatched: Record<string, number>;
  
  // Información adicional para debugging
  processingStats?: {
    totalRawLeads: number;
    validLeads: number;
    invalidLeads: number;
    duplicateRate: number;
  };
}

/**
 * Mapea SyncResult del dominio a SyncResponseDto para la API
 */
export function mapSyncResultToResponse(result: SyncResult): SyncResponseDto {
  return {
    success: result.success,
    message: result.error || generateSuccessMessage(result),
    leadsProcessed: result.leadsProcessed,
    timestamp: result.timestamp,
    duration: result.duration,
    durationFormatted: formatDuration(result.duration),
    error: result.error,
    details: result.details ? mapSyncDetailsToDto(result.details) : undefined
  };
}

/**
 * Mapea SyncDetails del dominio a SyncDetailsDto
 */
function mapSyncDetailsToDto(details: SyncDetails): SyncDetailsDto {
  const totalProcessed = details.newLeads + details.updatedLeads + details.skippedLeads;
  const duplicateRate = totalProcessed > 0 ? (details.duplicatesFound / totalProcessed) * 100 : 0;
  
  return {
    newLeads: details.newLeads,
    updatedLeads: details.updatedLeads,
    skippedLeads: details.skippedLeads,
    duplicatesFound: details.duplicatesFound,
    validationErrors: details.validationErrors,
    sheetsProcessed: details.sheetsProcessed || [],
    clientsMatched: details.clientsMatched || {},
    processingStats: {
      totalRawLeads: totalProcessed,
      validLeads: details.newLeads + details.updatedLeads,
      invalidLeads: details.validationErrors,
      duplicateRate: Math.round(duplicateRate * 100) / 100
    }
  };
}

/**
 * Genera mensaje de éxito basado en el resultado
 */
function generateSuccessMessage(result: SyncResult): string {
  if (!result.success) {
    return 'Sincronización fallida';
  }
  
  if (result.leadsProcessed === 0) {
    return 'Sincronización completada - No hay datos nuevos';
  }
  
  const details = result.details;
  if (details) {
    const { newLeads, updatedLeads, skippedLeads } = details;
    return `Sincronización completada: ${newLeads} nuevos, ${updatedLeads} actualizados, ${skippedLeads} omitidos`;
  }
  
  return `Sincronización completada exitosamente - ${result.leadsProcessed} leads procesados`;
}

/**
 * Formatea duración en formato legible
 */
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}