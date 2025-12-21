import { IDailyLeadStatsRepository } from "../../domain/interfaces/IDailyLeadStatsRepository";
import { DailyLeadStatsFiltersDTO } from "../dto/DailyLeadStatsFiltersDTO";
import { DailyLeadStatsDTO } from "../dto/DailyLeadStatsDTO";

export class GetDailyLeadStatsUseCase {
  constructor(
    private dailyStatsRepo: IDailyLeadStatsRepository
  ) {}

  async execute(
    filters: DailyLeadStatsFiltersDTO
  ): Promise<DailyLeadStatsDTO[]> {
    const stats = await this.dailyStatsRepo.getDailyLeadStats(filters);

    // Mapear dominio → DTO (string en fecha)
    return stats.map((s) => ({
      fecha: s.fecha.toISOString().slice(0, 10), // "YYYY-MM-DD"
      cliente: s.cliente,
      localizacion: s.localizacion,
      marca: s.marca,
      conteoLeads: s.conteoLeads,
      totalLeads: s.totalLeads,
    }));
  }
}
