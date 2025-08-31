import { SyncOptions } from '../dto/SyncOptions';
import { SyncResult, SyncDetails } from '../../domain/entities/SyncResult';
import { ISyncRepository } from '../../domain/interfaces/ISyncRepository';
import { ISheetsGateway } from '../../domain/interfaces/ISheetsGateway';
import { LeadProcessor } from '../../domain/services/LeadProcessor';
import { DuplicateDetector } from '../../domain/services/DuplicateDetector';

/**
 * Caso de uso para sincronización inteligente
 * Analiza el estado actual y continúa desde donde se quedó cada marca
 */
export class SyncSmartUseCase {
  private duplicateDetector: DuplicateDetector;
  
  constructor(
    private syncRepository: ISyncRepository,
    private sheetsGateway: ISheetsGateway,
    private leadProcessor: LeadProcessor
  ) {
    this.duplicateDetector = new DuplicateDetector();
  }

  async execute(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('🧠 Iniciando sincronización inteligente...');
      
      // Actualizar estado de sincronización
      await this.syncRepository.updateSyncStatus({
        isRunning: true,
        currentOperation: 'Analizando estado actual por marca'
      });

      // 1. Analizar estado actual de cada marca
      const brandAnalysis = await this.analyzeBrandStatus(options.specificSheets);
      console.log('📊 Análisis de marcas completado:', brandAnalysis);

      if (brandAnalysis.incompleteSheets.length === 0) {
        console.log('✅ Todas las marcas están completamente sincronizadas');
        await this.syncRepository.updateSyncStatus({ isRunning: false });
        return this.createResult(true, 0, startTime, 'Todas las marcas ya están sincronizadas');
      }

      console.log(`🔄 Marcas que necesitan sincronización: ${brandAnalysis.incompleteSheets.map(s => s.name).join(', ')}`);

      let totalProcessed = 0;
      const details: SyncDetails = {
        newLeads: 0,
        updatedLeads: 0,
        skippedLeads: 0,
        duplicatesFound: 0,
        validationErrors: 0,
        sheetsProcessed: [],
        clientsMatched: {}
      };

      // 2. Procesar solo las marcas incompletas
      for (const incompleteSheet of brandAnalysis.incompleteSheets) {
        console.log(`🔄 Procesando marca ${incompleteSheet.name}: ${incompleteSheet.currentCount}/${incompleteSheet.totalCount} registros`);
        
        await this.syncRepository.updateSyncStatus({
          currentOperation: `Sincronizando marca ${incompleteSheet.name}`,
          progress: { current: totalProcessed, total: brandAnalysis.totalPending, stage: 'syncing' }
        });

        // Obtener datos específicos de esta marca
        const rawLeads = await this.sheetsGateway.getLeadsFromSheets([incompleteSheet.name]);
        
        if (rawLeads.length > 0) {
          // Procesar y guardar leads
          const syncLeads = rawLeads.map(raw => this.leadProcessor.convertRawToSyncLead(raw));
          const processedLeads = this.leadProcessor.processLeadsBatch(syncLeads);
          const validLeads = processedLeads.filter(lead => lead.isValid);
          
          // Filtrar duplicados que ya existen en la base de datos
          const newLeads = await this.filterExistingLeads(validLeads, incompleteSheet.name);
          
          if (newLeads.length > 0) {
            const savedCount = await this.syncRepository.createLeadsBatch(newLeads);
            console.log(`✅ ${incompleteSheet.name}: Guardados ${savedCount} nuevos registros`);
            
            details.newLeads += savedCount;
            totalProcessed += savedCount;
          } else {
            console.log(`ℹ️ ${incompleteSheet.name}: No hay nuevos registros para guardar`);
          }
          
          details.sheetsProcessed?.push(incompleteSheet.name);
        }
      }

      // 3. Actualizar estado final
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        lastSyncTime: new Date(),
        currentOperation: undefined,
        progress: undefined
      });

      console.log(`✅ Sincronización inteligente completada: ${totalProcessed} registros procesados`);

      return this.createResult(
        true, 
        totalProcessed, 
        startTime, 
        `Sincronización inteligente completada: ${details.sheetsProcessed?.length || 0} marcas actualizadas`,
        details
      );

    } catch (error: any) {
      console.error('❌ Error en sincronización inteligente:', error);
      
      await this.syncRepository.updateSyncStatus({
        isRunning: false,
        currentOperation: undefined,
        progress: undefined
      });

      return this.createResult(false, 0, startTime, error.message);
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  /**
   * Analiza el estado actual de cada marca en la base de datos vs Google Sheets
   */
  private async analyzeBrandStatus(specificSheets?: string[]) {
    try {
      // 1. Obtener marcas disponibles en Google Sheets o usar las específicas
      let availableSheets: string[];
      
      if (specificSheets && specificSheets.length > 0) {
        availableSheets = specificSheets;
        console.log(`📋 Procesando marcas específicas: ${availableSheets.join(', ')}`);
      } else {
        availableSheets = await this.sheetsGateway.getAvailableSheetNames();
        console.log(`📋 Marcas disponibles en Google Sheets: ${availableSheets.join(', ')}`);
      }

      // 2. Para cada marca, obtener conteos actuales y totales
      const incompleteSheets: Array<{name: string, currentCount: number, totalCount: number}> = [];
      
      for (const sheetName of availableSheets) {
        // Contar registros actuales en op_lead
        const currentCount = await this.getCurrentBrandCount(sheetName);
        
        // Contar registros totales en Google Sheets  
        const totalCount = await this.getTotalBrandCount(sheetName);
        
        console.log(`📊 ${sheetName}: ${currentCount}/${totalCount} registros`);
        
        // SIEMPRE procesar todas las marcas para detectar registros nuevos
        // No importa si DB tiene más registros que Google Sheets (duplicados anteriores)
        incompleteSheets.push({
          name: sheetName,
          currentCount,
          totalCount
        });
        console.log(`🔄 ${sheetName} agregada a procesamiento para verificar registros nuevos`);
      }

      const totalPending = incompleteSheets.reduce((sum, sheet) => sum + (sheet.totalCount - sheet.currentCount), 0);

      return {
        availableSheets,
        incompleteSheets,
        totalPending
      };

    } catch (error) {
      console.error('Error analyzing brand status:', error);
      throw error;
    }
  }

  /**
   * Obtiene el conteo actual de registros para una marca en op_lead
   */
  private async getCurrentBrandCount(brandName: string): Promise<number> {
    try {
      // Normalizar nombre de marca para búsqueda (FIAT, CHEVROLET, etc.)
      const normalizedBrand = brandName.toUpperCase();
      
      const leads = await this.syncRepository.getLeads({ limit: 100000 });
      const brandLeads = leads.filter(lead => lead.marca?.toUpperCase() === normalizedBrand);
      
      return brandLeads.length;
    } catch (error) {
      console.error(`Error getting current count for brand ${brandName}:`, error);
      return 0;
    }
  }

  /**
   * Obtiene el conteo total de registros para una marca en Google Sheets
   */
  private async getTotalBrandCount(sheetName: string): Promise<number> {
    try {
      const leads = await this.sheetsGateway.getLeadsFromSheets([sheetName]);
      return leads.length;
    } catch (error) {
      console.error(`Error getting total count for sheet ${sheetName}:`, error);
      return 0;
    }
  }

  /**
   * Filtra leads que ya existen en la base de datos para evitar duplicados
   */
  private async filterExistingLeads(validLeads: any[], brandName: string): Promise<any[]> {
    try {
      // Obtener leads existentes de la marca con googleSheetsRowNumber usando el nuevo método
      const existingLeads = await (this.syncRepository as any).getExistingLeadsByBrand(brandName);
      
      console.log(`🔍 Encontrados ${existingLeads.length} leads existentes para marca ${brandName}`);
      
      // Usar DuplicateDetector mejorado para detectar duplicados
      const leadsWithDuplicates = this.duplicateDetector.detectDuplicatesAgainstExisting(
        validLeads, 
        existingLeads
      );
      
      // Filtrar solo los leads que NO son duplicados
      const newLeads = leadsWithDuplicates.filter(lead => !lead.isDuplicate);
      const duplicatesCount = leadsWithDuplicates.length - newLeads.length;
      
      console.log(`📊 De ${validLeads.length} leads: ${newLeads.length} nuevos, ${duplicatesCount} duplicados detectados`);
      
      // Log detallado de duplicados por tipo
      if (duplicatesCount > 0) {
        const duplicatesByPhone = leadsWithDuplicates.filter(l => 
          l.isDuplicate && existingLeads.some((e: any) => 
            e.telefono && l.normalizedPhone && 
            e.telefono.replace(/[^\d+]/g, '') === l.normalizedPhone
          )
        ).length;
        
        const duplicatesByMetaId = leadsWithDuplicates.filter(l => 
          l.isDuplicate && existingLeads.some((e: any) => e.metaLeadId === l.metaLeadId)
        ).length;
        
        const duplicatesByRowNumber = leadsWithDuplicates.filter(l => {
          if (!l.isDuplicate || !l.googleSheetsRowNumber || !l.marca) return false;
          const rowKey = `${l.marca.toUpperCase()}_${l.googleSheetsRowNumber}`;
          return existingLeads.some((e: any) => 
            e.googleSheetsRowNumber && e.marca && 
            `${e.marca.toUpperCase()}_${e.googleSheetsRowNumber}` === rowKey
          );
        }).length;
        
        console.log(`📈 Duplicados: ${duplicatesByPhone} por teléfono, ${duplicatesByMetaId} por metaLeadId, ${duplicatesByRowNumber} por número de fila`);
      }

      return newLeads;
    } catch (error: any) {
      console.error(`Error filtering existing leads for ${brandName}:`, error);
      return validLeads; // En caso de error, devolver todos los leads válidos
    }
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