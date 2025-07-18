import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { googleSheetsService, type SheetLead } from "./google-sheets";
import { registerMetaAdsRoutes } from "./meta-ads-routes";
import { 
  insertLeadSchema, 
  insertCampaignSchema, 
  insertDailyStatsSchema,
  insertLeadNoteSchema,
  insertUserSchema,
  insertClienteSchema,
  insertCampanaComercialSchema,
  createCampanaComercialSchema
} from "@shared/schema";

interface WebSocketWithData extends WebSocket {
  userId?: number;
  dashboardId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time dashboard updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const dashboardConnections = new Set<WebSocketWithData>();

  wss.on('connection', (ws: WebSocketWithData) => {
    console.log('Dashboard client connected');
    dashboardConnections.add(ws);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join_dashboard':
            ws.userId = message.userId;
            ws.dashboardId = message.dashboardId;
            
            // Send current stats to new connection
            const stats = await getRealtimeStats();
            ws.send(JSON.stringify({
              type: 'dashboard_update',
              data: stats
            }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      dashboardConnections.delete(ws);
    });
  });

  async function getRealtimeStats() {
    const [leadsCount, totalSpend, conversionRate, costPerLead] = await Promise.all([
      storage.getLeadsCount('today'),
      storage.getTotalSpend('today'),
      storage.getConversionRate('today'),
      storage.getCostPerLead('today')
    ]);

    return {
      leadsCount,
      totalSpend,
      conversionRate,
      costPerLead,
      timestamp: new Date()
    };
  }

  function broadcastDashboardUpdate(data: any) {
    const message = JSON.stringify({
      type: 'dashboard_update',
      data
    });
    
    dashboardConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  // Function to convert Google Sheets lead to database lead format
  function convertSheetLeadToDbLead(sheetLead: SheetLead, campaignId: number = 1) {
    const nameParts = sheetLead.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create unique ID based on lead data, not time
    const leadHash = `${sheetLead.email}_${sheetLead.phone}_${sheetLead.source}_${sheetLead.campaign}`;
    const uniqueId = leadHash.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);

    return {
      metaLeadId: `SHEET_${uniqueId}`,
      campaignId,
      firstName,
      lastName,
      email: sheetLead.email,
      phone: sheetLead.phone,
      city: sheetLead.city,
      interest: sheetLead.interest,
      budget: sheetLead.budget,
      campaignName: sheetLead.campaign,
      status: 'new' as const,
      source: 'google_sheets',
      cost: sheetLead.cost ? (parseFloat(sheetLead.cost.replace(/[^0-9.-]/g, '')) * 1400).toString() : '0', // Convertir USD a ARS (aprox 1400 pesos por dólar)
      leadDate: new Date(sheetLead.timestamp)
    };
  }

  // Handle Google Sheets sync
  async function handleSheetSync(leads: SheetLead[]) {
    try {
      let newLeadsCount = 0;
      
      // Get all existing leads to check for duplicates
      const existingLeads = await storage.getLeads({ limit: 10000 });
      const existingMetaIds = new Set(existingLeads.map(lead => lead.metaLeadId));
      
      for (const sheetLead of leads) {
        const dbLead = convertSheetLeadToDbLead(sheetLead);
        
        // Check if lead already exists by unique metaLeadId
        if (!existingMetaIds.has(dbLead.metaLeadId)) {
          await storage.createLead(dbLead);
          existingMetaIds.add(dbLead.metaLeadId); // Add to set to prevent duplicates in same batch
          newLeadsCount++;
        }
      }

      if (newLeadsCount > 0) {
        console.log(`Added ${newLeadsCount} new leads from Google Sheets`);
        
        // Broadcast update to dashboard
        const stats = await getRealtimeStats();
        broadcastDashboardUpdate(stats);
      }
    } catch (error) {
      console.error('Error handling sheet sync:', error);
    }
  }

  // Start Google Sheets periodic sync
  googleSheetsService.startPeriodicSync(handleSheetSync);

