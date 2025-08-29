import { SyncFactory } from '../config/SyncFactory';

/**
 * Adaptador para mantener compatibilidad con el sistema anterior de sincronización
 * Permite que el código existente funcione sin cambios mientras migra gradualmente
 */
export class LegacySyncAdapter {
  /**
   * Mantiene compatibilidad con handleSheetSync de routes.ts
   * Migra gradualmente la funcionalidad sin romper código existente
   */
  static async handleSheetSync(
    sheetName: string,
    options: {
      forceFullSync?: boolean;
      includeDashboard?: boolean;
      includeMetrics?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    leadsProcessed: number;
    message: string;
    duration?: number;
    details?: any;
  }> {
    try {
      console.log(`🔄 LegacySyncAdapter: Procesando sync de sheet "${sheetName}" con opciones:`, options);
      
      // Usar el nuevo sistema de sync pero manteniendo la interfaz anterior
      const syncSpecificSheetsUseCase = SyncFactory.createSyncSpecificSheetsUseCase();
      
      // Mapear opciones del sistema anterior al nuevo
      const syncOptions = {
        forceFullSync: options.forceFullSync || false,
        includeDashboardUpdate: options.includeDashboard || false,
        includeMetricsUpdate: options.includeMetrics || false,
        validateData: true
      };
      
      const result = await syncSpecificSheetsUseCase.execute([sheetName], syncOptions);
      
      console.log(`${result.success ? '✅' : '❌'} LegacySyncAdapter: Sync de "${sheetName}" ${result.success ? 'exitoso' : 'fallido'}`);
      
      // Mapear resultado del nuevo sistema al formato anterior
      return {
        success: result.success,
        leadsProcessed: result.leadsProcessed,
        message: result.error || `Sincronización de ${sheetName} completada`,
        duration: result.duration,
        details: result.details
      };
    } catch (error: any) {
      console.error(`❌ LegacySyncAdapter: Error en sync de "${sheetName}":`, error);
      return {
        success: false,
        leadsProcessed: 0,
        message: `Error en sincronización de ${sheetName}: ${error.message}`
      };
    }
  }

  /**
   * Mantiene compatibilidad con syncAllBrandSheetsToDatabase de google-sheets.ts
   */
  static async syncAllBrandSheetsToDatabase(options: {
    forceFullSync?: boolean;
    includeDashboard?: boolean;
    includeMetrics?: boolean;
    specificSheets?: string[];
  } = {}): Promise<{
    success: boolean;
    leadsProcessed: number;
    message: string;
    duration?: number;
    details?: any;
  }> {
    try {
      console.log('🔄 LegacySyncAdapter: Iniciando sync completo con opciones:', options);
      
      // Usar el sistema nuevo
      const syncOptions = {
        forceFullSync: options.forceFullSync || false,
        includeDashboardUpdate: options.includeDashboard || false,
        includeMetricsUpdate: options.includeMetrics || false,
        specificSheets: options.specificSheets,
        validateData: true
      };
      
      let result;
      if (options.specificSheets && options.specificSheets.length > 0) {
        // Sync específico
        const syncSpecificSheetsUseCase = SyncFactory.createSyncSpecificSheetsUseCase();
        result = await syncSpecificSheetsUseCase.execute(options.specificSheets, syncOptions);
      } else {
        // Sync completo
        const syncFullUseCase = SyncFactory.createSyncFullUseCase();
        result = await syncFullUseCase.execute(syncOptions);
      }
      
      console.log(`${result.success ? '✅' : '❌'} LegacySyncAdapter: Sync completo ${result.success ? 'exitoso' : 'fallido'}`);
      
      return {
        success: result.success,
        leadsProcessed: result.leadsProcessed,
        message: result.error || 'Sincronización completa exitosa',
        duration: result.duration,
        details: result.details
      };
    } catch (error: any) {
      console.error('❌ LegacySyncAdapter: Error en sync completo:', error);
      return {
        success: false,
        leadsProcessed: 0,
        message: `Error en sincronización completa: ${error.message}`
      };
    }
  }

  /**
   * Mantiene compatibilidad con el sistema de matching de clientes
   */
  static getClientMatchingSystem() {
    const clientMatcher = SyncFactory.getClientMatcher();
    
    // Crear wrapper que mantiene la interfaz anterior
    return {
      isMatch: (clienteName: string, dataName: string): boolean => {
        return clientMatcher.isMatch(clienteName, dataName);
      },
      
      addRule: (rule: any): void => {
        clientMatcher.addRule(rule);
      },
      
      findMatchingRule: (clienteName: string, dataName: string): any => {
        // El nuevo sistema no tiene este método exacto, pero podemos emularlo
        const isMatch = clientMatcher.isMatch(clienteName, dataName);
        if (isMatch) {
          const rules = clientMatcher.getRules();
          return rules.find(rule => {
            const matchesClient = rule.clienteNombre.some(name => 
              name === clienteName.toLowerCase() || clienteName.toLowerCase().includes(name)
            );
            return matchesClient;
          });
        }
        return null;
      }
    };
  }

  /**
   * Adaptador para mantener compatibilidad con getAllLeadsFromSheets
   */
  static async getAllLeadsFromSheets(): Promise<any[]> {
    try {
      const sheetsGateway = SyncFactory.getSheetsGateway();
      const rawLeads = await sheetsGateway.getAllLeads();
      
      // Convertir al formato esperado por el código anterior
      return rawLeads.map(lead => ({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        city: lead.city,
        timestamp: lead.timestamp,
        campaign: lead.campaign,
        source: lead.source,
        cost: lead.cost,
        // Metadatos adicionales
        origen: lead.origen,
        localizacion: lead.localizacion,
        cliente: lead.cliente
      }));
    } catch (error: any) {
      console.error('❌ LegacySyncAdapter: Error obteniendo leads:', error);
      return [];
    }
  }

  /**
   * Mantiene compatibilidad con las funciones de sincronización incremental
   */
  static async incrementalSync(options: {
    since?: Date;
    specificSheets?: string[];
  } = {}): Promise<{
    success: boolean;
    leadsProcessed: number;
    message: string;
  }> {
    try {
      const syncIncrementalUseCase = SyncFactory.createSyncIncrementalUseCase();
      
      const syncOptions = {
        since: options.since,
        specificSheets: options.specificSheets,
        validateData: true
      };
      
      const result = await syncIncrementalUseCase.execute(syncOptions);
      
      return {
        success: result.success,
        leadsProcessed: result.leadsProcessed,
        message: result.error || 'Sincronización incremental completada'
      };
    } catch (error: any) {
      console.error('❌ LegacySyncAdapter: Error en sync incremental:', error);
      return {
        success: false,
        leadsProcessed: 0,
        message: `Error en sincronización incremental: ${error.message}`
      };
    }
  }
}

/**
 * Instancia global para mantener compatibilidad con el código existente
 */
export const legacySyncAdapter = new LegacySyncAdapter();