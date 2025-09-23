// Servicio específico para actualizar conteos de "enviados"
import { DatabaseStorage } from './storage';
import { GoogleSheetsService } from './google-sheets';
import { extractBrandsFromCampaign, createMultiBrandCondition, getMultiBrandDebugInfo } from '../shared/utils/multi-brand-utils';

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
      console.log(`🔧 [CAMPAÑA LIST] Total campañas a procesar: ${campanasComerciales.length}`);
      campanasComerciales.forEach(c => {
        console.log(`  - ID: ${c.id}, numeroCampana: ${c.numeroCampana}, marca: ${c.marca}, clienteId: ${c.clienteId}`);
      });

      // ⚡ DEBUGGING ESPECÍFICO: Verificar si campaña 82 está en la lista
      const campana82 = campanasComerciales.find(c => c.id === 82);
      if (campana82) {
        console.log(`🔍 [CAMPAÑA 82 ENCONTRADA] ID: ${campana82.id}, numeroCampana: ${campana82.numeroCampana}, marca: ${campana82.marca}, clienteId: ${campana82.clienteId}`);
      } else {
        console.log(`⚠️ [CAMPAÑA 82 NO ENCONTRADA] La campaña 82 NO está en la lista de campañas comerciales`);
        console.log(`🔍 [DEBUG] Revisando todas las campañas en la lista:`, campanasComerciales.map(c => ({ id: c.id, clienteId: c.clienteId })));
      }

      for (const campana of campanasComerciales) {
        try {
          const cliente = await this.storage.getCliente(campana.clienteId);
          if (!cliente) {
            console.log(`⚠️ Cliente no encontrado para campaña ${campana.numeroCampana}`);
            continue;
          }

          console.log(`\n🔍 PROCESANDO: ${cliente.nombreCliente} - Campaña ID:${campana.id} NumCampana:${campana.numeroCampana}`);
          
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
      
      // ✅ USAR SOLO fecha_fin REAL de la base de datos - SIN cálculo automático  
      let fechaFinCalculada = campana.fechaFin; // Solo usar si está explícitamente definida en BD
      
      // Ejecutar la MISMA query que el endpoint principal - EXACTAMENTE igual
      console.log(`🎯 Update Service Query Debug - Campaña: ${campana.marca} ${campana.numeroCampana}`);
      console.log(`📊 Cliente normalizado: "${nombreComercial}"`);
      console.log(`📅 Fecha inicio: ${campana.fechaCampana}, Fecha fin: ${fechaFinCalculada || 'Sin límite'}`);

      // Mapeo de zonas (igual que en routes.ts)
      const mapeoZonas = {
        'NACIONAL': 'Pais',
        'AMBA': 'Amba',
        'Córdoba': 'Cordoba',
        'Santa Fe': 'Santa Fe',
        'Mendoza': 'Mendoza'
      };
      const localizacionFiltro = mapeoZonas[campana.zona as keyof typeof mapeoZonas] || campana.zona || 'Pais';
      
      // 🎯 NUEVA LÓGICA: Soporte para múltiples marcas (modo automático usa TODAS las marcas)
      console.log(`🔧 [DEBUG] CAMPAÑA ${campana.id} - Datos RAW:`, {
        id: campana.id,
        marca: campana.marca,
        porcentaje: campana.porcentaje,
        marca2: campana.marca2,
        porcentaje2: campana.porcentaje2,
        asignacionAutomatica: campana.asignacionAutomatica,
        zona: campana.zona
      });

      const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);
      console.log(`🏷️ MÚLTIPLES MARCAS (UPDATE SERVICE) - Campaña ${campana.id} - Modo: ${campana.asignacionAutomatica ? 'AUTOMÁTICO' : 'MANUAL'}`);
      console.log(`🏷️ Marcas extraídas:`, brands);

      // Crear condición para múltiples marcas (OR entre todas las marcas configuradas)
      const multiBrandCondition = createMultiBrandCondition(brands, opLeadsRep.campaign);

      let conditions = [
        multiBrandCondition, // ✅ NUEVA LÓGICA: Incluye todas las marcas configuradas
        eq(opLeadsRep.cliente, nombreComercial), // ✅ CORRECCIÓN: Comparación exacta (igual que routes.ts)
        eq(opLeadsRep.localizacion, localizacionFiltro),
        gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
      ];
      
      if (fechaFinCalculada) {
        conditions.push(lte(sql`date(${opLeadsRep.fechaCreacion})`, fechaFinCalculada));
      }

      console.log(`🔧 [SQL DEBUG] Ejecutando query con condiciones:`, conditions.length);
      console.log(`🔧 [SQL DEBUG] Cliente normalizado: "${nombreComercial}"`);
      console.log(`🔧 [SQL DEBUG] Zona filtro: "${localizacionFiltro}"`);
      console.log(`🔧 [SQL DEBUG] Fecha inicio: "${campana.fechaCampana}"`);
      console.log(`🔧 [SQL DEBUG] Fecha fin: "${fechaFinCalculada || 'Sin límite'}"`);

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