import { db } from './db';
import { googleSheetsData, syncControl } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import * as cron from 'node-cron';

interface GoogleSheetsService {
  fetchDataFromSheets(): Promise<any[]>;
}

export class GoogleSheetsSyncService {
  private googleSheetsService: GoogleSheetsService;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(googleSheetsService: GoogleSheetsService) {
    this.googleSheetsService = googleSheetsService;
  }

  /**
   * Inicializa el sistema de sincronización automática cada 30 minutos
   */
  public startAutoSync() {
    console.log('🚀 Iniciando sincronización automática de Google Sheets cada 30 minutos');
    
    // Ejecutar sincronización inicial
    this.performSync();

    // Programar sincronización cada 30 minutos usando node-cron
    cron.schedule('*/30 * * * *', () => {
      console.log('⏰ Ejecutando sincronización programada de Google Sheets...');
      this.performSync();
    });
  }

  /**
   * Ejecuta la sincronización completa de datos desde Google Sheets
   */
  public async performSync(): Promise<void> {
    const syncStartTime = new Date();
    
    try {
      console.log('📊 Iniciando sincronización completa de Google Sheets...');
      
      // Marcar inicio de sincronización
      await this.updateSyncStatus('google_sheets_data', 'running', 0);
      
      // Obtener datos de Google Sheets
      const sheetsData = await this.fetchAllSheetsData();
      
      // Limpiar datos existentes (full refresh)
      await db.delete(googleSheetsData);
      console.log('🗑️ Datos antiguos eliminados de la base de datos');
      
      // Insertar nuevos datos
      let insertedCount = 0;
      for (const batch of this.batchArray(sheetsData, 100)) {
        await db.insert(googleSheetsData).values(batch);
        insertedCount += batch.length;
        console.log(`✅ Insertados ${insertedCount}/${sheetsData.length} registros`);
      }
      
      // Marcar sincronización completa
      await this.updateSyncStatus('google_sheets_data', 'completed', insertedCount);
      
      const syncEndTime = new Date();
      const syncDuration = syncEndTime.getTime() - syncStartTime.getTime();
      
      console.log(`🎉 Sincronización completa exitosa: ${insertedCount} registros en ${syncDuration}ms`);
      
      // Actualizar métricas de enviados después de la sincronización
      await this.updateEnviadosMetrics();
      
    } catch (error) {
      console.error('❌ Error en sincronización de Google Sheets:', error);
      await this.updateSyncStatus('google_sheets_data', 'failed', 0, error.message);
    }
  }

