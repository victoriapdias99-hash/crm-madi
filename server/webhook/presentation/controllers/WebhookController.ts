import { Request, Response } from "express";
import { CreateWebhookLeadUseCase } from "../../application/usecases/CreateWebhookLeadUseCase";
import { CreateWebhookLeadDto } from "../../application/dto/WebhookLeadDto";
import { ZodError } from "zod";

/**
 * Controlador para endpoints de webhook
 */
export class WebhookController {
  // Modificamos el constructor para recibir también el repositorio
  // Usamos 'any' temporalmente para evitar conflictos de tipos rápidos
  constructor(
    private readonly createLeadUseCase: CreateWebhookLeadUseCase,
    private readonly repository: any,
  ) {}

  /**
   * POST /api/webhook/lead-webhook
   * Recibe un lead desde un webhook externo
   */
  async createLead(req: Request, res: Response): Promise<void> {
    try {
      //console.log("📨 Webhook lead-webhook recibido:", req.body);
      console.log("🔍 INSPECCIÓN DE JSON ENTRANTE:");
      console.log(JSON.stringify(req.body, null, 2));

      // Validar DTO con Zod
      const validatedData = CreateWebhookLeadDto.parse(req.body);

      // Ejecutar caso de uso
      const newLead = await this.createLeadUseCase.execute(validatedData);

      console.log("✅ Lead webhook guardado:", newLead.id);

      res.status(201).json({
        success: true,
        leadId: newLead.id,
        message: "Lead guardado exitosamente",
        data: {
          id: newLead.id,
          nombre: newLead.nombre,
          telefono: newLead.telefono,
          auto: newLead.auto,
          localidad: newLead.localidad,
          cliente: newLead.cliente, // Se muestra el cliente
          comentarios: newLead.comentarios,
          source: newLead.source,
          createdAt: newLead.createdAt,
          updatedAt: newLead.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error en webhook lead-webhook:", error);

      // Error de validación Zod
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: "Datos inválidos",
          details: error.errors,
        });
        return;
      }

      // Otros errores
      res.status(500).json({
        success: false,
        error: "Error al procesar webhook",
        message: error.message,
      });
    }
  }

  /**
   * GET /api/webhook/leads
   * Obtiene todos los leads de webhook
   */
  async getLeads(req: Request, res: Response): Promise<void> {
    try {
      console.log("🔄 Consultando base de datos de Webhooks...");

      // Intentamos obtener los leads usando el repositorio
      // ASUMIENDO que tu repositorio tiene un método llamado 'getAll' o 'findAll'
      let leads = [];

      if (typeof this.repository.getAll === "function") {
        leads = await this.repository.getAll();
      } else if (typeof this.repository.findAll === "function") {
        leads = await this.repository.findAll();
      } else {
        throw new Error(
          "El repositorio no tiene un método getAll() o findAll() implementado.",
        );
      }

      res.status(200).json({
        success: true,
        count: leads.length,
        data: leads,
      });
    } catch (error: any) {
      console.error("❌ Error al leer leads:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        hint: "Verifica que PostgresWebhookRepository tenga el método getAll()",
      });
    }
  }
}
