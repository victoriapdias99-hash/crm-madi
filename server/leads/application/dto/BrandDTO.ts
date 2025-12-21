export interface BrandDTO {
  id: number;
  name: string;        // FIAT, Peugeot, Bike...
  country?: string;    // opcional
  isActive: boolean;
}
