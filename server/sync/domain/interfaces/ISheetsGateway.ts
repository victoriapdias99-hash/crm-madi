import { RawSheetLead } from '../entities/SyncLead';

/**
 * Interface para gateway de Google Sheets
 * Define las operaciones de acceso a Google Sheets API
 */
export interface ISheetsGateway {
  // Obtener datos de sheets
  getAllLeads(): Promise<RawSheetLead[]>;
  getLeadsFromSheet(sheetName: string): Promise<RawSheetLead[]>;
  getLeadsFromSheets(sheetNames: string[]): Promise<RawSheetLead[]>;
  getLeadsFromSpecificSheet(sheetName: string, since?: Date): Promise<RawSheetLead[]>;
  
  // Metadatos de sheets
  getAvailableSheetNames(): Promise<string[]>;
  validateSheetAccess(): Promise<boolean>;
  
  // Información de última actualización (para sync incremental)
  getLastModified(sheetName?: string): Promise<Date | null>;
}