  /**
   * Obtiene todos los datos de las hojas de Google Sheets
   */
  private async fetchAllSheetsData(): Promise<any[]> {
    try {
      // Usar directamente el servicio de interface proporcionado
      const rawData = await this.googleSheetsService.fetchDataFromSheets();
      
      console.log(`📋 Obtenidos ${rawData.length} registros brutos de Google Sheets`);
      
      // Transformar todos los datos con información de marca detectada
      const transformedData = rawData.map((row, index) => {
        const marca = this.detectMarca(row);
        const cliente = this.extractClienteFromData(row);
        
        return {
          nombreCompleto: this.cleanString(row.nombre || row.nombreCompleto || row.full_name || ''),
          telefono: this.cleanString(row.telefono || row.phone || row.phone_number || ''),
          email: this.cleanString(row.email || ''),
          marca: marca,
          cliente: cliente,
          provincia: this.cleanString(row.provincia || row.state || ''),
          localidad: this.cleanString(row.localidad || row.city || row.ciudad || ''),
          fechaLead: this.parseDate(row.fecha || row.fechaLead || row.created_time),
          fechaIngreso: new Date(),
          sourceSheet: 'Google Sheets',
          rowNumber: index + 1
        };
      }).filter(row => row.nombreCompleto && row.telefono && row.marca); // Solo registros válidos
      
      console.log(`✅ ${transformedData.length} registros transformados exitosamente`);
      return transformedData;
      
    } catch (error) {
      console.error('❌ Error obteniendo datos de Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Detecta la marca desde los datos de la fila
   */
  private detectMarca(row: any): string {
    // Buscar en diferentes campos posibles
    const checkFields = [row.marca, row.brand, row.campaign_name, row.ad_name, row.source];
    
    for (const field of checkFields) {
      if (field) {
        const fieldStr = field.toString().toUpperCase();
        if (fieldStr.includes('FIAT')) return 'FIAT';
        if (fieldStr.includes('PEUGEOT')) return 'PEUGEOT';
        if (fieldStr.includes('TOYOTA')) return 'TOYOTA';
        if (fieldStr.includes('CHEVROLET') || fieldStr.includes('CHEVY')) return 'CHEVROLET';
        if (fieldStr.includes('RENAULT')) return 'RENAULT';
        if (fieldStr.includes('CITROEN') || fieldStr.includes('CITROËN')) return 'CITROEN';
      }
    }
    
    return 'GENERAL'; // Default si no se puede detectar
  }

  /**
   * Transforma datos de Google Sheets al formato de la base de datos
   */
  private transformSheetData(rawData: any[], sourceSheet: string): any[] {
    return rawData.map((row, index) => ({
      nombreCompleto: this.cleanString(row.nombre || row.nombreCompleto || ''),
      telefono: this.cleanString(row.telefono || row.phone || ''),
      email: this.cleanString(row.email || ''),
      marca: this.extractMarcaFromSheet(sourceSheet, row),
      cliente: this.extractClienteFromData(row),
      provincia: this.cleanString(row.provincia || ''),
      localidad: this.cleanString(row.localidad || row.city || ''),
      fechaLead: this.parseDate(row.fecha || row.fechaLead),
      fechaIngreso: new Date(),
      sourceSheet: sourceSheet,
      rowNumber: index + 1
    })).filter(row => row.nombreCompleto && row.telefono); // Solo registros válidos
  }



  /**
   * Extrae el nombre del cliente desde los datos de la fila
   */
  private extractClienteFromData(row: any): string {
    // Buscar diferentes campos posibles para cliente
    const clienteFields = ['cliente', 'nombreCliente', 'client', 'company'];
    
    for (const field of clienteFields) {
      if (row[field]) return this.cleanString(row[field]);
    }
    
    // Si no hay campo específico, intentar extraer de nombre completo o contexto
    return 'CLIENTE_GENERICO';
  }

  /**
   * Actualiza las métricas de enviados basándose en los datos de la base de datos
   */
  private async updateEnviadosMetrics(): Promise<void> {
    console.log('📊 Actualizando métricas de enviados desde base de datos...');
    
    try {
      // Obtener campañas comerciales activas
      const { campanasComerciales, clientes } = await import('@shared/schema');
      
      const campanas = await db
        .select()
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id));
      
      for (const campana of campanas) {
        const clienteNombre = campana.clientes?.nombreCliente || 'DESCONOCIDO';
        const numeroCampana = campana.campanas_comerciales?.numeroCampana || '1';
        
        // Contar datos enviados desde google_sheets_data
        const conteoEnviados = await this.countEnviadosForCampaign(
          clienteNombre, 
          campana.campanas_comerciales?.marca || 'Fiat'
        );
        
        // Actualizar o insertar métrica
        await this.upsertEnviadosMetric(clienteNombre, numeroCampana, conteoEnviados);
      }
      
      console.log('✅ Métricas de enviados actualizadas correctamente');
      
    } catch (error) {
      console.error('❌ Error actualizando métricas de enviados:', error);
    }
  }

  /**
   * Cuenta los datos enviados para una campaña específica
   */
  private async countEnviadosForCampaign(clienteNombre: string, marca: string): Promise<number> {
    try {
      const { count } = await db
        .select({ count: googleSheetsData.id })
        .from(googleSheetsData)
        .where(
          // Matching por marca y cliente similar al sistema actual
          eq(googleSheetsData.marca, marca)
        );
      
      return Array.isArray(count) ? count.length : 0;
    } catch (error) {
      console.error('❌ Error contando enviados:', error);
      return 0;
    }
  }

  /**
   * Inserta o actualiza una métrica de enviados
   */
  private async upsertEnviadosMetric(clienteNombre: string, numeroCampana: string, datosEnviados: number): Promise<void> {
    const { enviadosMetrics } = await import('@shared/schema');
    
    try {
      // Intentar actualizar registro existente
      const existingMetric = await db
        .select()
        .from(enviadosMetrics)
        .where(
          eq(enviadosMetrics.clienteNombre, clienteNombre)
        )
        .limit(1);

      if (existingMetric.length > 0) {
        // Actualizar existente
        await db
          .update(enviadosMetrics)
          .set({
            datosEnviados,
            lastCalculatedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(enviadosMetrics.clienteNombre, clienteNombre));
      } else {
        // Insertar nuevo
        await db.insert(enviadosMetrics).values({
          clienteNombre,
          numeroCampana,
          datosEnviados,
          fechaInicio: new Date(),
          fechaFin: new Date()
        });
      }
    } catch (error) {
      console.error(`❌ Error actualizando métrica para ${clienteNombre}:`, error);
    }
  }

  /**
   * Actualiza el estado de sincronización
   */
  private async updateSyncStatus(tableName: string, status: string, recordCount: number, errorMessage?: string): Promise<void> {
    try {
      await db.insert(syncControl).values({
        tableName,
        lastSyncAt: new Date(),
        recordCount,
        syncStatus: status,
        errorMessage: errorMessage || null
      });
    } catch (error) {
      console.error('❌ Error actualizando estado de sincronización:', error);
    }
  }

  /**
   * Obtiene el último estado de sincronización
   */
  public async getLastSyncStatus(): Promise<any> {
    try {
      const lastSync = await db
        .select()
        .from(syncControl)
        .orderBy(desc(syncControl.createdAt))
        .limit(1);
      
      return lastSync[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo estado de sincronización:', error);
      return null;
    }
  }

  /**
   * Utilidades
   */
  private cleanString(str: string): string {
    return str ? str.toString().trim() : '';
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private batchArray<T>(array: T[], batchSize: number): T[][] {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Para limpiar datos de prueba - solo usar en desarrollo
   */
  public async clearAllData(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No se puede limpiar datos en producción');
    }
    
    await db.delete(googleSheetsData);
    await db.delete(syncControl);
    await db.delete(enviadosMetrics);
    
    console.log('🗑️ Todos los datos de sincronización eliminados (solo desarrollo)');
  }
}