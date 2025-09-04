import { ISheetsGateway } from '../../domain/interfaces/ISheetsGateway';
import { RawSheetLead } from '../../domain/entities/SyncLead';

/**
 * Gateway para acceso a Google Sheets API
 * Extrae la funcionalidad desde google-sheets.ts manteniendo compatibilidad
 */
export class GoogleSheetsGateway implements ISheetsGateway {
  private googleSheetsService: any;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    try {
      const { googleSheetsService } = await import('../../../google-sheets');
      this.googleSheetsService = googleSheetsService;
    } catch (error) {
      console.error('Error initializing Google Sheets service for gateway:', error);
      throw new Error('Failed to initialize Google Sheets gateway');
    }
  }

  async getAllLeads(): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      console.log('🔄 GoogleSheetsGateway: Obteniendo todos los leads de Google Sheets...');
      const leads = await this.googleSheetsService.getAllLeadsFromSheets();
      
      console.log(`📥 GoogleSheetsGateway: Obtenidos ${leads.length} leads totales`);
      return this.mapToRawSheetLeads(leads);
    } catch (error) {
      console.error('Error getting all leads from Google Sheets gateway:', error);
      throw new Error(`Failed to get leads from Google Sheets: ${error.message}`);
    }
  }

  async getLeadsFromSheet(sheetName: string): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      console.log(`🔄 GoogleSheetsGateway: Obteniendo leads de sheet "${sheetName}"...`);
      const leads = await this.googleSheetsService.getSheetData(sheetName);
      
      console.log(`📥 GoogleSheetsGateway: Obtenidos ${leads.length} leads de "${sheetName}"`);
      return this.mapToRawSheetLeads(leads);
    } catch (error) {
      console.error(`Error getting leads from sheet ${sheetName}:`, error);
      throw new Error(`Failed to get leads from sheet ${sheetName}: ${error.message}`);
    }
  }

  async getLeadsFromSheets(sheetNames: string[]): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      console.log(`🔄 GoogleSheetsGateway: Obteniendo leads de múltiples sheets: ${sheetNames.join(', ')}`);
      
      const allLeads: RawSheetLead[] = [];
      
      for (const sheetName of sheetNames) {
        try {
          const sheetLeads = await this.getLeadsFromSheet(sheetName);
          allLeads.push(...sheetLeads);
          console.log(`✅ ${sheetName}: ${sheetLeads.length} leads`);
        } catch (error) {
          console.warn(`⚠️ Error obteniendo leads de sheet "${sheetName}":`, error.message);
          // Continuar con otros sheets aunque uno falle
        }
      }
      
      console.log(`📥 GoogleSheetsGateway: Total obtenido ${allLeads.length} leads de ${sheetNames.length} sheets`);
      return allLeads;
    } catch (error) {
      console.error('Error getting leads from multiple sheets:', error);
      throw new Error(`Failed to get leads from sheets: ${error.message}`);
    }
  }

  async getLeadsFromSpecificSheet(sheetName: string, since?: Date): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      console.log(`🔄 GoogleSheetsGateway: Obteniendo leads específicos de "${sheetName}"${since ? ` desde ${since.toISOString()}` : ''}`);
      
      // Obtener todos los leads del sheet
      const allLeads = await this.getLeadsFromSheet(sheetName);
      
      // Filtrar por fecha si se especifica
      if (since) {
        const filteredLeads = allLeads.filter(lead => {
          try {
            const leadDate = new Date(lead.timestamp);
            return leadDate >= since;
          } catch (error) {
            // Si no se puede parsear la fecha, incluir el lead
            return true;
          }
        });
        
        console.log(`🔍 GoogleSheetsGateway: Filtrados ${filteredLeads.length}/${allLeads.length} leads desde ${since.toISOString()}`);
        return filteredLeads;
      }
      
      return allLeads;
    } catch (error) {
      console.error(`Error getting specific leads from sheet ${sheetName}:`, error);
      throw new Error(`Failed to get specific leads from sheet ${sheetName}: ${error.message}`);
    }
  }

  async getAvailableSheetNames(): Promise<string[]> {
    await this.ensureServiceInitialized();
    
    try {
      console.log('🔍 GoogleSheetsGateway: Obteniendo nombres de sheets disponibles...');
      const sheetNames = await this.googleSheetsService.getAvailableSheetNames();
      
      console.log(`📋 GoogleSheetsGateway: Encontrados ${sheetNames.length} sheets disponibles: ${sheetNames.join(', ')}`);
      
      if (sheetNames.length === 0) {
        throw new Error('No se encontraron pestañas disponibles en Google Sheets');
      }
      
      return sheetNames;
    } catch (error) {
      console.error('❌ Error crítico obteniendo nombres de sheets:', error);
      throw new Error(`Falló la detección automática de pestañas: ${error.message}`);
    }
  }

  async validateSheetAccess(): Promise<boolean> {
    await this.ensureServiceInitialized();
    
    try {
      console.log('🔐 GoogleSheetsGateway: Validando acceso a Google Sheets...');
      
      // Intentar obtener la lista de sheets como validación
      const sheetNames = await this.getAvailableSheetNames();
      const hasAccess = sheetNames.length > 0;
      
      console.log(`${hasAccess ? '✅' : '❌'} GoogleSheetsGateway: Acceso ${hasAccess ? 'válido' : 'inválido'} a Google Sheets`);
      return hasAccess;
    } catch (error) {
      console.error('Error validating sheet access:', error);
      return false;
    }
  }

  async getLastModified(sheetName?: string): Promise<Date | null> {
    await this.ensureServiceInitialized();
    
    try {
      // Google Sheets API no proporciona directamente fecha de última modificación
      // por fila, así que devolvemos null por ahora
      // En una implementación real, esto podría usar la API de Drive o timestamps internos
      
      console.log(`ℹ️ GoogleSheetsGateway: getLastModified no implementado para ${sheetName || 'sheets'}`);
      return null;
    } catch (error) {
      console.error('Error getting last modified date:', error);
      return null;
    }
  }

  /**
   * Obtiene leads de rangos específicos en Google Sheets
   * Usado para verificación de integridad - obtener solo filas específicas
   */
  async getLeadsFromRange(sheetName: string, range: string): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      console.log(`📋 GoogleSheetsGateway: Obteniendo datos del rango "${range}" en sheet "${sheetName}"`);
      
      // Usar la API de Google Sheets directamente para obtener un rango específico
      const response = await this.googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: this.googleSheetsService.spreadsheetId,
        range: `${sheetName}!${range}`,
        majorDimension: 'ROWS'
      });
      
      const rows = response.data.values || [];
      console.log(`📊 GoogleSheetsGateway: Obtenidas ${rows.length} filas del rango "${range}"`);
      
      if (rows.length === 0) {
        return [];
      }
      
      // Extraer número de fila inicial del rango (ej: "A4:ZZ7" → fila inicial = 4)
      const startRow = parseInt(range.split(':')[0].match(/\d+/)?.[0] || '1');
      
      const leads: RawSheetLead[] = [];
      
      rows.forEach((row, index) => {
        const actualRowNumber = startRow + index;
        
        // Usar el mismo parseador que el GoogleSheetsService original
        const lead = this.parseRowToRawSheetLead(row, sheetName, actualRowNumber);
        if (lead) {
          leads.push(lead);
        }
      });
      
      console.log(`✅ GoogleSheetsGateway: Procesados ${leads.length} leads válidos del rango "${range}"`);
      return leads;
    } catch (error) {
      console.error(`Error obteniendo rango ${range} de ${sheetName}:`, error);
      return [];
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  private mapToRawSheetLeads(leads: any[]): RawSheetLead[] {
    return leads.map(lead => ({
      timestamp: lead.timestamp || new Date().toISOString(),
      name: lead.name || lead.nombre || 'S/D',
      email: lead.email || 'S/D',
      phone: lead.phone || lead.telefono || 'S/D',
      city: lead.city || lead.ciudad || 'S/D',
      interest: lead.interest || lead.interes || 'S/D',
      budget: lead.budget || lead.presupuesto || 'S/D',
      modelo: lead.modelo || 'S/D',                    // Modelo del auto
      comentarioHorario: lead.comentarioHorario || 'S/D', // Horario/Comentarios
      origen: lead.origen || 'S/D',                    // ORIGEN
      localizacion: lead.localizacion || 'S/D',        // LOCALIZACION
      cliente: lead.cliente || 'S/D',                  // CLIENTE
      googleSheetsRowNumber: lead.googleSheetsRowNumber, // Número de fila de Google Sheets
      source: lead.source || 'google_sheets',
      campaign: lead.campaign || lead.campana || 'S/D',
      cost: lead.cost || lead.costo || '0'
    }));
  }

  /**
   * Convierte una fila de Google Sheets a formato RawSheetLead
   * Replica el comportamiento del parseRowToLead del GoogleSheetsService
   */
  private parseRowToRawSheetLead(row: any[], sheetName: string, rowIndex: number): RawSheetLead | null {
    if (!row || row.length < 2) {
      return null;
    }

    // Validación permisiva: acepta cualquier fila con contenido
    const hasContent = row.some(cell => {
      if (!cell) return false;
      const cellStr = cell.toString().trim();
      return cellStr.length > 0 && cellStr !== '';
    });

    if (!hasContent) {
      return null;
    }

    // Mapear columnas según estructura estándar de Google Sheets
    let timestamp: string;
    try {
      if (row[0]) {
        // Validar que el valor se puede convertir a fecha
        const dateValue = new Date(row[0]);
        if (isNaN(dateValue.getTime())) {
          // Si no es una fecha válida, usar fecha actual
          timestamp = new Date().toISOString();
        } else {
          timestamp = dateValue.toISOString();
        }
      } else {
        timestamp = new Date().toISOString();
      }
    } catch (error) {
      // En caso de cualquier error en el parsing, usar fecha actual
      timestamp = new Date().toISOString();
    }
    const name = row[1] ? row[1].toString().trim() : 'S/D';
    const phone = row[2] ? row[2].toString().trim() : 'S/D';
    const email = '';                                               // Email vacío (no existe en Google Sheets)
    const city = row[3] ? row[3].toString().trim() : '';         // ✅ CIUDAD/LOCALIDAD (D) 
    const modelo = row[4] ? row[4].toString().trim() : '';       // ✅ MODELO (E)
    const comentarioHorario = row[5] ? row[5].toString().trim() : ''; // ✅ COMENTARIO/HORARIO (F)
    const origen = row[6] ? row[6].toString().trim() : '';       // ✅ ORIGEN (G)
    const localizacion = row[7] ? row[7].toString().trim() : '';  // ✅ LOCALIZACION (H)  
    const cliente = row[8] ? row[8].toString().trim() : '';       // ✅ CLIENTE (I)
    
    // 🚨 LOG 1: Datos crudos de Google Sheets  
    console.log(`📊 RAW GOOGLE SHEETS [Fila ${rowIndex}]: cliente="${row[8]}" (${typeof row[8]}) → parseado="${cliente}" (${typeof cliente})`);

    return {
      timestamp,
      name,
      email,
      phone,
      city,
      interest: '',
      budget: '',
      modelo,
      comentarioHorario,
      origen,
      localizacion,
      cliente,
      googleSheetsRowNumber: rowIndex,
      source: 'google_sheets',
      campaign: sheetName,
      cost: '0'
    };
  }

  private async ensureServiceInitialized(): Promise<void> {
    if (!this.googleSheetsService) {
      await this.initializeService();
    }
  }
}

/**
 * Instancia singleton del gateway
 */
let googleSheetsGatewayInstance: GoogleSheetsGateway | null = null;

export function getGoogleSheetsGateway(): GoogleSheetsGateway {
  if (!googleSheetsGatewayInstance) {
    googleSheetsGatewayInstance = new GoogleSheetsGateway();
  }
  return googleSheetsGatewayInstance;
}