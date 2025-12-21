import { Request, Response } from "express";
import { GetDailyLeadStatsUseCase } from "../../application/use-cases/GetDailyLeadStatsUseCase";
import { DailyLeadStatsFiltersDTO } from "../../application/dto/DailyLeadStatsFiltersDTO";

export class DailyLeadStatsController {
  constructor(
    private getDailyLeadStatsUseCase: GetDailyLeadStatsUseCase
  ) {}

  list = async (req: Request, res: Response) => {
    try {
      const filters: DailyLeadStatsFiltersDTO = {
        fromDate: req.query.fromDate
          ? new Date(String(req.query.fromDate))
          : undefined,
        toDate: req.query.toDate
          ? new Date(String(req.query.toDate))
          : undefined,
        clientId: req.query.clientId
          ? Number(req.query.clientId)
          : undefined,
        brandId: req.query.brandId
          ? Number(req.query.brandId)
          : undefined,
        localizacion: req.query.localizacion
          ? String(req.query.localizacion)
          : undefined,
      };

      const stats = await this.getDailyLeadStatsUseCase.execute(filters);
      return res.json(stats);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error fetching daily stats" });
    }
  };
}
