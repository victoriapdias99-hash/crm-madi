import { Lead } from "../entities/Lead";
import { ManychatLeadDTO } from "../../application/dto/ManychatLeadDTO";
import { LeadFiltersDTO } from "../../application/dto/LeadFiltersDTO";

export interface ILeadRepository {
  intakeFromManychat(payload: ManychatLeadDTO): Promise<Lead>;

  getLeads(filters: LeadFiltersDTO): Promise<Lead[]>;

  reassignLeads(
    leadIds: number[],
    newClientId: number,
    newLocationId: number
  ): Promise<void>;
}
