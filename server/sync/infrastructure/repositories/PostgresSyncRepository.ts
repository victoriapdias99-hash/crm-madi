import { ISyncRepository } from '../../domain/interfaces/ISyncRepository';
import { SyncLead, ProcessedSyncLead } from '../../domain/entities/SyncLead';
import { SyncStatus } from '../../domain/entities/SyncResult';

/**
 * Implementación de repositorio para PostgreSQL usando el storage existente
 * Actúa como adaptador para mantener compatibilidad con el sistema actual
 */
export class PostgresSyncRepository implements ISyncRepository {
  private storage: any;

  constructor() {
    // Importación dinámica para evitar dependencias circulares
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      const { storage } = await import('../../../storage');
      this.storage = storage;
    } catch (error) {
      console.error('Error initializing storage for sync repository:', error);
      throw new Error('Failed to initialize sync repository');
    }
  }

  async getLeads(options?: { limit?: number; offset?: number }): Promise<SyncLead[]> {
    await this.ensureStorageInitialized();
    
    try {
      const leads = await this.storage.getLeads({
        limit: options?.limit || 1000,
        offset: options?.offset || 0
      });

      // Mapear desde el formato del storage al formato de SyncLead
      return leads.map(this.mapStorageLeadToSyncLead);
    } catch (error) {
      console.error('Error getting leads from repository:', error);
      return [];
    }
  }

  async createLead(lead: ProcessedSyncLead): Promise<SyncLead> {
    await this.ensureStorageInitialized();
    
    try {
      const storageLeadData = this.mapSyncLeadToStorageFormat(lead);
      const createdLead = await this.storage.createLead(storageLeadData);
      return this.mapStorageLeadToSyncLead(createdLead);
    } catch (error) {
      console.error('Error creating lead in repository:', error);
      throw new Error(`Failed to create lead: ${error.message}`);
    }
  }

  async updateLead(metaLeadId: string, updates: Partial<SyncLead>): Promise<SyncLead> {
    await this.ensureStorageInitialized();
    
    try {
      // Buscar el lead por metaLeadId primero
      const existingLead = await this.findLeadByMetaId(metaLeadId);
      if (!existingLead) {
        throw new Error(`Lead with metaLeadId ${metaLeadId} not found`);
      }

      // El storage actual no tiene un update directo, así que usamos el ID interno
      // Esto requeriría modificar el storage o usar una aproximación diferente
      throw new Error('Lead update not implemented in current storage');
    } catch (error) {
      console.error('Error updating lead in repository:', error);
      throw error;
    }
  }

  async findLeadByPhone(phone: string): Promise<SyncLead | null> {
    await this.ensureStorageInitialized();
    
    try {
      const leads = await this.storage.getLeads({ limit: 10000 });
      const matchingLead = leads.find(lead => 
        lead.phone === phone || 
        this.normalizePhone(lead.phone || '') === this.normalizePhone(phone)
      );
      
      return matchingLead ? this.mapStorageLeadToSyncLead(matchingLead) : null;
    } catch (error) {
      console.error('Error finding lead by phone:', error);
      return null;
    }
  }

  async findLeadByMetaId(metaLeadId: string): Promise<SyncLead | null> {
    await this.ensureStorageInitialized();
    
    try {
      const leads = await this.storage.getLeads({ limit: 10000 });
      const matchingLead = leads.find(lead => lead.metaLeadId === metaLeadId);
      
      return matchingLead ? this.mapStorageLeadToSyncLead(matchingLead) : null;
    } catch (error) {
      console.error('Error finding lead by metaId:', error);
      return null;
    }
  }

  async createLeadsBatch(leads: ProcessedSyncLead[]): Promise<number> {
    await this.ensureStorageInitialized();
    
    try {
      let createdCount = 0;
      
      // Procesar en lotes para mejor performance
      const batchSize = 50;
      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        
        for (const lead of batch) {
          try {
            await this.createLead(lead);
            createdCount++;
          } catch (error) {
            console.warn(`Failed to create lead ${lead.metaLeadId}:`, error.message);
          }
        }
      }
      
      return createdCount;
    } catch (error) {
      console.error('Error creating leads batch:', error);
      throw new Error(`Failed to create leads batch: ${error.message}`);
    }
  }

  async getLeadsCount(): Promise<number> {
    await this.ensureStorageInitialized();
    
    try {
      const leads = await this.storage.getLeads({ limit: 1 });
      // El storage actual no tiene un count directo, así que esta es una aproximación
      return leads.length > 0 ? 10000 : 0; // Placeholder - necesitaría implementación real
    } catch (error) {
      console.error('Error getting leads count:', error);
      return 0;
    }
  }

  async getSyncStatus(): Promise<SyncStatus | null> {
    await this.ensureStorageInitialized();
    
    try {
      // El storage actual no maneja estado de sync, así que devolvemos null
      // En una implementación real, esto estaría en una tabla de sync_status
      return null;
    } catch (error) {
      console.error('Error getting sync status:', error);
      return null;
    }
  }

  async updateSyncStatus(status: Partial<SyncStatus>): Promise<void> {
    await this.ensureStorageInitialized();
    
    try {
      // El storage actual no maneja estado de sync
      // En una implementación real, esto actualizaría la tabla sync_status
      console.log('Sync status update:', status);
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }

  async findDuplicatesByPhone(phones: string[]): Promise<SyncLead[]> {
    await this.ensureStorageInitialized();
    
    try {
      const normalizedPhones = phones.map(p => this.normalizePhone(p));
      const leads = await this.storage.getLeads({ limit: 10000 });
      
      const duplicates = leads.filter(lead => {
        const leadPhone = this.normalizePhone(lead.phone || '');
        return normalizedPhones.includes(leadPhone);
      });
      
      return duplicates.map(this.mapStorageLeadToSyncLead);
    } catch (error) {
      console.error('Error finding duplicates by phone:', error);
      return [];
    }
  }

  async findDuplicatesByMetaId(metaIds: string[]): Promise<SyncLead[]> {
    await this.ensureStorageInitialized();
    
    try {
      const leads = await this.storage.getLeads({ limit: 10000 });
      
      const duplicates = leads.filter(lead => 
        metaIds.includes(lead.metaLeadId || '')
      );
      
      return duplicates.map(this.mapStorageLeadToSyncLead);
    } catch (error) {
      console.error('Error finding duplicates by metaId:', error);
      return [];
    }
  }

  // ========== MÉTODOS PRIVADOS DE MAPPING ==========

  private mapStorageLeadToSyncLead(storageLead: any): SyncLead {
    return {
      metaLeadId: storageLead.metaLeadId || '',
      nombre: storageLead.firstName || '',
      telefono: storageLead.phone || '',
      email: storageLead.email || '',
      ciudad: storageLead.city || '',
      marca: storageLead.campaignName || '',
      origen: storageLead.origen || '',
      localizacion: storageLead.localizacion || '',
      cliente: storageLead.cliente || '',
      fechaCreacion: storageLead.leadDate ? storageLead.leadDate.toISOString() : new Date().toISOString(),
      source: storageLead.source || 'google_sheets',
      campaign: storageLead.campaignName || ''
    };
  }

  private mapSyncLeadToStorageFormat(syncLead: ProcessedSyncLead): any {
    return {
      metaLeadId: syncLead.metaLeadId,
      firstName: syncLead.nombre,
      lastName: '', // El storage requiere lastName pero no lo usamos en sync
      phone: syncLead.telefono,
      email: syncLead.email,
      city: syncLead.ciudad,
      campaignName: syncLead.marca,
      origen: syncLead.origen,
      localizacion: syncLead.localizacion,
      cliente: syncLead.cliente,
      source: syncLead.source,
      status: 'new',
      leadDate: new Date(syncLead.fechaCreacion)
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  private async ensureStorageInitialized(): Promise<void> {
    if (!this.storage) {
      await this.initializeStorage();
    }
  }
}