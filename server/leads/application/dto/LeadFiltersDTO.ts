export interface LeadFiltersDTO {
  fromDate?: Date;
  toDate?: Date;
  brandId?: number;
  clientId?: number;
  locationId?: number;
  status?: string;
  search?: string; // búsqueda por nombre/teléfono
}
