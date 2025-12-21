export interface DailyLeadStatsFiltersDTO {
  fromDate?: Date;        // filtrar desde fecha
  toDate?: Date;          // hasta fecha
  clientId?: number;      // opcional, si ya tienes tabla de clientes
  brandId?: number;       // opcional, tabla de marcas
  localizacion?: string;  // Amba, Caba, etc.
}
