import { Request, Response } from 'express';
import { CreateWebhookLeadUseCase } from '../../application/usecases/CreateWebhookLeadUseCase';
import { CreateWebhookLeadDto } from '../../application/dto/WebhookLeadDto';
import { ZodError } from 'zod';

/**
 * Controlador para endpoints de webhook
 */
export class WebhookController {
  constructor(private readonly createLeadUseCase: CreateWebhookLeadUseCase) {}

  /**
   * POST /api/webhook/lead-webhook
   * Recibe un lead desde un webhook externo
   */
  async createLead(req: Request, res: Response): Promise<void> {
    try {
      console.log('📨 Webhook lead-webhook recibido:', req.body);

      // Validar DTO con Zod
      const validatedData = CreateWebhookLeadDto.parse(req.body);

      // Ejecutar caso de uso
      const newLead = await this.createLeadUseCase.execute(validatedData);

      console.log('✅ Lead webhook guardado:', newLead.id);

      res.status(201).json({
        success: true,
        leadId: newLead.id,
        message: 'Lead guardado exitosamente',
        data: {
          id: newLead.id,
          nombre: newLead.nombre,
          telefono: newLead.telefono,
          auto: newLead.auto,
          localidad: newLead.localidad,
          comentarios: newLead.comentarios,
          source: newLead.source,
          createdAt: newLead.createdAt,
          updatedAt: newLead.updatedAt
        }
      });
    } catch (error: any) {
      console.error('❌ Error en webhook lead-webhook:', error);

      // Error de validación Zod
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Datos inválidos',
          details: error.errors
        });
        return;
      }

      // Otros errores
      res.status(500).json({
        success: false,
        error: 'Error al procesar webhook',
        message: error.message
      });
    }
  }

  /**
   * GET /api/webhook/leads
   * Obtiene todos los leads de webhook con paginación
   */
  async getLeads(req: Request, res: Response): Promise<void> {
    try {
      // Implementar si se necesita consultar leads
      res.status(200).json({
        success: true,
        message: 'Endpoint no implementado aún'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
