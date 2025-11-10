import { Request, Response } from 'express';
import { BatchResetUseCase } from '../../application/usecases/BatchResetUseCase';

export class BatchResetController {
  constructor(
    private readonly batchResetUseCase: BatchResetUseCase
  ) {}

  async execute(req: Request, res: Response): Promise<void> {
    try {
      const { beforeDate, afterDate, onlyFinished, dryRun } = req.query;

      const result = await this.batchResetUseCase.execute({
        beforeDate: beforeDate as string | undefined,
        afterDate: afterDate as string | undefined,
        onlyFinished: onlyFinished !== 'false',
        dryRun: dryRun === 'true',
      });

      const message = dryRun === 'true'
        ? `Dry run: Would reset ${result.totalCampaigns} campaigns with ${result.totalLeadsReset} total leads`
        : `Successfully reset ${result.successfulResets} campaigns with ${result.totalLeadsReset} total leads`;

      res.status(200).json({
        success: true,
        data: result,
        message,
      });

    } catch (error: any) {
      console.error('Error in BatchResetController:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
