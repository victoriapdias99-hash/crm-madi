import { ILeadRepository } from "../../domain/interfaces/ILeadRepository";
import { ReassignLeadsDTO } from "../dto/ReassignLeadsDTO";

export class ReassignLeadsUseCase {
  constructor(private leadRepo: ILeadRepository) {}

  async execute(payload: ReassignLeadsDTO): Promise<void> {
    const { leadIds, newClientId, newLocationId } = payload;
    // TODO: aquí se puede validar que el cliente y la zona existen
    await this.leadRepo.reassignLeads(leadIds, newClientId, newLocationId);
  }
}
