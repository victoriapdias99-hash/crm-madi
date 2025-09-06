import { ICampaignRepository } from '../../domain/interfaces/ICampaignRepository';
import { ILeadRepository } from '../../domain/interfaces/ILeadRepository';
import { CampaignClosureUseCase } from '../../application/usecases/CampaignClosureUseCase';
import { CampaignProcessor } from '../../domain/services/CampaignProcessor';
import { PostgresCampaignRepository } from '../repositories/PostgresCampaignRepository';
import { PostgresLeadRepository } from '../repositories/PostgresLeadRepository';

/**
 * Factory para crear instancias del sistema de cierre de campañas
 * Siguiendo el patrón del sistema de sync para configuración y dependency injection
 */
export class ClosureFactory {
  private static instance: ClosureFactory;
  private campaignRepository?: ICampaignRepository;
  private leadRepository?: ILeadRepository;
  private campaignClosureUseCase?: CampaignClosureUseCase;
  private campaignProcessor?: CampaignProcessor;

  private constructor() {}

  /**
   * Obtiene la instancia singleton del factory
   */
  public static getInstance(): ClosureFactory {
    if (!ClosureFactory.instance) {
      ClosureFactory.instance = new ClosureFactory();
    }
    return ClosureFactory.instance;
  }

  /**
   * Obtiene el repositorio de campañas
   */
  public getCampaignRepository(): ICampaignRepository {
    if (!this.campaignRepository) {
      this.campaignRepository = new PostgresCampaignRepository();
      console.log('🏭 Campaign Repository initialized');
    }
    return this.campaignRepository;
  }

  /**
   * Obtiene el repositorio de leads
   */
  public getLeadRepository(): ILeadRepository {
    if (!this.leadRepository) {
      this.leadRepository = new PostgresLeadRepository();
      console.log('🏭 Lead Repository initialized');
    }
    return this.leadRepository;
  }

  /**
   * Obtiene el procesador de campañas
   */
  public getCampaignProcessor(): CampaignProcessor {
    if (!this.campaignProcessor) {
      const campaignRepo = this.getCampaignRepository();
      const leadRepo = this.getLeadRepository();
      
      this.campaignProcessor = new CampaignProcessor(campaignRepo, leadRepo);
      console.log('🏭 Campaign Processor initialized');
    }
    return this.campaignProcessor;
  }

  /**
   * Obtiene el caso de uso de cierre de campañas
   */
  public getCampaignClosureUseCase(): CampaignClosureUseCase {
    if (!this.campaignClosureUseCase) {
      const campaignRepo = this.getCampaignRepository();
      const leadRepo = this.getLeadRepository();
      
      this.campaignClosureUseCase = new CampaignClosureUseCase(campaignRepo, leadRepo);
      console.log('🏭 Campaign Closure Use Case initialized');
    }
    return this.campaignClosureUseCase;
  }

  /**
   * Reinicia todas las instancias (útil para testing)
   */
  public reset(): void {
    this.campaignRepository = undefined;
    this.leadRepository = undefined;
    this.campaignClosureUseCase = undefined;
    console.log('🏭 Factory reset completed');
  }

  /**
   * Verifica el estado de inicialización del factory
   */
  public getStatus(): {
    campaignRepositoryInitialized: boolean;
    leadRepositoryInitialized: boolean;
    useCaseInitialized: boolean;
  } {
    return {
      campaignRepositoryInitialized: !!this.campaignRepository,
      leadRepositoryInitialized: !!this.leadRepository,
      useCaseInitialized: !!this.campaignClosureUseCase
    };
  }

  /**
   * Inicializa todas las dependencias de una vez
   */
  public async initializeAll(): Promise<void> {
    console.log('🏭 Initializing all campaign closure dependencies...');
    
    try {
      this.getCampaignRepository();
      this.getLeadRepository();
      this.getCampaignClosureUseCase();
      
      console.log('🏭 ✅ All campaign closure dependencies initialized successfully');
    } catch (error: any) {
      console.error('🏭 ❌ Error initializing campaign closure dependencies:', error);
      throw new Error(`Factory initialization failed: ${error.message}`);
    }
  }
}