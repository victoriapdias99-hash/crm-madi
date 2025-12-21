import { ManychatLeadDTO } from "../dto/ManychatLeadDTO";
import { ILeadRepository } from "../../domain/interfaces/ILeadRepository";
import { Lead } from "../../domain/entities/Lead";

export class IntakeManychatLeadUseCase {
  constructor(private leadRepo: ILeadRepository) {}

  async execute(payload: ManychatLeadDTO): Promise<Lead> {
    // TODO: aquí más adelante podemos:
    // - normalizar marca/zona
    // - mapear palabras clave a brandId/locationId
    return this.leadRepo.intakeFromManychat(payload);
  }
}
