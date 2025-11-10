import { ICampaignResetRepository } from '../../domain/interfaces/ICampaignResetRepository';
import { ResetResult } from '../../domain/entities/ResetResult';
import { ResetCampaignOptions } from '../dto/ResetOptions';

export class ResetCampaignUseCase {
  constructor(
    private readonly campaignResetRepository: ICampaignResetRepository
  ) {}

  async execute(options: ResetCampaignOptions): Promise<ResetResult> {
    const { campaignId, dryRun = false } = options;

    if (!campaignId) {
      throw new Error('Campaign ID is required');
    }

    try {
      // 1. Obtener conteo de leads asignados
      const leadsCount = await this.campaignResetRepository.getAssignedLeadsCount(campaignId);

      // 2. Verificar si está finalizada
      const isFinished = await this.campaignResetRepository.isCampaignFinished(campaignId);

      // En modo dry-run, solo retornar la información
      if (dryRun) {
        return {
          campaignId,
          campaignName: '', // Se llenará en el controller
          campaignNumber: 0,
          leadsReset: leadsCount,
          fechaFinCleared: isFinished,
          success: true,
        };
      }

      // 3. Limpiar leads asignados
      const leadsReset = await this.campaignResetRepository.clearCampaignLeads(campaignId);

      // 4. Limpiar fecha_fin si existe
      let fechaFinCleared = false;
      if (isFinished) {
        await this.campaignResetRepository.clearCampaignEndDate(campaignId);
        fechaFinCleared = true;
      }

      return {
        campaignId,
        campaignName: '',
        campaignNumber: 0,
        leadsReset,
        fechaFinCleared,
        success: true,
      };

    } catch (error: any) {
      return {
        campaignId,
        campaignName: '',
        campaignNumber: 0,
        leadsReset: 0,
        fechaFinCleared: false,
        success: false,
        error: error.message,
      };
    }
  }
}
