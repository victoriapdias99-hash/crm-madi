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
        
        // Ejecutar limpieza de duplicados para todas las marcas disponibles
        console.log('🧽 Ejecutando limpieza de duplicados para todas las marcas...');
        let totalDuplicatesRemoved = 0;
        
        for (const sheetName of brandAnalysis.availableSheets) {
          console.log(`🧽 Limpiando duplicados para marca ${sheetName}...`);
          const duplicatesRemoved = await (this.syncRepository as any).cleanDuplicatesForBrand(sheetName);
          totalDuplicatesRemoved += duplicatesRemoved;
          if (duplicatesRemoved > 0) {
            console.log(`✨ ${sheetName}: ${duplicatesRemoved} duplicados eliminados`);
          }
        }
        
        await this.syncRepository.updateSyncStatus({ isRunning: false });
        
        const message = totalDuplicatesRemoved > 0 
          ? `Todas las marcas sincronizadas - ${totalDuplicatesRemoved} duplicados eliminados`
          : 'Todas las marcas ya están sincronizadas';
          
        return this.createResult(true, totalDuplicatesRemoved, startTime, message);
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

        // Obtener solo las filas nuevas de esta marca (incremental)
        const rawLeads = await this.getNewRowsOnly(incompleteSheet.name);
        
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
          
          // Limpiar duplicados automáticamente después de procesar la marca
          console.log(`🧽 Limpiando duplicados para marca ${incompleteSheet.name}...`);
          const duplicatesRemoved = await (this.syncRepository as any).cleanDuplicatesForBrand(incompleteSheet.name);
          if (duplicatesRemoved > 0) {
            console.log(`✨ ${incompleteSheet.name}: ${duplicatesRemoved} duplicados eliminados`);
          }
        } else {
          console.log(`ℹ️ ${incompleteSheet.name}: No hay nuevos registros para guardar`);
          
          // También limpiar duplicados aunque no haya nuevos registros
          console.log(`🧽 Limpiando duplicados para marca ${incompleteSheet.name}...`);
          const duplicatesRemoved = await (this.syncRepository as any).cleanDuplicatesForBrand(incompleteSheet.name);
          if (duplicatesRemoved > 0) {
            console.log(`✨ ${incompleteSheet.name}: ${duplicatesRemoved} duplicados eliminados`);
          }
        }
        
        details.sheetsProcessed?.push(incompleteSheet.name);
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

      // 2. Para cada marca, verificar si hay filas nuevas desde el último row procesado
      const incompleteSheets: Array<{name: string, currentCount: number, totalCount: number, lastRow: number, newRows: number}> = [];
      
      for (const sheetName of availableSheets) {
        // Obtener último row procesado
        const lastProcessedRow = await this.getLastProcessedRow(sheetName);
        
        // Contar registros actuales en op_lead
        const currentCount = await this.getCurrentBrandCount(sheetName);
        
        // Obtener última fila disponible en Google Sheets (número de fila, no cantidad)
        const lastAvailableRow = await this.getLastAvailableRow(sheetName);
        
        // Verificar si hay filas nuevas (comparar fila vs fila)
        const newRowsAvailable = lastAvailableRow > lastProcessedRow;
        const newRowsCount = Math.max(0, lastAvailableRow - lastProcessedRow);
        
        console.log(`📊 ${sheetName}: ${currentCount} en BD, última fila procesada: ${lastProcessedRow}, última fila disponible: ${lastAvailableRow}, nuevas: ${newRowsCount}`);
        
        // Solo agregar marcas que tienen filas nuevas
        if (newRowsAvailable && newRowsCount > 0) {
          // Para mantener compatibilidad con el resto del código, aún necesitamos totalCount
          const totalCount = await this.getTotalBrandCount(sheetName);
          
          incompleteSheets.push({
            name: sheetName,
            currentCount,
            totalCount,
            lastRow: lastProcessedRow,
            newRows: newRowsCount
          });
          console.log(`🔄 ${sheetName} agregada: ${newRowsCount} filas nuevas desde fila ${lastProcessedRow}`);
        } else {
          console.log(`✅ ${sheetName} está actualizada - no hay filas nuevas`);
        }
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
   * Obtiene el último número de fila procesado para una marca
   */
  private async getLastProcessedRow(brandName: string): Promise<number> {
    try {
      const normalizedBrand = brandName.toUpperCase();
      const lastRow = await (this.syncRepository as any).getLastProcessedRowByBrand(normalizedBrand);
      console.log(`📊 ${brandName}: última fila procesada = ${lastRow}`);
      return lastRow;
    } catch (error) {
      console.error(`Error getting last processed row for brand ${brandName}:`, error);
      return 0;
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
   * Obtiene solo las filas nuevas desde el último row procesado
   */
  private async getNewRowsOnly(sheetName: string): Promise<any[]> {
    try {
      const lastProcessedRow = await this.getLastProcessedRow(sheetName);
      const allLeads = await this.sheetsGateway.getLeadsFromSheets([sheetName]);
      
      // Filtrar solo filas nuevas (mayores al último row procesado)
      const newRows = allLeads.filter(lead => 
        lead.googleSheetsRowNumber && lead.googleSheetsRowNumber > lastProcessedRow
      );
      
      console.log(`🆕 ${sheetName}: ${newRows.length} filas nuevas desde la fila ${lastProcessedRow}`);
      return newRows;
    } catch (error) {
      console.error(`Error getting new rows for sheet ${sheetName}:`, error);
      return [];
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
   * ✅ MEJORADO: Obtiene el número real de la última fila con datos en Google Sheets
   */
  private async getLastAvailableRow(sheetName: string): Promise<number> {
    try {
      // Usar el nuevo método optimizado del GoogleSheetsService
      const googleSheetsService = await import('../../../google-sheets');
      const actualLastRow = await googleSheetsService.googleSheetsService.getActualLastRowWithData(sheetName);
      
      if (actualLastRow > 0) {
        console.log(`✅ ${sheetName}: última fila real detectada = ${actualLastRow}`);
        return actualLastRow;
      }
      
      // Fallback al método anterior si el nuevo falla
      console.log(`⚠️ ${sheetName}: usando método fallback para detectar última fila`);
      const leads = await this.sheetsGateway.getLeadsFromSheets([sheetName]);
      
      if (leads.length === 0) {
        return 1; // Solo header, última fila de datos sería 1 (pero no hay datos)
      }
      
      // Encontrar la fila más alta con datos
      const maxRow = Math.max(...leads.map(lead => lead.googleSheetsRowNumber || 0));
      console.log(`📊 ${sheetName}: última fila disponible con datos (fallback) = ${maxRow}`);
      return maxRow;
    } catch (error) {
      console.error(`Error getting last available row for sheet ${sheetName}:`, error);
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