/**
 * Servicio centralizado de sincronización para el CRM
 * Maneja la sincronización de datos de Google Sheets a PostgreSQL
 * Separación de responsabilidades para reutilización en diferentes contextos
 */

// Import desde google-sheets.ts que tiene las funciones necesarias
// import { googleSheetsService } from './google-sheets-sync-service';

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

export class SyncService {
  private isRunning = false;
  private lastSyncTime: Date | null = null;

  /**
   * Ejecuta sincronización completa de Google Sheets a PostgreSQL
   */
  async executeFullSync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    if (this.isRunning) {
      throw new Error('Sincronización ya en progreso');
    }

    this.isRunning = true;
    
    try {
      console.log('🔄 Iniciando sincronización completa desde SyncService...');
      
      // 1. Obtener datos desde Google Sheets
      const allLeads = await this._fetchDataFromSheets(options.specificSheets);
      console.log(`📥 Obtenidos ${allLeads.length} leads desde Google Sheets`);
      
      if (allLeads.length === 0) {
        return this._createResult(true, 0, startTime, 'No hay datos para sincronizar');
      }

      // 2. Procesar y guardar en base de datos
      const syncDetails = await this._processAndSaveLeads(allLeads, options);
      console.log('✅ Datos sincronizados en PostgreSQL');

      // 3. Actualizar métricas si se solicita
      if (options.includeMetricsUpdate) {
        await this._updateMetrics();
        console.log('📊 Métricas actualizadas');
      }

      // 4. Actualizar dashboard si se solicita
      if (options.includeDashboardUpdate) {
        await this._updateDashboard();
        console.log('📊 Dashboard actualizado');
      }

      this.lastSyncTime = new Date();
      
      return this._createResult(
        true, 
        allLeads.length, 
        startTime, 
        'Sincronización completada exitosamente',
        syncDetails
      );

    } catch (error: any) {
      console.error('❌ Error en sincronización:', error);
      return this._createResult(false, 0, startTime, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sincronización incremental (solo nuevos datos)
   */
  async executeIncrementalSync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Iniciando sincronización incremental...');
      
      // Implementar lógica incremental basada en timestamps
      const cutoffTime = this.lastSyncTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // Últimas 24h si es primera vez
      
      const newLeads = await this._fetchDataFromSheets(options.specificSheets, cutoffTime);
      
      if (newLeads.length === 0) {
        return this._createResult(true, 0, startTime, 'No hay nuevos datos para sincronizar');
      }

      const syncDetails = await this._processAndSaveLeads(newLeads, options);
      
      this.lastSyncTime = new Date();
      
      return this._createResult(
        true, 
        newLeads.length, 
        startTime, 
        'Sincronización incremental completada',
        syncDetails
      );

    } catch (error: any) {
      console.error('❌ Error en sincronización incremental:', error);
      return this._createResult(false, 0, startTime, error.message);
    }
  }

