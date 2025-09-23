// OPTIMIZACIÓN RÁPIDA - Reemplaza endpoint lento manteniendo compatibilidad 100%
import type { Express } from "express";
import { calculateDatosEnviadosPercentage, calculateFaltantesAEnviar, calculatePorcentajeDesvio } from '../shared/utils/percentage-utils';

export function registerQuickOptimized(app: Express) {

  // ENDPOINT OPTIMIZADO que reemplaza /api/dashboard/datos-diarios-db
  app.get('/api/dashboard/datos-diarios-db-quick', async (req, res) => {
    try {
      console.log('🚀 [QUICK] Iniciando optimización rápida...');
      const startTime = Date.now();

      const { storage } = await import('./storage');

      // OPTIMIZACIÓN 1: Obtener todos los datos de una vez (no 1 por 1)
      const [campanas, clientes] = await Promise.all([
        storage.getAllCampanasComerciales(),
        storage.getAllClientes()
      ]);

      console.log(`⚡ [QUICK] Datos base obtenidos en: ${Date.now() - startTime}ms`);
      console.log(`📊 [QUICK] Campañas: ${campanas.length}, Clientes: ${clientes.length}`);

      // OPTIMIZACIÓN 2: Crear mapa de clientes para lookup O(1)
      const clientesMap = new Map();
      clientes.forEach(cliente => {
        clientesMap.set(cliente.id, cliente);
      });

      const processedData = [];
      let queriesOptimized = 0;

      // OPTIMIZACIÓN 3: Procesar campañas con lógica simplificada
      for (const campana of campanas) {
        try {
          const cliente = clientesMap.get(campana.clienteId);
          if (!cliente) {
            console.warn(`⚠️ [QUICK] Cliente no encontrado: ${campana.clienteId}`);
            continue;
          }

          // OPTIMIZACIÓN 4: Usar storage directo para conteo eficiente
          const leadCounts = await storage.countLeadsByCampaign(campana.id);
          queriesOptimized++;

          // Lógica original simplificada
          const clienteIdentificador = `${campana.marca.toUpperCase()} ${campana.numeroCampana}`;
          const enviadosFinales = leadCounts.total || 0;
          const cantidadSolicitados = campana.cantidadDatosSolicitados || 0;

          const percentageResult = calculateDatosEnviadosPercentage(enviadosFinales, cantidadSolicitados);
          const porcentajeDatosEnviados = percentageResult.percentage;

          const faltantesAEnviar = calculateFaltantesAEnviar(enviadosFinales, cantidadSolicitados);

          // OPTIMIZACIÓN 5: Obtener CPL desde storage (optimizado por índices)
          const cplValue = await storage.getCpl(cliente.id) || 0;

          // Verificación de campaña anterior simplificada
          const tieneCampanaAnterior = campanas.some(c =>
            c.clienteId === campana.clienteId &&
            c.marca === campana.marca &&
            c.zona === campana.zona &&
            c.numeroCampana < campana.numeroCampana &&
            !c.fechaFin
          );

          // Aplicar guiones si hay campaña anterior
          let enviadosDisplay: string | number = enviadosFinales;
          let duplicadosDisplay: string | number = leadCounts.duplicados || 0;

          if (tieneCampanaAnterior) {
            enviadosDisplay = "-";
            duplicadosDisplay = "-";
          }

          // Calcular entregados por día
          const entregadosPorDia = (() => {
            if (tieneCampanaAnterior) return "-";

            const fechaInicio = campana.fechaCampana ? new Date(campana.fechaCampana) : new Date();
            const fechaReferencia = campana.fechaFin ? new Date(campana.fechaFin) : new Date();
            const diasTranscurridos = Math.max(1, Math.ceil((fechaReferencia.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)));

            return enviadosFinales / diasTranscurridos;
          })();

          // Record compatible 100% con frontend
          const record = {
            campaignId: campana.id,
            cliente: clienteIdentificador,
            clienteNombre: cliente.nombreCliente || clienteIdentificador,
            zona: campana.zona,
            enviados: enviadosDisplay,
            cantidadDatosSolicitados: cantidadSolicitados,
            porcentajeDatosEnviados,
            faltantesAEnviar,
            numeroCampana: campana.numeroCampana,
            cpl: cplValue,
            marca: campana.marca,
            fechaCampana: campana.fechaCampana,
            fechaFin: campana.fechaFin,
            fechaFinReal: campana.fechaFin,
            facturacionBruta: campana.facturacionBruta,
            pedidosPorDia: campana.pedidosPorDia ?? 0,
            pedidosTotal: cantidadSolicitados,
            faltantes: tieneCampanaAnterior ? "-" : faltantesAEnviar,
            entregadosPorDia: entregadosPorDia,
            inversionRealizada: tieneCampanaAnterior ? "-" : (enviadosFinales * cplValue),
            inversionPendiente: tieneCampanaAnterior ? "-" : (faltantesAEnviar * cplValue),
            estado: campana.fechaFin ? 'Finalizada' : 'En proceso',
            duplicados: duplicadosDisplay,
            diasProcesados: 0,
            porcentajeDesvio: tieneCampanaAnterior ? 0 : calculatePorcentajeDesvio(
              campana.pedidosPorDia ?? 0,
              typeof entregadosPorDia === 'number' ? entregadosPorDia : 0
            ),
            ventaPorCampana: 0,
            esSuperior100: porcentajeDatosEnviados > 100
          };

          processedData.push(record);

        } catch (campaignError) {
          console.error(`❌ [QUICK] Error procesando campaña ${campana.numeroCampana}:`, campaignError);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`🎯 [QUICK] Optimización completada en: ${totalTime}ms`);
      console.log(`📊 [QUICK] Queries optimizadas: ${queriesOptimized}, Records: ${processedData.length}`);

      // COMPATIBILIDAD: Mismo formato que endpoint original
      res.json(processedData);

    } catch (error) {
      console.error('❌ [QUICK] Error en optimización rápida:', error);
      res.status(500).json({ error: 'Error en consulta optimizada rápida', details: error.message });
    }
  });
}