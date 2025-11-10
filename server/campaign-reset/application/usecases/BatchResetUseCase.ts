import { ICampaignResetRepository } from '../../domain/interfaces/ICampaignResetRepository';
import { BatchResetResult, ResetResult } from '../../domain/entities/ResetResult';
import { BatchResetOptions } from '../dto/ResetOptions';

export class BatchResetUseCase {
  constructor(
    private readonly campaignResetRepository: ICampaignResetRepository
  ) {}

  async execute(options: BatchResetOptions): Promise<BatchResetResult> {
    const { beforeDate, afterDate, onlyFinished = true, dryRun = false } = options;

    try {
      // 1. Obtener campañas según filtros
      let campaigns = await this.campaignResetRepository.getFinishedCampaigns(
        beforeDate ? new Date(beforeDate) : undefined,
        afterDate ? new Date(afterDate) : undefined
      );

      if (campaigns.length === 0) {
        return {
          totalCampaigns: 0,
          successfulResets: 0,
          failedResets: 0,
          totalLeadsReset: 0,
          campaignsReopened: 0,
          results: [],
          errors: [],
        };
      }

      // 2. Para cada campaña, obtener conteo de leads
      const campaignsWithLeads = await Promise.all(
        campaigns.map(async (campaign) => {
          const leadsCount = await this.campaignResetRepository.getAssignedLeadsCount(campaign.id);
          return {
            ...campaign,
            leadsCount,
          };
        })
      );

      // Filtrar solo las que tienen leads si no es dry-run
      const campaignsToProcess = campaignsWithLeads.filter(c => c.leadsCount > 0 || dryRun);

      if (dryRun) {
        // En modo dry-run, solo retornar la información
        const results: ResetResult[] = campaignsToProcess.map(campaign => ({
          campaignId: campaign.id,
          campaignName: campaign.clienteNombre || '',
          campaignNumber: campaign.numeroCampana,
          leadsReset: campaign.leadsCount,
          fechaFinCleared: true,
          success: true,
        }));

        return {
          totalCampaigns: campaignsToProcess.length,
          successfulResets: 0,
          failedResets: 0,
          totalLeadsReset: campaignsToProcess.reduce((sum, c) => sum + c.leadsCount, 0),
          campaignsReopened: 0,
          results,
          errors: [],
        };
      }

      // 3. Ejecutar reset para cada campaña
      const results: ResetResult[] = [];
      const errors: Array<{ campaignId: number; error: string }> = [];
      let totalLeadsReset = 0;
      let successfulResets = 0;
      let failedResets = 0;
      let campaignsReopened = 0;

      for (const campaign of campaignsToProcess) {
        try {
          // Limpiar leads
          const leadsReset = await this.campaignResetRepository.clearCampaignLeads(campaign.id);

          // Limpiar fecha_fin
          await this.campaignResetRepository.clearCampaignEndDate(campaign.id);

          totalLeadsReset += leadsReset;
          successfulResets++;
          if (campaign.fechaFin) {
            campaignsReopened++;
          }

          results.push({
            campaignId: campaign.id,
            campaignName: campaign.clienteNombre || '',
            campaignNumber: campaign.numeroCampana,
            leadsReset,
            fechaFinCleared: true,
            success: true,
          });

        } catch (error: any) {
          failedResets++;
          errors.push({
            campaignId: campaign.id,
            error: error.message,
          });

          results.push({
            campaignId: campaign.id,
            campaignName: campaign.clienteNombre || '',
            campaignNumber: campaign.numeroCampana,
            leadsReset: 0,
            fechaFinCleared: false,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        totalCampaigns: campaignsToProcess.length,
        successfulResets,
        failedResets,
        totalLeadsReset,
        campaignsReopened,
        results,
        errors,
      };

    } catch (error: any) {
      throw new Error(`Batch reset failed: ${error.message}`);
    }
  }
}
