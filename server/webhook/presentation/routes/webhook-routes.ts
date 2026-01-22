import { Express } from "express";
import { WebhookController } from "../controllers/WebhookController";
import { CreateWebhookLeadUseCase } from "../../application/usecases/CreateWebhookLeadUseCase";
import { PostgresWebhookRepository } from "../../infrastructure/repositories/PostgresWebhookRepository";

/**
 * Registra las rutas del sistema de webhooks
 */
export function registerWebhookRoutes(app: Express): void {
  console.log("🔄 Registrando rutas del sistema de webhooks (Módulo Local)...");

  // Inicializar dependencias
  // Ahora sí estamos instanciando las clases NUEVAS que editamos
  const repository = new PostgresWebhookRepository();
  const createLeadUseCase = new CreateWebhookLeadUseCase(repository);
  const controller = new WebhookController(createLeadUseCase, repository); 

  // Rutas
  app.post("/api/webhook/lead-webhook", (req, res) => {
    console.log("👉 Ruta /lead-webhook golpeada. Delegando al controlador...");
    controller.createLead(req, res);
  });

  app.get("/api/webhook/leads", (req, res) => controller.getLeads(req, res));

  // Nuevas rutas CRM
  app.get("/api/webhook/leads-crm", (req, res) => controller.getLeadsCRM(req, res));
  app.patch("/api/webhook/leads/:id/crm", (req, res) => controller.updateLeadCRM(req, res));
  app.get("/api/webhook/leads-kanban", (req, res) => controller.getKanbanData(req, res));

  console.log("✅ Rutas del sistema de webhooks registradas correctamente.");
}
