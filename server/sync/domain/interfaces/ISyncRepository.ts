import { SyncLead, ProcessedSyncLead } from '../entities/SyncLead';
import { SyncStatus } from '../entities/SyncResult';

/**
 * Interface para repositorio de sincronización
 * Define las operaciones de acceso a datos para el proceso de sync
 */
export interface ISyncRepository {
  // Operaciones con leads
  getLeads(options?: { limit?: number; offset?: number }): Promise<SyncLead[]>;
  createLead(lead: ProcessedSyncLead): Promise<SyncLead>;
  updateLead(metaLeadId: string, updates: Partial<SyncLead>): Promise<SyncLead>;
  findLeadByPhone(phone: string): Promise<SyncLead | null>;
  findLeadByMetaId(metaLeadId: string): Promise<SyncLead | null>;
  
  // Operaciones de sincronización masiva
  createLeadsBatch(leads: ProcessedSyncLead[]): Promise<number>;
  getLeadsCount(): Promise<number>;
  
  // Estado de sincronización
  getSyncStatus(): Promise<SyncStatus | null>;
  updateSyncStatus(status: Partial<SyncStatus>): Promise<void>;
  
  // Búsqueda de duplicados
  findDuplicatesByPhone(phones: string[]): Promise<SyncLead[]>;
  findDuplicatesByMetaId(metaIds: string[]): Promise<SyncLead[]>;
  
  // Limpieza de duplicados
  cleanDuplicatesForBrand?(marca: string): Promise<number>;
}