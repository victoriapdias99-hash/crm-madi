import { PostgresFinishedCampaignRepository } from '../repositories/PostgresFinishedCampaignRepository';
import { FinishedCampaignService } from '../../domain/services/FinishedCampaignService';
import { FinishedCampaignEnrichmentService } from '../../domain/services/FinishedCampaignEnrichmentService';
import { GetFinishedCampaignsUseCase } from '../../application/usecases/GetFinishedCampaignsUseCase';
import { GetFinishedCampaignByIdUseCase } from '../../application/usecases/GetFinishedCampaignByIdUseCase';
import { GetFinishedCampaignStatsUseCase } from '../../application/usecases/GetFinishedCampaignStatsUseCase';
import { ReopenFinishedCampaignUseCase } from '../../application/usecases/ReopenFinishedCampaignUseCase';

/**
 * Factory para crear instancias del sistema de campañas finalizadas
 * Implementa el patrón Factory para centralizar la creación de objetos
 */
export class FinishedCampaignFactory {
  private static repository: PostgresFinishedCampaignRepository | null = null;
  private static service: FinishedCampaignService | null = null;
  private static enrichmentService: FinishedCampaignEnrichmentService | null = null;

  /**
   * Obtiene la instancia del repositorio (Singleton)
   */
  static getRepository(): PostgresFinishedCampaignRepository {
    if (!this.repository) {
      console.log('🏭 [FinishedCampaignFactory] Creando repositorio PostgreSQL...');
      this.repository = new PostgresFinishedCampaignRepository();
    }
    return this.repository;
  }

  /**
   * Obtiene la instancia del servicio de dominio (Singleton)
   */
  static getService(): FinishedCampaignService {
    if (!this.service) {
      console.log('🏭 [FinishedCampaignFactory] Creando servicio de dominio...');
      const repository = this.getRepository();
      this.service = new FinishedCampaignService(repository);
    }
    return this.service;
  }

  /**
   * Obtiene la instancia del servicio de enriquecimiento (Singleton)
   */
  static getEnrichmentService(): FinishedCampaignEnrichmentService {
    if (!this.enrichmentService) {
      console.log('🏭 [FinishedCampaignFactory] Creando servicio de enriquecimiento...');
      this.enrichmentService = new FinishedCampaignEnrichmentService();
    }
    return this.enrichmentService;
  }

  /**
   * Crea una instancia del caso de uso GetFinishedCampaigns
   */
  static createGetFinishedCampaignsUseCase(): GetFinishedCampaignsUseCase {
    const repository = this.getRepository();
    return new GetFinishedCampaignsUseCase(repository);
  }

  /**
   * Crea una instancia del caso de uso GetFinishedCampaignById
   */
  static createGetFinishedCampaignByIdUseCase(): GetFinishedCampaignByIdUseCase {
    const repository = this.getRepository();
    return new GetFinishedCampaignByIdUseCase(repository);
  }

  /**
   * Crea una instancia del caso de uso GetFinishedCampaignStats
   */
  static createGetFinishedCampaignStatsUseCase(): GetFinishedCampaignStatsUseCase {
    const repository = this.getRepository();
    return new GetFinishedCampaignStatsUseCase(repository);
  }

  /**
   * Crea una instancia del caso de uso ReopenFinishedCampaign
   */
  static createReopenFinishedCampaignUseCase(): ReopenFinishedCampaignUseCase {
    const repository = this.getRepository();
    return new ReopenFinishedCampaignUseCase(repository);
  }

  /**
   * Resetea todas las instancias (útil para testing)
   */
  static reset(): void {
    this.repository = null;
    this.service = null;
    this.enrichmentService = null;
    console.log('🔄 [FinishedCampaignFactory] Instancias reseteadas');
  }
}
