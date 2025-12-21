import { ILeadRepository } from "../../domain/interfaces/ILeadRepository";
import { LeadFiltersDTO } from "../dto/LeadFiltersDTO";
import { Lead } from "../../domain/entities/Lead";

export class GetLeadsUseCase {
  constructor(private leadRepo: ILeadRepository) {}

  async execute(filters: LeadFiltersDTO): Promise<Lead[]> {
    return this.leadRepo.getLeads(filters);
  }
}
