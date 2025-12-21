import { Request, Response } from "express";
import { IntakeManychatLeadUseCase } from "../../application/use-cases/IntakeManychatLeadUseCase";
import { ManychatLeadDTO } from "../../application/dto/ManychatLeadDTO";

export class ManychatLeadController {
  constructor(private intakeUseCase: IntakeManychatLeadUseCase) {}

  handle = async (req: Request, res: Response) => {
    try {
      const payload = req.body as Partial<ManychatLeadDTO>;
      // TODO: validar payload (zod, etc.)

      const lead = await this.intakeUseCase.execute(payload as ManychatLeadDTO);
      return res.status(201).json(lead);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Error processing lead" });
    }
  };
}
