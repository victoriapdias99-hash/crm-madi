// Tipos compartidos para las funciones de API de Leads

// Representa un lead retornado por el backend
export interface Lead {
  id: number;
  fecha: string;             // ISO date string
  nombre: string;
  telefono: string;
  localidad: string;
  modelo: string;
  horarioComentarios: string;
  origen: string;
  localizacion: string;
  cliente: string;

  // Campos derivados del CRM (si luego los agregamos)
  clientId?: number | null;
  locationId?: number | null;
  brandId?: number | null;
}

// Filtros utilizados en la pantalla de "Leads"
export interface LeadFilters {
  fromDate?: string;       // YYYY-MM-DD
  toDate?: string;         // YYYY-MM-DD
  clientId?: number;
  brandId?: number;
  locationId?: number;
  search?: string;
}

// Payload usado para reasignar leads
export interface ReassignLeadsPayload {
  leadIds: number[];       // IDs seleccionados en la tabla
  newClientId: number;     // ID del cliente destino
  newLocationId: number;   // ID de la localidad destino
}
