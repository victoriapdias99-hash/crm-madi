import { SyncOptions } from '../dto/SyncOptions';
import { SyncResult, SyncDetails } from '../../domain/entities/SyncResult';
import { ISyncRepository } from '../../domain/interfaces/ISyncRepository';
import { ISheetsGateway } from '../../domain/interfaces/ISheetsGateway';
import { LeadProcessor } from '../../domain/services/LeadProcessor';
import { ClientMatcher } from '../../domain/services/ClientMatcher';
import { DuplicateDetector } from '../../domain/services/DuplicateDetector';

/**
 * Caso de uso para sincronización completa
 * Orquesta el proceso completo de sincronización desde Google Sheets
 */
export class SyncFullUseCase {
  private duplicateDetector: DuplicateDetector;
  
  constructor(
    private syncRepository: ISyncRepository,
    private sheetsGateway: ISheetsGateway,
    private leadProcessor: LeadProcessor,
    private clientMatcher: ClientMatcher
  ) {
    this.duplicateDetector = new DuplicateDetector();
  }

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

      // 3. Filtrar duplicados usando el DuplicateDetector mejorado
      await this.syncRepository.updateSyncStatus({
        currentOperation: 'Detectando duplicados'
      });

      const validLeads = processedLeads.filter(lead => lead.isValid);
      
      // Obtener todos los leads existentes para detección de duplicados
      const existingLeads = await this.syncRepository.getLeads({ limit: 200000 });
      console.log(`🔍 Comparando contra ${existingLeads.length} leads existentes`);
      
      // Detectar duplicados usando el sistema mejorado
      const leadsWithDuplicates = this.duplicateDetector.detectDuplicatesAgainstExisting(
        validLeads,
        existingLeads
      );
      
      const newLeads = leadsWithDuplicates.filter(lead => !lead.isDuplicate);
      const duplicatesDetected = leadsWithDuplicates.length - newLeads.length;
      
      console.log(`📊 De ${validLeads.length} leads válidos: ${newLeads.length} nuevos, ${duplicatesDetected} duplicados detectados`);

      // 4. Guardar solo los leads nuevos
      await this.syncRepository.updateSyncStatus({
        currentOperation: 'Guardando en base de datos'
      });

      const savedCount = await this.syncRepository.createLeadsBatch(newLeads);
      
      console.log(`✅ Guardados ${savedCount} leads nuevos en PostgreSQL`);

      // 5. Actualizar estado final
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        lastSyncTime: new Date(),
        currentOperation: undefined,
        progress: undefined
      });

      // 6. Calcular estadísticas con duplicados detectados
      const details = this.calculateSyncDetails(processedLeads, rawLeads, options, duplicatesDetected);

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
    options: SyncOptions,
    duplicatesDetected: number = 0
  ): SyncDetails {
    const validLeads = processedLeads.filter(l => l.isValid).length;
    const newLeads = validLeads - duplicatesDetected;
    const duplicatesFound = duplicatesDetected;
    const validationErrors = processedLeads.filter(l => !l.isValid).length;
    const skippedLeads = rawLeads.length - validLeads;

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