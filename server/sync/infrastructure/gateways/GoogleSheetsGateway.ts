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
      return sheetNames;
    } catch (error) {
      console.error('Error getting available sheet names:', error);
      
      // Fallback a lista fija si falla la detección automática
      const fallbackSheets = ['Fiat', 'Peugeot', 'Citroen', 'Toyota', 'Chevrolet', 'Renault', 'VW', 'Jeep', 'Ford'];
      console.log(`⚠️ GoogleSheetsGateway: Usando fallback sheets: ${fallbackSheets.join(', ')}`);
      return fallbackSheets;
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

  // ========== MÉTODOS PRIVADOS ==========

  private mapToRawSheetLeads(leads: any[]): RawSheetLead[] {
    return leads.map(lead => ({
      timestamp: lead.timestamp || new Date().toISOString(),
      name: lead.name || lead.nombre || '',
      email: lead.email || '',
      phone: lead.phone || lead.telefono || '',
      city: lead.city || lead.ciudad || '',
      interest: lead.interest || lead.interes || '',
      budget: lead.budget || lead.presupuesto || '',
      origen: lead.origen || '',      // Columna G
      localizacion: lead.localizacion || '', // Columna H
      cliente: lead.cliente || '',      // Columna I
      source: lead.source || 'google_sheets',
      campaign: lead.campaign || lead.campana || '',
      cost: lead.cost || lead.costo || '0'
    }));
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