import { Request, Response } from 'express';
import { ResetCampaignUseCase } from '../../application/usecases/ResetCampaignUseCase';

export class ResetCampaignController {
  constructor(
    private readonly resetCampaignUseCase: ResetCampaignUseCase
  ) {}

  async execute(req: Request, res: Response): Promise<void> {
    try {
      const { campaignId } = req.params;
      const { dryRun } = req.query;

      if (!campaignId) {
        res.status(400).json({
          success: false,
          error: 'Campaign ID is required',
        });
        return;
      }

      const result = await this.resetCampaignUseCase.execute({
        campaignId: parseInt(campaignId),
        dryRun: dryRun === 'true',
      });

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
        message: dryRun === 'true'
          ? `Dry run: Would reset ${result.leadsReset} leads and ${result.fechaFinCleared ? 'clear' : 'not clear'} fecha_fin`
          : `Successfully reset ${result.leadsReset} leads and ${result.fechaFinCleared ? 'cleared' : 'did not clear'} fecha_fin`,
      });

    } catch (error: any) {
      console.error('Error in ResetCampaignController:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
