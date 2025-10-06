import { WebhookLead } from '../entities/WebhookLead';

/**
 * Interfaz del repositorio para persistir leads de webhook
 */
export interface IWebhookRepository {
  /**
   * Crea un nuevo lead desde webhook
   */
  create(lead: Omit<WebhookLead, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookLead>;

  /**
   * Obtiene un lead por ID
   */
  findById(id: number): Promise<WebhookLead | null>;

  /**
   * Obtiene todos los leads de webhook con paginación
   */
  findAll(options?: {
    limit?: number;
    offset?: number;
    source?: string;
  }): Promise<WebhookLead[]>;

  /**
   * Cuenta el total de leads por fuente
   */
  countBySource(source?: string): Promise<number>;
}
