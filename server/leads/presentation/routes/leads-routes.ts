import { Router } from 'express';
import { LeadsController } from '../controllers/LeadsController';

/**
 * Router de Express para endpoints de leads
 *
 * RESPONSABILIDAD:
 * - Definir rutas HTTP para operaciones relacionadas con leads
 * - Mapear rutas a métodos del LeadsController
 * - Exponer endpoint público: GET /api/leads/sent-by-campaign/:campaignId
 *
 * ARQUITECTURA:
 * - Capa de Presentación (Presentation Layer)
 * - Patrón: Router (Express.js pattern)
 * - Este archivo se monta en /api/leads en el servidor principal (server/index.ts)
 *
 * ENDPOINTS DISPONIBLES:
 * - GET /api/leads/sent-by-campaign/:campaignId - Listado de leads enviados por campaña
 *
 * USO EN SERVIDOR PRINCIPAL:
 * import { leadsRoutes } from './leads/presentation/routes/leads-routes';
 * app.use('/api/leads', leadsRoutes);
 *
 * EJEMPLO DE LLAMADA:
 * GET http://localhost:5000/api/leads/sent-by-campaign/38
 * Respuesta: { campaignId: 38, totalSent: 44, leads: [...] }
 */

const router = Router();
const leadsController = new LeadsController();

/**
 * GET /api/leads/sent-by-campaign/:campaignId
 *
 * PROPÓSITO:
 * Obtener el listado completo de leads enviados para una campaña específica
 *
 * PARÁMETROS:
 * - campaignId (path param): ID numérico de la campaña a consultar
 *
 * LÓGICA:
 * 1. Campañas FINALIZADAS (con fecha_fin):
 *    - Busca leads directamente por campaign_id = X
 *    - Retorna solo leads asignados a esa campaña
 *
 * 2. Campañas EN PROCESO (sin fecha_fin):
 *    - Busca leads usando filtros múltiples (marca, cliente, zona, fechas)
 *    - Incluye leads asignados (campaign_id = X) + disponibles (campaign_id IS NULL)
 *    - Usa normalización centralizada de cliente: "Giorgi automotores" → "giorgi_automotores"
 *    - Aplica filtro multi-marca si la campaña tiene varias marcas configuradas
 *
 * RESPUESTA EXITOSA (200):
 * {
 *   campaignId: number,           // ID de la campaña consultada
 *   campaignName: string,          // Nombre de la campaña (ej: "Campaña #1")
 *   clientName: string,            // Nombre del cliente (ej: "Giorgi automotores")
 *   marca: string,                 // Marca principal de la campaña
 *   zona: string,                  // Zona de la campaña (Santa Fe, AMBA, etc.)
 *   totalSent: number,             // Total de leads en el listado
 *   leads: Array<{                 // Array con todos los leads
 *     id: number,                  // ID único del lead en la BD
 *     metaLeadId: string,          // ID único compuesto (ej: FORD_20250815_54932882)
 *     nombre: string,              // Nombre del contacto
 *     telefono: string,            // Teléfono normalizado (+54...)
 *     email: string | null,        // Email (opcional)
 *     ciudad: string | null,       // Ciudad (opcional)
 *     modelo: string | null,       // Modelo de vehículo (opcional)
 *     marca: string,               // Marca del vehículo (FORD, TOYOTA, etc.)
 *     campaign: string,            // Campaña de origen
 *     origen: string | null,       // Origen del lead (opcional)
 *     localizacion: string | null, // Localización (Pais, Amba, etc.)
 *     cliente: string | null,      // Cliente normalizado (ej: "giorgi_automotores")
 *     fechaCreacion: Date,         // Fecha de creación del lead
 *     sentAt: Date                 // Fecha de envío (updatedAt o fechaCreacion)
 *   }>
 * }
 *
 * ERRORES POSIBLES:
 * - 400 Bad Request: campaignId no es un número válido
 * - 500 Internal Server Error: error en BD o lógica interna
 *
 * EJEMPLO:
 * GET http://localhost:5000/api/leads/sent-by-campaign/38
 * → Retorna todos los leads enviados de la campaña #38 (Giorgi Automotores #1)
 */
router.get('/sent-by-campaign/:campaignId', (req, res) =>
  leadsController.getSentLeadsByCampaign(req, res)
);

export { router as leadsRoutes };
