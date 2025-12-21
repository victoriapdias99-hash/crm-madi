export interface Lead {
  id: number;

  clientId: number | null;
  brandId: number | null;
  locationId: number | null;

  firstName: string;
  lastName?: string;
  phone: string;
  comment?: string;

  createdAt: Date;
  status: "new" | "assigned" | "reassigned" | "discarded";
}
