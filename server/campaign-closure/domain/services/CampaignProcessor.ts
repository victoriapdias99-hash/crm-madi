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
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

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
      // Contar leads únicos disponibles para este cliente
      const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
        campaign.clientName,
        campaign.brandName,
        campaign.zone
      );

      console.log(`📊 Leads disponibles para ${campaign.brandName} ${campaign.campaignNumber}: ${availableLeadsCount}`);
      console.log(`🎯 Meta de leads: ${campaign.targetLeads}`);

      if (availableLeadsCount === 0) {
        console.log(`⚠️ No hay leads disponibles para asignar`);
        return { success: false, leadsAssigned: 0, error: 'No hay leads disponibles' };
      }

      // Determinar cuántos leads asignar (mínimo entre disponibles y meta)
      const leadsToAssign = Math.min(availableLeadsCount, campaign.targetLeads);

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

      // Si se alcanzó la meta, cerrar la campaña
      if (assignedCount >= campaign.targetLeads) {
        const finalLeadDate = leadsToProcess[leadsToProcess.length - 1].fechaCreacion;
        await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);

        console.log(`🎯 Campaña ${campaign.id} cerrada. Fecha final: ${finalLeadDate.toISOString()}`);

        const campaignDetail: ClosedCampaignDetail = {
          campaignId: campaign.id,
          clientName: campaign.clientName,
          brandName: campaign.brandName,
          leadsAssigned: assignedCount,
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