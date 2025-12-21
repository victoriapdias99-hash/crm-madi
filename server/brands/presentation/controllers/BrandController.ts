import { Request, Response } from "express";
import { GetBrandsUseCase } from "../../application/use-cases/GetBrandsUseCase";
import { CreateBrandUseCase } from "../../application/use-cases/CreateBrandUseCase";

export class BrandsController {
  constructor(
    private getBrandsUseCase: GetBrandsUseCase,
    private createBrandUseCase: CreateBrandUseCase
  ) {}

  list = async (_req: Request, res: Response) => {
    try {
      const brands = await this.getBrandsUseCase.execute();
      return res.json(brands);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error fetching brands" });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { name, country } = req.body as { name: string; country?: string };
      // TODO: validaciones
      const brand = await this.createBrandUseCase.execute(name, country);
      return res.status(201).json(brand);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error creating brand" });
    }
  };
}
