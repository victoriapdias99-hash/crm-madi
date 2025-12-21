import { IBrandRepository } from "../../domain/interfaces/IBrandRepository";
import { Brand } from "../../domain/entities/Brand";

export class PostgresBrandRepository implements IBrandRepository {
  constructor(/* private db: DrizzleClient */) {}

  async getAll(): Promise<Brand[]> {
    // TODO: select * from brands where isActive = true
    throw new Error("Not implemented");
  }

  async create(name: string, country?: string): Promise<Brand> {
    // TODO: insert brand
    throw new Error("Not implemented");
  }
}
