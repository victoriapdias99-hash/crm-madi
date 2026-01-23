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
   * Recibe un lead desde un webhook externo (Make, Postman, etc.)
   */
  async createLead(req: Request, res: Response): Promise<void> {
    try {
      console.log(
        "🔍 INSPECCIÓN DE JSON ENTRANTE:",
        JSON.stringify(req.body, null, 2),
      );

      // =================================================================
      // 1. NORMALIZACIÓN DE DATOS (El "Puente" para Make)
      // =================================================================
      const rawBody = req.body;

      // Aquí hacemos la "traducción" de campos para que no se pierdan
      const normalizedBody = {
        ...rawBody,

        // Si Make manda 'cliente', 'client' o 'nombreCliente', lo guardamos en 'cliente'
        cliente:
          rawBody.cliente || rawBody.client || rawBody.nombreCliente || "S/D",

        // Aseguramos que el teléfono sea string
        telefono: rawBody.telefono
          ? String(rawBody.telefono)
          : rawBody.phone
            ? String(rawBody.phone)
            : undefined,

        // Mapeo de modelo/auto
        auto: rawBody.auto || rawBody.modelo || rawBody.adName || "Desconocido",
      };

      console.log(
        "🛠️ Datos Normalizados:",
        JSON.stringify(normalizedBody, null, 2),
      );

      // =================================================================
      // 2. VALIDACIÓN CON ZOD
      // =================================================================
      // Ahora pasamos 'normalizedBody' en lugar de 'req.body'
      const validatedData = CreateWebhookLeadDto.parse(normalizedBody);

      // 3. Ejecutar caso de uso
      const newLead = await this.createLeadUseCase.execute(validatedData);

      console.log("✅ Lead webhook guardado con ID:", newLead.id);

      res.status(201).json({
        success: true,
        message: "Lead guardado exitosamente",
        leadId: newLead.id,
        data: {
          id: newLead.id,
          nombre: newLead.nombre,
          telefono: newLead.telefono,
          auto: newLead.auto,
          localidad: newLead.localidad,
          cliente: newLead.cliente, // ¡Ahora esto debería salir lleno!
          comentarios: newLead.comentarios,
          source: newLead.source,
          createdAt: newLead.createdAt,
          updatedAt: newLead.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error en webhook lead-webhook:", error);

      if (error instanceof ZodError) {
        // Log para ver qué campo exacto falló
        console.error(
          "🔍 Detalles de validación:",
          JSON.stringify(error.errors, null, 2),
        );

        res.status(400).json({
          success: false,
          error: "Datos inválidos según el esquema DTO",
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Error interno procesando webhook",
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
