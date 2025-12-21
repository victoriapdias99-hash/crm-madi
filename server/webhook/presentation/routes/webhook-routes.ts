import { Express } from "express";
import { WebhookController } from "../controllers/WebhookController";
import { CreateWebhookLeadUseCase } from "../../application/usecases/CreateWebhookLeadUseCase";
import { PostgresWebhookRepository } from "../../infrastructure/repositories/PostgresWebhookRepository";

/**
 * Registra las rutas del sistema de webhooks
 */
export function registerWebhookRoutes(app: Express): void {
  console.log("🔄 Registrando rutas del sistema de webhooks...");

  // Inicializar dependencias (Inyección de dependencias)
  const repository = new PostgresWebhookRepository();
  const createLeadUseCase = new CreateWebhookLeadUseCase(repository);
  const controller = new WebhookController(createLeadUseCase, repository);

  // Rutas
  app.post("/api/webhook/lead-webhook", (req, res) =>
    controller.createLead(req, res),
  );
  app.get("/api/webhook/leads", (req, res) => controller.getLeads(req, res));

  console.log("✅ Rutas del sistema de webhooks registradas:");
  console.log("   POST /api/webhook/lead-webhook");
  console.log("   GET  /api/webhook/leads");
}
