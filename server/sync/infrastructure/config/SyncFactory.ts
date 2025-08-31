import { SyncController } from '../../presentation/controllers/SyncController';
import { SyncSmartUseCase } from '../../application/usecases/SyncSmartUseCase';
import { PostgresSyncRepository } from '../repositories/PostgresSyncRepository';
import { GoogleSheetsGateway } from '../gateways/GoogleSheetsGateway';
import { LeadProcessor } from '../../domain/services/LeadProcessor';
import { ClientMatcher } from '../../domain/services/ClientMatcher';

/**
 * Factory simplificado para crear instancias del sistema de sincronización inteligente
 */
export class SyncFactory {
  private static syncRepository: PostgresSyncRepository | null = null;
  private static sheetsGateway: GoogleSheetsGateway | null = null;
  private static leadProcessor: LeadProcessor | null = null;
  private static clientMatcher: ClientMatcher | null = null;

  /**
   * Crea y configura el controlador de sincronización
   */
  static createSyncController(): SyncController {
    const syncSmartUseCase = this.createSyncSmartUseCase();
    const sheetsGateway = this.getSheetsGateway();

    return new SyncController(
      syncSmartUseCase,
      sheetsGateway
    );
  }

  /**
   * Crea caso de uso para sincronización inteligente
   */
  static createSyncSmartUseCase(): SyncSmartUseCase {
    return new SyncSmartUseCase(
      this.getSyncRepository(),
      this.getSheetsGateway(),
      this.getLeadProcessor()
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