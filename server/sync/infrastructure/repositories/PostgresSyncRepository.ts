import { ISyncRepository } from '../../domain/interfaces/ISyncRepository';
import { SyncLead, ProcessedSyncLead } from '../../domain/entities/SyncLead';
import { SyncStatus } from '../../domain/entities/SyncResult';
import { db } from '../../../db';
import { opLead, insertOpLeadSchema, InsertOpLead } from '@shared/schema';
import { sql } from 'drizzle-orm';

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
    try {
      // Obtener leads de la nueva tabla op_lead
      const leads = await db.select()
        .from(opLead)
        .limit(options?.limit || 1000)
        .offset(options?.offset || 0)
        .orderBy(sql`${opLead.createdAt} DESC`);

      // Mapear desde el formato de op_lead al formato de SyncLead
      return leads.map(this.mapOpLeadToSyncLead);
    } catch (error) {
      console.error('Error getting leads from op_lead table:', error);
      return [];
    }
  }

  async createLead(lead: ProcessedSyncLead): Promise<SyncLead> {
    try {
      // 🚨 LOG 4: Antes de insertar en BD
      console.log(`💾 BEFORE INSERT: lead.cliente="${lead.cliente}" (${typeof lead.cliente}) | lead.normalizedClient="${lead.normalizedClient}" (${typeof lead.normalizedClient})`);
      
      // Mapear ProcessedSyncLead a InsertOpLead
      const opLeadData: InsertOpLead = {
        metaLeadId: lead.metaLeadId,
        nombre: lead.nombre,
        telefono: lead.normalizedPhone || lead.telefono,
        email: lead.normalizedEmail || lead.email || null,
        ciudad: lead.ciudad || null,
        origen: lead.origen || null,
        localizacion: lead.localizacion || null,
        cliente: lead.normalizedClient || lead.cliente || null,
        marca: lead.marca,
        campaign: lead.campaign,
        googleSheetsRowNumber: lead.googleSheetsRowNumber || null,
        fechaCreacion: new Date(lead.fechaCreacion),
        source: 'google_sheets'
      };
      
      // Insertar en la nueva tabla op_lead
      const result = await db.insert(opLead).values(opLeadData).returning();
      const createdOpLead = result[0];
      
      // Mapear de vuelta a SyncLead
      return this.mapOpLeadToSyncLead(createdOpLead);
    } catch (error: any) {
      console.error('Error creating lead in op_lead table:', error);
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
      const matchingLead = leads.find((lead: any) => 
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
      const matchingLead = leads.find((lead: any) => lead.metaLeadId === metaLeadId);
      
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
          } catch (error: any) {
            console.warn(`Failed to create lead ${lead.metaLeadId}:`, error.message);
          }
        }
      }
      
      return createdCount;
    } catch (error: any) {
      console.error('Error creating leads batch:', error);
      throw new Error(`Failed to create leads batch: ${error.message}`);
    }
  }

  async getLeadsCount(): Promise<number> {
    try {
      // Contar leads en la nueva tabla op_lead
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(opLead);
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting op_lead count:', error);
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
      
      const duplicates = leads.filter((lead: any) => {
        const leadPhone = this.normalizePhone(lead.phone || '');
        return normalizedPhones.includes(leadPhone);
      });
      
      return duplicates.map((lead: any) => this.mapStorageLeadToSyncLead(lead));
    } catch (error) {
      console.error('Error finding duplicates by phone:', error);
      return [];
    }
  }

  async findDuplicatesByMetaId(metaIds: string[]): Promise<SyncLead[]> {
    try {
      // Buscar en la nueva tabla op_lead por metaLeadId
      const duplicates = await db.select()
        .from(opLead)
        .where(sql`${opLead.metaLeadId} IN ${sql.raw(`(${metaIds.map(id => `'${id}'`).join(', ')})`)}`);
      
      return duplicates.map(this.mapOpLeadToSyncLead);
    } catch (error) {
      console.error('Error finding duplicates by metaId in op_lead:', error);
      return [];
    }
  }

  /**
   * Busca duplicados por marca y número de fila de Google Sheets
   * Esto evita reinsertar leads de la misma fila de la misma hoja
   */
  async findDuplicatesByRowNumber(marca: string, googleSheetsRowNumbers: number[]): Promise<SyncLead[]> {
    try {
      if (!marca || googleSheetsRowNumbers.length === 0) {
        return [];
      }

      // Buscar en la tabla op_lead por marca y googleSheetsRowNumber
      const duplicates = await db.select()
        .from(opLead)
        .where(sql`${opLead.marca} = ${marca.toUpperCase()} AND ${opLead.googleSheetsRowNumber} IN ${sql.raw(`(${googleSheetsRowNumbers.join(', ')})`)}`);      
      
      console.log(`🔍 Encontrados ${duplicates.length} duplicados por fila para marca ${marca}: filas [${googleSheetsRowNumbers.join(', ')}]`);
      return duplicates.map(this.mapOpLeadToSyncLead);
    } catch (error) {
      console.error(`Error finding duplicates by row number for ${marca}:`, error);
      return [];
    }
  }

  /**
   * Obtiene el último número de fila procesado para una marca específica
   * Usado para sincronización incremental - solo procesar filas nuevas
   */
  async getLastProcessedRowByBrand(marca: string): Promise<number> {
    try {
      if (!marca) {
        return 0;
      }

      const result = await db.select({ maxRow: sql<number>`MAX(${opLead.googleSheetsRowNumber})` })
        .from(opLead)
        .where(sql`${opLead.marca} = ${marca.toUpperCase()} AND ${opLead.googleSheetsRowNumber} IS NOT NULL`);
      
      const maxRow = result[0]?.maxRow || 0;
      console.log(`🔢 Última fila procesada para ${marca}: ${maxRow}`);
      return maxRow;
    } catch (error) {
      console.error(`Error getting last processed row for brand ${marca}:`, error);
      return 0;
    }
  }

  /**
   * Limpia duplicados para una marca específica basado en marca + google_sheets_row_number
   * Mantiene solo el registro más reciente para cada combinación única
   */
  async cleanDuplicatesForBrand(marca: string): Promise<number> {
    try {
      if (!marca) {
        console.log('⚠️ No se puede limpiar duplicados: marca vacía');
        return 0;
      }

      const normalizedBrand = marca.toUpperCase();
      
      // Buscar duplicados: más de 1 registro con la misma marca + google_sheets_row_number
      const duplicateRows = await db.select({
        marca: opLead.marca,
        googleSheetsRowNumber: opLead.googleSheetsRowNumber,
        count: sql<number>`COUNT(*) as count`,
        minId: sql<number>`MIN(${opLead.id}) as min_id`
      })
      .from(opLead)
      .where(sql`${opLead.marca} = ${normalizedBrand} AND ${opLead.googleSheetsRowNumber} IS NOT NULL`)
      .groupBy(opLead.marca, opLead.googleSheetsRowNumber)
      .having(sql`COUNT(*) > 1`);
      
      if (duplicateRows.length === 0) {
        console.log(`✅ ${marca}: No hay duplicados para limpiar`);
        return 0;
      }
      
      console.log(`🧽 ${marca}: Encontrados ${duplicateRows.length} grupos de duplicados`);
      
      let totalDeleted = 0;
      
      // Para cada grupo de duplicados, eliminar todos excepto el más reciente (ID mayor)
      for (const duplicateGroup of duplicateRows) {
        const { googleSheetsRowNumber } = duplicateGroup;
        
        // Obtener todos los IDs del grupo ordenados por ID descendente (más reciente primero)
        const groupRecords = await db.select({ id: opLead.id })
          .from(opLead)
          .where(sql`${opLead.marca} = ${normalizedBrand} AND ${opLead.googleSheetsRowNumber} = ${googleSheetsRowNumber}`)
          .orderBy(sql`${opLead.id} DESC`);
        
        // Mantener el primero (más reciente) y eliminar los demás
        const idsToDelete = groupRecords.slice(1).map(record => record.id);
        
        if (idsToDelete.length > 0) {
          const deleteResult = await db.delete(opLead)
            .where(sql`${opLead.id} IN ${sql.raw(`(${idsToDelete.join(', ')})`)}`)
            .returning({ deletedId: opLead.id });
          
          const deletedCount = deleteResult.length;
          totalDeleted += deletedCount;
          
          console.log(`🗑️ ${marca} fila ${googleSheetsRowNumber}: Eliminados ${deletedCount} duplicados, mantenido ID ${groupRecords[0].id}`);
        }
      }
      
      console.log(`✨ ${marca}: Limpieza completada - ${totalDeleted} duplicados eliminados`);
      return totalDeleted;
      
    } catch (error) {
      console.error(`Error cleaning duplicates for brand ${marca}:`, error);
      return 0;
    }
  }

  /**
   * Obtiene todos los leads existentes con googleSheetsRowNumber para una marca específica
   * Útil para detección rápida de duplicados antes de la sincronización
   */
  async getExistingLeadsByBrand(marca: string): Promise<SyncLead[]> {
    try {
      if (!marca) {
        return [];
      }

      const existingLeads = await db.select()
        .from(opLead)
        .where(sql`${opLead.marca} = ${marca.toUpperCase()} AND ${opLead.googleSheetsRowNumber} IS NOT NULL`)
        .orderBy(sql`${opLead.googleSheetsRowNumber} ASC`);
      
      console.log(`📊 Encontrados ${existingLeads.length} leads existentes con googleSheetsRowNumber para marca ${marca}`);
      return existingLeads.map(this.mapOpLeadToSyncLead);
    } catch (error) {
      console.error(`Error getting existing leads by brand ${marca}:`, error);
      return [];
    }
  }

  /**
   * Obtiene solo los números de fila de Google Sheets para una marca específica
   * Usado para verificación de integridad - detectar gaps en la secuencia
   */
  async getGoogleSheetsRowNumbers(marca: string): Promise<number[]> {
    try {
      if (!marca) {
        return [];
      }

      const result = await db.select({ 
        rowNumber: opLead.googleSheetsRowNumber 
      })
        .from(opLead)
        .where(sql`${opLead.marca} = ${marca.toUpperCase()} AND ${opLead.googleSheetsRowNumber} IS NOT NULL`)
        .orderBy(sql`${opLead.googleSheetsRowNumber} ASC`);
      
      const rowNumbers = result
        .map(row => row.rowNumber)
        .filter(row => row !== null && row !== undefined) as number[];
        
      console.log(`🔍 ${marca}: ${rowNumbers.length} filas en BD, rango: ${rowNumbers[0] || 0}-${rowNumbers[rowNumbers.length - 1] || 0}`);
      return rowNumbers;
    } catch (error) {
      console.error(`Error getting Google Sheets row numbers for ${marca}:`, error);
      return [];
    }
  }

  // ========== MÉTODOS PRIVADOS DE MAPPING ==========

  private mapOpLeadToSyncLead(opLeadData: any): SyncLead {
    return {
      metaLeadId: opLeadData.metaLeadId,
      nombre: opLeadData.nombre,
      telefono: opLeadData.telefono,
      email: opLeadData.email || '',
      ciudad: opLeadData.ciudad || '',
      modelo: opLeadData.modelo || '',
      comentarioHorario: opLeadData.comentarioHorario || '',
      marca: opLeadData.marca,
      origen: opLeadData.origen || '',
      localizacion: opLeadData.localizacion || '',
      cliente: opLeadData.cliente || '',
      googleSheetsRowNumber: opLeadData.googleSheetsRowNumber,
      fechaCreacion: opLeadData.fechaCreacion.toISOString(),
      source: opLeadData.source,
      campaign: opLeadData.campaign
    };
  }

  private mapStorageLeadToSyncLead(storageLead: any): SyncLead {
    return {
      metaLeadId: storageLead.metaLeadId || '',
      nombre: storageLead.firstName || '',
      telefono: storageLead.phone || '',
      email: storageLead.email || '',
      ciudad: storageLead.city || '',
      modelo: storageLead.modelo || '',
      comentarioHorario: storageLead.comentarioHorario || '',
      marca: storageLead.campaignName || '',
      origen: storageLead.origen || '',
      localizacion: storageLead.localizacion || '',
      cliente: storageLead.cliente || '',
      googleSheetsRowNumber: storageLead.googleSheetsRowNumber,
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