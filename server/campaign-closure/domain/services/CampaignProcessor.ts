import { CampaignClosure, ClientProcessingResult, ClosedCampaignDetail } from '../entities/CampaignClosure';
import { ICampaignRepository } from '../interfaces/ICampaignRepository';
import { ILeadRepository } from '../interfaces/ILeadRepository';
import { WebSocket } from 'ws';

// Interfaz para eventos de progreso
export interface ProgressEvent {
  type: 'campaign-progress';
  campaignKey: string;
  progress: number;
  message: string;
  timestamp: Date;
}

// Manager de WebSocket para eventos de progreso
class ProgressEventManager {
  private static instance: ProgressEventManager;
  private connections: Map<string, WebSocket> = new Map();
  private processingCampaigns: Map<string, { progress: number; message: string; startTime: Date }> = new Map();

  static getInstance(): ProgressEventManager {
    if (!ProgressEventManager.instance) {
      ProgressEventManager.instance = new ProgressEventManager();
    }
    return ProgressEventManager.instance;
  }

  addConnection(campaignKey: string, ws: WebSocket) {
    this.connections.set(campaignKey, ws);
    console.log(`📡 Conexión WebSocket agregada para campaña: ${campaignKey}`);
  }

  removeConnection(campaignKey: string) {
    this.connections.delete(campaignKey);
    console.log(`📡 Conexión WebSocket removida para campaña: ${campaignKey}`);
  }
  
  getProcessingCampaigns(): Record<string, { progress: number; message: string; startTime: string }> {
    const result: Record<string, { progress: number; message: string; startTime: string }> = {};
    this.processingCampaigns.forEach((value, key) => {
      result[key] = {
        progress: value.progress,
        message: value.message,
        startTime: value.startTime.toISOString()
      };
    });
    return result;
  }

  emitProgress(campaignKey: string, progress: number, message: string) {
    // Actualizar estado interno
    this.processingCampaigns.set(campaignKey, {
      progress,
      message,
      startTime: this.processingCampaigns.get(campaignKey)?.startTime || new Date()
    });
    
    // Si llegó al 100%, remover después de un tiempo
    if (progress >= 100) {
      setTimeout(() => {
        this.processingCampaigns.delete(campaignKey);
      }, 5000); // 5 segundos después de completar
    }
    
    const connection = this.connections.get(campaignKey);
    if (connection && connection.readyState === WebSocket.OPEN) {
      const event: ProgressEvent = {
        type: 'campaign-progress',
        campaignKey,
        progress,
        message,
        timestamp: new Date()
      };
      connection.send(JSON.stringify(event));
      console.log(`📡 Progreso emitido para ${campaignKey}: ${progress}% - ${message}`);
    } else {
      console.log(`📡 Progreso almacenado para ${campaignKey}: ${progress}% - ${message} (sin conexión WebSocket)`);
    }
  }
}

/**
 * Servicio de procesamiento de campañas
 * Maneja la lógica de negocio para el cierre de campañas
 */
export class CampaignProcessor {
  private progressManager = ProgressEventManager.getInstance();
  
  constructor(
    private campaignRepository: ICampaignRepository,
    private leadRepository: ILeadRepository,
    private campaignKey?: string
  ) {}

  /**
   * Registra una conexión WebSocket para recibir eventos de progreso
   */
  registerWebSocketConnection(campaignKey: string, ws: WebSocket) {
    this.progressManager.addConnection(campaignKey, ws);
    
    // Limpiar conexión al cerrar
    ws.on('close', () => {
      this.progressManager.removeConnection(campaignKey);
    });
    
    ws.on('error', () => {
      this.progressManager.removeConnection(campaignKey);
    });
  }

