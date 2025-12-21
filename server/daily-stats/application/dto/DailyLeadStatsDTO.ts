export interface DailyLeadStatsDTO {
  fecha: string;          // ej: "2025-07-17"
  cliente: string;        // "Avec", "GIA Motors", etc.
  localizacion: string;   // "Amba", "Caba", etc.
  marca?: string;         // opcional: FIAT, Peugeot, Bike...
  conteoLeads: number;    // equivalente a columna "Conteo de leads" (L)
  totalLeads: number;     // equivalente a "TOTAL LEADS" (N)
}
