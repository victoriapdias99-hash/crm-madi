import { ClosureResult, ClosureDetails, ClosedCampaignDetail } from '../../domain/entities/ClosureResult';
import { ClientProcessingResult } from '../../domain/entities/CampaignClosure';
import { ICampaignRepository } from '../../domain/interfaces/ICampaignRepository';
import { ILeadRepository } from '../../domain/interfaces/ILeadRepository';
import { CampaignProcessor } from '../../domain/services/CampaignProcessor';
import { LeadAssigner } from '../../domain/services/LeadAssigner';
import { ClosureOptions } from '../dto/ClosureOptions';

/**
 * Caso de uso principal para el cierre manual de campañas
 * Coordina todo el proceso de cierre siguiendo el algoritmo especificado
 */
export class CampaignClosureUseCase {
  private campaignProcessor: CampaignProcessor;
  private leadAssigner: LeadAssigner;

  constructor(
    private campaignRepository: ICampaignRepository,
    private leadRepository: ILeadRepository
  ) {
    this.campaignProcessor = new CampaignProcessor(campaignRepository, leadRepository);
    this.leadAssigner = new LeadAssigner(leadRepository);
  }

  /**
   * Ejecuta el proceso completo de cierre de campañas
   */
  async execute(options: ClosureOptions = {}): Promise<ClosureResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    console.log('🚀 Iniciando proceso de cierre de campañas...');
    console.log('⚙️ Opciones:', JSON.stringify(options, null, 2));

