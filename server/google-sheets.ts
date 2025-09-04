import { google } from 'googleapis';
import { analistaFuncional } from './analista-funcional';

interface SheetLead {
  timestamp: string;
  name: string;
  email: string | null;
  phone: string;
  city: string | null;
  interest: string | null;
  budget: string | null;
  // Nuevos campos agregados
  modelo: string | null;                    // Modelo del auto
  comentarioHorario: string | null;         // Horario/Comentarios
  // Columnas desde Google Sheets (G, H, I)
  origen: string | null;
  localizacion: string | null;
  cliente: string | null;
  googleSheetsRowNumber?: number;    // Número de fila exacto en Google Sheets
  source: string;
  campaign: string;
  cost: string;
}

class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;
  private auth: any;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1jgi8XIWFUdu6x68oIDaGldr3s19JQC_LBZ8ZzQAsPJA';
    
    // Try to use service account first, fall back to API key
    this.initializeAuth();
  }

  private initializeAuth() {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    console.log('API key exists:', !!apiKey);

    if (apiKey) {
      this.sheets = google.sheets({ 
        version: 'v4', 
        auth: apiKey 
      });
      console.log('Google Sheets: Using API key authentication');
    } else {
      console.log('No Google Sheets credentials configured');
    }
  }

  private fallbackToApiKey(apiKey: string) {
    if (apiKey) {
      this.sheets = google.sheets({ 
        version: 'v4', 
        auth: apiKey 
      });
      console.log('Google Sheets: Using API key authentication');
    }
  }

  private isValidRow(row: any[]): boolean {
    // ✅ VALIDACIÓN PERMISIVA: Acepta cualquier fila con algún contenido
    if (!row || row.length < 1) return false;
    
    // Verificar si hay al menos una celda con contenido útil
    return row.some(cell => {
      if (!cell) return false;
      const cellStr = cell.toString().trim();
      return cellStr.length > 0 && cellStr !== '';
    });
  }

  private parseRowToLead(row: any[], sheetName: string, rowIndex: number): SheetLead | null {
    if (!this.isValidRow(row)) return null;

    // 🚨 LOG 1b: Datos crudos de Google Sheets (sistema legacy)
    console.log(`📊 RAW GOOGLE SHEETS [Legacy-Fila ${rowIndex + 1}]: cliente="${row[8]}" (${typeof row[8]}) → parseado="${row[8] || ''}" (${typeof (row[8] || '')})`);

    return {
      timestamp: row[0] || new Date().toISOString(),           // Fecha
      name: row[1] || '',                                      // Nombre
      phone: row[2] || '',                                     // Telefono
      email: '',                                               // Email vacío (no existe en Google Sheets)
      city: row[3] || '',                                      // Localidad (columna D)
      modelo: row[4] || '',                                    // Modelo (E)
      comentarioHorario: row[5] || '',                         // Horario/Comentarios (F)
      // Columnas G, H, I según tu orden - CORRECCIÓN DEL MAPEO
      origen: row[6] || '',                                    // ORIGEN (G)
      localizacion: row[7] || '',                              // LOCALIZACION (H)
      cliente: row[8] || '',                                   // CLIENTE (I)
      googleSheetsRowNumber: rowIndex + 1,                     // Número de fila (1-indexed como Google Sheets)
      // Campos del sistema
      interest: '',
      budget: '',
      source: 'google_sheets',
      campaign: sheetName,
      cost: '0'
    };
  }

  /**
   * Detecta la última fila con datos en una hoja
   */
  private async getLastRowWithData(sheetName: string): Promise<number> {
    try {
      if (!this.sheets) {
        return 1000; // Fallback al límite anterior
      }

      // Obtener metadata de la hoja para detectar dimensiones
      const spreadsheetResponse = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        ranges: [`${sheetName}!A:A`],
        includeGridData: false,
      });

      const sheet = spreadsheetResponse.data.sheets?.find((s: any) => s.properties?.title === sheetName);
      if (!sheet?.properties?.gridProperties?.rowCount) {
        console.log(`⚠️ No se pudo detectar tamaño de '${sheetName}', usando límite de 5000`);
        return 5000; // Límite más alto como fallback
      }

      const maxRows = sheet.properties.gridProperties.rowCount;
      console.log(`📏 ${sheetName}: Detectadas ${maxRows} filas máximas en la hoja`);
      
      // Limitar a un máximo razonable para evitar timeouts
      const safeLimit = Math.min(maxRows, 10000);
      console.log(`📏 ${sheetName}: Usando límite seguro de ${safeLimit} filas`);
      
      return safeLimit;
    } catch (error: any) {
      console.error(`Error detectando rango para ${sheetName}:`, error.message);
      console.log(`📏 ${sheetName}: Fallback a 5000 filas debido a error`);
      return 5000; // Límite más alto como fallback en caso de error
    }
  }

  async getSheetData(sheetName: string): Promise<SheetLead[]> {
    if (!this.sheets) {
      console.log('Google Sheets API not configured');
      return [];
    }

    // ✅ RETRY MEJORADO: Implementar retry en caso de fallos temporales
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`🔄 Intentando obtener datos de '${sheetName}' (intento ${retryCount + 1}/${maxRetries})`);
        
        // ✅ RANGO DINÁMICO: Detectar automáticamente el número real de filas
        const maxRows = await this.getLastRowWithData(sheetName);
        const dynamicRange = `${sheetName}!A1:ZZ${maxRows}`;
        console.log(`📊 ${sheetName}: Usando rango dinámico: ${dynamicRange}`);

        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: dynamicRange,
        });

        const rows = response.data.values || [];
        const leads: SheetLead[] = [];
        let validRowsCount = 0;
        let skippedRowsCount = 0;

        console.log(`📊 ${sheetName}: Procesando ${rows.length} filas totales`);
        
        // Skip header row (index 0)
        for (let i = 1; i < rows.length; i++) {
          const lead = this.parseRowToLead(rows[i], sheetName, i);
          if (lead) {
            leads.push(lead);
            validRowsCount++;
          } else {
            skippedRowsCount++;
          }
        }

        console.log(`✅ ${sheetName}: ${validRowsCount} leads válidos, ${skippedRowsCount} filas omitidas`);
        return leads;
        
      } catch (error: any) {
        retryCount++;
        console.error(`❌ Error obteniendo datos de '${sheetName}' (intento ${retryCount}):`, error.message);
        
        if (retryCount >= maxRetries) {
          console.error(`🚨 FALLÓ después de ${maxRetries} intentos: ${sheetName}`);
          return [];
        }
        
        // Esperar antes del retry (exponential backoff)
        const waitTime = Math.pow(2, retryCount) * 1000;
        console.log(`⏳ Esperando ${waitTime}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    return [];
  }


  /**
   * Obtiene automáticamente todas las pestañas del documento (excluyendo las de control)
   */
  async getAvailableSheetNames(): Promise<string[]> {
    try {
      if (!this.sheets) {
        console.error('Google Sheets service not initialized');
        return [];
      }

      // Obtener metadatos del documento para listar todas las pestañas
      const spreadsheetResponse = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheets = spreadsheetResponse.data.sheets || [];
      
      // Extraer nombres de pestañas y filtrar las excluidas
      const excludedSheets = ['Datos Diarios', 'Control Campañas', 'Datos diarios', 'Control campañas'];
      const availableSheets = sheets
        .map((sheet: any) => sheet.properties?.title)
        .filter((sheetName: any) => 
          sheetName && 
          !excludedSheets.includes(sheetName) &&
          !sheetName.toLowerCase().includes('control') &&
          !sheetName.toLowerCase().includes('datos diarios')
        );

      console.log('🔍 Pestañas detectadas automáticamente:', availableSheets);
      console.log('🚫 Pestañas excluidas:', excludedSheets);
      
      return availableSheets;
    } catch (error: any) {
      console.error('Error obteniendo lista de pestañas:', error?.message || error);
      // Fallback a la lista fija en caso de error
      return ['Fiat', 'Peugeot', 'Citroen', 'Toyota', 'Chevrolet', 'Renault'];
    }
  }

  /**
   * Obtiene todos los leads de todas las pestañas de marcas disponibles
   * Utilizado por el sistema de sincronización refactorizado
   */
  async getAllLeadsFromSheets(): Promise<SheetLead[]> {
    if (!this.sheets) {
      console.log('Google Sheets API not configured');
      return [];
    }

    try {
      console.log('🔄 GoogleSheetsService: Obteniendo todas las pestañas disponibles...');
      
      // Obtener nombres de todas las pestañas disponibles
      const sheetNames = await this.getAvailableSheetNames();
      console.log(`📋 GoogleSheetsService: Encontradas ${sheetNames.length} pestañas para sincronizar: ${sheetNames.join(', ')}`);
      
      const allLeads: SheetLead[] = [];
      
      // Obtener datos de cada pestaña
      for (const sheetName of sheetNames) {
        try {
          console.log(`🔄 GoogleSheetsService: Procesando pestaña "${sheetName}"...`);
          const sheetLeads = await this.getSheetData(sheetName);
          allLeads.push(...sheetLeads);
          console.log(`✅ GoogleSheetsService: ${sheetLeads.length} leads obtenidos de "${sheetName}"`);
        } catch (error: any) {
          console.warn(`⚠️ GoogleSheetsService: Error obteniendo datos de "${sheetName}":`, error.message);
          // Continuar con otras pestañas aunque una falle
        }
      }
      
      console.log(`📥 GoogleSheetsService: Total de ${allLeads.length} leads obtenidos de ${sheetNames.length} pestañas`);
      return allLeads;
    } catch (error: any) {
      console.error('Error obteniendo todos los leads de Google Sheets:', error);
      return [];
    }
  }

  // Nueva función para sincronizar TODAS las pestañas de marcas a PostgreSQL (DETECCIÓN AUTOMÁTICA)

  // Función auxiliar para extraer cliente del nombre
  private extractClientFromName(fullName: string): string {
    // Lógica para identificar el cliente desde el nombre completo
    // Basado en los patrones observados en el sistema actual
    const name = fullName.toLowerCase();
    
    if (name.includes('albens')) return 'PEUGEOT ALBENS';
    if (name.includes('autos del sol')) return 'FIAT AUTOS DEL SOL';
    if (name.includes('novo group')) return 'NOVO GROUP';
    if (name.includes('grupo quijada')) return 'GRUPO QUIJADA';
    if (name.includes('italy')) return 'ITALY AUTOS';
    if (name.includes('javier cagiao')) return 'RENAULT - Javier Cagiao';
    if (name.includes('mariano pichetti')) return 'TOYOTA MARIANO PICHETTI';
    
    // Retornar marca genérica si no coincide con patrones específicos
    return 'CLIENTE GENERICO';
  }

  // Función auxiliar para parsear fechas
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      // Intentar diferentes formatos de fecha
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  // Nueva función para obtener datos específicos por marca y cliente
  async getLeadsByBrandAndClient(marca: string, clienteNombre: string, fechaInicio?: Date): Promise<SheetLead[]> {
    if (!this.sheets) {
      console.log('Google Sheets API not configured');
      return [];
    }

    try {
      // PASO 1: Filtrar por hoja de marca primero
      const marcaCapitalized = marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase();
      console.log(`🔍 FILTRO POR MARCA: Buscando en hoja "${marcaCapitalized}" para cliente "${clienteNombre}"`);
      
      const leads = await this.getSheetData(marcaCapitalized);
      console.log(`📋 DATOS ACTUALES EN HOJA ${marcaCapitalized}: ${leads.length} registros totales`);
      
      // PASO 2: Verificar que el nombre del cliente y marca es el mismo
      const leadsFiltered = leads.filter(lead => {
        const leadData = lead.name ? lead.name.toLowerCase() : '';
        const clientData = clienteNombre.toLowerCase();
        
        // Verificar coincidencia exacta del cliente
        const isClientMatch = leadData.includes(clientData) || 
                              clientData.includes(leadData) ||
                              this.normalizeClientName(leadData) === this.normalizeClientName(clientData);
        
        if (isClientMatch) {
          console.log(`✅ CLIENTE COINCIDE: "${lead.name}" matches "${clienteNombre}"`);
        }
        
        return isClientMatch;
      });

      // PASO 3: Contabilizar por fecha de inicio de campaña si se especifica
      if (fechaInicio && leadsFiltered.length > 0) {
        const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
        const leadsFromDate = leadsFiltered.filter(lead => {
          const leadDate = new Date(lead.timestamp).toISOString().split('T')[0];
          return leadDate >= fechaInicioStr;
        });
        
        console.log(`📅 FILTRO POR FECHA: ${leadsFromDate.length} leads desde ${fechaInicioStr}`);
        return leadsFromDate;
      }

      console.log(`📊 RESULTADO FINAL: ${leadsFiltered.length} leads para ${marca} - ${clienteNombre}`);
      return leadsFiltered;
      
    } catch (error) {
      console.error(`Error fetching leads for ${marca} - ${clienteNombre}:`, error);
      return [];
    }
  }

  private normalizeClientName(name: string): string {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, ' ')    // Normalizar espacios
      .trim();
  }

  async getAvailableSheets(): Promise<string[]> {
    if (!this.sheets) {
      return [];
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheets = response.data.sheets || [];
      return sheets
        .map((sheet: any) => sheet.properties?.title)
        .filter((title: string) => 
          title && 
          title !== 'Datos Diarios' && 
          !title.toLowerCase().includes('config')
        );
    } catch (error: any) {
      console.error('Error fetching sheet names:', error?.message || error);
      return [];
    }
  }

  async getDatosDiariosData(): Promise<any[]> {
    if (!this.sheets) {
      console.log('Google Sheets API not configured');
      return [];
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `Datos Diarios!A1:AJ100`, // Obtener los primeros 100 registros
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return [];

      // La primera fila es el título (julio 2025)
      // La segunda fila son los headers
      const headers = rows[1];
      const dataRows = rows.slice(2);

      const processedData = dataRows
        .filter((row: any[]) => {
          const cliente = row[0] && row[0].trim();
          // Filtrar filas vacías y registros no válidos
          return cliente && 
                 cliente !== 'CLIENTE' && 
                 !cliente.includes('2025') &&
                 !cliente.toLowerCase().includes('junio') &&
                 !cliente.toLowerCase().includes('julio');
        })
        .map((row: any[]) => {
          const cliente = row[0] || '';
          const zona = row[1] || '';
          
          // Extraer días del 1 al 31 (columnas 2 a 32)
          const diasData: number[] = [];
          for (let i = 2; i <= 32; i++) {
            const value = row[i];
            diasData.push(value && !isNaN(Number(value)) ? Number(value) : 0);
          }

          // Extraer datos calculados (columnas siguientes)
          // Para RENAULT específicamente, usar suma de días si está disponible
          const enviadosFromColumn = row[33] && !isNaN(Number(row[33])) ? Number(row[33]) : 0;
          const sumaDias = diasData.reduce((sum, day) => sum + day, 0);
          
          // Debug específico para AVEC
          if (cliente.toLowerCase().includes('avec')) {
            console.log(`AVEC debug: columna 33 = ${enviadosFromColumn}, suma días = ${sumaDias}`);
            console.log(`AVEC días individuales:`, diasData.slice(0, 10));
          }
          
          // Inicializar enviados con el valor estándar
          let enviados = sumaDias > 0 ? sumaDias : enviadosFromColumn;
          
          // Función para extraer marca del nombre del cliente
          const extractBrand = (clienteName: string): string => {
            const cliente = clienteName.toLowerCase();
            if (cliente.includes('fiat')) return 'fiat';
            if (cliente.includes('peugeot')) return 'peugeot';
            if (cliente.includes('toyota')) return 'toyota';
            if (cliente.includes('chevrolet')) return 'chevrolet';
            if (cliente.includes('renault')) return 'renault';
            if (cliente.includes('citroen')) return 'citroen';
            return 'other';
          };

          // Usar el analista funcional para determinar conteos reales - aplicar directamente
          let conteoRealAnalista = null;
          
          // Mapeo directo por nombre exacto de cliente (basado en evidencia del usuario)
          const clienteLower = cliente.toLowerCase();
          
          // Usar conteo automático de la base de datos para todos los casos
          if (conteoRealAnalista !== null) {
            enviados = conteoRealAnalista;
          } else {
            // Para AVEC/GRUPO QUIJADA, usar datos reales basados en marca + zona específica
            if (cliente.toLowerCase().includes('avec') || cliente.toLowerCase().includes('grupo quijada')) {
              console.log(`AVEC/GRUPO QUIJADA debug para cliente "${cliente}":`, {
                enviadosFromColumn,
                sumaDias,
                diasData: diasData.slice(0, 10),
                zona,
                pedidosPorDia: row[35]
              });
              
              // Para todos los casos de AVEC, usar suma de días o datos como respaldo
              enviados = sumaDias > 0 ? sumaDias : (enviadosFromColumn > 0 ? enviadosFromColumn : 0);
              console.log(`AVEC: ${cliente} en ${zona} - ${enviados} enviados`);
            }
          }
          
          const pedidosPorDia = row[35] && !isNaN(Number(row[35])) ? Number(row[35]) : 0;
          
          // Calcular entregados por día de forma realista
          // Si hay datos enviados, calcular promedio asumiendo distribución sobre días hábiles
          const diasHabiles = 20; // Aproximadamente 20 días hábiles por mes
          const entregadosPorDia = enviados > 0 ? Math.round((enviados / diasHabiles) * 100) / 100 : 0;

          // Extraer nombre del cliente del campo "cliente"
          const extractClientName = (clienteField: string) => {
            // Ejemplos: "NOVO GROUP - FIAT" -> "NOVO GROUP", "RENAULT" -> "RENAULT"
            const parts = clienteField.split(' - ');
            return parts[0].trim();
          };

          const clienteNombre = extractClientName(cliente);

          // Extraer campos adicionales desde las columnas correspondientes
          const pedidosTotal = row[36] && !isNaN(Number(row[36])) ? Number(row[36]) : 0;
          const numeroCampana = row[37] && !isNaN(Number(row[37])) ? Number(row[37]) : 1;
          const ventaPorCampana = row[38] && !isNaN(Number(row[38])) ? Number(row[38]) : 0;

          return {
            cliente,
            clienteNombre,
            zona,
            diasData,
            enviados,
            entregadosPorDia,
            pedidosPorDia,
            pedidosTotal,
            numeroCampana,
            ventaPorCampana,
            // Campos calculados
            porcentajeDesvio: (pedidosPorDia > 0 && entregadosPorDia > 0) ? ((entregadosPorDia - pedidosPorDia) / pedidosPorDia * 100) : 0,
            faltantesAEnviar: Math.max(0, pedidosPorDia - enviados),
            // CPL se establecerá manualmente por el usuario
            cpl: 0,
            inversionRealizada: 0,
            inversionPendiente: 0,
            inversionTotal: 0
          };
        });

      console.log(`Fetched ${processedData.length} records from Datos Diarios`);
      
      // Ejecutar análisis funcional para verificar datos (comentado para evitar await en función no async)
      // await analistaFuncional.analizarMapeoClientes();
      // await analistaFuncional.reportarDiscrepancias(processedData, {});
      
      return processedData;
    } catch (error) {
      console.error('Error fetching Datos Diarios data:', error);
      return [];
    }
  }

  async getClientesData(): Promise<any[]> {
    if (!this.sheets) {
      console.log('Google Sheets API not configured');
      return [];
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `Clientes!A1:J100`, // Obtener los primeros 100 registros
      });

      const rows = response.data.values || [];
      if (rows.length < 2) return [];

      // La primera fila son los headers
      const headers = rows[0];
      const dataRows = rows.slice(1);

      const processedData = dataRows
        .filter((row: any[]) => row[0] && row[0].trim() !== '') // Filtrar filas vacías
        .map((row: any[]) => {
          return {
            nombreCliente: row[0] || '',
            nombreComercial: row[1] || '',
            telefono: row[2] || '',
            email: row[3] || '',
            fechaAlta: row[4] ? new Date(row[4]) : new Date(),
            cuitCliente: row[5] || '',
            tipoFacturacion: row[6] || 'C',
            marcasSolicitadas: row[7] ? row[7].split(',').map((m: string) => m.trim()) : [],
            zonas: row[8] ? row[8].split(',').map((z: string) => z.trim()) : []
          };
        });

      console.log(`Fetched ${processedData.length} clients from Clientes sheet`);
      return processedData;
    } catch (error) {
      console.error('Error fetching Clientes data:', error);
      return [];
    }
  }

}

export const googleSheetsService = new GoogleSheetsService();
export type { SheetLead };