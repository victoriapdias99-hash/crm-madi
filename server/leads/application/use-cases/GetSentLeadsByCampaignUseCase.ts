import { PostgresLeadsQueryRepository } from '../../infrastructure/repositories/PostgresLeadsQueryRepository';

/**
 * DTO (Data Transfer Object) para un lead enviado
 * Estructura de datos que se retorna al cliente
 */
export interface SentLeadDTO {
  id: number;                    // ID único del lead en la BD
  metaLeadId: string;           // ID único compuesto (ej: FORD_20250815_54932882)
  nombre: string;               // Nombre del contacto
  telefono: string;             // Teléfono normalizado (+54...)
  email: string | null;         // Email (opcional)
  ciudad: string | null;        // Ciudad (opcional)
  modelo: string | null;        // Modelo de vehículo (opcional)
  marca: string;                // Marca del vehículo (FORD, TOYOTA, etc.)
  campaign: string;             // Campaña de origen (ej: "Ford")
  origen: string | null;        // Origen del lead (opcional)
  localizacion: string | null;  // Localización (Pais, Amba, etc.)
  cliente: string | null;       // Cliente normalizado (ej: "giorgi_automotores")
  fechaCreacion: Date;          // Fecha de creación del lead
  sentAt: Date;                 // Fecha de envío (updatedAt o fechaCreacion)
}

/**
 * DTO de respuesta para listado de leads por campaña
 * Incluye metadata de la campaña + listado completo de leads
 */
export interface SentLeadsByCampaignResponse {
  campaignId: number;           // ID de la campaña consultada
  campaignName: string | null;  // Nombre de la campaña (ej: "Campaña #1")
  clientName: string | null;    // Nombre del cliente (ej: "Giorgi automotores")
  marca: string | null;         // Marca principal de la campaña
  marca2: string | null;        // Segunda marca (para campañas multimarca)
  marca3: string | null;        // Tercera marca (para campañas multimarca)
  marca4: string | null;        // Cuarta marca (para campañas multimarca)
  marca5: string | null;        // Quinta marca (para campañas multimarca)
  zona: string | null;          // Zona de la campaña (Santa Fe, AMBA, etc.)
  totalSent: number;            // Total de leads en el listado
  leads: SentLeadDTO[];         // Array con todos los leads
}

/**
 * Caso de uso: Obtener leads enviados de una campaña
 *
 * RESPONSABILIDAD:
 * - Orquesta la lógica de negocio para obtener leads enviados
 * - Delega la consulta al repositorio PostgresLeadsQueryRepository
 * - Actúa como capa de aplicación entre el controlador y el repositorio
 *
 * FLUJO DE DATOS:
 * Cliente HTTP → LeadsController → GetSentLeadsByCampaignUseCase → PostgresLeadsQueryRepository → DB
 *                                                                                                    ↓
 * Cliente HTTP ← LeadsController ← GetSentLeadsByCampaignUseCase ← PostgresLeadsQueryRepository ← DB
 *
 * USO:
 * const useCase = new GetSentLeadsByCampaignUseCase();
 * const response = await useCase.execute(38);
 * // response: { campaignId: 38, totalSent: 44, leads: [...] }
 *
 * ARQUITECTURA:
 * - Capa de Aplicación (Application Layer)
 * - Patrón: Use Case / Interactor
 * - Principio: Single Responsibility - solo orquesta, no contiene lógica de BD
 */
export class GetSentLeadsByCampaignUseCase {
  private repository: PostgresLeadsQueryRepository;

  constructor() {
    this.repository = new PostgresLeadsQueryRepository();
  }

  /**
   * Ejecuta el caso de uso: obtener leads enviados de una campaña
   *
   * @param campaignId - ID de la campaña a consultar
   * @returns Promesa con respuesta que incluye metadata y listado de leads
   *
   * EJEMPLO:
   * const response = await execute(38);
   * // {
   * //   campaignId: 38,
   * //   campaignName: "Campaña #1",
   * //   clientName: "Giorgi automotores",
   * //   marca: "Ford",
   * //   zona: "Santa Fe",
   * //   totalSent: 44,
   * //   leads: [
   * //     { id: 1, nombre: "Juan Pérez", telefono: "+5491112345678", ... },
   * //     { id: 2, nombre: "María García", telefono: "+5491123456789", ... },
   * //     ...
   * //   ]
   * // }
   */
  async execute(campaignId: number): Promise<SentLeadsByCampaignResponse> {
    return await this.repository.getSentLeadsByCampaign(campaignId);
  }
}
