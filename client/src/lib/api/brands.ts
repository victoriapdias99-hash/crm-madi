export interface Brand {
  id: number;
  name: string;
  country?: string;
  isActive: boolean;
}

export async function fetchBrands(): Promise<Brand[]> {
  const res = await fetch("/api/brands");
  if (!res.ok) throw new Error("Error fetching brands");
  return res.json();
}
