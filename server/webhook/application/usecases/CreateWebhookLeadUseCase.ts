import { IWebhookRepository } from '../../domain/interfaces/IWebhookRepository';
import { WebhookLead } from '../../domain/entities/WebhookLead';
import { CreateWebhookLeadDto } from '../dto/WebhookLeadDto';

/**
 * Caso de uso: Crear un lead desde webhook
 */
export class CreateWebhookLeadUseCase {
  constructor(private readonly repository: IWebhookRepository) {}

  async execute(dto: CreateWebhookLeadDto): Promise<WebhookLead> {
    // Normalizar teléfono
    const normalizedPhone = WebhookLead.normalizePhone(dto.telefono);

    // Crear entidad de dominio
    const leadData = new WebhookLead(
      0, // ID será asignado por la BD
      dto.nombre.trim(),
      normalizedPhone,
      dto.auto?.trim() || null,
      dto.localidad?.trim() || null,
      dto.comentarios?.trim() || null,
      dto.source || 'webhook'
    );

    // Validar entidad
    const validation = leadData.validate();
    if (!validation.valid) {
      throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
    }

    // Persistir en BD
    const savedLead = await this.repository.create(leadData);

    return savedLead;
  }
}
