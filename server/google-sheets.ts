import { google } from 'googleapis';
import cron from 'node-cron';

interface SheetLead {
  timestamp: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  interest: string;
  budget: string;
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
    // Check if row has at least name and email
    return row && row.length >= 2 && row[0] && row[1];
  }

  private parseRowToLead(row: any[], sheetName: string): SheetLead | null {
    if (!this.isValidRow(row)) return null;

    return {
      timestamp: row[0] || new Date().toISOString(),
      name: row[1] || '',
      email: row[2] || '',
      phone: row[3] || '',
      city: row[4] || '',
      interest: row[5] || '',
      budget: row[6] || '',
      source: 'google_sheets',
      campaign: sheetName,
      cost: row[7] || '0'
    };
  }

  async getSheetData(sheetName: string): Promise<SheetLead[]> {
    if (!this.sheets) {
      console.log('Google Sheets API not configured');
      return [];
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A:H`, // Assuming columns A to H contain the data
      });

      const rows = response.data.values || [];
      const leads: SheetLead[] = [];

      // Skip header row (index 0)
      for (let i = 1; i < rows.length; i++) {
        const lead = this.parseRowToLead(rows[i], sheetName);
        if (lead) {
          leads.push(lead);
        }
      }

      return leads;
    } catch (error) {
      console.error(`Error fetching data from sheet ${sheetName}:`, error);
      return [];
    }
  }

  async getAllLeadsFromSheets(): Promise<SheetLead[]> {
    if (!this.sheets) {
      console.log('Google Sheets API not configured');
      return [];
    }

    const sheetNames = ['Fiat', 'Peugeot']; // Add more sheet names as needed
    const allLeads: SheetLead[] = [];

    for (const sheetName of sheetNames) {
      try {
        const leads = await this.getSheetData(sheetName);
        allLeads.push(...leads);
        console.log(`Fetched ${leads.length} leads from ${sheetName} sheet`);
      } catch (error) {
        console.error(`Error fetching ${sheetName} sheet:`, error);
      }
    }

    return allLeads;
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
    } catch (error) {
      console.error('Error fetching sheet names:', error);
      return [];
    }
  }

  async startPeriodicSync(callback: (leads: SheetLead[]) => void) {
    if (!this.sheets) {
      console.log('Google Sheets API not configured, skipping periodic sync');
      return;
    }

    // Sync every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      console.log('Syncing data from Google Sheets...');
      try {
        const leads = await this.getAllLeadsFromSheets();
        callback(leads);
        console.log(`Synced ${leads.length} leads from Google Sheets`);
      } catch (error) {
        console.error('Error during periodic sync:', error);
      }
    });

    // Initial sync
    try {
      const leads = await this.getAllLeadsFromSheets();
      callback(leads);
      console.log(`Initial sync: ${leads.length} leads from Google Sheets`);
    } catch (error) {
      console.error('Error during initial sync:', error);
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
export type { SheetLead };