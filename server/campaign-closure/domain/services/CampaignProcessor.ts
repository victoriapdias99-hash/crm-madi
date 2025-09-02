import { CampaignClosure, ClientProcessingResult, ClosedCampaignDetail } from '../entities/CampaignClosure';
import { ICampaignRepository } from '../interfaces/ICampaignRepository';
import { ILeadRepository } from '../interfaces/ILeadRepository';

/**
 * Servicio de procesamiento de campañas
 * Maneja la lógica de negocio para el cierre de campañas
 */
export class CampaignProcessor {
  constructor(
    private campaignRepository: ICampaignRepository,
    private leadRepository: ILeadRepository
  ) {}

  /**
   * Procesa campañas por cliente, respetando el orden cronológico
   */
  async processClientCampaigns(clientName: string): Promise<ClientProcessingResult> {
    const campaigns = await this.campaignRepository.getCampaignsByClient(clientName);
    const campaignsClosed: ClosedCampaignDetail[] = [];
    let totalLeadsAssigned = 0;

    console.log(`🏢 Procesando campañas para cliente: ${clientName}`);
    console.log(`📋 Campañas encontradas: ${campaigns.length}`);

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

    const result = await this.processSingleCampaign(firstCampaign);
    
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
  async processSingleCampaign(campaign: CampaignClosure): Promise<{
    success: boolean;
    leadsAssigned: number;
    campaignDetail?: ClosedCampaignDetail;
    error?: string;
  }> {
    try {
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
        const finalLeadDate = await this.leadRepository.getLastLeadDateForCampaign(campaign.id);
        
        if (finalLeadDate) {
          await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
          console.log(`🎯 Campaña ${campaign.id} cerrada automáticamente`);
          
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
        return { success: false, leadsAssigned: 0, error: 'No hay leads disponibles' };
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

      // Tomar solo los leads necesarios, ordenados por fecha (más antiguos primero)
      const leadsToProcess = availableLeads
        .sort((a, b) => a.fechaCreacion.getTime() - b.fechaCreacion.getTime())
        .slice(0, leadsToAssign);

      const leadIds = leadsToProcess.map(lead => lead.id);
      
      // Asignar leads a la campaña
      const assignedCount = await this.leadRepository.assignLeadsToCampaign(leadIds, campaign.id);
      
      console.log(`✅ Asignados ${assignedCount} leads a campaña ${campaign.id}`);

      // Verificar si se alcanzó la meta (leads actuales + recién asignados)
      const totalLeads = currentAssignedLeads + assignedCount;
      if (totalLeads >= campaign.targetLeads) {
        const finalLeadDate = leadsToProcess[leadsToProcess.length - 1].fechaCreacion;
        await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);

        console.log(`🎯 Campaña ${campaign.id} cerrada. Fecha final: ${finalLeadDate.toISOString()}`);

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

      return { success: true, leadsAssigned: assignedCount };
    } catch (error: any) {
      console.error(`❌ Error procesando campaña ${campaign.id}:`, error);
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