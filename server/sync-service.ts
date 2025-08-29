/**
 * Servicio de sincronización migrado al nuevo sistema refactorizado
 * Reemplaza sync-service.ts legacy usando el sistema Clean Architecture
 */

import { SyncFactory } from './sync/infrastructure/config/SyncFactory';
import { mapSyncRequestToOptions } from './sync/application/dto/SyncOptions';
import { mapSyncResultToResponse } from './sync/application/dto/SyncResultDto';

// Interfaces compatibles con el sistema anterior
export interface SyncResult {
  success: boolean;
  leadsProcessed: number;
  timestamp: string;
  duration: number;
  error?: string;
  details?: {
    newLeads: number;
    updatedLeads: number;
    skippedLeads: number;
  };
}

export interface SyncOptions {
  forceFullSync?: boolean;
  includeDashboardUpdate?: boolean;
  includeMetricsUpdate?: boolean;
  specificSheets?: string[];
  validateData?: boolean;
}

/**
 * Servicio de sincronización usando el nuevo sistema refactorizado
 * Mantiene compatibilidad con la interfaz anterior
 */
export class SyncService {
  private isRunning = false;
  private lastSyncTime: Date | null = null;

  /**
   * Ejecuta sincronización completa usando el nuevo sistema
   */
  async executeFullSync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.isRunning) {
      throw new Error('Sincronización ya en progreso');
    }

    this.isRunning = true;
    
    try {
      console.log('🔄 SyncService: Ejecutando sync completo con nuevo sistema...');
      
      // Usar el nuevo sistema refactorizado
      const syncFullUseCase = SyncFactory.createSyncFullUseCase();
      
      // Mapear opciones al nuevo sistema
      const syncOptions = {
        forceFullSync: options.forceFullSync || false,
        includeDashboardUpdate: options.includeDashboardUpdate || false,
        includeMetricsUpdate: options.includeMetricsUpdate || false,
        specificSheets: options.specificSheets,
        validateData: options.validateData !== false // true por defecto
      };
      
      const result = await syncFullUseCase.execute(syncOptions);
      this.lastSyncTime = new Date();
      
      console.log(`✅ SyncService: Sync completo ${result.success ? 'exitoso' : 'fallido'} - ${result.leadsProcessed} leads`);
      
      // Mapear resultado al formato anterior
      return {
        success: result.success,
        leadsProcessed: result.leadsProcessed,
        timestamp: result.timestamp,
        duration: result.duration,
        error: result.error,
        details: result.details ? {
          newLeads: result.details.newLeads,
          updatedLeads: result.details.updatedLeads,
          skippedLeads: result.details.skippedLeads
        } : undefined
      };
      
    } catch (error: any) {
      console.error('❌ SyncService: Error en sync completo:', error);
      return {
        success: false,
        leadsProcessed: 0,
        timestamp: new Date().toISOString(),
        duration: 0,
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Ejecuta sincronización incremental usando el nuevo sistema
   */
  async executeIncrementalSync(options: SyncOptions = {}): Promise<SyncResult> {
    try {
      console.log('🔄 SyncService: Ejecutando sync incremental con nuevo sistema...');
      
      // Usar el nuevo sistema refactorizado
      const syncIncrementalUseCase = SyncFactory.createSyncIncrementalUseCase();
      
      const syncOptions = {
        since: this.lastSyncTime,
        includeDashboardUpdate: options.includeDashboardUpdate || false,
        includeMetricsUpdate: options.includeMetricsUpdate || false,
        specificSheets: options.specificSheets,
        validateData: true
      };
      
      const result = await syncIncrementalUseCase.execute(syncOptions);
      this.lastSyncTime = new Date();
      
      console.log(`✅ SyncService: Sync incremental ${result.success ? 'exitoso' : 'fallido'} - ${result.leadsProcessed} leads`);
      
      return {
        success: result.success,
        leadsProcessed: result.leadsProcessed,
        timestamp: result.timestamp,
        duration: result.duration,
        error: result.error,
        details: result.details ? {
          newLeads: result.details.newLeads,
          updatedLeads: result.details.updatedLeads,
          skippedLeads: result.details.skippedLeads
        } : undefined
      };
      
    } catch (error: any) {
      console.error('❌ SyncService: Error en sync incremental:', error);
      return {
        success: false,
        leadsProcessed: 0,
        timestamp: new Date().toISOString(),
        duration: 0,
        error: error.message
      };
    }
  }

  /**
   * Sincronizar hojas específicas usando el nuevo sistema
   */
  async syncSpecificSheets(sheetNames: string[], options: SyncOptions = {}): Promise<SyncResult> {
    try {
      console.log(`🔄 SyncService: Sync de sheets específicos con nuevo sistema: ${sheetNames.join(', ')}`);
      
      const syncSpecificSheetsUseCase = SyncFactory.createSyncSpecificSheetsUseCase();
      
      const syncOptions = {
        forceFullSync: options.forceFullSync || false,
        includeDashboardUpdate: options.includeDashboardUpdate || false,
        includeMetricsUpdate: options.includeMetricsUpdate || false,
        validateData: true
      };
      
      const result = await syncSpecificSheetsUseCase.execute(sheetNames, syncOptions);
      
      console.log(`✅ SyncService: Sync de sheets específicos ${result.success ? 'exitoso' : 'fallido'} - ${result.leadsProcessed} leads`);
      
      return {
        success: result.success,
        leadsProcessed: result.leadsProcessed,
        timestamp: result.timestamp,
        duration: result.duration,
        error: result.error,
        details: result.details ? {
          newLeads: result.details.newLeads,
          updatedLeads: result.details.updatedLeads,
          skippedLeads: result.details.skippedLeads
        } : undefined
      };
      
    } catch (error: any) {
      console.error(`❌ SyncService: Error en sync de sheets específicos (${sheetNames.join(', ')}):`, error);
      return {
        success: false,
        leadsProcessed: 0,
        timestamp: new Date().toISOString(),
        duration: 0,
        error: error.message
      };
    }
  }

  /**
   * Mantiene compatibilidad con syncAllBrandSheets
   */
  async syncAllBrandSheets(options: SyncOptions = {}): Promise<SyncResult> {
    return this.executeFullSync(options);
  }

  /**
   * Obtener estado de sincronización
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      uptime: this.lastSyncTime ? Date.now() - this.lastSyncTime.getTime() : null
    };
  }
}

// Exportar instancia singleton para compatibilidad
export const syncService = new SyncService();

// Exportar también como default para compatibilidad
export default syncService;