import { SyncController } from '../../presentation/controllers/SyncController';
import { SyncFullUseCase } from '../../application/usecases/SyncFullUseCase';
import { SyncIncrementalUseCase } from '../../application/usecases/SyncIncrementalUseCase';
import { SyncSpecificSheetsUseCase } from '../../application/usecases/SyncSpecificSheetsUseCase';
import { PostgresSyncRepository } from '../repositories/PostgresSyncRepository';
import { GoogleSheetsGateway } from '../gateways/GoogleSheetsGateway';
import { LeadProcessor } from '../../domain/services/LeadProcessor';
import { ClientMatcher } from '../../domain/services/ClientMatcher';

/**
 * Factory para crear instancias configuradas del sistema de sincronización
 * Implementa patrón Factory para inyección de dependencias
 */
export class SyncFactory {
  private static syncRepository: PostgresSyncRepository | null = null;
  private static sheetsGateway: GoogleSheetsGateway | null = null;
  private static leadProcessor: LeadProcessor | null = null;
  private static clientMatcher: ClientMatcher | null = null;

  /**
   * Crea y configura el controlador principal de sincronización
   */
  static createSyncController(): SyncController {
    const syncFullUseCase = this.createSyncFullUseCase();
    const syncIncrementalUseCase = this.createSyncIncrementalUseCase();
    const syncSpecificSheetsUseCase = this.createSyncSpecificSheetsUseCase();

    return new SyncController(
      syncFullUseCase,
      syncIncrementalUseCase,
      syncSpecificSheetsUseCase
    );
  }

  /**
   * Crea caso de uso para sincronización completa
   */
  static createSyncFullUseCase(): SyncFullUseCase {
    return new SyncFullUseCase(
      this.getSyncRepository(),
      this.getSheetsGateway(),
      this.getLeadProcessor(),
      this.getClientMatcher()
    );
  }

  /**
   * Crea caso de uso para sincronización incremental
   */
  static createSyncIncrementalUseCase(): SyncIncrementalUseCase {
    return new SyncIncrementalUseCase(
      this.getSyncRepository(),
      this.getSheetsGateway(),
      this.getLeadProcessor()
    );
  }

  /**
   * Crea caso de uso para sincronización de sheets específicos
   */
  static createSyncSpecificSheetsUseCase(): SyncSpecificSheetsUseCase {
    return new SyncSpecificSheetsUseCase(
      this.getSyncRepository(),
      this.getSheetsGateway(),
      this.getLeadProcessor(),
      this.getClientMatcher()
    );
  }

  // ========== SINGLETONS DE SERVICIOS ==========

  /**
   * Obtiene instancia singleton del repositorio
   */
  static getSyncRepository(): PostgresSyncRepository {
    if (!this.syncRepository) {
      this.syncRepository = new PostgresSyncRepository();
    }
    return this.syncRepository;
  }

  /**
   * Obtiene instancia singleton del gateway de Google Sheets
   */
  static getSheetsGateway(): GoogleSheetsGateway {
    if (!this.sheetsGateway) {
      this.sheetsGateway = new GoogleSheetsGateway();
    }
    return this.sheetsGateway;
  }

  /**
   * Obtiene instancia singleton del procesador de leads
   */
  static getLeadProcessor(): LeadProcessor {
    if (!this.leadProcessor) {
      this.leadProcessor = new LeadProcessor();
    }
    return this.leadProcessor;
  }


  /**
   * Obtiene instancia singleton del matcher de clientes
   */
  static getClientMatcher(): ClientMatcher {
    if (!this.clientMatcher) {
      this.clientMatcher = new ClientMatcher();
    }
    return this.clientMatcher;
  }

  /**
   * Resetea todas las instancias (útil para testing)
   */
  static resetInstances(): void {
    this.syncRepository = null;
    this.sheetsGateway = null;
    this.leadProcessor = null;
    this.clientMatcher = null;
  }
}