import { sql, eq, and, ilike, isNull, desc, asc, inArray } from 'drizzle-orm';
import { AvailableLead } from '../../domain/entities/CampaignClosure';
import { ILeadRepository } from '../../domain/interfaces/ILeadRepository';
import { opLeadsRep, opLead } from '@shared/schema';
import { normalizeClientName } from '../../../../shared/utils/client-normalization';
import { createMultiBrandCondition } from '../../../../shared/utils/multi-brand-utils';

/**
 * Implementación PostgreSQL del repositorio de leads
 * Maneja operaciones con op_lead (writes) y op_leads_rep (reads optimizados)
 */
export class PostgresLeadRepository implements ILeadRepository {
  private db: any;

  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    try {
      const { db } = await import('../../../db');
      this.db = db;
    } catch (error) {
      console.error('Error initializing database for lead repository:', error);
      throw new Error('Failed to initialize lead repository');
    }
  }

  private async ensureDbInitialized() {
    if (!this.db) {
      await this.initializeDb();
    }
  }

  /**
   * Obtiene leads únicos disponibles para un cliente específico (usando op_leads_rep)
   * NUEVO: Retorna leads únicos con sus duplicate_ids para asignación precisa
   */
  async getAvailableLeadsForClient(clientName: string, brandName: string, zone: string): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();

    try {
      // Normalizar nombres para matching
      const normalizedClient = normalizeClientName(clientName);
      const normalizedZone = this.normalizeZoneName(zone);

      console.log(`🔍 ⏱️ [TIMING] Iniciando búsqueda de leads desde op_leads_rep: cliente=${normalizedClient}, marca=${brandName}, zona=${normalizedZone}`);

      // ✅ USAR FUNCIÓN CENTRALIZADA para condición de marca
      const brandsInfo = [{ marca: brandName, porcentaje: 100 }];
      const multiBrandCondition = createMultiBrandCondition(brandsInfo, opLeadsRep.campaign);

      // NUEVA LÓGICA: Buscar desde op_leads_rep para obtener leads únicos con duplicate_ids
      // CORREGIDO: Solo buscar leads que NO estén asignados (campaignId IS NULL)
      const uniqueLeads = await this.db
        .select()
        .from(opLeadsRep)
        .where(
          and(
            isNull(opLeadsRep.campaignId), // CRÍTICO: Solo leads no asignados
            multiBrandCondition,           // ✅ Usar función centralizada
            eq(opLeadsRep.cliente, normalizedClient),  // ✅ Comparación exacta
            eq(opLeadsRep.localizacion, normalizedZone) // ✅ Comparación exacta
          )
        )
        .orderBy(asc(opLeadsRep.fechaCreacion));

      console.log(`📊 ⏱️ [TIMING] Query completado - ${uniqueLeads.length} leads encontrados`);
      
      // Filtrar solo los que no tienen ninguno de sus duplicados asignados
      const availableUniqueLeads: any[] = [];
      
      for (const uniqueLead of uniqueLeads) {
        // Verificar si alguno de los duplicados ya está asignado
        const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
        
        const assignedCount = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(opLead)
          .where(
            and(
              inArray(opLead.id, duplicateIds),
              sql`${opLead.campaignId} IS NOT NULL`
            )
          );

        const alreadyAssigned = assignedCount[0]?.count || 0;
        
        if (alreadyAssigned === 0) {
          // Ningún duplicado está asignado, incluir este lead único
          availableUniqueLeads.push({
            ...this.mapOpLeadRepToAvailableLead(uniqueLead),
            duplicateIds: duplicateIds
          });
        }
      }

      console.log(`📊 Leads únicos disponibles (sin duplicados asignados): ${availableUniqueLeads.length}`);

      return availableUniqueLeads;
    } catch (error: any) {
      console.error(`Error getting available unique leads for ${clientName}:`, error);
      throw new Error(`Failed to get available unique leads: ${error.message}`);
    }
  }

  /**
   * Cuenta leads únicos disponibles para un cliente específico (usando op_leads_rep)
   */
  async countUniqueLeadsForClient(clientName: string, brandName: string, zone: string): Promise<number> {
    await this.ensureDbInitialized();
    
    try {

      
      const normalizedClient = normalizeClientName(clientName);
      const normalizedBrand = brandName?.toLowerCase() || '';
      const normalizedZone = this.normalizeZoneName(zone);

      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLead)
        .where(
          and(
            ilike(opLead.marca, `%${normalizedBrand}%`),
            ilike(opLead.cliente, `%${normalizedClient}%`),
            ilike(opLead.localizacion, `%${normalizedZone}%`),
            isNull(opLead.campaignId) // Solo leads NO asignados
          )
        );

      const count = result[0]?.count || 0;
      console.log(`📊 Leads disponibles (no asignados): ${count} para ${clientName} (${brandName}, ${zone})`);
      
      return count;
    } catch (error: any) {
      console.error(`Error counting leads for ${clientName}:`, error);
      return 0;
    }
  }

  /**
   * Asigna leads únicos a una campaña usando duplicate_ids para consistencia total
   * Nuevo parámetro: uniqueLeadsWithDuplicates[] contiene {id, duplicateIds}
   */
  async assignLeadsToCampaign(uniqueLeadsWithDuplicates: any[], campaignId: number): Promise<number> {
    await this.ensureDbInitialized();
    
    try {
      if (uniqueLeadsWithDuplicates.length === 0) {
        return 0;
      }

      // Extraer todos los duplicate_ids de los leads únicos seleccionados
      const allDuplicateIds: number[] = [];
      for (const uniqueLead of uniqueLeadsWithDuplicates) {
        const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
        allDuplicateIds.push(...duplicateIds);
      }

      console.log(`🎯 Asignando ${uniqueLeadsWithDuplicates.length} leads únicos (${allDuplicateIds.length} duplicados totales) a campaña ${campaignId}`);

      // Si hay demasiados IDs, procesar en lotes para evitar queries muy grandes
      const batchSize = 1000;
      let totalUpdated = 0;
      
      for (let i = 0; i < allDuplicateIds.length; i += batchSize) {
        const batch = allDuplicateIds.slice(i, i + batchSize);
        console.log(`⚙️ Procesando lote ${Math.floor(i/batchSize) + 1}: ${batch.length} leads...`);
        
        try {
          // Actualizar campaign_id para este lote de duplicados
          await this.db
            .update(opLead)
            .set({ 
              campaignId: campaignId,
              updatedAt: new Date()
            })
            .where(inArray(opLead.id, batch));
            
          totalUpdated += batch.length;
          console.log(`✅ Lote procesado: ${batch.length} leads asignados (total: ${totalUpdated}/${allDuplicateIds.length})`);
        } catch (batchError: any) {
          console.error(`❌ Error en lote ${Math.floor(i/batchSize) + 1}:`, batchError);
          throw batchError;
        }
      }

      console.log(`✅ Leads asignados exitosamente: ${uniqueLeadsWithDuplicates.length} únicos → ${totalUpdated} duplicados a campaña ${campaignId}`);
      
      return totalUpdated;
    } catch (error: any) {
      console.error(`Error assigning unique leads to campaign ${campaignId}:`, error);
      throw new Error(`Failed to assign unique leads: ${error.message}`);
    }
  }

  /**
   * Obtiene leads asignados a una campaña
   */
  async getLeadsAssignedToCampaign(campaignId: number): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();
    
    try {

      
      const leads = await this.db
        .select()
        .from(opLead)
        .where(eq(opLead.campaignId, campaignId))
        .orderBy(asc(opLead.fechaCreacion));

      console.log(`📋 Leads asignados a campaña ${campaignId}: ${leads.length}`);

      return leads.map(this.mapOpLeadToAvailableLead);
    } catch (error: any) {
      console.error(`Error getting leads for campaign ${campaignId}:`, error);
      throw new Error(`Failed to get assigned leads: ${error.message}`);
    }
  }

  /**
   * Cuenta leads YA asignados a una campaña específica
   */
  async countAssignedLeadsForCampaign(campaignId: number): Promise<number> {
    await this.ensureDbInitialized();
    
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLead)
        .where(eq(opLead.campaignId, campaignId));

      const count = result[0]?.count || 0;
      console.log(`📊 Leads ya asignados a campaña ${campaignId}: ${count}`);
      
      return count;
    } catch (error: any) {
      console.error(`Error counting assigned leads for campaign ${campaignId}:`, error);
      return 0;
    }
  }

  /**
   * Verifica si un lead ya está asignado a alguna campaña
   */
  async isLeadAssigned(leadId: number): Promise<boolean> {
    await this.ensureDbInitialized();
    
    try {

      
      const result = await this.db
        .select({ campaignId: opLead.campaignId })
        .from(opLead)
        .where(eq(opLead.id, leadId))
        .limit(1);

      if (result.length === 0) {
        return false;
      }

      return result[0].campaignId !== null;
    } catch (error: any) {
      console.error(`Error checking if lead ${leadId} is assigned:`, error);
      return false;
    }
  }

  /**
   * Obtiene fecha del último lead asignado a una campaña
   */
  async getLastLeadDateForCampaign(campaignId: number): Promise<Date | null> {
    await this.ensureDbInitialized();
    
    try {

      
      const result = await this.db
        .select({ fechaCreacion: opLead.fechaCreacion })
        .from(opLead)
        .where(eq(opLead.campaignId, campaignId))
        .orderBy(desc(opLead.fechaCreacion))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return result[0].fechaCreacion;
    } catch (error: any) {
      console.error(`Error getting last lead date for campaign ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * OPTIMIZACIÓN 1: Obtener solo los leads ÚNICOS necesarios con sus duplicados
   * Respeta la estructura de leads únicos y duplicados de opLeadsRep
   */
  async getLeadsForAssignment(
    clientName: string,
    brandName: string,
    zone: string,
    limit: number
  ): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();
    
    try {
      const normalizedClient = normalizeClientName(clientName);
      const normalizedBrand = brandName?.toLowerCase() || '';
      const normalizedZone = this.normalizeZoneName(zone);

      console.log(`🚀 [OPTIMIZADO] Obteniendo máximo ${limit} leads ÚNICOS para asignación`);
      const startTime = Date.now();

      // IMPORTANTE: Usar opLeadsRep para obtener leads únicos con duplicateIds
      // CORREGIDO: Solo buscar leads que NO estén asignados (campaignId IS NULL)
      const uniqueLeads = await this.db
        .select()
        .from(opLeadsRep)
        .where(
          and(
            isNull(opLeadsRep.campaignId), // CRÍTICO: Solo leads no asignados
            ilike(opLeadsRep.marca, `%${normalizedBrand}%`),
            ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
            ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
          )
        )
        .orderBy(asc(opLeadsRep.fechaCreacion))
        .limit(limit * 2); // Traer más para compensar por leads ya asignados

      console.log(`📊 Query completada: ${uniqueLeads.length} leads únicos obtenidos`);
      
      // Filtrar solo los que no tienen ninguno de sus duplicados asignados
      const availableUniqueLeads: AvailableLead[] = [];
      let checkedCount = 0;
      
      for (const uniqueLead of uniqueLeads) {
        if (availableUniqueLeads.length >= limit) break; // Ya tenemos suficientes
        
        checkedCount++;
        const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
        
        // Verificar si alguno de los duplicados ya está asignado
        const assignedCheck = await this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(opLead)
          .where(
            and(
              inArray(opLead.id, duplicateIds),
              sql`${opLead.campaignId} IS NOT NULL`
            )
          );

        const alreadyAssigned = assignedCheck[0]?.count || 0;
        
        if (alreadyAssigned === 0) {
          // Ningún duplicado está asignado, incluir este lead único con sus duplicateIds
          availableUniqueLeads.push({
            ...this.mapOpLeadRepToAvailableLead(uniqueLead),
            duplicateIds: duplicateIds // IMPORTANTE: Incluir los duplicateIds
          });
        }
      }

      const queryTime = Date.now() - startTime;
      console.log(`✅ [OPTIMIZADO] ${availableUniqueLeads.length} leads únicos disponibles de ${checkedCount} verificados en ${queryTime}ms`);
      console.log(`📦 Total de duplicados a asignar: ${availableUniqueLeads.reduce((sum, lead) => sum + (lead.duplicateIds?.length || 1), 0)}`);

      return availableUniqueLeads;
    } catch (error: any) {
      console.error(`Error getting leads for assignment:`, error);
      throw new Error(`Failed to get leads for assignment: ${error.message}`);
    }
  }

  /**
   * OPTIMIZACIÓN 2: Asignar leads ÚNICOS con sus DUPLICADOS en lotes
   * Procesa correctamente los duplicateIds para asignación exacta
   */
  async assignLeadsInBatches(
    leads: AvailableLead[],
    campaignId: number,
    batchSize: number = 100,
    onProgress?: (processed: number, total: number) => void
  ): Promise<number> {
    await this.ensureDbInitialized();
    
    try {
      if (leads.length === 0) {
        return 0;
      }

      // IMPORTANTE: Extraer TODOS los duplicate IDs de los leads únicos
      const allDuplicateIds: number[] = [];
      for (const lead of leads) {
        const duplicateIds = lead.duplicateIds || [lead.id];
        allDuplicateIds.push(...duplicateIds);
      }

      console.log(`📦 [BATCH] Asignando ${leads.length} leads ÚNICOS (${allDuplicateIds.length} duplicados totales) en lotes de ${batchSize}`);
      const startTime = Date.now();
      
      let totalAssigned = 0;

      // Procesar los duplicate IDs en lotes
      for (let i = 0; i < allDuplicateIds.length; i += batchSize) {
        const batch = allDuplicateIds.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(allDuplicateIds.length / batchSize);
        
        console.log(`⚙️ [BATCH ${batchNum}/${totalBatches}] Procesando ${batch.length} duplicados...`);
        
        // Actualizar campaign_id para este lote de duplicados
        const result = await this.db
          .update(opLead)
          .set({ 
            campaignId: campaignId,
            updatedAt: new Date()
          })
          .where(
            and(
              inArray(opLead.id, batch),
              isNull(opLead.campaignId) // Doble verificación: solo actualizar si no está asignado
            )
          )
          .returning({ id: opLead.id });
        
        const batchAssigned = result.length;
        totalAssigned += batchAssigned;
        
        console.log(`✅ [BATCH ${batchNum}] ${batchAssigned} duplicados asignados (total: ${totalAssigned}/${allDuplicateIds.length})`);
        
        // Reportar progreso basado en duplicados totales
        if (onProgress) {
          onProgress(totalAssigned, allDuplicateIds.length);
        }
        
        // Pequeña pausa entre lotes para no saturar la BD
        if (i + batchSize < allDuplicateIds.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Verificación de asignación exacta
      if (totalAssigned !== allDuplicateIds.length) {
        console.warn(`⚠️ ADVERTENCIA: Asignación no exacta. Esperados: ${allDuplicateIds.length}, Asignados: ${totalAssigned}`);
        console.log(`🔍 Verificando discrepancia...`);
        
        // Verificar cuáles no se asignaron
        const verifyResult = await this.db
          .select({ 
            id: opLead.id,
            campaignId: opLead.campaignId 
          })
          .from(opLead)
          .where(inArray(opLead.id, allDuplicateIds));
        
        const notAssigned = verifyResult.filter(r => r.campaignId !== campaignId);
        if (notAssigned.length > 0) {
          console.error(`❌ ${notAssigned.length} leads no se asignaron correctamente:`, notAssigned.slice(0, 5));
        }
      }

      const totalTime = Date.now() - startTime;
      const leadsPerSecond = (totalAssigned / (totalTime / 1000)).toFixed(0);
      console.log(`🎯 [BATCH] Asignación completada: ${leads.length} únicos → ${totalAssigned} duplicados en ${totalTime}ms (${leadsPerSecond} leads/seg)`);
      
      return totalAssigned; // Retornar el total de duplicados asignados
    } catch (error: any) {
      console.error(`Error in batch assignment for campaign ${campaignId}:`, error);
      throw new Error(`Batch assignment failed: ${error.message}`);
    }
  }

  /**
   * Normaliza nombres de clientes para matching consistente
   */
  // NOTA: normalizeClientName ahora se importa de shared/utils/client-normalization.ts
  // que incluye la lógica especial para formato "MARCA # #cliente"

  /**
   * Normaliza nombres de zonas para matching consistente
   */
  private normalizeZoneName(zone: string | null | undefined): string {
    if (!zone) return 'Pais'; // Default to 'Pais' if zone is null/undefined

    const zoneMapping: Record<string, string> = {
      'NACIONAL': 'Pais',
      'AMBA': 'Amba',
      'Córdoba': 'Cordoba',
      'CORDOBA': 'Cordoba',
      'Santa Fe': 'Santa Fe',
      'SANTA FE': 'Santa Fe',
      'Mendoza': 'Mendoza',
      'MENDOZA': 'Mendoza'
    };

    return zoneMapping[zone] || zone;
  }

  /**
   * NUEVO: Obtiene pool unificado de leads para múltiples marcas ordenado cronológicamente
   * Para modo AUTOMÁTICO: ignora porcentajes, pool unificado por fecha
   */
  async getUnifiedLeadsPoolChronologically(
    clientName: string,
    brands: string[],
    zone: string,
    campaignId: number,
    targetCount: number
  ): Promise<AvailableLead[]> {
    await this.ensureDbInitialized();

    try {
      console.log(`🔄 OBTENIENDO POOL UNIFICADO CRONOLÓGICO:`);
      console.log(`   Cliente: ${clientName}`);
      console.log(`   Marcas: ${brands.join(', ')}`);
      console.log(`   Zona: ${zone}`);
      console.log(`   Solicitados: ${targetCount}`);

      const normalizedClientName = normalizeClientName(clientName);
      const normalizedZone = this.normalizeZoneName(zone);

      // ✅ USAR FUNCIÓN CENTRALIZADA para multi-marca
      const brandsInfo = brands.map(marca => ({ marca, porcentaje: 0 })); // Porcentaje no importa aquí
      const multiBrandCondition = createMultiBrandCondition(brandsInfo, opLeadsRep.campaign);

      console.log(`🔍 Buscando leads unificados para todas las marcas...`);

      const availableLeads = await this.db
        .select({
          id: opLeadsRep.id,
          metaLeadId: opLeadsRep.metaLeadId,
          nombre: opLeadsRep.nombre,
          telefono: opLeadsRep.telefono,
          email: opLeadsRep.email,
          ciudad: opLeadsRep.ciudad,
          modelo: opLeadsRep.modelo,
          comentarioHorario: opLeadsRep.comentarioHorario,
          origen: opLeadsRep.origen,
          localizacion: opLeadsRep.localizacion,
          cliente: opLeadsRep.cliente,
          marca: opLeadsRep.marca,
          campaign: opLeadsRep.campaign,
          campaignId: opLeadsRep.campaignId,
          fechaCreacion: opLeadsRep.fechaCreacion,
          createdAt: opLeadsRep.createdAt
        })
        .from(opLeadsRep)
        .where(sql`
          ${multiBrandCondition}
          AND ${opLeadsRep.cliente} = ${normalizedClientName}
          AND ${opLeadsRep.localizacion} = ${normalizedZone}
          AND (${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campaignId})
        `)
        .orderBy(sql`${opLeadsRep.createdAt} ASC`)  // ✅ ORDEN CRONOLÓGICO
        .limit(targetCount);

      console.log(`✅ Pool unificado encontrado: ${availableLeads.length} leads`);

      if (availableLeads.length > 0) {
        console.log(`📅 Rango de fechas: ${availableLeads[0].createdAt} a ${availableLeads[availableLeads.length - 1].createdAt}`);
      }

      return availableLeads.map(lead => ({
        id: lead.id,
        metaLeadId: lead.metaLeadId,
        nombre: lead.nombre,
        telefono: lead.telefono,
        email: lead.email,
        ciudad: lead.ciudad,
        modelo: lead.modelo,
        comentarioHorario: lead.comentarioHorario,
        origen: lead.origen,
        localizacion: lead.localizacion,
        cliente: lead.cliente,
        marca: lead.marca,
        campaign: lead.campaign,
        fechaCreacion: lead.fechaCreacion
      }));
    } catch (error: any) {
      console.error(`❌ Error obteniendo pool unificado cronológico:`, error);
      throw new Error(`Failed to get unified chronological pool: ${error.message}`);
    }
  }

  /**
   * NUEVO: Asigna leads en bloque cronológico (modo automático)
   */
  async assignLeadsChronologically(
    leads: AvailableLead[],
    campaignId: number
  ): Promise<{
    assigned: number;
    finalLeadDate?: Date;
    brandDistribution: { [marca: string]: number };
  }> {
    await this.ensureDbInitialized();

    try {
      if (leads.length === 0) {
        return {
          assigned: 0,
          brandDistribution: {}
        };
      }

      console.log(`🎯 ASIGNACIÓN CRONOLÓGICA EN BLOQUE:`);
      console.log(`   Leads a asignar: ${leads.length}`);
      console.log(`   Campaña ID: ${campaignId}`);

      // Extraer IDs para actualización en bloque
      const leadIds = leads.map(lead => lead.id);

      // Actualización atómica en bloque
      const result = await this.db
        .update(opLead)
        .set({
          campaignId: campaignId,
          updatedAt: new Date()
        })
        .where(inArray(opLead.id, leadIds))
        .returning({
          id: opLead.id,
          campaign: opLead.campaign,
          createdAt: opLead.createdAt
        });

      // Calcular distribución real por marca
      const brandDistribution: { [marca: string]: number } = {};
      result.forEach(lead => {
        const campaign = lead.campaign || 'Desconocida';
        brandDistribution[campaign] = (brandDistribution[campaign] || 0) + 1;
      });

      // Obtener fecha del último lead asignado
      const finalLeadDate = result.length > 0
        ? new Date(Math.max(...result.map(r => new Date(r.createdAt!).getTime())))
        : undefined;

      console.log(`✅ Asignación cronológica completada:`);
      console.log(`   Leads asignados: ${result.length}`);
      console.log(`   Distribución por marca:`, brandDistribution);

      return {
        assigned: result.length,
        finalLeadDate,
        brandDistribution
      };
    } catch (error: any) {
      console.error(`❌ Error en asignación cronológica:`, error);
      throw new Error(`Failed to assign leads chronologically: ${error.message}`);
    }
  }

  /**
   * Mapea de op_leads_rep a AvailableLead
   */
  private mapOpLeadRepToAvailableLead(lead: any): AvailableLead {
    return {
      id: lead.id,
      metaLeadId: lead.metaLeadId,
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      marca: lead.marca,
      cliente: lead.cliente,
      localizacion: lead.localizacion,
      fechaCreacion: lead.fechaCreacion,
      campaignId: undefined // op_leads_rep no tiene campaign_id
    };
  }

  /**
   * Mapea de op_lead a AvailableLead
   */
  private mapOpLeadToAvailableLead(lead: any): AvailableLead {
    return {
      id: lead.id,
      metaLeadId: lead.metaLeadId,
      nombre: lead.nombre,
      telefono: lead.telefono,
      email: lead.email,
      marca: lead.marca,
      cliente: lead.cliente,
      localizacion: lead.localizacion,
      fechaCreacion: lead.fechaCreacion,
      campaignId: lead.campaignId
    };
  }

  /**
   * FUNCIÓN ATÓMICA CORREGIDA: Asigna leads usando el procedimiento correcto
   * 1. Busca leads únicos en op_leads_rep
   * 2. Verifica disponibilidad de duplicados
   * 3. Selecciona cantidad exacta necesaria
   * 4. Extrae todos los duplicate_ids
   * 5. Asigna todos los duplicados en op_lead
   */
  async assignLeadsAtomically(
    clientName: string, 
    brandName: string, 
    zone: string, 
    campaignId: number, 
    targetCount: number
  ): Promise<{
    assigned: number;
    finalLeadDate?: Date;
    leads: AvailableLead[];
    continuityVerified: boolean;
    exactCountVerified: boolean;
  }> {
    await this.ensureDbInitialized();
    
    try {
      console.log(`🔒 ASIGNACIÓN ATÓMICA CORREGIDA: ${targetCount} leads únicos para campaña ${campaignId}`);
      console.log(`📋 Filtros: cliente=${clientName}, marca=${brandName}, zona=${zone}`);

      // Normalizar parámetros
      const normalizedClient = normalizeClientName(clientName);
      const normalizedBrand = brandName?.toLowerCase() || '';
      const normalizedZone = this.normalizeZoneName(zone);

      // TRANSACCIÓN ATÓMICA - TODO O NADA
      const result = await this.db.transaction(async (tx: any) => {
        console.log(`🚀 Iniciando transacción atómica para campaña ${campaignId}`);

        // PASO 1: Buscar leads únicos en op_leads_rep
        console.log(`🔍 PASO 1: Buscando leads únicos en op_leads_rep`);
        console.log(`🔧 Filtros normalizados: cliente=${normalizedClient}, marca=${normalizedBrand}, zona=${normalizedZone}`);
        
        const uniqueLeads = await tx
          .select()
          .from(opLeadsRep)
          .where(
            and(
              isNull(opLeadsRep.campaignId), // CRÍTICO: Solo leads no asignados
              ilike(opLeadsRep.marca, `%${normalizedBrand}%`),
              ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
              ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
            )
          )
          .orderBy(asc(opLeadsRep.fechaCreacion));

        console.log(`📊 Leads únicos encontrados en op_leads_rep: ${uniqueLeads.length}`);

        // PASO 2: Verificar disponibilidad de duplicados y filtrar
        console.log(`🔍 PASO 2: Verificando disponibilidad de duplicados`);
        const availableUniqueLeads: any[] = [];
        
        for (const uniqueLead of uniqueLeads) {
          const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
          
          // Verificar si alguno de los duplicados ya está asignado
          const assignedCount = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(opLead)
            .where(
              and(
                inArray(opLead.id, duplicateIds),
                sql`${opLead.campaignId} IS NOT NULL`
              )
            );

          const alreadyAssigned = assignedCount[0]?.count || 0;
          
          if (alreadyAssigned === 0) {
            // Ningún duplicado está asignado, incluir este lead único
            availableUniqueLeads.push({
              ...this.mapOpLeadRepToAvailableLead(uniqueLead),
              duplicateIds: duplicateIds
            });
          }
        }

        console.log(`📊 Leads únicos disponibles (sin duplicados asignados): ${availableUniqueLeads.length}`);

        if (availableUniqueLeads.length === 0) {
          throw new Error(`No hay leads únicos disponibles para ${clientName} (${brandName}, ${zone})`);
        }

        // PASO 3: Seleccionar exactamente la cantidad necesaria de leads únicos
        console.log(`🎯 PASO 3: Seleccionando ${Math.min(targetCount, availableUniqueLeads.length)} leads únicos`);
        const selectedUniqueLeads = availableUniqueLeads
          .sort((a, b) => a.fechaCreacion.getTime() - b.fechaCreacion.getTime())
          .slice(0, targetCount);

        console.log(`📋 Leads únicos seleccionados:`);
        selectedUniqueLeads.forEach((lead, index) => {
          console.log(`   ${index + 1}. ID ${lead.id}: ${lead.nombre} - ${lead.fechaCreacion.toISOString()}`);
        });

        // PASO 4: Extraer todos los duplicate_ids
        console.log(`🔗 PASO 4: Extrayendo duplicate_ids de leads únicos seleccionados`);
        const allDuplicateIds: number[] = [];
        for (const uniqueLead of selectedUniqueLeads) {
          const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
          allDuplicateIds.push(...duplicateIds);
        }

        console.log(`📊 Total de duplicate_ids a asignar: ${allDuplicateIds.length} (de ${selectedUniqueLeads.length} leads únicos)`);

        // PASO 5: Bloquear y asignar todos los duplicate_ids atómicamente
        console.log(`🔒 PASO 5: Bloqueando y asignando duplicate_ids en op_lead`);
        
        // Primero bloquear los leads que vamos a asignar
        const leadsToAssign = await tx
          .select()
          .from(opLead)
          .where(inArray(opLead.id, allDuplicateIds))
          .for('update'); // BLOQUEO CRÍTICO

        console.log(`🔒 Leads bloqueados: ${leadsToAssign.length}`);

        // Verificar que todos estén disponibles
        const unavailableLeads = leadsToAssign.filter((lead: any) => lead.campaignId !== null);
        if (unavailableLeads.length > 0) {
          throw new Error(`${unavailableLeads.length} leads ya están asignados. Race condition detectada.`);
        }

        // Asignación atómica
        const updateResult = await tx
          .update(opLead)
          .set({ 
            campaignId: campaignId,
            updatedAt: new Date()
          })
          .where(inArray(opLead.id, allDuplicateIds));

        console.log(`✅ Asignados ${allDuplicateIds.length} duplicate_ids a campaña ${campaignId}`);

        // PASO 6: Verificación de conteo exacto
        const verificationCount = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(opLead)
          .where(
            and(
              eq(opLead.campaignId, campaignId),
              inArray(opLead.id, allDuplicateIds)
            )
          );

        const actualAssigned = verificationCount[0]?.count || 0;
        const exactCountOk = actualAssigned === allDuplicateIds.length;
        
        console.log(`✅ Verificación: esperados=${allDuplicateIds.length}, asignados=${actualAssigned}, exacto=${exactCountOk}`);

        if (!exactCountOk) {
          throw new Error(`Error de conteo: esperados ${allDuplicateIds.length}, encontrados ${actualAssigned}`);
        }

        // PASO 7: Verificar continuidad y preparar resultado
        const continuityCheck = this.verifyDateContinuity(selectedUniqueLeads);
        console.log(`📅 Verificación de continuidad: ${continuityCheck ? '✅ CONTINUO' : '⚠️ CON GAPS'}`);

        const finalLeadDate = selectedUniqueLeads.length > 0 
          ? selectedUniqueLeads[selectedUniqueLeads.length - 1].fechaCreacion 
          : undefined;

        console.log(`🎉 TRANSACCIÓN EXITOSA: ${selectedUniqueLeads.length} leads únicos → ${allDuplicateIds.length} duplicados asignados`);
        console.log(`📅 Fecha del último lead único: ${finalLeadDate?.toISOString()}`);

        return {
          assigned: allDuplicateIds.length, // Retorna el total de duplicados asignados
          finalLeadDate,
          leads: selectedUniqueLeads, // Retorna los leads únicos para referencia
          continuityVerified: continuityCheck,
          exactCountVerified: exactCountOk
        };
      });

      console.log(`✅ ASIGNACIÓN ATÓMICA COMPLETADA: ${result.assigned} duplicados asignados de ${targetCount} leads únicos solicitados`);
      return result;

    } catch (error: any) {
      console.error(`❌ ERROR EN ASIGNACIÓN ATÓMICA para campaña ${campaignId}:`, error);
      throw new Error(`Atomic assignment failed: ${error.message}`);
    }
  }

  /**
   * Verifica que las fechas de leads sean continuas (sin gaps grandes)
   */
  private verifyDateContinuity(leads: any[]): boolean {
    if (leads.length <= 1) return true;

    const sortedLeads = leads.sort((a, b) => a.fechaCreacion.getTime() - b.fechaCreacion.getTime());
    
    for (let i = 1; i < sortedLeads.length; i++) {
      const current = new Date(sortedLeads[i].fechaCreacion).getTime();
      const previous = new Date(sortedLeads[i-1].fechaCreacion).getTime();
      
      // Gap de más de 7 días se considera discontinuo
      const gapDays = (current - previous) / (1000 * 60 * 60 * 24);
      if (gapDays > 7) {
        console.log(`⚠️ Gap detectado: ${gapDays.toFixed(1)} días entre ${sortedLeads[i-1].fechaCreacion} y ${sortedLeads[i].fechaCreacion}`);
        return false;
      }
    }
    
    return true;
  }

}