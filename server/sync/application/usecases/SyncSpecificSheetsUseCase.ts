import { SyncOptions } from '../dto/SyncOptions';
import { SyncResult } from '../../domain/entities/SyncResult';
import { ISyncRepository } from '../../domain/interfaces/ISyncRepository';
import { ISheetsGateway } from '../../domain/interfaces/ISheetsGateway';
import { LeadProcessor } from '../../domain/services/LeadProcessor';
import { DuplicateDetector } from '../../domain/services/DuplicateDetector';
import { ClientMatcher } from '../../domain/services/ClientMatcher';

/**
 * Caso de uso para sincronización de sheets específicos
 * Permite sincronizar solo pestañas seleccionadas de Google Sheets
 */
export class SyncSpecificSheetsUseCase {
  constructor(
    private syncRepository: ISyncRepository,
    private sheetsGateway: ISheetsGateway,
    private leadProcessor: LeadProcessor,
    private duplicateDetector: DuplicateDetector,
    private clientMatcher: ClientMatcher
  ) {}

  async execute(sheetNames: string[], options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Iniciando sincronización de sheets específicos: ${sheetNames.join(', ')}`);
      
      // Validar que los sheets existen
      const availableSheets = await this.sheetsGateway.getAvailableSheetNames();
      const invalidSheets = sheetNames.filter(name => !availableSheets.includes(name));
      
      if (invalidSheets.length > 0) {
        console.warn(`⚠️ Sheets no encontrados: ${invalidSheets.join(', ')}`);
      }
      
      const validSheets = sheetNames.filter(name => availableSheets.includes(name));
      if (validSheets.length === 0) {
        return this.createResult(false, 0, startTime, 'No se encontraron sheets válidos para sincronizar');
      }

      // Actualizar estado
      await this.syncRepository.updateSyncStatus({
        isRunning: true,
        currentOperation: `Sincronizando ${validSheets.length} sheets`,
        progress: { current: 0, total: validSheets.length, stage: 'sheets' }
      });

      const allRawLeads = [];
      const sheetResults: Record<string, { leads: number; errors: string[] }> = {};

      // Procesar cada sheet individualmente
      for (let i = 0; i < validSheets.length; i++) {
        const sheetName = validSheets[i];
        
        try {
          console.log(`📊 Procesando sheet: ${sheetName} (${i + 1}/${validSheets.length})`);
          
          await this.syncRepository.updateSyncStatus({
            currentOperation: `Procesando ${sheetName}`,
            progress: { current: i + 1, total: validSheets.length, stage: 'sheets' }
          });

          const sheetLeads = await this.sheetsGateway.getLeadsFromSheet(sheetName);
          
          if (sheetLeads.length > 0) {
            // Agregar información del sheet a cada lead
            const leadsWithSheet = sheetLeads.map(lead => ({
              ...lead,
              campaign: sheetName,
              source: 'google_sheets' as const
            }));
            
            allRawLeads.push(...leadsWithSheet);
            sheetResults[sheetName] = { leads: sheetLeads.length, errors: [] };
            
            console.log(`✅ ${sheetName}: ${sheetLeads.length} leads obtenidos`);
          } else {
            sheetResults[sheetName] = { leads: 0, errors: ['No se encontraron datos'] };
            console.log(`⚠️ ${sheetName}: Sin datos`);
          }
          
        } catch (error: any) {
          console.error(`❌ Error procesando sheet ${sheetName}:`, error.message);
          sheetResults[sheetName] = { leads: 0, errors: [error.message] };
        }
      }

      if (allRawLeads.length === 0) {
        await this.syncRepository.updateSyncStatus({ isRunning: false });
        return this.createResult(true, 0, startTime, 'No se encontraron datos en los sheets especificados');
      }

      console.log(`📥 Total obtenido: ${allRawLeads.length} leads de ${validSheets.length} sheets`);

      // Procesar todos los leads
      await this.syncRepository.updateSyncStatus({
        currentOperation: 'Procesando leads obtenidos',
        progress: { current: 0, total: allRawLeads.length, stage: 'processing' }
      });

      const syncLeads = allRawLeads.map(raw => this.leadProcessor.convertRawToSyncLead(raw));
      const processedLeads = this.leadProcessor.processLeadsBatch(syncLeads);

      // Detectar duplicados si no está deshabilitado
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

      // Guardar leads válidos (y no duplicados solo si la verificación está activa)
      const validLeads = options.skipDuplicateDetection 
        ? finalLeads.filter(lead => lead.isValid)
        : finalLeads.filter(lead => lead.isValid && !lead.isDuplicate);
      const savedCount = await this.syncRepository.createLeadsBatch(validLeads);

      // Actualizar estado final
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        lastSyncTime: new Date(),
        currentOperation: undefined,
        progress: undefined
      });

      console.log(`✅ Sincronización de sheets específicos completada: ${savedCount} leads guardados`);

      const details = {
        newLeads: savedCount,
        updatedLeads: 0,
        skippedLeads: allRawLeads.length - savedCount,
        duplicatesFound: finalLeads.filter(l => l.isDuplicate).length,
        validationErrors: finalLeads.filter(l => !l.isValid).length,
        sheetsProcessed: validSheets,
        clientsMatched: this.calculateClientsMatched(finalLeads),
        sheetDetails: sheetResults
      };

      return this.createResult(
        true,
        allRawLeads.length,
        startTime,
        `Sincronización completada para ${validSheets.length} sheets`,
        details
      );

    } catch (error: any) {
      console.error('❌ Error en sincronización de sheets específicos:', error);
      
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        currentOperation: undefined,
        progress: undefined
      });

      return this.createResult(false, 0, startTime, error.message);
    }
  }

  /**
   * Obtiene estadísticas de sheets disponibles
   */
  async getAvailableSheets(): Promise<{
    available: string[];
    total: number;
    lastChecked: string;
  }> {
    try {
      const available = await this.sheetsGateway.getAvailableSheetNames();
      return {
        available,
        total: available.length,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error obteniendo sheets disponibles:', error);
      return {
        available: [],
        total: 0,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Valida que los sheets especificados existen
   */
  async validateSheets(sheetNames: string[]): Promise<{
    valid: string[];
    invalid: string[];
    available: string[];
  }> {
    const availableSheets = await this.sheetsGateway.getAvailableSheetNames();
    const valid = sheetNames.filter(name => availableSheets.includes(name));
    const invalid = sheetNames.filter(name => !availableSheets.includes(name));
    
    return {
      valid,
      invalid,
      available: availableSheets
    };
  }

  // ========== MÉTODOS PRIVADOS ==========

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