    try {
      // Validación inicial si está habilitada
      if (options.validateOnly) {
        return await this.validateOnly(timestamp, startTime);
      }

      // Obtener clientes a procesar
      const clientsToProcess = await this.getClientsToProcess(options);
      
      if (clientsToProcess.length === 0) {
        console.log('ℹ️ No hay clientes con campañas pendientes para procesar');
        return this.createResult(true, 0, 0, 0, [], clientsToProcess, timestamp, startTime);
      }

      console.log(`👥 Clientes a procesar: ${clientsToProcess.length}`);
      console.log(`📋 Lista: ${clientsToProcess.join(', ')}`);

      const allClosedCampaigns: ClosedCampaignDetail[] = [];
      let totalCampaignsProcessed = 0;
      let totalLeadsAssigned = 0;

      // Procesar cada cliente
      for (const clientName of clientsToProcess) {
        console.log(`\n🏢 === PROCESANDO CLIENTE: ${clientName} ===`);
        
        if (options.dryRun) {
          console.log('🧪 Modo DRY RUN: Solo simulando...');
        }

        const clientResult = await this.processClient(clientName, options);
        
        totalCampaignsProcessed += clientResult.campaignsProcessed;
        totalLeadsAssigned += clientResult.leadsAssigned;
        allClosedCampaigns.push(...clientResult.campaignsClosed);

        console.log(`✅ Cliente ${clientName} procesado: ${clientResult.campaignsProcessed} campañas, ${clientResult.leadsAssigned} leads asignados`);
      }

      const campaignsClosed = allClosedCampaigns.length;
      
      console.log('\n🎯 === RESUMEN FINAL ===');
      console.log(`📊 Clientes procesados: ${clientsToProcess.length}`);
      console.log(`📋 Campañas procesadas: ${totalCampaignsProcessed}`);
      console.log(`🎯 Campañas cerradas: ${campaignsClosed}`);
      console.log(`📧 Leads asignados: ${totalLeadsAssigned}`);

      return this.createResult(
        true,
        totalCampaignsProcessed,
        campaignsClosed,
        totalLeadsAssigned,
        allClosedCampaigns,
        clientsToProcess,
        timestamp,
        startTime
      );

    } catch (error: any) {
      console.error('❌ Error en proceso de cierre:', error);
      return this.createResult(
        false,
        0,
        0,
        0,
        [],
        [],
        timestamp,
        startTime,
        error.message
      );
    }
  }

  /**
   * Procesa las campañas de un cliente específico
   */
  private async processClient(clientName: string, options: ClosureOptions): Promise<ClientProcessingResult> {
    try {
      if (options.dryRun) {
        // En modo dry run, solo simular el procesamiento
        return await this.simulateClientProcessing(clientName);
      }

      return await this.campaignProcessor.processClientCampaigns(clientName, options.campaignKey);
    } catch (error: any) {
      console.error(`❌ Error procesando cliente ${clientName}:`, error);
      return {
        clientName,
        campaignsProcessed: 0,
        leadsAssigned: 0,
        campaignsClosed: []
      };
    }
  }

  /**
   * Simula el procesamiento sin hacer cambios reales
   */
  private async simulateClientProcessing(clientName: string): Promise<ClientProcessingResult> {
    console.log(`🧪 SIMULANDO procesamiento para ${clientName}...`);
    
    const campaigns = await this.campaignRepository.getCampaignsByClient(clientName);
    const pendingCampaigns = campaigns.filter(c => c.status === 'En proceso');
    
    if (pendingCampaigns.length === 0) {
      return { clientName, campaignsProcessed: 0, leadsAssigned: 0, campaignsClosed: [] };
    }

    const firstCampaign = pendingCampaigns
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

    const availableLeads = await this.leadRepository.countUniqueLeadsForClient(
      firstCampaign.clientName,
      firstCampaign.brandName,
      firstCampaign.zone
    );

    const wouldAssign = Math.min(availableLeads, firstCampaign.targetLeads);
    const wouldClose = wouldAssign >= firstCampaign.targetLeads;

    console.log(`🧪 Simularía asignar ${wouldAssign} leads ${wouldClose ? 'y CERRAR' : 'sin cerrar'} campaña`);

    return {
      clientName,
      campaignsProcessed: 1,
      leadsAssigned: wouldAssign,
      campaignsClosed: wouldClose ? [{
        campaignId: firstCampaign.id,
        clientName: firstCampaign.clientName,
        brandName: firstCampaign.brandName,
        leadsAssigned: wouldAssign,
        targetLeads: firstCampaign.targetLeads,
        closureDate: new Date(),
        finalLeadDate: new Date()
      }] : []
    };
  }

  /**
   * Solo validar sin procesar
   */
  private async validateOnly(timestamp: string, startTime: number): Promise<ClosureResult> {
    console.log('🔍 Ejecutando solo validación...');
    
    const clients = await this.campaignProcessor.getClientsToProcess();
    const validationErrors: string[] = [];

    for (const clientName of clients) {
      const campaigns = await this.campaignRepository.getCampaignsByClient(clientName);
      const pendingCampaigns = campaigns.filter(c => c.status === 'En proceso');
      
      if (pendingCampaigns.length === 0) {
        validationErrors.push(`Cliente ${clientName} no tiene campañas pendientes`);
        continue;
      }

      const firstCampaign = pendingCampaigns[0];
      const availableLeads = await this.leadRepository.countUniqueLeadsForClient(
        firstCampaign.clientName,
        firstCampaign.brandName,
        firstCampaign.zone
      );

      if (availableLeads === 0) {
        validationErrors.push(`Cliente ${clientName} no tiene leads disponibles`);
      }
    }

    console.log(`✅ Validación completada. ${validationErrors.length} errores encontrados`);

    return this.createResult(
      validationErrors.length === 0,
      clients.length,
      0,
      0,
      [],
      clients,
      timestamp,
      startTime,
      validationErrors.length > 0 ? validationErrors.join('; ') : undefined,
      { validationErrors }
    );
  }

  /**
   * Obtiene la lista de clientes a procesar según las opciones
   */
  private async getClientsToProcess(options: ClosureOptions): Promise<string[]> {
    let clients = await this.campaignProcessor.getClientsToProcess();

    // Filtrar por clientes específicos si se especificaron
    if (options.specificClients && options.specificClients.length > 0) {
      clients = clients.filter(client => 
        options.specificClients!.some(specified => 
          client.toLowerCase().includes(specified.toLowerCase())
        )
      );
    }

    return clients;
  }

  /**
   * Crea el resultado final
   */
  private createResult(
    success: boolean,
    campaignsProcessed: number,
    campaignsClosed: number,
    leadsAssigned: number,
    closedCampaigns: ClosedCampaignDetail[],
    clientsProcessed: string[],
    timestamp: string,
    startTime: number,
    error?: string,
    additionalDetails?: Partial<ClosureDetails>
  ): ClosureResult {
    const duration = Date.now() - startTime;

    const details: ClosureDetails = {
      closedCampaigns,
      clientsProcessed,
      totalLeadsAvailable: leadsAssigned,
      ...additionalDetails
    };

    return {
      success,
      campaignsProcessed,
      campaignsClosed,
      leadsAssigned,
      timestamp,
      duration,
      error,
      details
    };
  }
}