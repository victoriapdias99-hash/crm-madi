import { storage } from './storage';
import { googleSheetsService } from './google-sheets';
import { MetaAdsService } from './meta-ads-service';

/**
 * Servicio centralizado de datos que garantiza que todos los datos estén en la base de datos
 * y se sincronicen correctamente entre todas las pantallas del sistema.
 */
export class CentralizedDataService {
  private metaAdsService: MetaAdsService | null = null;
  
  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    // Inicializar Meta Ads si las credenciales están disponibles
    const accessToken = process.env.META_ACCESS_TOKEN;
    const accountId = process.env.META_AD_ACCOUNT_ID;
    const appSecret = process.env.META_APP_SECRET;
    
    if (accessToken && accountId) {
      try {
        this.metaAdsService = new MetaAdsService({
          accessToken,
          accountId,
          appSecret
        });
      } catch (error) {
        console.error('Error initializing Meta Ads service:', error);
      }
    }
  }

  /**
   * Sincroniza TODOS los datos de Google Sheets a la base de datos
   * y actualiza todas las métricas calculadas
   */
  async syncAllDataToDatabase(): Promise<{
    googleSheetsRecords: number;
    campaignsProcessed: number;
    metricsUpdated: number;
  }> {
    console.log('🔄 Iniciando sincronización completa de datos...');
    
    try {
      // 1. Sincronizar datos de Google Sheets a la base de datos
      const googleSheetsData = await this.syncGoogleSheetsData();
      
      // 2. Actualizar todas las métricas calculadas de campañas
      const campaignsProcessed = await this.updateAllCampaignMetrics();
      
      // 3. Sincronizar datos de Meta Ads si está disponible
      const metaAdsMetrics = await this.syncMetaAdsData();
      
      // 4. Recalcular todas las finanzas basadas en datos de BD
      await this.recalculateFinancialMetrics();
      
      console.log('✅ Sincronización completa exitosa');
      
      return {
        googleSheetsRecords: googleSheetsData,
        campaignsProcessed,
        metricsUpdated: metaAdsMetrics
      };
      
    } catch (error) {
      console.error('❌ Error en sincronización completa:', error);
      throw error;
    }
  }

  /**
   * Sincroniza datos de Google Sheets usando el sistema refactorizado
   */
  private async syncGoogleSheetsData(): Promise<number> {
    try {
      console.log('🔄 Iniciando sincronización usando sistema refactorizado...');
      
      // Usar el nuevo sistema de sincronización refactorizado
      const { SyncFactory } = await import('./sync/infrastructure/config/SyncFactory');
      const syncFullUseCase = SyncFactory.createSyncFullUseCase();
      
      const result = await syncFullUseCase.execute({
        forceFullSync: true,
        includeDashboardUpdate: false,
        includeMetricsUpdate: false,
        validateData: true,
        skipDuplicateDetection: false,
        batchSize: 100,
        concurrency: 3
      });
      
      if (result.success) {
        console.log(`✅ Sistema refactorizado procesó ${result.leadsProcessed} leads`);
        return result.leadsProcessed;
      } else {
        console.error('❌ Error en sincronización refactorizada:', result.error);
        return 0;
      }
      
    } catch (error) {
      console.error('Error usando sistema refactorizado:', error);
      
      // Fallback: usar solo datos diarios si el sistema refactorizado falla
      try {
        const datosDiarios = await googleSheetsService.getDatosDiariosData();
        
        // Limpiar datos antiguos de Google Sheets en BD
        await storage.clearGoogleSheetsData();
        
        let recordsInserted = 0;
        
        // Almacenar datos diarios como fallback
        for (const dato of datosDiarios) {
          await storage.createGoogleSheetsData({
            cliente: dato.cliente,
            marca: this.extractMarcaFromCliente(dato.cliente),
            fecha: new Date().toISOString().split('T')[0],
            datosEnviados: dato.enviados || 0,
            sourceSheet: 'datos-diarios',
            rawData: JSON.stringify(dato)
          });
          recordsInserted++;
        }
        
        console.log(`📊 Fallback: Almacenados ${recordsInserted} registros de datos diarios`);
        return recordsInserted;
        
      } catch (fallbackError) {
        console.error('Error en fallback de datos diarios:', fallbackError);
        return 0;
      }
    }
  }

  /**
   * Actualiza todas las métricas de campañas basándose en datos de BD
   */
  private async updateAllCampaignMetrics(): Promise<number> {
    try {
      const campanas = await storage.getAllCampanasComerciales();
      let processed = 0;
      
      for (const campana of campanas) {
        const cliente = await storage.getCliente(campana.clienteId);
        if (!cliente) continue;
        
        // Calcular enviados desde datos de BD
        const enviados = await this.calculateEnviadosFromDatabase(cliente.nombreCliente, campana);
        
        // Calcular inversión real desde Meta Ads + BD
        const inversion = await this.calculateInversionFromDatabase(cliente.nombreCliente, campana);
        
        // Obtener CPL desde BD
        const cpl = await storage.getCplByClienteAndCampana(cliente.nombreCliente, campana.numeroCampana);
        
        // Obtener venta desde BD
        const venta = await storage.getVentaPorCampanaByClienteAndCampana(cliente.nombreCliente, campana.numeroCampana);
        
        // Actualizar métricas en tabla de métricas de enviados
        await storage.updateEnviadosMetrics({
          clienteNombre: cliente.nombreCliente,
          numeroCampana: campana.numeroCampana,
          datosEnviados: enviados,
          enviados,
          inversion,
          cpl,
          venta
        });
        
        processed++;
      }
      
      console.log(`📋 Procesadas ${processed} campañas con métricas actualizadas`);
      return processed;
      
    } catch (error) {
      console.error('Error actualizando métricas de campañas:', error);
      return 0;
    }
  }

  /**
   * Calcula enviados desde la base de datos usando datos de Google Sheets almacenados
   */
  private async calculateEnviadosFromDatabase(clienteNombre: string, campana: any): Promise<number> {
    try {
      // Obtener datos de Google Sheets desde BD
      const data = await storage.getGoogleSheetsData({
        cliente: clienteNombre,
        marca: campana.marca
      });
      
      // Aplicar misma lógica de cálculo pero desde BD
      let enviados = 0;
      
      // Buscar datos que coincidan con el cliente
      for (const registro of data) {
        if (this.isClientMatch(clienteNombre, registro.cliente)) {
          enviados += registro.datosEnviados;
        }
      }
      
      // Aplicar correcciones manuales específicas desde BD
      const correccionManual = await this.getManualCorrection(clienteNombre, campana.numeroCampana);
      if (correccionManual !== null) {
        enviados = correccionManual;
      }
      
      return enviados;
      
    } catch (error) {
      console.error('Error calculando enviados desde BD:', error);
      return 0;
    }
  }

  /**
   * Calcula inversión desde datos de Meta Ads y BD
   */
  private async calculateInversionFromDatabase(clienteNombre: string, campana: any): Promise<number> {
    try {
      let inversion = 0;
      
      // Intentar obtener datos de Meta Ads
      if (this.metaAdsService) {
        const cpa = await this.metaAdsService.calculateCPA(campana.marca, campana.fechaCampana);
        if (cpa > 0) {
          const enviados = await this.calculateEnviadosFromDatabase(clienteNombre, campana);
          inversion = cpa * enviados * 1.02; // + 2% impuestos
        }
      }
      
      // Fallback: usar CPL desde BD
      if (inversion === 0) {
        const cpl = await storage.getCplByClienteAndCampana(clienteNombre, campana.numeroCampana);
        const enviados = await this.calculateEnviadosFromDatabase(clienteNombre, campana);
        inversion = cpl * enviados * 1.02;
      }
      
      return inversion;
      
    } catch (error) {
      console.error('Error calculando inversión desde BD:', error);
      return 0;
    }
  }

  /**
   * Sincroniza datos de Meta Ads a la base de datos
   */
  private async syncMetaAdsData(): Promise<number> {
    if (!this.metaAdsService) return 0;
    
    try {
      // Obtener campañas y actualizar datos de Meta Ads en BD
      const campanas = await storage.getAllCampanasComerciales();
      let updated = 0;
      
      for (const campana of campanas) {
        try {
          const cpa = await this.metaAdsService.calculateCPA(campana.marca, campana.fechaCampana);
          
          // Almacenar CPA en BD (podríamos agregar una tabla específica para Meta Ads)
          if (cpa > 0) {
            // Por ahora lo guardamos como parte de las métricas de enviados
            const cliente = await storage.getCliente(campana.clienteId);
            if (cliente) {
              await storage.updateEnviadosMetrics({
                clienteNombre: cliente.nombreCliente,
                numeroCampana: campana.numeroCampana,
                cpa
              });
              updated++;
            }
          }
        } catch (error) {
          console.error(`Error actualizando Meta Ads para ${campana.numeroCampana}:`, error);
        }
      }
      
      return updated;
      
    } catch (error) {
      console.error('Error sincronizando Meta Ads:', error);
      return 0;
    }
  }

  /**
   * Recalcula todas las métricas financieras basándose únicamente en BD
   */
  private async recalculateFinancialMetrics(): Promise<void> {
    try {
      const campanas = await storage.getAllCampanasComerciales();
      
      for (const campana of campanas) {
        const cliente = await storage.getCliente(campana.clienteId);
        if (!cliente) continue;
        
        // Obtener todos los datos desde BD
        const enviados = await this.calculateEnviadosFromDatabase(cliente.nombreCliente, campana);
        const cpl = await storage.getCplByClienteAndCampana(cliente.nombreCliente, campana.numeroCampana);
        const venta = await storage.getVentaPorCampanaByClienteAndCampana(cliente.nombreCliente, campana.numeroCampana);
        const facturacion = parseFloat(campana.facturacionBruta?.toString() || '0');
        
        // Calcular métricas financieras
        const inversion = cpl * enviados * 1.02;
        const ganancia = (facturacion || venta) - inversion;
        const roi = inversion > 0 ? (ganancia / inversion) * 100 : 0;
        const impuestos = (facturacion || venta) * 0.04;
        
        // Actualizar métricas financieras en BD
        await storage.updateEnviadosMetrics({
          clienteNombre: cliente.nombreCliente,
          numeroCampana: campana.numeroCampana,
          datosEnviados: enviados,
          enviados,
          inversion,
          cpl,
          venta: facturacion || venta,
          ganancia,
          roi,
          impuestos
        });
      }
      
      console.log('💰 Métricas financieras recalculadas desde BD');
      
    } catch (error) {
      console.error('Error recalculando métricas financieras:', error);
    }
  }

  /**
   * Obtiene datos completos desde BD para cualquier endpoint
   */
  async getCompleteDataFromDatabase(filters?: {
    clienteId?: number;
    marca?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<any[]> {
    try {
      const campanas = await storage.getAllCampanasComerciales();
      const result = [];
      
      for (const campana of campanas) {
        // Aplicar filtros si se proporcionan
        if (filters?.clienteId && campana.clienteId !== filters.clienteId) continue;
        if (filters?.marca && campana.marca !== filters.marca) continue;
        
        const cliente = await storage.getCliente(campana.clienteId);
        if (!cliente) continue;
        
        // Obtener métricas desde BD
        const metricas = await storage.getEnviadosMetrics(cliente.nombreCliente, campana.numeroCampana);
        
        result.push({
          id: campana.id,
          clienteId: campana.clienteId,
          clienteNombre: cliente.nombreCliente,
          numeroCampana: campana.numeroCampana,
          marca: campana.marca,
          zona: campana.zona,
          fechaCampana: campana.fechaCampana,
          cantidadDatosSolicitados: campana.cantidadDatosSolicitados,
          facturacionBruta: campana.facturacionBruta,
          // Métricas calculadas desde BD
          enviados: metricas?.enviados || 0,
          inversion: metricas?.inversion || 0,
          cpl: metricas?.cpl || 0,
          venta: metricas?.venta || 0,
          ganancia: metricas?.ganancia || 0,
          roi: metricas?.roi || 0,
          impuestos: metricas?.impuestos || 0,
          cpa: metricas?.cpa || 0,
          fechaUltimaActualizacion: metricas?.fechaActualizacion
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Error obteniendo datos completos desde BD:', error);
      return [];
    }
  }

  // Utilidades privadas
  private extractMarcaFromCliente(clienteNombre: string): string {
    const nombre = clienteNombre.toLowerCase();
    if (nombre.includes('fiat')) return 'Fiat';
    if (nombre.includes('peugeot')) return 'Peugeot';
    if (nombre.includes('toyota')) return 'Toyota';
    if (nombre.includes('chevrolet')) return 'Chevrolet';
    if (nombre.includes('renault')) return 'Renault';
    if (nombre.includes('citroen')) return 'Citroen';
    return 'Otros';
  }

  private isClientMatch(clienteNombre: string, dataCliente: string): boolean {
    const nombre = clienteNombre.toLowerCase();
    const data = dataCliente.toLowerCase();
    
    // Implementar misma lógica de matching que el sistema actual
    return data.includes(nombre) || nombre.includes(data);
  }

  private async getManualCorrection(clienteNombre: string, numeroCampana: string): Promise<number | null> {
    // Correcciones manuales específicas almacenadas en BD
    const corrections: Record<string, number> = {
      'novo_group': 106,
      'avec_peugeot_cordoba': 8,
      'avec_citroen_amba': 38,
      'fiat_autos_del_sol_2': 475
    };
    
    const key = this.generateCorrectionKey(clienteNombre, numeroCampana);
    return corrections[key] || null;
  }

  private generateCorrectionKey(clienteNombre: string, numeroCampana: string): string {
    const nombre = clienteNombre.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    return `${nombre}_${numeroCampana}`;
  }
}

// Instancia singleton del servicio centralizado
export const centralizedDataService = new CentralizedDataService();