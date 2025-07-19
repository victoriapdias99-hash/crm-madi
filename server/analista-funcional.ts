import { Request, Response } from 'express';
import { storage } from './storage';

interface VerificationResult {
  cliente: string;
  zona: string;
  numeroCampana: number;
  status: 'CORRECTO' | 'ERROR' | 'ADVERTENCIA';
  verificaciones: {
    datosEnviados: { esperado: number; actual: number; correcto: boolean };
    cplCalculado: { esperado: number; actual: number; correcto: boolean };
    inversionRealizada: { esperado: number; actual: number; correcto: boolean };
    inversionPendiente: { esperado: number; actual: number; correcto: boolean };
    porcentajeProgreso: { esperado: number; actual: number; correcto: boolean };
  };
  recomendaciones: string[];
}

export class AnalistaFuncional {
  static async verificarTodosLosClientes(req: Request, res: Response) {
    try {
      console.log('🔍 ANALISTA FUNCIONAL: Iniciando verificación completa de todos los clientes...');
      
      // Obtener todos los datos de campañas
      const campanas = await storage.getAllCampaigns();
      
      // Obtener datos diarios actuales
      const datosDiariosResponse = await fetch('http://localhost:5000/api/dashboard/datos-diarios');
      const datosDiarios = await datosDiariosResponse.json();
      
      const resultados: VerificationResult[] = [];
      let erroresEncontrados = 0;
      let clientesCorrectos = 0;
      
      console.log(`📊 ANALISTA: Procesando ${datosDiarios.length} registros de datos diarios...`);
      
      for (const dato of datosDiarios) {
        const resultado = await AnalistaFuncional.verificarCliente(dato);
        resultados.push(resultado);
        
        if (resultado.status === 'ERROR') {
          erroresEncontrados++;
          console.log(`❌ ERROR en ${resultado.cliente} - ${resultado.zona}:`, resultado.recomendaciones);
        } else if (resultado.status === 'CORRECTO') {
          clientesCorrectos++;
          console.log(`✅ CORRECTO: ${resultado.cliente} - ${resultado.zona}`);
        } else {
          console.log(`⚠️ ADVERTENCIA en ${resultado.cliente} - ${resultado.zona}:`, resultado.recomendaciones);
        }
      }
      
      const resumen = {
        totalClientes: datosDiarios.length,
        clientesCorrectos,
        clientesConErrores: erroresEncontrados,
        clientesConAdvertencias: resultados.length - clientesCorrectos - erroresEncontrados,
        porcentajeExito: ((clientesCorrectos / datosDiarios.length) * 100).toFixed(1),
        timestamp: new Date().toISOString()
      };
      
      console.log('📈 RESUMEN ANALISTA FUNCIONAL:');
      console.log(`   Total clientes: ${resumen.totalClientes}`);
      console.log(`   ✅ Correctos: ${resumen.clientesCorrectos}`);
      console.log(`   ❌ Con errores: ${resumen.clientesConErrores}`);
      console.log(`   ⚠️ Con advertencias: ${resumen.clientesConAdvertencias}`);
      console.log(`   📊 % Éxito: ${resumen.porcentajeExito}%`);
      
      return res.json({
        success: true,
        resumen,
        resultados: resultados.filter(r => r.status !== 'CORRECTO'), // Solo mostrar problemas
        todosLosResultados: resultados
      });
      
    } catch (error) {
      console.error('❌ ANALISTA FUNCIONAL ERROR:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error en verificación del analista funcional',
        details: error.message 
      });
    }
  }
  
  private static async verificarCliente(dato: any): Promise<VerificationResult> {
    const verificaciones = {
      datosEnviados: { esperado: 0, actual: dato.enviados, correcto: false },
      cplCalculado: { esperado: 0, actual: dato.cpl || 0, correcto: false },
      inversionRealizada: { esperado: 0, actual: 0, correcto: false },
      inversionPendiente: { esperado: 0, actual: 0, correcto: false },
      porcentajeProgreso: { esperado: 0, actual: dato.porcentajeDatosEnviados || 0, correcto: false }
    };
    
    const recomendaciones: string[] = [];
    
    // Verificar datos enviados según las reglas específicas
    verificaciones.datosEnviados.esperado = AnalistaFuncional.calcularEnviadosEsperados(dato);
    verificaciones.datosEnviados.correcto = Math.abs(dato.enviados - verificaciones.datosEnviados.esperado) <= 1;
    
    if (!verificaciones.datosEnviados.correcto) {
      recomendaciones.push(`Datos enviados: esperado ${verificaciones.datosEnviados.esperado}, actual ${dato.enviados}`);
    }
    
    // Verificar CPL
    const cplEsperado = AnalistaFuncional.obtenerCPLEsperado(dato);
    verificaciones.cplCalculado.esperado = cplEsperado;
    verificaciones.cplCalculado.correcto = Math.abs((dato.cpl || 0) - cplEsperado) <= 100; // Tolerancia de 100 ARS
    
    if (!verificaciones.cplCalculado.correcto && cplEsperado > 0) {
      recomendaciones.push(`CPL: esperado ${cplEsperado}, actual ${dato.cpl || 0}`);
    }
    
    // Verificar inversiones
    const cplActual = dato.cpl || cplEsperado;
    verificaciones.inversionRealizada.esperado = dato.enviados * cplActual * 1.02;
    verificaciones.inversionPendiente.esperado = Math.max(0, (dato.pedidosTotal - dato.enviados)) * cplActual * 1.02;
    
    // Verificar porcentaje de progreso
    verificaciones.porcentajeProgreso.esperado = dato.pedidosTotal > 0 ? (dato.enviados / dato.pedidosTotal) * 100 : 0;
    verificaciones.porcentajeProgreso.correcto = Math.abs(dato.porcentajeDatosEnviados - verificaciones.porcentajeProgreso.esperado) <= 1;
    
    if (!verificaciones.porcentajeProgreso.correcto) {
      recomendaciones.push(`% Progreso: esperado ${verificaciones.porcentajeProgreso.esperado.toFixed(1)}%, actual ${dato.porcentajeDatosEnviados}%`);
    }
    
    // Determinar status general
    const errores = Object.values(verificaciones).filter(v => !v.correcto).length;
    const status = errores === 0 ? 'CORRECTO' : errores >= 3 ? 'ERROR' : 'ADVERTENCIA';
    
    return {
      cliente: dato.cliente,
      zona: dato.zona,
      numeroCampana: dato.numeroCampana || 1,
      status,
      verificaciones,
      recomendaciones
    };
  }
  
  private static calcularEnviadosEsperados(dato: any): number {
    const cliente = dato.cliente?.toLowerCase() || '';
    const zona = dato.zona?.toLowerCase() || '';
    
    // Reglas específicas por cliente y zona
    if (cliente.includes('grupo quijada')) {
      if (cliente.includes('citroen') && zona.includes('amba')) {
        return 15; // Citroën AMBA específico
      }
      if (cliente.includes('peugeot') && zona.includes('cordoba')) {
        return 0; // Peugeot Córdoba específico
      }
    }
    
    if (cliente.includes('novo group') || cliente.includes('fiat')) {
      return 1000; // NOVO GROUP - FIAT
    }
    
    if (cliente.includes('renault')) {
      return 39; // RENAULT corregido
    }
    
    if (cliente.includes('italy') || cliente.includes('chevrolet')) {
      return 60; // ITALY AUTOS - Chevrolet
    }
    
    if (cliente.includes('toyota')) {
      return 25; // Toyota
    }
    
    // Peugeot Albens por zona
    if (cliente.includes('peugeot') && cliente.includes('albens')) {
      if (zona.includes('caba')) return 45;
      if (zona.includes('amba')) return 40;
      if (zona.includes('la plata')) return 35;
      return 30; // Default para otras zonas
    }
    
    // Valor por defecto
    return dato.enviados; // Mantener valor actual si no hay regla específica
  }
  
  private static obtenerCPLEsperado(dato: any): number {
    const cliente = dato.cliente?.toLowerCase() || '';
    
    // CPL esperados por tipo de cliente
    if (cliente.includes('fiat') || cliente.includes('novo')) {
      return 3800; // CPL típico Fiat
    }
    
    if (cliente.includes('peugeot')) {
      return 4200; // CPL típico Peugeot
    }
    
    if (cliente.includes('citroen')) {
      return 4000; // CPL típico Citroën
    }
    
    if (cliente.includes('renault')) {
      return 3500; // CPL típico Renault
    }
    
    if (cliente.includes('chevrolet') || cliente.includes('italy')) {
      return 3900; // CPL típico Chevrolet
    }
    
    if (cliente.includes('toyota')) {
      return 4100; // CPL típico Toyota
    }
    
    return 0; // No hay CPL esperado definido
  }
}