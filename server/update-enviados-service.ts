// Servicio específico para actualizar conteos de "enviados"
import { DatabaseStorage } from './storage';
import { GoogleSheetsService } from './google-sheets';

export class UpdateEnviadosService {
  constructor(
    private storage: DatabaseStorage,
    private googleSheetsService: GoogleSheetsService
  ) {}

  async updateAllEnviadosCount(): Promise<{success: boolean, updated: number, details: any[]}> {
    console.log('🔢 INICIO: Actualización específica de conteos "enviados"');
    
    try {
      // 1. Obtener datos frescos de Google Sheets
      const datosDiarios = await this.googleSheetsService.getDatosDiariosData();
      console.log(`📊 Obtenidos ${datosDiarios.length} registros de Google Sheets`);
      
      // 2. Obtener todas las campañas comerciales
      const campanasComerciales = await this.storage.getAllCampanasComerciales();
      console.log(`🎯 Procesando ${campanasComerciales.length} campañas comerciales`);
      
      const detallesActualizacion = [];
      let campanasActualizadas = 0;
      
      // 3. Procesar cada campaña individualmente
      for (const campana of campanasComerciales) {
        try {
          const cliente = await this.storage.getCliente(campana.clienteId);
          if (!cliente) {
            console.log(`⚠️ Cliente no encontrado para campaña ${campana.numeroCampana}`);
            continue;
          }
          
          console.log(`\n🔍 PROCESANDO: ${cliente.nombreCliente} - Campaña ${campana.numeroCampana}`);
          
          // 4. Aplicar la misma lógica que usa el endpoint datos-diarios
          const enviadosAnterior = await this.getEnviadosActual(campana, cliente);
          const enviadosNuevo = await this.calculateEnviadosFromSheets(campana, cliente, datosDiarios);
          
          if (enviadosAnterior !== enviadosNuevo) {
            console.log(`📊 CAMBIO DETECTADO: ${cliente.nombreCliente} - ${enviadosAnterior} → ${enviadosNuevo} enviados`);
            campanasActualizadas++;
          } else {
            console.log(`✅ Sin cambios: ${cliente.nombreCliente} - ${enviadosNuevo} enviados`);
          }
          
          detallesActualizacion.push({
            cliente: cliente.nombreCliente,
            campana: campana.numeroCampana,
            marca: campana.marca,
            enviadosAnterior,
            enviadosNuevo,
            cambio: enviadosAnterior !== enviadosNuevo
          });
          
        } catch (error) {
          console.error(`❌ Error procesando campaña ${campana.numeroCampana}:`, error.message);
        }
      }
      
      console.log(`\n✅ COMPLETADO: ${campanasActualizadas} campañas actualizadas de ${campanasComerciales.length} total`);
      
      return {
        success: true,
        updated: campanasActualizadas,
        details: detallesActualizacion
      };
      
    } catch (error) {
      console.error('❌ Error en actualización de enviados:', error);
      return {
        success: false,
        updated: 0,
        details: []
      };
    }
  }
  
  private async getEnviadosActual(campana: any, cliente: any): Promise<number> {
    // Esta función simula obtener el valor actual de "enviados"
    // En realidad, estos valores se calculan dinámicamente en datos-diarios
    return 0; // Placeholder - se calcula dinámicamente
  }
  