  /**
   * Procesa campañas por cliente, respetando el orden cronológico
   */
  async processClientCampaigns(clientName: string, campaignKey?: string, specificCampaignNumber?: string): Promise<ClientProcessingResult> {
    // Emitir progreso inicial
    if (campaignKey) {
      this.progressManager.emitProgress(campaignKey, 10, 'Iniciando proceso...');
    }

    const campaigns = await this.campaignRepository.getCampaignsByClient(clientName);
    const campaignsClosed: ClosedCampaignDetail[] = [];
    let totalLeadsAssigned = 0;

    console.log(`🏢 Procesando campañas para cliente: ${clientName}`);
    console.log(`📋 Campañas encontradas: ${campaigns.length}`);
    if (specificCampaignNumber) {
      console.log(`🎯 Buscando campaña específica: ${specificCampaignNumber}`);
    }

    if (campaignKey) {
      this.progressManager.emitProgress(campaignKey, 20, 'Campañas cargadas, procesando...');
    }

    // Filtrar campañas en proceso
    let pendingCampaigns = campaigns.filter(c => c.status === 'En proceso');
    
    // Si se especificó un número de campaña, filtrar solo esa
    if (specificCampaignNumber) {
      pendingCampaigns = pendingCampaigns.filter(c => 
        c.campaignNumber === parseInt(specificCampaignNumber) || 
        c.campaignNumber.toString() === specificCampaignNumber
      );
      
      if (pendingCampaigns.length === 0) {
        console.log(`⚠️ No se encontró la campaña ${specificCampaignNumber} para ${clientName}`);
        if (campaignKey) {
          this.progressManager.emitProgress(campaignKey, 100, `Campaña ${specificCampaignNumber} no encontrada o ya cerrada`);
        }
        return {
          clientName,
          campaignsProcessed: 0,
          leadsAssigned: 0,
          campaignsClosed: []
        };
      }
    }
    
    // Ordenar por fecha de inicio (más antigua primero)
    const sortedCampaigns = pendingCampaigns.sort((a, b) => {
      const dateA = typeof a.startDate === 'string' ? new Date(a.startDate) : a.startDate;
      const dateB = typeof b.startDate === 'string' ? new Date(b.startDate) : b.startDate;
      return dateA.getTime() - dateB.getTime();
    });

    if (sortedCampaigns.length === 0) {
      console.log(`ℹ️ No hay campañas pendientes para ${clientName}`);
      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 100, 'No hay campañas pendientes');
      }
      return {
        clientName,
        campaignsProcessed: 0,
        leadsAssigned: 0,
        campaignsClosed: []
      };
    }

    // Procesar la primera campaña (o la específica si se indicó)
    const campaignToProcess = sortedCampaigns[0];
    console.log(`🎯 Procesando campaña: ${campaignToProcess.brandName} ${campaignToProcess.campaignNumber}`);
    
    // Generar un campaignKey específico para esta campaña si no coincide
    const actualCampaignKey = campaignKey && campaignKey.includes(`-${campaignToProcess.campaignNumber}`) 
      ? campaignKey 
      : `${clientName}-${campaignToProcess.campaignNumber}`;
    
    console.log(`📡 Usando campaignKey: ${actualCampaignKey}`);

    const result = await this.processSingleCampaign(campaignToProcess, actualCampaignKey);
    
    if (result.success) {
      campaignsClosed.push(result.campaignDetail!);
      totalLeadsAssigned += result.leadsAssigned;
    }

    return {
      clientName,
      campaignsProcessed: 1,
      leadsAssigned: totalLeadsAssigned,
      campaignsClosed
    };
  }

  /**
   * Procesa una campaña individual
   */
  async processSingleCampaign(campaign: CampaignClosure, campaignKey?: string): Promise<{
    success: boolean;
    leadsAssigned: number;
    campaignDetail?: ClosedCampaignDetail;
    error?: string;
  }> {
    const startTime = Date.now();
    console.log(`⏱️ [TIMING] Iniciando procesamiento de campaña ${campaign.id}`);
    
    try {
      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 40, 'Analizando leads actuales...');
      }

      // Contar leads YA asignados a esta campaña
      const step1Start = Date.now();
      console.log(`⏱️ [TIMING] Contando leads asignados...`);
      const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(campaign.id);
      console.log(`⏱️ [TIMING] Leads asignados contados en ${Date.now() - step1Start}ms`);
      
      // Contar leads únicos disponibles para este cliente (no asignados)
      const step2Start = Date.now();
      console.log(`⏱️ [TIMING] Contando leads disponibles...`);
      const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
        campaign.clientName,
        campaign.brandName,
        campaign.zone
      );
      console.log(`⏱️ [TIMING] Leads disponibles contados en ${Date.now() - step2Start}ms`);

      console.log(`📊 Leads ya asignados a campaña ${campaign.id}: ${currentAssignedLeads}`);
      console.log(`📊 Leads disponibles (no asignados): ${availableLeadsCount}`);
      console.log(`🎯 Meta de leads: ${campaign.targetLeads}`);
      
      // Si ya alcanzó la meta, cerrar la campaña
      if (currentAssignedLeads >= campaign.targetLeads) {
        console.log(`✅ Campaña ya completó su meta (${currentAssignedLeads}/${campaign.targetLeads})`);
        if (campaignKey) {
          this.progressManager.emitProgress(campaignKey, 90, 'Cerrando campaña completada...');
        }

        const finalLeadDate = await this.leadRepository.getLastLeadDateForCampaign(campaign.id);
        
        if (finalLeadDate) {
          await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
          console.log(`🎯 Campaña ${campaign.id} cerrada automáticamente`);
          
          if (campaignKey) {
            this.progressManager.emitProgress(campaignKey, 100, 'Campaña cerrada exitosamente');
          }
          
          const campaignDetail: ClosedCampaignDetail = {
            campaignId: campaign.id,
            clientName: campaign.clientName,
            brandName: campaign.brandName,
            leadsAssigned: currentAssignedLeads,
            targetLeads: campaign.targetLeads,
            closureDate: new Date(),
            finalLeadDate
          };
          
          return { success: true, leadsAssigned: 0, campaignDetail };
        }
      }

      if (availableLeadsCount === 0) {
        console.log(`⚠️ No hay leads disponibles para asignar`);
        if (campaignKey) {
          this.progressManager.emitProgress(campaignKey, 100, 'Error: No hay leads disponibles');
        }
        return { success: false, leadsAssigned: 0, error: 'No hay leads disponibles' };
      }

      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 60, 'Preparando asignación de leads...');
      }

      // Calcular cuántos leads necesitamos para completar la meta
      const leadsNeeded = campaign.targetLeads - currentAssignedLeads;
      const leadsToAssign = Math.min(availableLeadsCount, leadsNeeded);
      
      console.log(`🎯 Leads necesarios: ${leadsNeeded}, disponibles: ${availableLeadsCount}, asignaremos: ${leadsToAssign}`);

      // Obtener leads específicos para asignar
      const step3Start = Date.now();
      console.log(`⏱️ [TIMING] Obteniendo lista de leads disponibles...`);
      const availableLeads = await this.leadRepository.getAvailableLeadsForClient(
        campaign.clientName,
        campaign.brandName,
        campaign.zone
      );
      console.log(`⏱️ [TIMING] Lista de leads obtenida en ${Date.now() - step3Start}ms - ${availableLeads.length} leads encontrados`);

      // Tomar solo los leads únicos necesarios, ordenados por fecha (más antiguos primero)
      const step4Start = Date.now();
      console.log(`⏱️ [TIMING] Ordenando y filtrando ${availableLeads.length} leads...`);
      const uniqueLeadsToProcess = availableLeads
        .sort((a, b) => a.fechaCreacion.getTime() - b.fechaCreacion.getTime())
        .slice(0, leadsToAssign);
      console.log(`⏱️ [TIMING] Leads ordenados y filtrados en ${Date.now() - step4Start}ms - ${uniqueLeadsToProcess.length} leads seleccionados`);
      
      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 70, `Asignando ${leadsToAssign} leads...`);
      }

      // Asignar leads únicos (con sus duplicados) a la campaña
      const step5Start = Date.now();
      console.log(`⏱️ [TIMING] Iniciando asignación de ${uniqueLeadsToProcess.length} leads...`);
      const assignedCount = await Promise.race([
        this.leadRepository.assignLeadsToCampaign(uniqueLeadsToProcess, campaign.id),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout: Asignación de leads tardó más de 60 segundos')), 60000);
        })
      ]);
      console.log(`⏱️ [TIMING] Asignación completada en ${Date.now() - step5Start}ms - ${assignedCount} leads asignados`);
      
      console.log(`✅ Asignados ${assignedCount} leads a campaña ${campaign.id}`);

      // Verificar si se alcanzó la meta (leads actuales + recién asignados)
      const totalLeads = currentAssignedLeads + assignedCount;
      if (totalLeads >= campaign.targetLeads) {
        if (campaignKey) {
          this.progressManager.emitProgress(campaignKey, 90, 'Meta alcanzada, cerrando campaña...');
        }

        const step6Start = Date.now();
        console.log(`⏱️ [TIMING] Cerrando campaña en base de datos...`);
        const finalLeadDate = uniqueLeadsToProcess[uniqueLeadsToProcess.length - 1].fechaCreacion;
        await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
        console.log(`⏱️ [TIMING] Campaña cerrada en ${Date.now() - step6Start}ms`);

        console.log(`🎯 Campaña ${campaign.id} cerrada. Fecha final: ${finalLeadDate.toISOString()}`);

        if (campaignKey) {
          this.progressManager.emitProgress(campaignKey, 100, `Campaña cerrada: ${assignedCount} leads asignados`);
        }

        const campaignDetail: ClosedCampaignDetail = {
          campaignId: campaign.id,
          clientName: campaign.clientName,
          brandName: campaign.brandName,
          leadsAssigned: totalLeads,
          targetLeads: campaign.targetLeads,
          closureDate: new Date(),
          finalLeadDate
        };

        return { success: true, leadsAssigned: assignedCount, campaignDetail };
      }

      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 100, `${assignedCount} leads asignados`);
      }

      console.log(`⏱️ [TIMING] Procesamiento completo de campaña ${campaign.id} en ${Date.now() - startTime}ms`);
      return { success: true, leadsAssigned: assignedCount };
    } catch (error: any) {
      console.error(`❌ Error procesando campaña ${campaign.id}:`, error);
      console.log(`⏱️ [TIMING] Error después de ${Date.now() - startTime}ms`);
      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 100, `Error: ${error.message}`);
      }
      return { success: false, leadsAssigned: 0, error: error.message };
    }
  }

  /**
   * Obtiene lista de clientes únicos para procesar
   */
  async getClientsToProcess(): Promise<string[]> {
    return await this.campaignRepository.getClientsWithPendingCampaigns();
  }
  
  /**
   * Obtiene las campañas que están siendo procesadas actualmente
   */
  getProcessingCampaigns(): Record<string, { progress: number; message: string; startTime: string }> {
    return this.progressManager.getProcessingCampaigns();
  }
}