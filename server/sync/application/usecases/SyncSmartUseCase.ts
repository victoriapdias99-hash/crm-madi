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

      // 2. Procesar todas las marcas disponibles con verificación de integridad integrada
      for (const sheetName of brandAnalysis.availableSheets) {
        console.log(`🔄 Procesando marca ${sheetName} con verificación de integridad...`);
        
        await this.syncRepository.updateSyncStatus({
          currentOperation: `Verificando integridad: ${sheetName}`,
          progress: { current: totalProcessed, total: brandAnalysis.totalPending, stage: 'integrity_check' }
        });

        // ✅ FASE 1: VERIFICACIÓN Y CORRECCIÓN DE INTEGRIDAD
        const integrityResult = await this.verifyAndFixIntegrity(sheetName);
        details.newLeads += integrityResult.gapsFixed;
        totalProcessed += integrityResult.gapsFixed;

        await this.syncRepository.updateSyncStatus({
          currentOperation: `Sincronización incremental: ${sheetName}`,
          progress: { current: totalProcessed, total: brandAnalysis.totalPending, stage: 'syncing' }
        });

        // ✅ FASE 2: SINCRONIZACIÓN INCREMENTAL (solo si hay filas nuevas)
        const incompleteSheet = brandAnalysis.incompleteSheets.find(s => s.name === sheetName);
        if (incompleteSheet && incompleteSheet.newRows > 0) {
          console.log(`🆕 ${sheetName}: Sincronizando ${incompleteSheet.newRows} filas nuevas (incremental)`);
          
          // Obtener solo las filas nuevas de esta marca (incremental)
          const rawLeads = await this.getNewRowsOnly(sheetName);
        
          if (rawLeads.length > 0) {
            // Procesar y guardar leads
            const syncLeads = rawLeads.map(raw => this.leadProcessor.convertRawToSyncLead(raw));
            const processedLeads = this.leadProcessor.processLeadsBatch(syncLeads);
            const validLeads = processedLeads.filter(lead => lead.isValid);
            
            // Filtrar duplicados que ya existen en la base de datos
            const newLeads = await this.filterExistingLeads(validLeads, sheetName);
            
            if (newLeads.length > 0) {
              const savedCount = await this.syncRepository.createLeadsBatch(newLeads);
              console.log(`✅ ${sheetName}: Guardados ${savedCount} nuevos registros incrementales`);
              
              details.newLeads += savedCount;
              totalProcessed += savedCount;
            } else {
              console.log(`ℹ️ ${sheetName}: No hay nuevos registros para guardar (incremental)`);
            }
          } else {
            console.log(`ℹ️ ${sheetName}: No hay nuevos registros para obtener (incremental)`);
          }
        } else {
          console.log(`✅ ${sheetName}: No hay filas nuevas para sincronización incremental`);
        }
        
        // ✅ FASE 3: LIMPIAR DUPLICADOS SIEMPRE
        console.log(`🧽 Limpiando duplicados para marca ${sheetName}...`);
        const duplicatesRemoved = await (this.syncRepository as any).cleanDuplicatesForBrand(sheetName);
        if (duplicatesRemoved > 0) {
          console.log(`✨ ${sheetName}: ${duplicatesRemoved} duplicados eliminados`);
        }
        
        details.sheetsProcessed?.push(sheetName);
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
   * Obtiene el número de la última fila disponible con datos en Google Sheets
   */
  private async getLastAvailableRow(sheetName: string): Promise<number> {
    try {
      const leads = await this.sheetsGateway.getLeadsFromSheets([sheetName]);
      
      if (leads.length === 0) {
        return 1; // Solo header, última fila de datos sería 1 (pero no hay datos)
      }
      
      // Encontrar la fila más alta con datos
      const maxRow = Math.max(...leads.map(lead => lead.googleSheetsRowNumber || 0));
      console.log(`📊 ${sheetName}: última fila disponible con datos = ${maxRow}`);
      return maxRow;
    } catch (error) {
      console.error(`Error getting last available row for sheet ${sheetName}:`, error);
      return 0;
    }
  }

  /**
   * Verifica y corrige la integridad de datos para una marca específica
   * Detecta gaps en la secuencia de google_sheets_row_number y los sincroniza
   */
  private async verifyAndFixIntegrity(marca: string): Promise<{ gapsFixed: number; integrityStatus: string; missingRows?: number[] }> {
    console.log(`🔍 Verificando integridad para ${marca}...`);
    
    try {
      // 1. Obtener filas existentes en BD
      const dbRows = await (this.syncRepository as any).getGoogleSheetsRowNumbers(marca);
      const maxDbRow = Math.max(...dbRows, 0);
      
      // 2. Obtener última fila real en Google Sheets
      const maxGoogleRow = await this.getLastAvailableRow(marca);
      
      if (maxGoogleRow === 0) {
        console.log(`⚠️ ${marca}: No hay datos en Google Sheets`);
        return { gapsFixed: 0, integrityStatus: 'no_data' };
      }
      
      // 3. Generar secuencia esperada y detectar gaps
      const expectedRows = Array.from({length: maxGoogleRow}, (_, i) => i + 1);
      const missingRows = expectedRows.filter(row => !dbRows.includes(row));
      
      if (missingRows.length === 0) {
        console.log(`✅ ${marca}: Integridad completa (${dbRows.length}/${maxGoogleRow} filas)`);
        return { gapsFixed: 0, integrityStatus: 'complete' };
      }
      
      // 4. SINCRONIZAR GAPS DETECTADOS
      console.log(`🔧 ${marca}: Detectados ${missingRows.length} gaps - sincronizando filas: [${missingRows.slice(0, 5).join(', ')}${missingRows.length > 5 ? '...' : ''}]`);
      const gapsSynced = await this.syncSpecificRows(marca, missingRows);
      
      console.log(`✅ ${marca}: ${gapsSynced.length} gaps sincronizados de ${missingRows.length} detectados`);
      return { 
        gapsFixed: gapsSynced.length, 
        integrityStatus: 'fixed',
        missingRows: missingRows 
      };
    } catch (error) {
      console.error(`Error verificando integridad para ${marca}:`, error);
      return { gapsFixed: 0, integrityStatus: 'error' };
    }
  }

  /**
   * Sincroniza filas específicas de Google Sheets
   * Optimiza las llamadas API agrupando filas consecutivas
   */
  private async syncSpecificRows(marca: string, rowNumbers: number[]): Promise<any[]> {
    if (rowNumbers.length === 0) return [];
    
    try {
      // Optimizar: agrupar filas consecutivas para minimizar API calls
      const ranges = this.optimizeRowRanges(rowNumbers);
      console.log(`📋 ${marca}: Obteniendo ${rowNumbers.length} filas en ${ranges.length} rangos optimizados`);
      
      const allLeads: any[] = [];
      
      for (const range of ranges) {
        // Obtener datos específicos de Google Sheets usando el nuevo método
        const rangeLeads = await (this.sheetsGateway as any).getLeadsFromRange(marca, range);
        allLeads.push(...rangeLeads);
      }
      
      console.log(`📥 ${marca}: Obtenidos ${allLeads.length} leads de ${ranges.length} rangos`);
      
      if (allLeads.length === 0) {
        return [];
      }
      
      // Procesar con la lógica actual del sistema
      const syncLeads = allLeads.map(raw => this.leadProcessor.convertRawToSyncLead(raw));
      const processedLeads = this.leadProcessor.processLeadsBatch(syncLeads);
      const validLeads = processedLeads.filter(lead => lead.isValid);
      
      // Filtrar duplicados que ya existen en la base de datos
      const newLeads = await this.filterExistingLeads(validLeads, marca);
      
      // Guardar en BD
      if (newLeads.length > 0) {
        const savedCount = await this.syncRepository.createLeadsBatch(newLeads);
        console.log(`💾 ${marca}: Guardados ${savedCount} leads de gaps sincronizados`);
        return newLeads;
      }
      
      return [];
    } catch (error) {
      console.error(`Error sincronizando filas específicas para ${marca}:`, error);
      return [];
    }
  }

  /**
   * Optimiza rangos de filas para minimizar llamadas API
   * Convierte [4,5,6,7,10,11,15] → ["A4:ZZ7", "A10:ZZ11", "A15:ZZ15"]
   */
  private optimizeRowRanges(rowNumbers: number[]): string[] {
    const sortedRows = [...rowNumbers].sort((a, b) => a - b);
    const ranges: string[] = [];
    
    let start = sortedRows[0];
    let end = sortedRows[0];
    
    for (let i = 1; i < sortedRows.length; i++) {
      if (sortedRows[i] === end + 1) {
        end = sortedRows[i]; // Extender rango consecutivo
      } else {
        ranges.push(end === start ? `A${start}:ZZ${start}` : `A${start}:ZZ${end}`);
        start = end = sortedRows[i]; // Nuevo rango
      }
    }
    
    ranges.push(end === start ? `A${start}:ZZ${start}` : `A${start}:ZZ${end}`);
    return ranges;
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