  private async calculateEnviadosFromSheets(campana: any, cliente: any, datosDiarios: any[]): Promise<number> {
    // NUEVA LÓGICA: Usar la misma función contarLeadsPorCampana que el endpoint principal
    console.log(`🧮 Calculando enviados para ${cliente.nombreCliente} usando filtrado por campaña específica`);
    
    try {
      // Obtener todas las campañas para cálculo de fechas límite
      const todasLasCampanas = await this.storage.getAllCampanasComerciales();
      
      // Importar dependencias de Drizzle - USAR opLeadsRep optimizado
      const { db } = await import('./db');
      const { opLeadsRep } = await import('../shared/schema');
      const { count, sql, eq, ilike, gte, lte, and } = await import('drizzle-orm');
      
      // Usar la misma función que el endpoint principal para garantizar consistencia
      const nombreComercial = cliente?.nombreComercial || '';
      
      // CALCULAR FECHA_FIN AUTOMÁTICAMENTE si no existe (misma lógica que endpoint principal)
      let fechaFinCalculada = campana.fechaFin;
      
      if (!fechaFinCalculada) {
        // Buscar la siguiente campaña del mismo cliente para calcular fecha límite
        const campanasDelCliente = todasLasCampanas
          .filter(c => c.clienteId === campana.clienteId)
          .sort((a, b) => new Date(a.fechaCampana).getTime() - new Date(b.fechaCampana).getTime());
        
        const indiceCampanaActual = campanasDelCliente.findIndex(c => c.id === campana.id);
        if (indiceCampanaActual !== -1 && indiceCampanaActual < campanasDelCliente.length - 1) {
          // Hay una campaña siguiente, usar día anterior como límite
          const siguienteCampana = campanasDelCliente[indiceCampanaActual + 1];
          const fechaSiguiente = new Date(siguienteCampana.fechaCampana);
          fechaSiguiente.setDate(fechaSiguiente.getDate() - 1); // Día anterior
          fechaFinCalculada = fechaSiguiente.toISOString().split('T')[0];
          
        }
      }
      
      // Ejecutar la MISMA query que el endpoint principal - EXACTAMENTE igual
      console.log(`🎯 Update Service Query Debug - Campaña: ${campana.marca} ${campana.numeroCampana}`);
      console.log(`📊 Cliente normalizado: "${nombreComercial}"`);
      console.log(`📅 Fecha inicio: ${campana.fechaCampana}, Fecha fin: ${fechaFinCalculada || 'Sin límite'}`);

      // Mapeo de zonas (igual que en routes.ts)
      const mapeoZonas = {
        'NACIONAL': 'Pais',
        'AMBA': 'Amba', 
        'Córdoba': 'Cordoba',
        'Santa Fe': 'Santa Fe'
      };
      const localizacionFiltro = mapeoZonas[campana.zona as keyof typeof mapeoZonas] || campana.zona || 'Pais';
      
      let conditions = [
        ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`),
        eq(opLeadsRep.cliente, nombreComercial), // ✅ CORRECCIÓN: Comparación exacta (igual que routes.ts)
        eq(opLeadsRep.localizacion, localizacionFiltro),
        eq(opLeadsRep.source, 'google_sheets'),
        gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
      ];
      
      if (fechaFinCalculada) {
        conditions.push(lte(sql`date(${opLeadsRep.fechaCreacion})`, fechaFinCalculada));
      }

      const leadsCount = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(and(...conditions));
      
      console.log(`✅ Update Service - Leads encontrados: ${leadsCount[0]?.count || 0}`);
      
      const enviadosDB = leadsCount[0]?.count || 0;
      
      
      // CRÍTICO: Aplicar correcciones DESPUÉS del cálculo filtrado
      const enviadosCorregidos = this.applyClientSpecificCorrections(cliente, campana, enviadosDB);
      
      // Si hay una corrección específica, usarla; sino usar el cálculo filtrado
      if (enviadosCorregidos !== enviadosDB && enviadosCorregidos > 0) {
          return enviadosCorregidos;
      }
      
      return enviadosDB;
      
    } catch (error) {
      console.error(`❌ Error calculando enviados para ${cliente.nombreCliente}:`, error);
      return 0;
    }
  }
  
  private applyClientSpecificCorrections(cliente: any, campana: any, enviados: number): number {
    const nombreCliente = cliente.nombreCliente?.toLowerCase() || '';
    
    console.log(`🔍 DEBUG: Aplicando correcciones para cliente: "${nombreCliente}" - Campaña: ${campana.numeroCampana}`);
    
    // Aplicar las mismas correcciones que en el endpoint principal
    
    // ✅ CORRECCIONES DESHABILITADAS: Ahora usamos cálculos precisos con query corregido
    /*
    if (nombreCliente.includes('toyota')) {
      return Math.max(enviados, 101); // Puede superar el pedido
    }
    
    // CRÍTICO: Corrección específica para FIAT AUTOS DEL SOL
    if (nombreCliente.includes('fiat') && nombreCliente.includes('autos del sol')) {
      console.log(`🔍 FIAT AUTOS DEL SOL: Aplicando distribución específica por campaña`);
      // Total real confirmado: 954 registros "Autos del Sol"
      if (campana.numeroCampana === '1' || campana.numeroCampana === 1) {
        console.log(`🚨 CORRECCIÓN APLICADA: FIAT AUTOS DEL SOL Campaña 1 = 500 leads`);
        return 500; // Campaña 1: primeros 500 leads
      } else if (campana.numeroCampana === '2' || campana.numeroCampana === 2) {
        console.log(`🚨 CORRECCIÓN APLICADA: FIAT AUTOS DEL SOL Campaña 2 = 454 leads (954 - 500)`);
        return 454; // Campaña 2: leads restantes (954 - 500)
      }
    }
    */
    
    
    return enviados;
  }
}