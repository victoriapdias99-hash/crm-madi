import { SyncOptions } from '../dto/SyncOptions';
import { SyncResult, SyncDetails } from '../../domain/entities/SyncResult';
import { ISyncRepository } from '../../domain/interfaces/ISyncRepository';
import { ISheetsGateway } from '../../domain/interfaces/ISheetsGateway';
import { LeadProcessor } from '../../domain/services/LeadProcessor';
import { DuplicateDetector } from '../../domain/services/DuplicateDetector';
import { ClientMatcher } from '../../domain/services/ClientMatcher';

/**
 * Caso de uso para sincronización completa
 * Orquesta el proceso completo de sincronización desde Google Sheets
 */
export class SyncFullUseCase {
  constructor(
    private syncRepository: ISyncRepository,
    private sheetsGateway: ISheetsGateway,
    private leadProcessor: LeadProcessor,
    private duplicateDetector: DuplicateDetector,
    private clientMatcher: ClientMatcher
  ) {}

  async execute(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 Iniciando sincronización completa...');
      
      // Actualizar estado de sincronización
      await this.syncRepository.updateSyncStatus({
        isRunning: true,
        currentOperation: 'Obteniendo datos de Google Sheets'
      });

      // 1. Obtener datos desde Google Sheets
      const rawLeads = await this.fetchDataFromSheets(options);
      
      if (rawLeads.length === 0) {
        await this.syncRepository.updateSyncStatus({ isRunning: false });
        return this.createResult(true, 0, startTime, 'No hay datos para sincronizar');
      }

      console.log(`📥 Obtenidos ${rawLeads.length} leads desde Google Sheets`);

      // 2. Procesar leads
      await this.syncRepository.updateSyncStatus({
        currentOperation: 'Procesando leads',
        progress: { current: 0, total: rawLeads.length, stage: 'processing' }
      });

      const syncLeads = rawLeads.map(raw => this.leadProcessor.convertRawToSyncLead(raw));
      const processedLeads = this.leadProcessor.processLeadsBatch(syncLeads);
      
      console.log(`🔄 Procesados ${processedLeads.length} leads`);

      // 3. Detectar duplicados si no está deshabilitado
      let finalLeads = processedLeads;
      if (!options.skipDuplicateDetection) {
        await this.syncRepository.updateSyncStatus({
          currentOperation: 'Detectando duplicados'
        });

        const existingLeads = await this.syncRepository.getLeads({ limit: 10000 });
        finalLeads = this.duplicateDetector.detectDuplicatesAgainstExisting(
          processedLeads, 
          existingLeads
        );
        
        console.log(`🔍 Detectados duplicados en ${finalLeads.filter(l => l.isDuplicate).length} leads`);
      }

      // 4. Guardar leads válidos
      await this.syncRepository.updateSyncStatus({
        currentOperation: 'Guardando en base de datos'
      });

      const validLeads = finalLeads.filter(lead => lead.isValid && !lead.isDuplicate);
      const savedCount = await this.syncRepository.createLeadsBatch(validLeads);
      
      console.log(`✅ Guardados ${savedCount} leads nuevos en PostgreSQL`);

      // 5. Actualizar estado final
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        lastSyncTime: new Date(),
        currentOperation: undefined,
        progress: undefined
      });

      // 6. Calcular estadísticas
      const details = this.calculateSyncDetails(finalLeads, rawLeads, options);

      console.log('✅ Sincronización completa exitosa');

      return this.createResult(
        true, 
        rawLeads.length, 
        startTime, 
        'Sincronización completada exitosamente',
        details
      );

    } catch (error: any) {
      console.error('❌ Error en sincronización completa:', error);
      
      // Actualizar estado de error
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        currentOperation: undefined,
        progress: undefined
      });

      return this.createResult(false, 0, startTime, error.message);
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  private async fetchDataFromSheets(options: SyncOptions) {
    if (options.specificSheets && options.specificSheets.length > 0) {
      return await this.sheetsGateway.getLeadsFromSheets(options.specificSheets);
    } else {
      return await this.sheetsGateway.getAllLeads();
    }
  }

  private calculateSyncDetails(
    processedLeads: any[], 
    rawLeads: any[], 
    options: SyncOptions
  ): SyncDetails {
    const newLeads = processedLeads.filter(l => l.isValid && !l.isDuplicate).length;
    const duplicatesFound = processedLeads.filter(l => l.isDuplicate).length;
    const validationErrors = processedLeads.filter(l => !l.isValid).length;
    const skippedLeads = rawLeads.length - newLeads - duplicatesFound;

    // Calcular clientes matched
    const clientsMatched: Record<string, number> = {};
    for (const lead of processedLeads) {
      if (lead.cliente) {
        const normalizedClient = lead.normalizedClient || lead.cliente;
        clientsMatched[normalizedClient] = (clientsMatched[normalizedClient] || 0) + 1;
      }
    }

    // Obtener sheets procesados
    const sheetsProcessed = options.specificSheets || ['all_available_sheets'];

    return {
      newLeads,
      updatedLeads: 0, // Por ahora no actualizamos leads existentes
      skippedLeads,
      duplicatesFound,
      validationErrors,
      sheetsProcessed,
      clientsMatched
    };
  }

  private createResult(
    success: boolean, 
    leadsProcessed: number, 
    startTime: number, 
    message: string,
    details?: SyncDetails
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