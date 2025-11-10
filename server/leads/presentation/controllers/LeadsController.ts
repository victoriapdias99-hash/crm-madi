import { Request, Response } from 'express';
import { GetSentLeadsByCampaignUseCase } from '../../application/use-cases/GetSentLeadsByCampaignUseCase';

/**
 * Controlador HTTP para endpoints relacionados con leads
 *
 * RESPONSABILIDAD:
 * - Manejar requests HTTP del endpoint /api/leads/sent-by-campaign/:campaignId
 * - Validar parámetros de entrada (campaignId debe ser número válido)
 * - Delegar lógica de negocio al Use Case correspondiente
 * - Formatear respuestas HTTP (success 200, error 400/500)
 * - Manejar errores y retornar mensajes apropiados al cliente
 *
 * ARQUITECTURA:
 * - Capa de Presentación (Presentation Layer)
 * - Patrón: Controller (MVC pattern)
 * - Principio: Thin controllers - solo maneja HTTP, no contiene lógica de negocio
 *
 * FLUJO DE DATOS:
 * Cliente HTTP → Express Router → LeadsController → GetSentLeadsByCampaignUseCase → Repository → DB
 *                                                                                                  ↓
 * Cliente HTTP ← Express Router ← LeadsController ← GetSentLeadsByCampaignUseCase ← Repository ← DB
 */
export class LeadsController {
  private getSentLeadsUseCase: GetSentLeadsByCampaignUseCase;

  constructor() {
    // Inicializar Use Case para obtener leads enviados
    // El controller no maneja lógica de negocio, solo delega
    this.getSentLeadsUseCase = new GetSentLeadsByCampaignUseCase();
  }

  /**
   * Handler para GET /api/leads/sent-by-campaign/:campaignId
   *
   * PROPÓSITO:
   * - Obtener el listado completo de leads enviados para una campaña específica
   * - Incluye metadata de campaña (nombre, cliente, marca, zona, total)
   * - Retorna todos los leads con información detallada (nombre, teléfono, email, etc.)
   *
   * VALIDACIONES:
   * - campaignId debe ser un número válido
   * - Retorna 400 (Bad Request) si el ID es inválido
   *
   * LÓGICA DE NEGOCIO (delegada al Use Case):
   * 1. Campañas FINALIZADAS: Busca leads por campaign_id
   * 2. Campañas EN PROCESO: Busca leads por filtros (marca, cliente, zona, fechas)
   *
   * RESPUESTAS:
   * - 200: Éxito - retorna { campaignId, campaignName, clientName, marca, zona, totalSent, leads[] }
   * - 400: Bad Request - campaignId inválido
   * - 500: Internal Server Error - error en BD o lógica interna
   *
   * EJEMPLO DE REQUEST:
   * GET http://localhost:5000/api/leads/sent-by-campaign/38
   *
   * EJEMPLO DE RESPUESTA:
   * {
   *   "campaignId": 38,
   *   "campaignName": "Campaña #1",
   *   "clientName": "Giorgi automotores",
   *   "marca": "Ford",
   *   "zona": "Santa Fe",
   *   "totalSent": 44,
   *   "leads": [
   *     {
   *       "id": 123,
   *       "metaLeadId": "FORD_20250815_54932882",
   *       "nombre": "Juan Pérez",
   *       "telefono": "+5491112345678",
   *       "email": "juan@example.com",
   *       "ciudad": "Rosario",
   *       "modelo": "Ranger",
   *       "marca": "Ford",
   *       "campaign": "Ford",
   *       "origen": null,
   *       "localizacion": "Santa Fe",
   *       "cliente": "giorgi_automotores",
   *       "fechaCreacion": "2025-08-15T10:30:00Z",
   *       "sentAt": "2025-08-15T10:30:00Z"
   *     },
   *     ...
   *   ]
   * }
   *
   * @param req - Express Request con params.campaignId
   * @param res - Express Response para enviar respuesta HTTP
   */
  async getSentLeadsByCampaign(req: Request, res: Response): Promise<void> {
    try {
      // 1. Extraer y validar parámetro campaignId
      const campaignId = parseInt(req.params.campaignId);

      // 2. Validar que campaignId sea un número válido
      if (isNaN(campaignId)) {
        res.status(400).json({
          error: 'Invalid campaign ID',
          message: 'Campaign ID must be a valid number'
        });
        return;
      }

      // 3. Delegar lógica de negocio al Use Case
      // El controller NO conoce detalles de BD ni filtros
      const result = await this.getSentLeadsUseCase.execute(campaignId);

      // 4. Retornar respuesta exitosa (200 OK)
      res.status(200).json(result);
    } catch (error: any) {
      // 5. Manejar errores y retornar respuesta apropiada (500 Internal Server Error)
      console.error(`Error getting sent leads for campaign:`, error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'Failed to retrieve sent leads'
      });
    }
  }
}
