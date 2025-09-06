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

  emitProgress(campaignKey: string, progress: number, message: string) {
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
  async processClientCampaigns(clientName: string, campaignKey?: string): Promise<ClientProcessingResult> {
    // Emitir progreso inicial
    if (campaignKey) {
      this.progressManager.emitProgress(campaignKey, 10, 'Iniciando proceso...');
    }

    const campaigns = await this.campaignRepository.getCampaignsByClient(clientName);
    const campaignsClosed: ClosedCampaignDetail[] = [];
    let totalLeadsAssigned = 0;

    console.log(`🏢 Procesando campañas para cliente: ${clientName}`);
    console.log(`📋 Campañas encontradas: ${campaigns.length}`);

    if (campaignKey) {
      this.progressManager.emitProgress(campaignKey, 20, 'Campañas cargadas, procesando...');
    }

    // Ordenar por fecha de inicio (más antigua primero)
    const sortedCampaigns = campaigns
      .filter(c => c.status === 'En proceso')
      .sort((a, b) => {
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

    // Procesar la primera campaña cronológicamente
    const firstCampaign = sortedCampaigns[0];
    console.log(`🎯 Procesando primera campaña: ${firstCampaign.brandName} ${firstCampaign.campaignNumber}`);

    const result = await this.processSingleCampaign(firstCampaign, campaignKey);
    
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
    try {
      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 40, 'Analizando leads actuales...');
      }

      // Contar leads YA asignados a esta campaña
      const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(campaign.id);
      
      // Contar leads únicos disponibles para este cliente (no asignados)
      const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
        campaign.clientName,
        campaign.brandName,
        campaign.zone
      );

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
      const availableLeads = await this.leadRepository.getAvailableLeadsForClient(
        campaign.clientName,
        campaign.brandName,
        campaign.zone
      );

      // Tomar solo los leads únicos necesarios, ordenados por fecha (más antiguos primero)
      const uniqueLeadsToProcess = availableLeads
        .sort((a, b) => a.fechaCreacion.getTime() - b.fechaCreacion.getTime())
        .slice(0, leadsToAssign);
      
      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 70, `Asignando ${leadsToAssign} leads...`);
      }

      // Asignar leads únicos (con sus duplicados) a la campaña
      const assignedCount = await this.leadRepository.assignLeadsToCampaign(uniqueLeadsToProcess, campaign.id);
      
      console.log(`✅ Asignados ${assignedCount} leads a campaña ${campaign.id}`);

      // Verificar si se alcanzó la meta (leads actuales + recién asignados)
      const totalLeads = currentAssignedLeads + assignedCount;
      if (totalLeads >= campaign.targetLeads) {
        if (campaignKey) {
          this.progressManager.emitProgress(campaignKey, 90, 'Meta alcanzada, cerrando campaña...');
        }

        const finalLeadDate = uniqueLeadsToProcess[uniqueLeadsToProcess.length - 1].fechaCreacion;
        await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);

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

      return { success: true, leadsAssigned: assignedCount };
    } catch (error: any) {
      console.error(`❌ Error procesando campaña ${campaign.id}:`, error);
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
}