export interface DailyLeadStats {
  fecha: Date;
  cliente: string;
  localizacion: string;
  marca?: string;
  conteoLeads: number;
  totalLeads: number;
}
