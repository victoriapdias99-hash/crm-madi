import { DailyLeadStats } from "../entities/DailyLeadStats";
import { DailyLeadStatsFiltersDTO } from "../../application/dto/DailyLeadStatsFiltersDTO";

export interface IDailyLeadStatsRepository {
  getDailyLeadStats(
    filters: DailyLeadStatsFiltersDTO
  ): Promise<DailyLeadStats[]>;
}
