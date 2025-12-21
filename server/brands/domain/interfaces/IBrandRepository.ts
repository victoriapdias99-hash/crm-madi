import { Brand } from "../entities/Brand";

export interface IBrandRepository {
  getAll(): Promise<Brand[]>;
  create(name: string, country?: string): Promise<Brand>;
}