  // Auth routes
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Simple session (in production use proper session management)
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email,
          role: user.role 
        },
        token: `user_${user.id}_${Date.now()}`
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Dashboard analytics routes
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const timeframe = req.query.timeframe as string || 'today';
      
      const [leadsCount, totalSpend, conversionRate, costPerLead] = await Promise.all([
        storage.getLeadsCount(timeframe),
        storage.getTotalSpend(timeframe),
        storage.getConversionRate(timeframe),
        storage.getCostPerLead(timeframe)
      ]);

      const stats = {
        leadsCount,
        totalSpend: Number(totalSpend.toFixed(2)),
        conversionRate: Number(conversionRate.toFixed(2)),
        costPerLead: Number(costPerLead.toFixed(2))
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  app.get('/api/dashboard/leads-by-brand', async (req, res) => {
    try {
      const leads = await storage.getLeads({ limit: 10000 });
      const brandCounts: Record<string, number> = {};
      
      // Contar leads por marca de auto desde Google Sheets
      leads.forEach(lead => {
        if (lead.source === 'google_sheets' && lead.campaignName) {
          const brand = lead.campaignName.toLowerCase();
          if (brand.includes('fiat')) brandCounts['Fiat'] = (brandCounts['Fiat'] || 0) + 1;
          else if (brand.includes('peugeot')) brandCounts['Peugeot'] = (brandCounts['Peugeot'] || 0) + 1;
          else if (brand.includes('toyota')) brandCounts['Toyota'] = (brandCounts['Toyota'] || 0) + 1;
          else if (brand.includes('chevrolet')) brandCounts['Chevrolet'] = (brandCounts['Chevrolet'] || 0) + 1;
          else if (brand.includes('renault')) brandCounts['Renault'] = (brandCounts['Renault'] || 0) + 1;
          else if (brand.includes('citroen')) brandCounts['Citroen'] = (brandCounts['Citroen'] || 0) + 1;
          else brandCounts['Otros'] = (brandCounts['Otros'] || 0) + 1;
        }
      });
      
      res.json(brandCounts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leads by brand' });
    }
  });

  app.get('/api/dashboard/datos-diarios', async (req, res) => {
    try {
      // Obtener datos reales desde la hoja "Datos Diarios"
      const datosDiarios = await googleSheetsService.getDatosDiariosData();
      console.log(`Fetched ${datosDiarios.length} records from Datos Diarios`);
      console.log('Available client names in data:', datosDiarios.map(d => d.cliente || d.clienteNombre).slice(0, 5));
      
      // Obtener todas las campañas comerciales para mapeo
      const campanasComerciales = await storage.getAllCampanasComerciales();
      
      // Crear mapeo mejorado que prioriza por campaña
      const mappedData = [];
      
      // Procesar cada campaña individualmente
      for (const campana of campanasComerciales) {
        const cliente = await storage.getCliente(campana.clienteId);
        if (!cliente) continue;
        
        const fechaInicioCampana = new Date(campana.fechaCampana);
        
        // Filtrar datos específicos para esta campaña
        // Para demo: permitir datos históricos si la fecha de campaña es futura
        const fechaInicio = new Date(campana.fechaCampana);
        const hoy = new Date();
        // Agregar 1 día a hoy para comparación más precisa
        const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
        const esFuturo = fechaInicio > manana;
        
        // Log inicial para debug
        console.log(`  Processing campaign: ${cliente.nombreCliente} - ${campana.marca} (${campana.numeroCampana})`);
        
        // Approach directo: asignar datos manualmente basado en el matching
        let datosParaCampana = [];
        
        // Encontrar el dato específico para cada campaña
        for (let i = 0; i < datosDiarios.length; i++) {
          const dato = datosDiarios[i];
          const clienteBajo = dato.cliente.toLowerCase();
          const nombreClienteBajo = cliente.nombreCliente.toLowerCase();
          
          // Debug cuando busque GRUPO QUIJADA
          if (nombreClienteBajo === 'grupo quijada' && i < 10) {
            console.log(`    Checking[${i}]: '${nombreClienteBajo}' vs '${clienteBajo}'`);
          }
          
          let esMatch = false;
          
          // Matching válidos basados en datos reales de Google Sheets
          if (nombreClienteBajo === 'italy autos' && clienteBajo === 'chevrolet - italy') {
            esMatch = true;
            console.log(`    ✓ MATCH: ${nombreClienteBajo} -> ${clienteBajo}`);
          }
          // GRUPO QUIJADA puede hacer match con sus datos en Google Sheets
          else if (nombreClienteBajo === 'grupo quijada' && 
                   (clienteBajo === 'grupo quijada - peugeot' || clienteBajo === 'grupo quijada - citroen')) {
            esMatch = true;
            console.log(`    ✓ MATCH: ${nombreClienteBajo} -> ${clienteBajo}`);
          }
          // NOVO GROUP puede hacer match con NOVO GROUP - FIAT
          else if (nombreClienteBajo === 'novo group' && clienteBajo === 'novo group - fiat') {
            esMatch = true;
            console.log(`    ✓ MATCH: ${nombreClienteBajo} -> ${clienteBajo}`);
          }
          // RENAULT puede hacer match directo
          else if (nombreClienteBajo === 'renault' && clienteBajo === 'renault') {
            esMatch = true;
            console.log(`    ✓ MATCH: ${nombreClienteBajo} -> ${clienteBajo}`);
          }
          // PEUGEOT ALBENS puede hacer match con datos que contengan "albens"
          else if (nombreClienteBajo === 'peugeot albens' && clienteBajo.includes('albens')) {
            esMatch = true;
            console.log(`    ✓ MATCH: ${nombreClienteBajo} -> ${clienteBajo}`);
          }
          // NO hacer matching entre PEUGEOT ALBENS y GRUPO QUIJADA - son clientes diferentes
          
          if (esMatch) {
            datosParaCampana.push(dato);
            console.log(`    Added data record to campaign ${campana.numeroCampana}`);
          }
        }
        
        console.log(`Campaign ${campana.numeroCampana} - Found ${datosParaCampana.length} matching data records for ${cliente.nombreCliente} from ${campana.fechaCampana}`);
        
        // Debug para ver qué datos están disponibles
        if (datosParaCampana.length === 0) {
          console.log(`  No matches found for '${cliente.nombreCliente}' or '${campana.marca}'`);
          console.log(`  Sample data names: ${datosDiarios.slice(0, 3).map(d => d.cliente).join(', ')}`);
          

        } else if (cliente.nombreCliente === 'GRUPO QUIJADA') {
          console.log(`    GRUPO QUIJADA found data:`, datosParaCampana.map(d => ({
            cliente: d.cliente,
            fecha: d.fecha,
            cantidad: d.cantidad,
            totalLeads: d.totalLeads
          })));
        }
        
        // Calcular métricas específicas para esta campaña SECUENCIALMENTE desde fecha inicio
        let datosAcumulados = 0;
        let entregadosPorDiaTotal = 0;
        let diasConDatos = 0;
        let fechaFinReal = null;
        
        // Ordenar datos por fecha para procesar secuencialmente
        const datosOrdenados = datosParaCampana.sort((a, b) => 
          new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );
        
        // Debug antes del loop
        if (cliente.nombreCliente === 'GRUPO QUIJADA') {
          console.log(`    GRUPO QUIJADA processing ${datosOrdenados.length} records...`);
        }
        
        // Procesar día por día hasta alcanzar la cantidad solicitada
        for (const dato of datosOrdenados) {
          if (datosAcumulados >= campana.cantidadDatosSolicitados) break;
          
          // Debug para ver estructura de datos
          if (cliente.nombreCliente === 'GRUPO QUIJADA' && diasConDatos === 0) {
            console.log(`    GRUPO QUIJADA data structure:`, Object.keys(dato));
            console.log(`    Values: totalLeads=${dato.totalLeads}, cantidad=${dato.cantidad}, enviados=${dato.enviados}, totalLeads=${dato.totalLeads}`);
          }
          
          const datosDelDia = dato.totalLeads || dato.cantidad || dato.enviados || 0;
          const entregadosDelDia = dato.entregadosPorDia || 0;
          
          // Solo contar si hay datos ese día
          if (datosDelDia > 0) {
            datosAcumulados += datosDelDia;
            entregadosPorDiaTotal += entregadosDelDia;
            diasConDatos++;
            fechaFinReal = dato.fecha; // Última fecha con datos
            
            console.log(`  Day ${diasConDatos}: ${dato.fecha} - ${datosDelDia} data, total: ${datosAcumulados}/${campana.cantidadDatosSolicitados}`);
          }
        }
        
        // Determinar estado de la campaña
        let estadoCampana = 'En Progreso';
        if (datosAcumulados >= campana.cantidadDatosSolicitados) {
          estadoCampana = 'Completada';
        } else if (diasConDatos === 0) {
          estadoCampana = 'Sin Datos';
        }
        
        console.log(`Campaign ${campana.numeroCampana} final status: ${estadoCampana}, ${datosAcumulados}/${campana.cantidadDatosSolicitados} data`);
        
        // Limitar datos acumulados a la cantidad solicitada para esta campaña específica
        const datosFinales = Math.min(datosAcumulados, campana.cantidadDatosSolicitados);
        const porcentajeDatosEnviados = Math.min(100, (datosFinales / campana.cantidadDatosSolicitados) * 100);
        const faltantesAEnviar = Math.max(0, campana.cantidadDatosSolicitados - datosFinales);
        const entregadosPorDiaPromedio = diasConDatos > 0 ? Math.round(entregadosPorDiaTotal / diasConDatos) : 0;
        
        // Obtener valores almacenados en memoria para esta campaña específica
        const campanIndex = campanasComerciales.findIndex(c => c.id === campana.id);
        const storedCpl = await storage.getCpl(campanIndex);
        const storedVenta = await storage.getVentaPorCampana(campanIndex);
        const storedPedidos = await storage.getPedidosPorDia(campanIndex);
        
        mappedData.push({
          cliente: `${cliente.nombreCliente} - ${campana.marca}`,
          clienteNombre: cliente.nombreCliente,
          zona: campana.zona,
          numeroCampana: campana.numeroCampana,
          enviados: datosFinales,
          entregadosPorDia: entregadosPorDiaPromedio,
          pedidosPorDia: storedPedidos || 0,
          pedidosTotal: (storedPedidos || 0) * diasConDatos,
          porcentajeDesvio: storedPedidos > 0 ? ((entregadosPorDiaPromedio - storedPedidos) / storedPedidos * 100) : 0,
          porcentajeDatosEnviados: Math.round(porcentajeDatosEnviados),
          faltantesAEnviar: faltantesAEnviar,
          cpl: storedCpl || 0,
          ventaPorCampana: storedVenta || 0,
          inversionRealizada: datosFinales * (storedCpl || 0) * 1.02, // 2% impuestos
          inversionPendiente: faltantesAEnviar * (storedCpl || 0) * 1.02,
          inversionTotal: campana.cantidadDatosSolicitados * (storedCpl || 0) * 1.02,
          fechaCampana: campana.fechaCampana,
          fechaFinReal: fechaFinReal,
          cantidadSolicitada: campana.cantidadDatosSolicitados,
          diasProcesados: diasConDatos,
          estadoCampana: estadoCampana
        });
      }
      
      // Si no hay campañas comerciales, usar datos por defecto desde Google Sheets
      if (mappedData.length === 0) {
        console.log('No commercial campaigns found, using default Google Sheets data');
        const enrichedData = await Promise.all(
          datosDiarios.map(async (data: any, index: number) => {
            const storedCpl = await storage.getCpl(index);
            const storedVenta = await storage.getVentaPorCampana(index);
            const storedPedidos = await storage.getPedidosPorDia(index);
            
            return {
              ...data,
              cpl: storedCpl || data.cpl || 0,
              ventaPorCampana: storedVenta || data.ventaPorCampana || 0,
              pedidosPorDiaManual: storedPedidos || data.pedidosPorDia || 0
            };
          })
        );
        
        console.log(`Processed ${enrichedData.length} default records for datos diarios dashboard`);
        return res.json(enrichedData);
      }

      console.log(`Processed ${mappedData.length} campaigns for datos diarios dashboard`);
      res.json(mappedData);
    } catch (error) {
      console.error('Error fetching datos diarios:', error);
      res.status(500).json({ error: 'Failed to fetch datos diarios' });
    }
  })

  // Mapear campañas comerciales con datos diarios dinámicamente
  app.post('/api/dashboard/mapear-campanas', async (req, res) => {
    try {
      console.log('Starting enhanced campaign mapping process...');
      
      // Obtener todas las campañas comerciales
      const campanasComerciales = await storage.getAllCampanasComerciales();
      console.log(`Found ${campanasComerciales.length} commercial campaigns`);
      
      // Obtener datos diarios desde Google Sheets
      const datosDiarios = await googleSheetsService.getDatosDiariosData();
      console.log(`Found ${datosDiarios.length} daily data records`);
      
      let mappedCount = 0;
      const mapeoDetallado = [];
      
      // Mapear cada campaña individualmente por número y fecha
      for (const campana of campanasComerciales) {
        // Buscar cliente asociado
        const cliente = await storage.getCliente(campana.clienteId);
        if (!cliente) continue;
        
        console.log(`Processing Campaign ${campana.numeroCampana} - ${cliente.nombreCliente} - ${campana.marca}`);
        console.log(`Campaign start date: ${campana.fechaCampana}, requested data: ${campana.cantidadDatosSolicitados}`);
        
        // Filtrar datos por cliente/marca Y fecha de inicio de campaña
        const fechaInicioCampana = new Date(campana.fechaCampana);
        
        const datosRelacionados = datosDiarios.filter(dato => {
          if (!dato.fecha) return false;
          
          const fechaDato = new Date(dato.fecha);
          
          // Debe ser posterior o igual a la fecha de inicio de la campaña
          const dentroRangoFecha = fechaDato >= fechaInicioCampana;
          
          // Debe coincidir la marca/cliente
          const clienteCoincide = dato.cliente.toLowerCase().includes(cliente.nombreCliente.toLowerCase()) ||
                                 dato.clienteNombre.toLowerCase().includes(cliente.nombreCliente.toLowerCase()) ||
                                 dato.cliente.toLowerCase().includes(campana.marca.toLowerCase());
          
          return dentroRangoFecha && clienteCoincide;
        });
        
        // Calcular datos obtenidos hasta ahora
        let datosAcumulados = 0;
        let diasProcesados = 0;
        
        // Ordenar datos por fecha para contar secuencialmente
        const datosOrdenados = datosRelacionados.sort((a, b) => 
          new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );
        
        for (const dato of datosOrdenados) {
          if (datosAcumulados >= campana.cantidadDatosSolicitados) break;
          
          const datosDelDia = dato.totalLeads || dato.cantidad || dato.enviados || 1;
          datosAcumulados += datosDelDia;
          diasProcesados++;
        }
        
        const porcentajeCompletado = Math.min(100, (datosAcumulados / campana.cantidadDatosSolicitados) * 100);
        const datosFaltantes = Math.max(0, campana.cantidadDatosSolicitados - datosAcumulados);
        
        const mapeoInfo = {
          campanaNumerо: campana.numeroCampana,
          clienteNombre: cliente.nombreCliente,
          marca: campana.marca,
          fechaInicio: campana.fechaCampana,
          datosSolicitados: campana.cantidadDatosSolicitados,
          datosObtenidos: datosAcumulados,
          datosFaltantes: datosFaltantes,
          porcentajeCompletado: Math.round(porcentajeCompletado),
          diasProcesados: diasProcesados,
          datosEncontrados: datosRelacionados.length
        };
        
        mapeoDetallado.push(mapeoInfo);
        
        console.log(`Campaign ${campana.numeroCampana} mapping result:`, mapeoInfo);
        
        if (datosRelacionados.length > 0) {
          mappedCount++;
        }
      }
      
      console.log(`Successfully mapped ${mappedCount} campaigns`);
      
      res.json({ 
        success: true, 
        mapped: mappedCount,
        totalCampaigns: campanasComerciales.length,
        totalDataRecords: datosDiarios.length,
        mapeoDetallado: mapeoDetallado,
        message: `Se mapearon ${mappedCount} campañas exitosamente con datos específicos por fecha`
      });
    } catch (error) {
      console.error('Error mapping campaigns:', error);
      res.status(500).json({ error: 'Failed to map campaigns with daily data' });
    }
  });

  // Datos diarios con matching de campañas
  app.get('/api/dashboard/datos-diarios-matching', async (req, res) => {
    try {
      if (typeof (storage as any).getDatosDiariosConMatching === 'function') {
        const data = await (storage as any).getDatosDiariosConMatching();
        res.json(data);
      } else {
        // Fallback para storage que no tenga esta función
        const datosDiarios = await storage.getDashboardCampaigns();
        res.json(datosDiarios.map(dato => ({ ...dato, hasMatch: false, campanaMatched: null })));
      }
    } catch (error) {
      console.error('Error fetching datos diarios with matching:', error);
      res.status(500).json({ error: 'Failed to fetch datos diarios with matching' });
    }
  });

  // Campañas con información de matching y conteo real
  app.get('/api/campanas-comerciales/matching', async (req, res) => {
    try {
      // Obtener campañas y clientes
      const campanas = await storage.getAllCampanasComerciales();
      const clientes = await storage.getAllClientes();
      const datosDiarios = await googleSheetsService.getDatosDiariosData();
      
      const campanasConMatching = await Promise.all(
        campanas.map(async (campana) => {
          const cliente = clientes.find(c => c.id === campana.clienteId);
          
          // Calcular datos reales obtenidos hasta ahora
          const fechaInicioObj = new Date(campana.fechaCampana);
          const hoy = new Date();
          
          // Filtrar datos desde la fecha de inicio hasta hoy
          const datosMatcheados = datosDiarios.filter((dato: any) => {
            if (!dato.cliente || !dato.fecha) return false;
            
            const fechaDato = new Date(dato.fecha);
            const clienteNombre = dato.cliente.toLowerCase();
            const marcaBuscada = campana.marca.toLowerCase();
            
            // Debe estar en el rango de fechas de la campaña
            const dentroRango = fechaDato >= fechaInicioObj && fechaDato <= hoy;
            
            // Debe coincidir la marca
            const marcaCoincide = clienteNombre.includes(marcaBuscada) || 
                                 (dato.marca && dato.marca.toLowerCase().includes(marcaBuscada));
            
            return dentroRango && marcaCoincide;
          });
          
          // Contar total de leads obtenidos
          const datosObtenidos = datosMatcheados.reduce((total, dato) => {
            return total + (dato.totalLeads || dato.cantidad || 1);
          }, 0);
          
          // Calcular progreso
          const porcentajeCompletado = Math.min(100, (datosObtenidos / campana.cantidadDatosSolicitados) * 100);
          const datosFaltantes = Math.max(0, campana.cantidadDatosSolicitados - datosObtenidos);
          
          // Estado de la campaña
          let estadoCampana = 'En progreso';
          if (datosObtenidos >= campana.cantidadDatosSolicitados) {
            estadoCampana = 'Completada';
          } else if (new Date() > new Date(campana.fechaFin || '')) {
            estadoCampana = 'Vencida';
          }
          
          return {
            ...campana,
            nombreCliente: cliente?.nombreCliente || 'Cliente no encontrado',
            nombreComercial: cliente?.nombreComercial || 'N/A',
            datosObtenidos,
            datosFaltantes,
            porcentajeCompletado: Math.round(porcentajeCompletado),
            estadoCampana,
            datosMatcheados: datosMatcheados.length,
            ultimaFechaConDatos: datosMatcheados.length > 0 ? 
              datosMatcheados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0].fecha : 
              null
          };
        })
      );
      
      res.json(campanasConMatching);
    } catch (error) {
      console.error('Error fetching campañas with matching:', error);
      res.status(500).json({ error: 'Failed to fetch campañas with matching' });
    }
  });

  app.post('/api/dashboard/update-cpl', async (req, res) => {
    try {
      const { clienteIndex, cpl } = req.body;
      
      if (typeof clienteIndex !== 'number' || typeof cpl !== 'number') {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      // Almacenar en memoria
      await storage.updateCpl(clienteIndex, cpl);
      
      res.json({ 
        success: true, 
        message: `CPL actualizado para cliente ${clienteIndex}`,
        cpl: parseFloat(cpl)
      });
    } catch (error) {
      console.error('Error updating CPL:', error);
      res.status(500).json({ error: 'Failed to update CPL' });
    }
  });

  // Actualizar venta por campaña
  app.post('/api/dashboard/update-venta', async (req, res) => {
    try {
      const { clienteIndex, venta } = req.body;
      
      if (typeof clienteIndex !== 'number' || typeof venta !== 'number') {
        return res.status(400).json({ error: 'Invalid parameters' });
      }

      // Almacenar en memoria
      await storage.updateVentaPorCampana(clienteIndex, venta);

      res.json({ 
        success: true, 
        message: `Venta por campaña actualizada para cliente ${clienteIndex}`,
        venta: parseFloat(venta)
      });
    } catch (error) {
      console.error('Error updating venta por campaña:', error);
      res.status(500).json({ error: 'Failed to update venta por campaña' });
    }
  });

  // Obtener datos para dashboard de finanzas
  app.get('/api/dashboard/finanzas', async (req, res) => {
    try {
      const datosDiarios = await googleSheetsService.getDatosDiariosData();
      
      // Transformar datos para finanzas
      const finanzasData = datosDiarios.map((data: any, index: number) => {
        // Extraer marca del cliente
        let marca = 'Otros';
        const clienteNombre = data.clienteNombre?.toLowerCase() || '';
        if (clienteNombre.includes('fiat')) marca = 'Fiat';
        else if (clienteNombre.includes('peugeot')) marca = 'Peugeot';
        else if (clienteNombre.includes('toyota')) marca = 'Toyota';
        else if (clienteNombre.includes('chevrolet')) marca = 'Chevrolet';
        else if (clienteNombre.includes('renault')) marca = 'Renault';
        else if (clienteNombre.includes('citroen')) marca = 'Citroen';

        return {
          cliente: data.cliente,
          clienteNombre: data.clienteNombre,
          campana: data.cliente,
          numeroCampana: data.numeroCampana || 1,
          marca,
          zona: data.zona,
          totalLeads: data.enviados || 0,
          cpl: data.cpl || 0,
          ventaPorCampana: data.ventaPorCampana || 0,
          inversionTotal: data.inversionTotal || 0
        };
      });
      
      res.json(finanzasData);
    } catch (error) {
      console.error('Error fetching finanzas data:', error);
      res.status(500).json({ error: 'Failed to fetch finanzas data' });
    }
  });

  // Endpoints para gestión de clientes
  app.get('/api/clientes', async (req, res) => {
    try {
      const clientes = await storage.getAllClientes();
      res.json(clientes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clientes' });
    }
  });

  app.get('/api/clientes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const cliente = await storage.getCliente(id);
      
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente not found' });
      }
      
      res.json(cliente);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch cliente' });
    }
  });

  app.post('/api/clientes', async (req, res) => {
    try {
      console.log('Creating cliente with data:', req.body);
      const validatedData = insertClienteSchema.parse(req.body);
      const cliente = await storage.createCliente(validatedData);
      console.log('Cliente created successfully:', cliente);
      res.status(201).json(cliente);
    } catch (error) {
      console.error('Error creating cliente:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create cliente' });
      }
    }
  });

  app.put('/api/clientes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const cliente = await storage.updateCliente(id, req.body);
      
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente not found' });
      }
      
      res.json(cliente);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update cliente' });
    }
  });

  app.delete('/api/clientes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCliente(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Cliente not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete cliente' });
    }
  });

  app.get('/api/sheets/clientes', async (req, res) => {
    try {
      const clientesData = await googleSheetsService.getClientesData();
      res.json(clientesData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clientes from Google Sheets' });
    }
  });

  // Campañas comerciales routes
  app.get('/api/campanas-comerciales', async (req, res) => {
    try {
      const campanas = await storage.getAllCampanasComerciales();
      res.json(campanas);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campañas comerciales' });
    }
  });

  app.get('/api/campanas-comerciales/cliente/:clienteId', async (req, res) => {
    try {
      const clienteId = parseInt(req.params.clienteId);
      const campanas = await storage.getCampanasPorCliente(clienteId);
      res.json(campanas);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campañas for cliente' });
    }
  });

  app.post('/api/campanas-comerciales', async (req, res) => {
    try {
      console.log('Creating campaña comercial with data:', req.body);
      
      // Validar datos sin fecha_fin y numeroCampana (se calcularán automáticamente)
      const { fechaFin, numeroCampana, ...dataWithoutCalculatedFields } = req.body;
      
      // Usar el schema específico para crear (sin campos calculados)
      console.log('Data to validate:', dataWithoutCalculatedFields);
      
      const validatedData = createCampanaComercialSchema.parse(dataWithoutCalculatedFields);
      
      // Generar número de campaña automáticamente basado en cliente
      const existingCampanas = await storage.getCampanasPorCliente(validatedData.clienteId);
      const nextNumber = existingCampanas.length + 1;
      const numeroGenerado = `${nextNumber}`;
      
      // Calcular fecha de fin automáticamente basada en datos disponibles
      const fechaFinCalculada = await calculateFechaFin(
        validatedData.fechaCampana,
        validatedData.cantidadDatosSolicitados,
        validatedData.marca
      );
      
      console.log('Generated numero_campana:', numeroGenerado);
      console.log('Calculated fecha_fin:', fechaFinCalculada);
      
      const campanaDatos = {
        ...validatedData,
        numeroCampana: numeroGenerado,
        fechaFin: fechaFinCalculada
      };
      
      const campana = await storage.createCampanaComercial(campanaDatos);
      console.log('Campaña comercial created successfully:', campana);
      res.status(201).json(campana);
    } catch (error: any) {
      console.error('Error creating campaña comercial:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create campaña comercial' });
      }
    }
  });

  app.get('/api/campanas-comerciales/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campana = await storage.getCampanaComercial(id);
      
      if (!campana) {
        return res.status(404).json({ error: 'Campaña comercial not found' });
      }
      
      res.json(campana);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaña comercial' });
    }
  });

  app.put('/api/campanas-comerciales/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const campana = await storage.updateCampanaComercial(id, req.body);
      
      if (!campana) {
        return res.status(404).json({ error: 'Campaña comercial not found' });
      }
      
      res.json(campana);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update campaña comercial' });
    }
  });

  app.delete('/api/campanas-comerciales/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCampanaComercial(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Campaña comercial not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete campaña comercial' });
    }
  });

  // Registrar rutas de Meta Ads (módulo de prueba)
  registerMetaAdsRoutes(app);

  // Campaign routes
  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  app.post('/api/campaigns', async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      res.status(400).json({ error: 'Invalid campaign data' });
    }
  });

  app.get('/api/campaigns/:id', async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch campaign' });
    }
  });

  // Lead routes
  app.get('/api/leads', async (req, res) => {
    try {
      const status = req.query.status as string;
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const leads = await storage.getLeads({ status, campaignId, limit });
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  app.post('/api/leads', async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);
      
      // Broadcast real-time update
      const stats = await getRealtimeStats();
      broadcastDashboardUpdate(stats);
      
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ error: 'Invalid lead data' });
    }
  });

  app.get('/api/leads/:id', async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch lead' });
    }
  });

  app.patch('/api/leads/:id', async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const updates = req.body;
      
      const lead = await storage.updateLead(leadId, updates);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Broadcast real-time update
      const stats = await getRealtimeStats();
      broadcastDashboardUpdate(stats);
      
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update lead' });
    }
  });

  // Lead notes routes
  app.get('/api/leads/:leadId/notes', async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const notes = await storage.getLeadNotes(leadId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch lead notes' });
    }
  });

  app.post('/api/leads/:leadId/notes', async (req, res) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const validatedData = insertLeadNoteSchema.parse({
        ...req.body,
        leadId
      });
      
      const note = await storage.createLeadNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: 'Invalid note data' });
    }
  });

  // Google Sheets integration routes
  app.get('/api/sheets/status', async (req, res) => {
    try {
      const hasApiKey = !!process.env.GOOGLE_SHEETS_API_KEY;
      const hasSpreadsheetId = !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
      
      if (!hasApiKey || !hasSpreadsheetId) {
        return res.json({
          connected: false,
          message: 'Google Sheets API credentials not configured'
        });
      }

      // Test connection by trying to get available sheets
      const sheets = await googleSheetsService.getAvailableSheets();
      
      res.json({
        connected: true,
        sheetsCount: sheets.length,
        availableSheets: sheets,
        message: 'Connected to Google Sheets'
      });
    } catch (error) {
      res.json({
        connected: false,
        message: 'Failed to connect to Google Sheets',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/sheets/sync', async (req, res) => {
    try {
      console.log('Manual Google Sheets sync requested');
      const leads = await googleSheetsService.getAllLeadsFromSheets();
      await handleSheetSync(leads);
      
      res.json({
        success: true,
        message: `Synced ${leads.length} leads from Google Sheets`,
        leadsCount: leads.length
      });
    } catch (error) {
      console.error('Manual sync error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync Google Sheets',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/sheets/preview', async (req, res) => {
    try {
      const sheetName = req.query.sheet as string || 'Fiat';
      const leads = await googleSheetsService.getSheetData(sheetName);
      
      res.json({
        sheetName,
        leadsCount: leads.length,
        leads: leads.slice(0, 10) // Preview first 10 leads
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to preview sheet data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Daily stats routes
  app.get('/api/stats/daily', async (req, res) => {
    try {
      const date = req.query.date as string;
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId as string) : undefined;
      
      const stats = await storage.getDailyStats(date, campaignId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch daily stats' });
    }
  });

  app.post('/api/stats/daily', async (req, res) => {
    try {
      const validatedData = insertDailyStatsSchema.parse(req.body);
      const stats = await storage.createDailyStats(validatedData);
      
      // Broadcast real-time update
      const realtimeStats = await getRealtimeStats();
      broadcastDashboardUpdate(realtimeStats);
      
      res.status(201).json(stats);
    } catch (error) {
      res.status(400).json({ error: 'Invalid stats data' });
    }
  });

  // Webhook endpoint for Make.com integration
  app.post('/api/webhook/lead', async (req, res) => {
    try {
      console.log('Webhook received:', req.body);
      
      // Validate required fields
      const requiredFields = ['email', 'firstName', 'lastName'];
      const missing = requiredFields.filter(field => !req.body[field]);
      
      if (missing.length > 0) {
        return res.status(400).json({ 
          error: 'Missing required fields', 
          missing 
        });
      }
      
      // Create lead from webhook data
      const leadData = {
        metaLeadId: req.body.metaLeadId || `WEBHOOK_${Date.now()}`,
        campaignId: req.body.campaignId || 1, // Default campaign
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        age: req.body.age ? parseInt(req.body.age) : undefined,
        city: req.body.city,
        interest: req.body.interest,
        budget: req.body.budget,
        adName: req.body.adName,
        adsetName: req.body.adsetName,
        campaignName: req.body.campaignName,
        cost: req.body.cost,
        leadDate: req.body.leadDate ? new Date(req.body.leadDate) : new Date()
      };
      
      const lead = await storage.createLead(leadData);
      
      // Broadcast real-time update
      const stats = await getRealtimeStats();
      broadcastDashboardUpdate(stats);
      
      res.status(201).json({ 
        success: true, 
        leadId: lead.id,
        message: 'Lead created successfully'
      });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Test runner endpoint para pruebas funcionales
  app.post('/api/run-tests', async (req, res) => {
    try {
      const { FunctionalTester } = await import('./test-runner');
      const tester = new FunctionalTester();
      const results = await tester.runAllTests();
      
      const allPassed = results.every(r => r.passed);
      
      res.json({
        success: allPassed,
        results,
        summary: {
          total: results.length,
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length
        }
      });
    } catch (error) {
      console.error('Error running tests:', error);
      res.status(500).json({ error: 'Failed to run tests' });
    }
  });

  // Función para calcular fecha de fin automáticamente
  async function calculateFechaFin(fechaInicio: string, cantidadSolicitada: number, marca: string): Promise<string> {
    try {
      console.log('Calculating fecha_fin for:', { fechaInicio, cantidadSolicitada, marca });
      
      // Obtener datos diarios desde Google Sheets
      const datosDiarios = await googleSheetsService.getDatosDiariosData();
      console.log('Total datos diarios found:', datosDiarios.length);
      
      // Filtrar datos desde fecha de inicio y por marca
      const fechaInicioObj = new Date(fechaInicio);
      let contador = 0;
      let fechaFin = fechaInicioObj;
      
      // Filtrar por marca (más flexible para matching)
      const datosFiltrados = datosDiarios.filter((dato: any) => {
        if (!dato.cliente) return false;
        const clienteNombre = dato.cliente.toLowerCase();
        const marcaBuscada = marca.toLowerCase();
        
        // Buscar marca en el nombre del cliente o campaña
        return clienteNombre.includes(marcaBuscada) || 
               (dato.marca && dato.marca.toLowerCase().includes(marcaBuscada));
      });
      
      console.log('Datos filtrados por marca:', datosFiltrados.length);
      
      // Ordenar datos por fecha y contar desde la fecha de inicio
      const datosOrdenados = datosFiltrados
        .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      
      for (const dato of datosOrdenados) {
        const fechaDato = new Date(dato.fecha);
        if (fechaDato >= fechaInicioObj) {
          const cantidad = dato.totalLeads || dato.cantidad || 1;
          contador += cantidad;
          fechaFin = fechaDato;
          
          console.log(`Fecha: ${dato.fecha}, Cantidad: ${cantidad}, Total acumulado: ${contador}`);
          
          if (contador >= cantidadSolicitada) {
            break;
          }
        }
      }
      
      const fechaFinString = fechaFin.toISOString().split('T')[0];
      console.log('Fecha fin calculada:', fechaFinString, 'con', contador, 'datos acumulados');
      
      return fechaFinString;
    } catch (error) {
      console.error('Error calculating fecha fin:', error);
      // Fallback: sumar días estimados (1 dato por día)
      const fechaInicio = new Date(fechaInicio);
      fechaInicio.setDate(fechaInicio.getDate() + cantidadSolicitada);
      return fechaInicio.toISOString().split('T')[0];
    }
  }

  return httpServer;
}
