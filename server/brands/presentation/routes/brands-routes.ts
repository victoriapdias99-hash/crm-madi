import { Router } from "express";
import { PostgresBrandRepository } from "../../infrastructure/repositories/PostgresBrandRepository";
import { GetBrandsUseCase } from "../../application/use-cases/GetBrandUseCase";
import { CreateBrandUseCase } from "../../application/use-cases/CreateBrandUseCase";
import { BrandsController } from "../controllers/BrandController";

export const brandsRouter = Router();

const brandRepo = new PostgresBrandRepository(/* db */);
const getBrandsUseCase = new GetBrandsUseCase(brandRepo);
const createBrandUseCase = new CreateBrandUseCase(brandRepo);
const brandsController = new BrandsController(getBrandsUseCase, createBrandUseCase);

brandsRouter.get("/", brandsController.list);
brandsRouter.post("/", brandsController.create);