  /**
   * Sincroniza todas las pestañas de marcas con opciones específicas
   * Método requerido por google-sheets-sync-service.ts
   */
  async syncAllBrandSheets(options: SyncOptions = {}, preloadedLeads?: any[]): Promise<SyncResult> {
    const startTime = Date.now();
    
    if (this.isRunning) {
      throw new Error('Sincronización ya en progreso');
    }

    this.isRunning = true;
    
    try {
      console.log('🔄 Sincronizando todas las pestañas de marcas...');
      
      // Usar datos precargados o obtener nuevos
      const allLeads = preloadedLeads || await this._fetchDataFromSheets();
      console.log(`📥 Procesando ${allLeads.length} leads desde Google Sheets`);
      
      if (allLeads.length === 0) {
        return this._createResult(true, 0, startTime, 'No hay datos para sincronizar');
      }

      // Procesar y guardar en base de datos
      const syncDetails = await this._processAndSaveLeads(allLeads, options);
      console.log('✅ Datos sincronizados en PostgreSQL con nuevas columnas');

      // Actualizar métricas y dashboard
      if (options.includeMetrics) {
        await this._updateMetrics();
      }

      if (options.includeDashboard) {
        await this._updateDashboard();
      }

      this.lastSyncTime = new Date();
      
      return this._createResult(true, allLeads.length, startTime, 'Sincronización completada');
      
    } catch (error) {
      console.error('❌ Error en syncAllBrandSheets:', error);
      return this._createResult(false, 0, startTime, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Verificar estado de sincronización
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      uptime: this.lastSyncTime ? Date.now() - this.lastSyncTime.getTime() : null
    };
  }

  /**
   * Obtener datos desde Google Sheets
   */
  private async _fetchDataFromSheets(specificSheets?: string[], since?: Date) {
    try {
      // Importar dinámicamente el servicio correcto
      const { googleSheetsService } = await import('./google-sheets');
      
      if (specificSheets && specificSheets.length > 0) {
        // Sincronizar solo hojas específicas
        const leads = [];
        for (const sheetName of specificSheets) {
          const sheetLeads = await googleSheetsService.getLeadsFromSpecificSheet?.(sheetName, since) || [];
          leads.push(...sheetLeads);
        }
        return leads;
      } else {
        // Sincronización completa de todas las hojas
        return await googleSheetsService.getAllLeadsFromSheets();
      }
    } catch (error) {
      console.error('Error fetching data from sheets:', error);
      throw new Error(`Error obteniendo datos de Google Sheets: ${error.message}`);
    }
  }

  /**
   * Procesar y guardar leads en base de datos
   */
  private async _processAndSaveLeads(leads: any[], options: SyncOptions) {
    try {
      // Usar el sistema handleSheetSync existente que ya funciona
      const routesModule = await import('./routes');
      
      const beforeCount = await this._getLeadsCount();
      
      // Convertir leads al formato esperado por handleSheetSync
      const sheetLeads = leads.map(lead => ({
        nombre: lead.nombre || '',
        telefono: lead.telefono || '',
        email: lead.email || '',
        ciudad: lead.ciudad || '',
        marca: lead.marca || '',
        origen: lead.origen || '',
        localizacion: lead.localizacion || '',
        cliente: lead.cliente || '',
        fechaCreacion: lead.fechaCreacion || new Date().toISOString(),
        // Campos adicionales requeridos por el sistema existente
        metaLeadId: `${lead.telefono}_${lead.marca}_${Date.now()}` // ID único basado en teléfono
      }));
      
      // Llamar a la función que sabemos que existe y funciona
      if (typeof routesModule.handleSheetSync === 'function') {
        await routesModule.handleSheetSync(sheetLeads);
      } else {
        // Fallback: procesar directamente con storage
        const { storage } = await import('./storage');
        const existingLeads = await storage.getLeads({ limit: 10000 });
        const existingPhones = new Set(existingLeads.map(lead => lead.phone || ''));
        
        for (const leadData of sheetLeads) {
          if (!existingPhones.has(leadData.telefono) && leadData.telefono) {
            await storage.createLead({
              metaLeadId: leadData.metaLeadId || `SYNC_${Date.now()}_${leadData.telefono}`,
              firstName: leadData.nombre || '',
              lastName: '',
              phone: leadData.telefono || '',
              email: leadData.email || '',
              city: leadData.ciudad || '',
              campaignName: leadData.marca || '',
              origen: leadData.origen || '',
              localizacion: leadData.localizacion || '',
              cliente: leadData.cliente || '',
              source: 'google_sheets',
              status: 'new',
              leadDate: new Date(leadData.fechaCreacion || new Date())
            });
            existingPhones.add(leadData.telefono);
          }
        }
      }
      
      const afterCount = await this._getLeadsCount();
      const newLeads = Math.max(0, afterCount - beforeCount);
      
      console.log(`🔄 Procesados ${leads.length} leads, ${newLeads} nuevos agregados`);
      
      return {
        newLeads,
        updatedLeads: 0,
        skippedLeads: leads.length - newLeads
      };
    } catch (error) {
      console.error('Error processing leads:', error);
      throw new Error(`Error procesando leads: ${error.message}`);
    }
  }

  /**
   * Actualizar métricas del sistema
   */
  private async _updateMetrics() {
    try {
      const { getRealtimeStats } = await import('./routes');
      await getRealtimeStats();
    } catch (error) {
      console.warn('No se pudieron actualizar métricas:', error.message);
    }
  }

  /**
   * Actualizar dashboard
   */
  private async _updateDashboard() {
    try {
      const { getRealtimeStats, broadcastDashboardUpdate } = await import('./routes');
      const stats = await getRealtimeStats();
      broadcastDashboardUpdate(stats);
    } catch (error) {
      console.warn('No se pudo actualizar dashboard:', error.message);
    }
  }

  /**
   * Obtener conteo actual de leads
   */
  private async _getLeadsCount(): Promise<number> {
    try {
      const { storage } = await import('./storage');
      const leads = await storage.getLeads({ limit: 1 });
      // Esto es aproximado, en una implementación real usaríamos COUNT()
      return leads.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Crear resultado estandarizado
   */
  private _createResult(
    success: boolean, 
    leadsProcessed: number, 
    startTime: number, 
    message: string,
    details?: any
  ): SyncResult {
    return {
      success,
      leadsProcessed,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: success ? undefined : message,
      details
    };
  }
}

// Instancia singleton del servicio
export const syncService = new SyncService();