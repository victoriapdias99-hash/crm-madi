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
      throw new Error('Failed to initialize Google Sheets gateway');
    }
  }

  async getAllLeads(): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      const leads = await this.googleSheetsService.getAllLeadsFromSheets();
      return this.mapToRawSheetLeads(leads);
    } catch (error) {
      throw new Error(`Failed to get leads from Google Sheets: ${error.message}`);
    }
  }

  async getLeadsFromSheet(sheetName: string): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      const leads = await this.googleSheetsService.getSheetData(sheetName);
      return this.mapToRawSheetLeads(leads);
    } catch (error) {
      throw new Error(`Failed to get leads from sheet ${sheetName}: ${error.message}`);
    }
  }

  async getLeadsFromSheets(sheetNames: string[]): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      const allLeads: RawSheetLead[] = [];
      
      for (const sheetName of sheetNames) {
        try {
          const sheetLeads = await this.getLeadsFromSheet(sheetName);
          allLeads.push(...sheetLeads);
        } catch (error) {
          // Continuar con otros sheets aunque uno falle
        }
      }
      
      return allLeads;
    } catch (error) {
      throw new Error(`Failed to get leads from sheets: ${error.message}`);
    }
  }

  async getLeadsFromSpecificSheet(sheetName: string, since?: Date): Promise<RawSheetLead[]> {
    await this.ensureServiceInitialized();
    
    try {
      const allLeads = await this.getLeadsFromSheet(sheetName);
      
      // Filtrar por fecha si se especifica
      if (since) {
        const filteredLeads = allLeads.filter(lead => {
          try {
            const leadDate = new Date(lead.timestamp);
            return leadDate >= since;
          } catch (error) {
            return true;
          }
        });
        
        return filteredLeads;
      }
      
      return allLeads;
    } catch (error) {
      throw new Error(`Failed to get specific leads from sheet ${sheetName}: ${error.message}`);
    }
  }

  async getAvailableSheetNames(): Promise<string[]> {
    await this.ensureServiceInitialized();
    
    try {
      const sheetNames = await this.googleSheetsService.getAvailableSheetNames();
      
      
      if (sheetNames.length === 0) {
        throw new Error('No se encontraron pestañas disponibles en Google Sheets');
      }
      
      return sheetNames;
    } catch (error) {
      throw new Error(`Falló la detección automática de pestañas: ${error.message}`);
    }
  }

  async validateSheetAccess(): Promise<boolean> {
    await this.ensureServiceInitialized();
    
    try {
      const sheetNames = await this.getAvailableSheetNames();
      const hasAccess = sheetNames.length > 0;
      
      return hasAccess;
    } catch (error) {
      return false;
    }
  }

  async getLastModified(sheetName?: string): Promise<Date | null> {
    await this.ensureServiceInitialized();
    
    try {
      // Google Sheets API no proporciona directamente fecha de última modificación
      // por fila, así que devolvemos null por ahora
      // En una implementación real, esto podría usar la API de Drive o timestamps internos
      
      return null;
    } catch (error) {
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
      const response = await this.googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: this.googleSheetsService.spreadsheetId,
        range: `${sheetName}!${range}`,
        majorDimension: 'ROWS'
      });
      
      const rows = response.data.values || [];
      
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
      
      return leads;
    } catch (error) {
      return [];
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  private mapToRawSheetLeads(leads: any[]): RawSheetLead[] {
    return leads.map(lead => ({
      timestamp: lead.timestamp || new Date().toISOString(),
      name: lead.name || lead.nombre || 'S/D',
      email: lead.email || null,
      phone: lead.phone || lead.telefono || 'S/D',
      city: lead.city || lead.ciudad || null,
      interest: lead.interest || lead.interes || null,
      budget: lead.budget || lead.presupuesto || null,
      modelo: lead.modelo || null,                    // Modelo del auto
      comentarioHorario: lead.comentarioHorario || null, // Horario/Comentarios
      origen: lead.origen || null,                    // ORIGEN
      localizacion: lead.localizacion || null,        // LOCALIZACION
      cliente: lead.cliente || null,                  // CLIENTE
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
    const email = null;                                               // Email no existe → NULL
    const city = row[3] ? row[3].toString().trim() : null;         // ✅ CIUDAD/LOCALIDAD (D) → NULL si vacío 
    const modelo = row[4] ? row[4].toString().trim() : null;       // ✅ MODELO (E) → NULL si vacío
    const comentarioHorario = row[5] ? row[5].toString().trim() : null; // ✅ COMENTARIO/HORARIO (F) → NULL si vacío
    const origen = row[6] ? row[6].toString().trim() : null;       // ✅ ORIGEN (G) → NULL si vacío
    const localizacion = row[7] ? row[7].toString().trim() : null;  // ✅ LOCALIZACION (H) → NULL si vacío  
    const cliente = row[8] ? row[8].toString().trim() : null;       // ✅ CLIENTE (I) → NULL si vacío
    
    // Solo log en debug mode si es necesario

    return {
      timestamp,
      name,
      email,
      phone,
      city,
      interest: null,
      budget: null,
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