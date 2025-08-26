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
   * Inicializa el sistema de sincronización automática cada 15 minutos
   */
  public startAutoSync() {
    console.log('🚀 Iniciando sincronización automática de Google Sheets cada 15 minutos');
    
    // Ejecutar sincronización inicial
    this.performSync();

    // Programar sincronización cada 15 minutos usando node-cron
    cron.schedule('*/15 * * * *', () => {
      console.log('⏰ Ejecutando sincronización programada de Google Sheets (cada 15 min)...');
      this.performSync();
    });
    
    console.log('📊 Próxima sincronización automática en 15 minutos');
  }

  /**
   * Ejecuta la sincronización INCREMENTAL de datos desde Google Sheets
   * Preserva datos existentes y solo agrega/actualiza lo necesario
   */
  public async performSync(): Promise<void> {
    const syncStartTime = new Date();
    
    try {
      console.log('📊 Iniciando sincronización INCREMENTAL de Google Sheets (preservando datos existentes)...');
      
      // Marcar inicio de sincronización
      await this.updateSyncStatus('google_sheets_data', 'running', 0);
      
      // USAR EL SISTEMA REFACTORIZADO que funciona al 100%
      const { googleSheetsService } = await import('./google-sheets');
      const allLeads = await googleSheetsService.getAllLeadsFromSheets();
      console.log(`📥 Obtenidos ${allLeads.length} leads desde Google Sheets con columnas G, H, I`);
      
      if (allLeads.length > 0) {
        // USAR MÉTODO ALTERNATIVO: Insertar datos directamente usando storage
        const { storage } = await import('./storage');
        let newLeadsCount = 0;
        
        // Obtener leads existentes para evitar duplicados
        const existingLeads = await storage.getLeads({ limit: 10000 });
        const existingMetaIds = new Set(existingLeads.map(lead => lead.metaLeadId));
        
        for (const sheetLead of allLeads) {
          // Limpiar y normalizar datos del cliente
          const clienteNormalizado = this.normalizeClienteName(sheetLead.cliente || '');
          const marcaNormalizada = this.detectMarcaFromData(sheetLead);
          
          // Crear un ID único que incluya información del cliente para mejor rastreo de duplicados
          const cleanPhone = (sheetLead.phone || '').replace(/\s/g, '');
          const cleanTimestamp = sheetLead.timestamp.split(' ')[0]; // Solo la fecha
          const uniqueId = `${marcaNormalizada}-${clienteNormalizado}-${cleanTimestamp}-${cleanPhone}`;
          
          // Convertir lead de Google Sheets al formato de base de datos (mapear a campos correctos)
          const dbLead = {
            metaLeadId: uniqueId,
            firstName: sheetLead.name || '',
            lastName: '', // Google Sheets no tiene apellido separado
            phone: sheetLead.phone || '',
            email: sheetLead.email || '',
            campaignName: sheetLead.campaign || marcaNormalizada,
            leadDate: new Date(sheetLead.timestamp || Date.now()),
            city: sheetLead.city || '',
            origen: sheetLead.origen || '',
            localizacion: sheetLead.localizacion || '',
            cliente: clienteNormalizado,
            status: 'new',
            source: 'google_sheets'
          };
          
          // Verificar si el lead ya existe
          if (!existingMetaIds.has(dbLead.metaLeadId)) {
            await storage.createLead(dbLead);
            existingMetaIds.add(dbLead.metaLeadId);
            newLeadsCount++;
          }
        }
        
        console.log(`✅ Sincronización incremental completada: ${newLeadsCount} nuevos leads agregados`);
      }
      
      // Marcar sincronización completa
      await this.updateSyncStatus('google_sheets_data', 'completed', allLeads.length);
      
      const syncEndTime = new Date();
      const syncDuration = syncEndTime.getTime() - syncStartTime.getTime();
      
      console.log(`🎉 Sincronización incremental exitosa: ${allLeads.length} leads procesados en ${syncDuration}ms`);
      console.log('💾 Datos existentes preservados - solo se agregaron/actualizaron cambios');
      
      // Actualizar métricas de enviados después de la sincronización
      await this.updateEnviadosMetrics();
      
    } catch (error) {
      console.error('❌ Error en sincronización incremental de Google Sheets:', error);
      await this.updateSyncStatus('google_sheets_data', 'failed', 0, error.message);
    }
  }

  /**
   * MÉTODO REFACTORIZADO - Ahora usa el sistema que funciona al 100%
   * Redirige al googleSheetsService.getAllLeadsFromSheets() que captura columnas G, H, I
   */
  private async fetchAllSheetsData(): Promise<any[]> {
    try {
      console.log('🔄 REFACTORIZADO: Usando sistema que funciona al 100% con columnas G, H, I');
      
      // Usar el sistema refactorizado que funciona correctamente
      const { googleSheetsService } = await import('./google-sheets');
      const allLeads = await googleSheetsService.getAllLeadsFromSheets();
      
      console.log(`✅ Sistema refactorizado obtuvo ${allLeads.length} leads con metadatos completos`);
      return allLeads;
      
    } catch (error) {
      console.error('❌ Error en sistema refactorizado:', error);
      throw error;
    }
  }

  /**
   * MÉTODO ELIMINADO - Ya no se usa debido a la refactorización
   * El sistema ahora usa googleSheetsService.getAllLeadsFromSheets()
   */
  private async fetchBrandSpecificData(brand: string): Promise<any[]> {
    try {
      // Acceder al método específico de GoogleSheetsService para obtener datos de marca
      if (typeof (this.googleSheetsService as any).getLeadsBySheet === 'function') {
        return await (this.googleSheetsService as any).getLeadsBySheet(brand);
      } else {
        // Fallback: usar método genérico y filtrar
        const allData = await this.googleSheetsService.fetchDataFromSheets();
        return allData.filter((row: any) => 
          this.detectMarca(row).toLowerCase() === brand.toLowerCase()
        );
      }
    } catch (error) {
      console.error(`❌ Error obteniendo datos de marca ${brand}:`, error);
      return [];
    }
  }

  /**
   * Extrae información del cliente desde datos de marca específica
   */
  private extractClienteFromBrand(row: any, brand: string): string {
    // Buscar en diferentes campos posibles
    const clienteFields = [
      row['Cliente'] || row.cliente || row['Client'] || 
      row['Campaign Name'] || row.campaign_name || row.campaña ||
      `${brand} Cliente`
    ];
    
    return clienteFields.find(field => field && field.trim()) || `${brand} Cliente`;
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
   * Normaliza el nombre del cliente para crear metaLeadId consistente
   */
  private normalizeClienteName(clienteName: string): string {
    if (!clienteName || clienteName.trim() === '') {
      return 'SIN_CLIENTE';
    }
    
    // Convertir a mayúsculas y remover caracteres especiales
    return clienteName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
      .substring(0, 20); // Limitar longitud
  }

  /**
   * Detecta la marca desde los datos del lead
   */
  private detectMarcaFromData(leadData: any): string {
    // Buscar en diferentes campos posibles
    const checkFields = [
      leadData.campaign, // Campo correcto para SheetLead
      leadData.marca,
      leadData.brand,
      leadData.ad_name,
      leadData.source,
      leadData.hoja // Nombre de la pestaña de Google Sheets
    ];
    
    for (const field of checkFields) {
      if (field) {
        const fieldStr = field.toString().toUpperCase();
        if (fieldStr.includes('FIAT')) return 'FIAT';
        if (fieldStr.includes('PEUGEOT')) return 'PEUGEOT';
        if (fieldStr.includes('TOYOTA')) return 'TOYOTA';
        if (fieldStr.includes('CHEVROLET') || fieldStr.includes('CHEVY')) return 'CHEVROLET';
        if (fieldStr.includes('RENAULT')) return 'RENAULT';
        if (fieldStr.includes('CITROEN') || fieldStr.includes('CITROËN')) return 'CITROEN';
        if (fieldStr.includes('VW') || fieldStr.includes('VOLKSWAGEN')) return 'VW';
        if (fieldStr.includes('JEEP')) return 'JEEP';
        if (fieldStr.includes('FORD')) return 'FORD';
      }
    }
    
    return 'GENERAL'; // Default si no se puede detectar
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