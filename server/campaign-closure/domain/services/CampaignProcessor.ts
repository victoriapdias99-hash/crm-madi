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

    const result = await this.processSingleCampaign(campaignToProcess, actualCampaignKey, !!specificCampaignNumber);
    
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
   * @param forceClose - Si es true, permite cerrar aunque no llegue a la meta (cierre manual)
   */
  async processSingleCampaign(campaign: CampaignClosure, campaignKey?: string, forceClose: boolean = false): Promise<{
    success: boolean;
    leadsAssigned: number;
    campaignDetail?: ClosedCampaignDetail;
    error?: string;
  }> {
    const startTime = Date.now();
    const campaignTrackingId = `CAMP-${campaign.id}-${Date.now()}`;
    let assignedCount = 0; // Declarar fuera del try-catch para evitar scope issues

    console.log(`🚀 [${campaignTrackingId}] INICIO procesamiento campaña ${campaign.id}`);
    console.log(`📋 [${campaignTrackingId}] Detalles campaña:`, {
      id: campaign.id,
      clientName: campaign.clientName,
      brandName: campaign.brandName,
      targetLeads: campaign.targetLeads,
      zone: campaign.zone,
      forceClose,
      campaignKey
    });

    try {
      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 40, 'Analizando leads actuales...');
      }

      // Contar leads YA asignados a esta campaña
      const step1Start = Date.now();
      console.log(`📊 [${campaignTrackingId}] PASO 1 - Contando leads ya asignados...`);
      const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(campaign.id);
      console.log(`✅ [${campaignTrackingId}] PASO 1 completado en ${Date.now() - step1Start}ms - ${currentAssignedLeads} leads asignados`);

      // Contar leads únicos disponibles para este cliente (no asignados)
      const step2Start = Date.now();
      console.log(`🔍 [${campaignTrackingId}] PASO 2 - Contando leads disponibles...`);
      const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
        campaign.clientName,
        campaign.brandName,
        campaign.zone
      );
      console.log(`✅ [${campaignTrackingId}] PASO 2 completado en ${Date.now() - step2Start}ms - ${availableLeadsCount} leads disponibles`);

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
        } else {
          console.error(`❌ [CIERRE AUTO] No se puede obtener fecha del último lead para campaña ${campaign.id} con ${currentAssignedLeads} leads asignados`);
          if (campaignKey) {
            this.progressManager.emitProgress(campaignKey, 100, 'Error: No se pudo obtener fecha del último lead');
          }
          return { success: false, leadsAssigned: 0, error: 'No se pudo obtener fecha del último lead para cierre automático' };
        }
      }

      if (availableLeadsCount === 0) {
        console.log(`🔍 Debug cierre forzado: forceClose=${forceClose}, currentAssignedLeads=${currentAssignedLeads}`);
        // Si es un cierre forzado (manual/individual) y ya hay leads asignados, cerrar la campaña
        if (forceClose && currentAssignedLeads > 0) {
          console.log(`🔧 Cierre manual: Cerrando campaña con ${currentAssignedLeads}/${campaign.targetLeads} leads`);
          if (campaignKey) {
            this.progressManager.emitProgress(campaignKey, 90, `Cerrando campaña manualmente (${currentAssignedLeads}/${campaign.targetLeads} leads)...`);
          }

          const finalLeadDate = await this.leadRepository.getLastLeadDateForCampaign(campaign.id);
          
          if (finalLeadDate) {
            await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
            console.log(`🎯 Campaña ${campaign.id} cerrada manualmente con ${currentAssignedLeads} leads`);
            
            if (campaignKey) {
              this.progressManager.emitProgress(campaignKey, 100, `Campaña cerrada manualmente: ${currentAssignedLeads}/${campaign.targetLeads} leads`);
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
          } else {
            console.error(`❌ [CIERRE MANUAL] No se puede obtener fecha del último lead para campaña ${campaign.id} con ${currentAssignedLeads} leads asignados`);
            if (campaignKey) {
              this.progressManager.emitProgress(campaignKey, 100, 'Error: No se pudo obtener fecha del último lead para cierre manual');
            }
            return { success: false, leadsAssigned: 0, error: 'No se pudo obtener fecha del último lead para cierre manual' };
          }
        }

        console.log(`⚠️ No hay leads disponibles para asignar`);
        if (campaignKey) {
          const message = forceClose ? 'No se puede cerrar: campaña sin leads asignados' : 'Error: No hay leads disponibles';
          this.progressManager.emitProgress(campaignKey, 100, message);
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

      // OPTIMIZACIÓN 1: Obtener SOLO los leads necesarios con límite
      const step3Start = Date.now();
      console.log(`🎯 [${campaignTrackingId}] PASO 3 - Obteniendo máximo ${leadsToAssign} leads optimizados...`);
      const leadsForAssignment = await this.leadRepository.getLeadsForAssignment(
        campaign.clientName,
        campaign.brandName,
        campaign.zone,
        leadsToAssign // Solo traer los necesarios
      );
      console.log(`✅ [${campaignTrackingId}] PASO 3 completado en ${Date.now() - step3Start}ms - ${leadsForAssignment.length} leads obtenidos`);

      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 70, `Asignando ${leadsForAssignment.length} leads...`);
      }

      // OPTIMIZACIÓN 2: Asignar leads en lotes con progreso
      const step5Start = Date.now();
      console.log(`💾 [${campaignTrackingId}] PASO 4 - Iniciando asignación en lotes de ${leadsForAssignment.length} leads...`);

      // Timeout dinámico basado en el volumen (50ms por lead, mínimo 30 segundos)
      const timeoutMs = Math.max(30000, leadsForAssignment.length * 50);
      console.log(`⏱️ [${campaignTrackingId}] Timeout dinámico establecido: ${timeoutMs}ms (${timeoutMs/1000}s)`);

      // Callback de progreso para actualizar WebSocket
      const progressCallback = (processed: number, total: number) => {
        const elapsed = Date.now() - step5Start;
        console.log(`📈 [${campaignTrackingId}] Progreso asignación: ${processed}/${total} leads (${elapsed}ms transcurridos)`);
        if (campaignKey) {
          const progressPercent = 70 + Math.floor((processed / total) * 20); // 70% a 90%
          this.progressManager.emitProgress(
            campaignKey,
            progressPercent,
            `Procesados ${processed}/${total} leads...`
          );
        }
      };

      console.log(`🚀 [${campaignTrackingId}] Iniciando Promise.race para asignación con timeout`);
      try {
        assignedCount = await Promise.race([
          this.leadRepository.assignLeadsInBatches(
            leadsForAssignment,
            campaign.id,
            100, // Tamaño del lote
            progressCallback
          ),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              console.error(`⏱️ [${campaignTrackingId}] TIMEOUT TRIGGERED después de ${timeoutMs}ms`);
              reject(new Error(`Timeout: Asignación tardó más de ${timeoutMs/1000} segundos para campaña ${campaign.id}`));
            }, timeoutMs);
          })
        ]);
        console.log(`✅ [${campaignTrackingId}] PASO 4 completado en ${Date.now() - step5Start}ms - ${assignedCount} leads asignados`);
      } catch (assignmentError: any) {
        console.error(`❌ [${campaignTrackingId}] ERROR en asignación después de ${Date.now() - step5Start}ms:`, {
          error: assignmentError.message,
          campaignId: campaign.id,
          leadsToAssign: leadsForAssignment.length,
          timeoutMs,
          isTimeout: assignmentError.message?.includes('Timeout')
        });
        throw assignmentError;
      }
      
      console.log(`✅ Asignados ${assignedCount} leads a campaña ${campaign.id}`);

      // Verificar si se alcanzó la meta (leads actuales + recién asignados)
      const totalLeads = currentAssignedLeads + assignedCount;
      if (totalLeads >= campaign.targetLeads) {
        if (campaignKey) {
          this.progressManager.emitProgress(campaignKey, 90, 'Meta alcanzada, cerrando campaña...');
        }

        const step6Start = Date.now();
        console.log(`🔒 [${campaignTrackingId}] PASO 5 - Cerrando campaña en base de datos...`);

        // Obtener la fecha del último lead asignado
        const finalLeadDate = leadsForAssignment.length > 0
          ? leadsForAssignment[leadsForAssignment.length - 1].fechaCreacion
          : await this.leadRepository.getLastLeadDateForCampaign(campaign.id);

        console.log(`📅 [${campaignTrackingId}] Fecha final calculada: ${finalLeadDate?.toISOString() || 'null'}`);

        if (finalLeadDate) {
          console.log(`💾 [${campaignTrackingId}] Ejecutando closeCampaign en repositorio...`);
          await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
          console.log(`✅ [${campaignTrackingId}] PASO 5 completado en ${Date.now() - step6Start}ms - Campaña cerrada`);
          console.log(`🎯 [${campaignTrackingId}] Campaña ${campaign.id} cerrada exitosamente. Fecha final: ${finalLeadDate.toISOString()}`);

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
      }

      if (campaignKey) {
        this.progressManager.emitProgress(campaignKey, 100, `${assignedCount} leads asignados`);
      }

      console.log(`🎉 [${campaignTrackingId}] PROCESAMIENTO COMPLETO en ${Date.now() - startTime}ms`);
      return { success: true, leadsAssigned: assignedCount };
    } catch (error: any) {
      const errorDuration = Date.now() - startTime;
      console.error(`💥 [${campaignTrackingId}] ERROR CRÍTICO después de ${errorDuration}ms:`, {
        campaignId: campaign.id,
        error: error.message,
        stack: error.stack,
        clientName: campaign.clientName,
        brandName: campaign.brandName,
        targetLeads: campaign.targetLeads,
        forceClose,
        campaignKey,
        errorType: error.constructor?.name,
        isTimeout: error.message?.includes('Timeout') || error.message?.includes('timeout'),
        isDatabaseError: error.message?.includes('database') || error.message?.includes('sql'),
        systemState: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      });

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