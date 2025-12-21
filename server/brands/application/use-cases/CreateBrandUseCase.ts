import { IBrandRepository } from "../../domain/interfaces/IBrandRepository";
import { Brand } from "../../domain/entities/Brand";

export class CreateBrandUseCase {
  constructor(private brandRepo: IBrandRepository) {}

  async execute(name: string, country?: string): Promise<Brand> {
    // TODO: validaciones (duplicados, etc.)
    return this.brandRepo.create(name, country);
  }
}
