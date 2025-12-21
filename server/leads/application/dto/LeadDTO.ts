export interface LeadDTO {
  id: number;
  createdAt: Date;

  // Relaciones
  clientId: number | null;
  clientName?: string;
  brandId: number | null;
  brandName?: string;
  locationId: number | null;
  locationName?: string;

  firstName: string;
  lastName?: string;
  phone: string;
  comment?: string;

  // Campos de control
  status?: "new" | "assigned" | "reassigned" | "discarded";
}
