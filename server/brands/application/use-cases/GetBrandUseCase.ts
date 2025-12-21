import { IBrandRepository } from "../../domain/interfaces/IBrandRepository";
import { Brand } from "../../domain/entities/Brand";

export class GetBrandsUseCase {
  constructor(private brandRepo: IBrandRepository) {}

  async execute(): Promise<Brand[]> {
    return this.brandRepo.getAll();
  }
}
