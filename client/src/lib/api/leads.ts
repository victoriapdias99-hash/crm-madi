export interface Lead {
  id: number;
  createdAt: string;

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
  status?: string;
}

export interface LeadFilters {
  fromDate?: string;
  toDate?: string;
  brandId?: number;
  clientId?: number;
  locationId?: number;
  status?: string;
  search?: string;
}

export interface ReassignLeadsPayload {
  leadIds: number[];
  newClientId: number;
  newLocationId: number;
}

import { Lead, LeadFilters, ReassignLeadsPayload } from "./leads-types";

const BASE_URL = "/api";

export async function fetchLeads(filters: LeadFilters): Promise<Lead[]> {
  const params = new URLSearchParams();

  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.brandId) params.set("brandId", String(filters.brandId));
  if (filters.clientId) params.set("clientId", String(filters.clientId));
  if (filters.locationId) params.set("locationId", String(filters.locationId));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);

  const res = await fetch(`${BASE_URL}/leads?${params.toString()}`);
  if (!res.ok) throw new Error("Error fetching leads");
  return res.json();
}

export async function reassignLeads(payload: ReassignLeadsPayload): Promise<void> {
  const res = await fetch(`${BASE_URL}/leads/reassign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Error reassigning leads");
}