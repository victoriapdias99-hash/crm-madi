import { IDailyLeadStatsRepository } from "../../domain/interfaces/IDailyLeadStatsRepository";
import { DailyLeadStats } from "../../domain/entities/DailyLeadStats";
import { DailyLeadStatsFiltersDTO } from "../../application/dto/DailyLeadStatsFiltersDTO";

export class PostgresDailyLeadStatsRepository implements IDailyLeadStatsRepository {
  constructor(
    // private db: DrizzleClient
  ) {}

  async getDailyLeadStats(
    filters: DailyLeadStatsFiltersDTO
  ): Promise<DailyLeadStats[]> {
    // TODO: aquí irá el query tipo:
    // SELECT DATE(fecha) as fecha, cliente, localizacion, marca,
    //        COUNT(*) as conteoLeads,
    //        SUM(COUNT(*)) OVER (PARTITION BY cliente ORDER BY DATE(fecha)) as totalLeads
    // FROM leads
    // WHERE ...
    // GROUP BY ...
    throw new Error("Not implemented");
  }
}
