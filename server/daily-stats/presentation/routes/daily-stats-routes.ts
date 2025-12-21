import { Router } from "express";
import { PostgresDailyLeadStatsRepository } from "../../infrastructure/repositories/PostgresDailyLeadStatsRepository";
import { GetDailyLeadStatsUseCase } from "../../application/use-cases/GetDailyLeadStatsUseCase";
import { DailyLeadStatsController } from "../controllers/DailyLeadStatsController";

export const dailyStatsRouter = Router();

const dailyStatsRepo = new PostgresDailyLeadStatsRepository(/* db */);
const getDailyLeadStatsUseCase = new GetDailyLeadStatsUseCase(dailyStatsRepo);
const dailyStatsController = new DailyLeadStatsController(
  getDailyLeadStatsUseCase
);

// GET /api/stats/leads-daily
dailyStatsRouter.get("/leads-daily", dailyStatsController.list);
