/**
 * Punto de entrada principal del sistema de sincronización refactorizado
 * Exporta todas las interfaces públicas y utilidades del módulo sync
 */

// ========== CASOS DE USO ==========
export { SyncFullUseCase } from './application/usecases/SyncFullUseCase';
export { SyncIncrementalUseCase } from './application/usecases/SyncIncrementalUseCase';
export { SyncSpecificSheetsUseCase } from './application/usecases/SyncSpecificSheetsUseCase';

// ========== CONTROLADOR ==========
export { SyncController } from './presentation/controllers/SyncController';

// ========== RUTAS ==========
export { createSyncRoutes, syncLoggingMiddleware } from './presentation/routes/sync-routes';

// ========== FACTORY ==========
export { SyncFactory } from './infrastructure/config/SyncFactory';

// ========== ADAPTADOR DE COMPATIBILIDAD ==========
export { LegacySyncAdapter, legacySyncAdapter } from './infrastructure/adapters/LegacySyncAdapter';

// ========== ENTIDADES DE DOMINIO ==========
export type { SyncLead, ProcessedSyncLead, RawSheetLead } from './domain/entities/SyncLead';
export type { SyncResult, SyncDetails, SyncStatus, SyncOptions as DomainSyncOptions } from './domain/entities/SyncResult';

// ========== INTERFACES ==========
export type { ISyncRepository } from './domain/interfaces/ISyncRepository';
export type { ISheetsGateway } from './domain/interfaces/ISheetsGateway';

// ========== SERVICIOS DE DOMINIO ==========
export { LeadProcessor } from './domain/services/LeadProcessor';
export { DuplicateDetector } from './domain/services/DuplicateDetector';
export { ClientMatcher } from './domain/services/ClientMatcher';
export type { ClientMatchingRule } from './domain/services/ClientMatcher';

// ========== DTOs ==========
export type { SyncOptions, SyncRequestDto } from './application/dto/SyncOptions';
export type { SyncResponseDto, SyncDetailsDto } from './application/dto/SyncResultDto';
export { mapSyncRequestToOptions } from './application/dto/SyncOptions';
export { mapSyncResultToResponse } from './application/dto/SyncResultDto';

// ========== IMPLEMENTACIONES DE INFRAESTRUCTURA ==========
export { PostgresSyncRepository } from './infrastructure/repositories/PostgresSyncRepository';
export { GoogleSheetsGateway, getGoogleSheetsGateway } from './infrastructure/gateways/GoogleSheetsGateway';

// ========== CONFIGURACIÓN ==========
export { SYNC_CONFIG, getEnvironmentConfig, validateConfig, syncLogger } from './infrastructure/config/sync-config';

// ========== UTILIDADES DE COMPATIBILIDAD ==========

// Importaciones necesarias para las funciones utilitarias
import { validateConfig as validateSyncConfig, SYNC_CONFIG as CONFIG } from './infrastructure/config/sync-config';
import { SyncFactory } from './infrastructure/config/SyncFactory';
import { createSyncRoutes } from './presentation/routes/sync-routes';
import { legacySyncAdapter } from './infrastructure/adapters/LegacySyncAdapter';

/**
 * Función de conveniencia para inicializar el sistema de sync
 */
export function initializeSyncSystem() {
  console.log('🚀 Inicializando sistema de sincronización refactorizado...');
  
  // Validar configuración
  const isConfigValid = validateSyncConfig();
  if (!isConfigValid) {
    throw new Error('Invalid sync system configuration');
  }
  
  console.log('✅ Sistema de sincronización inicializado exitosamente');
  
  return {
    controller: SyncFactory.createSyncController(),
    routes: createSyncRoutes(),
    legacyAdapter: legacySyncAdapter
  };
}

/**
 * Función de conveniencia para obtener instancias de casos de uso
 */
export function getSyncUseCases() {
  return {
    full: SyncFactory.createSyncFullUseCase(),
    incremental: SyncFactory.createSyncIncrementalUseCase(),
    specific: SyncFactory.createSyncSpecificSheetsUseCase()
  };
}

/**
 * Función para verificar estado del sistema
 */
export async function checkSyncSystemHealth() {
  try {
    const sheetsGateway = SyncFactory.getSheetsGateway();
    const hasAccess = await sheetsGateway.validateSheetAccess();
    
    return {
      healthy: hasAccess,
      timestamp: new Date().toISOString(),
      version: CONFIG.SYNC_VERSION,
      components: {
        sheetsAccess: hasAccess,
        repository: true, // PostgresSyncRepository siempre disponible
        config: validateSyncConfig()
      }
    };
  } catch (error: any) {
    return {
      healthy: false,
      timestamp: new Date().toISOString(),
      version: CONFIG.SYNC_VERSION,
      error: error.message
    };
  }
}