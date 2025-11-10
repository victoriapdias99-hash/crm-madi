import { PostgresPendingCampaignRepository } from '../repositories/PostgresPendingCampaignRepository';
import { GetPendingCampaignsUseCase } from '../../application/usecases/GetPendingCampaignsUseCase';
import { GetPendingCampaignByIdUseCase } from '../../application/usecases/GetPendingCampaignByIdUseCase';
import { GetPendingCampaignStatsUseCase } from '../../application/usecases/GetPendingCampaignStatsUseCase';

/**
 * Factory para crear instancias de use cases de campañas pendientes
 * Implementa patrón Singleton para reutilizar instancias
 */
export class PendingCampaignFactory {
  private static instance: PendingCampaignFactory;
  private repository: PostgresPendingCampaignRepository;

  private constructor() {
    console.log('🏭 [PendingCampaignFactory] Inicializando factory...');
    this.repository = new PostgresPendingCampaignRepository();
  }

  /**
   * Obtiene la instancia única del factory (Singleton)
   */
  static getInstance(): PendingCampaignFactory {
    if (!PendingCampaignFactory.instance) {
      PendingCampaignFactory.instance = new PendingCampaignFactory();
    }
    return PendingCampaignFactory.instance;
  }

  /**
   * Crea instancia de GetPendingCampaignsUseCase
   */
  getGetPendingCampaignsUseCase(): GetPendingCampaignsUseCase {
    return new GetPendingCampaignsUseCase(this.repository);
  }

  /**
   * Crea instancia de GetPendingCampaignByIdUseCase
   */
  getGetPendingCampaignByIdUseCase(): GetPendingCampaignByIdUseCase {
    return new GetPendingCampaignByIdUseCase(this.repository);
  }

  /**
   * Crea instancia de GetPendingCampaignStatsUseCase
   */
  getGetPendingCampaignStatsUseCase(): GetPendingCampaignStatsUseCase {
    return new GetPendingCampaignStatsUseCase(this.repository);
  }

  /**
   * Obtiene el repositorio (para casos especiales)
   */
  getRepository(): PostgresPendingCampaignRepository {
    return this.repository;
  }
}
