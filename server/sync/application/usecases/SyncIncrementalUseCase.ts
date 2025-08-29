import { SyncOptions } from '../dto/SyncOptions';
import { SyncResult } from '../../domain/entities/SyncResult';
import { ISyncRepository } from '../../domain/interfaces/ISyncRepository';
import { ISheetsGateway } from '../../domain/interfaces/ISheetsGateway';
import { LeadProcessor } from '../../domain/services/LeadProcessor';

/**
 * Caso de uso para sincronización incremental
 * Solo procesa datos nuevos desde la última sincronización
 */
export class SyncIncrementalUseCase {
  constructor(
    private syncRepository: ISyncRepository,
    private sheetsGateway: ISheetsGateway,
    private leadProcessor: LeadProcessor
  ) {}

  async execute(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Iniciando sincronización incremental...');
      
      // Obtener último timestamp de sincronización
      const syncStatus = await this.syncRepository.getSyncStatus();
      const cutoffTime = options.since || 
        syncStatus?.lastSyncTime || 
        new Date(Date.now() - 24 * 60 * 60 * 1000); // Últimas 24h por defecto

      console.log(`📅 Sincronizando datos desde: ${cutoffTime.toISOString()}`);

      // Actualizar estado
      await this.syncRepository.updateSyncStatus({
        isRunning: true,
        currentOperation: 'Obteniendo datos incrementales'
      });

      // Obtener solo datos nuevos (nota: dependería de implementación en Google Sheets)
      const rawLeads = await this.fetchIncrementalData(options, cutoffTime);

      if (rawLeads.length === 0) {
        await this.syncRepository.updateSyncStatus({ isRunning: false });
        return this.createResult(true, 0, startTime, 'No hay datos nuevos para sincronizar');
      }

      console.log(`📥 Obtenidos ${rawLeads.length} leads nuevos desde Google Sheets`);

      // Procesar leads
      const syncLeads = rawLeads.map(raw => this.leadProcessor.convertRawToSyncLead(raw));
      const processedLeads = this.leadProcessor.processLeadsBatch(syncLeads);

      // Guardar todos los leads válidos
      const validLeads = processedLeads.filter(lead => lead.isValid);
      const savedCount = await this.syncRepository.createLeadsBatch(validLeads);

      // Actualizar estado final
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        lastSyncTime: new Date(),
        currentOperation: undefined
      });

      console.log(`✅ Sincronización incremental completada: ${savedCount} leads guardados`);

      const details = {
        newLeads: savedCount,
        updatedLeads: 0,
        skippedLeads: rawLeads.length - savedCount,
        duplicatesFound: 0,
        validationErrors: processedLeads.filter(l => !l.isValid).length,
        sheetsProcessed: options.specificSheets || ['incremental_sync'],
        clientsMatched: this.calculateClientsMatched(processedLeads)
      };

      return this.createResult(
        true,
        rawLeads.length,
        startTime,
        'Sincronización incremental completada',
        details
      );

    } catch (error: any) {
      console.error('❌ Error en sincronización incremental:', error);
      
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        currentOperation: undefined
      });

      return this.createResult(false, 0, startTime, error.message);
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  private async fetchIncrementalData(options: SyncOptions, since: Date) {
    // Por ahora, Google Sheets no tiene API para datos incrementales por timestamp
    // Así que obtenemos todos y filtramos por fecha (no es lo más eficiente pero funciona)
    if (options.specificSheets && options.specificSheets.length > 0) {
      const allLeads = [];
      for (const sheetName of options.specificSheets) {
        const sheetLeads = await this.sheetsGateway.getLeadsFromSpecificSheet(sheetName, since);
        allLeads.push(...sheetLeads);
      }
      return allLeads;
    } else {
      // Obtener todos y filtrar por fecha
      const allLeads = await this.sheetsGateway.getAllLeads();
      return this.filterLeadsByDate(allLeads, since);
    }
  }

  private filterLeadsByDate(leads: any[], since: Date) {
    return leads.filter(lead => {
      try {
        const leadDate = new Date(lead.timestamp);
        return leadDate >= since;
      } catch (error) {
        // Si no se puede parsear la fecha, incluir el lead por seguridad
        return true;
      }
    });
  }

  private async getRecentLeads(since: Date) {
    // Obtener leads recientes para comparación de duplicados (más eficiente que todos)
    const allLeads = await this.syncRepository.getLeads({ limit: 5000 });
    return allLeads.filter(lead => {
      try {
        const leadDate = new Date(lead.fechaCreacion);
        return leadDate >= new Date(since.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 días antes
      } catch (error) {
        return true; // Incluir por seguridad
      }
    });
  }

  private calculateClientsMatched(leads: any[]): Record<string, number> {
    const clientsMatched: Record<string, number> = {};
    for (const lead of leads) {
      if (lead.cliente) {
        const normalizedClient = lead.normalizedClient || lead.cliente;
        clientsMatched[normalizedClient] = (clientsMatched[normalizedClient] || 0) + 1;
      }
    }
    return clientsMatched;
  }

  private createResult(
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