/**
 * DTOs para opciones de cierre de campañas
 */
export interface ClosureOptions {
  // Filtros
  specificClients?: string[];
  specificBrands?: string[];
  
  // Configuración de procesamiento
  dryRun?: boolean; // Solo simular, no ejecutar
  validateOnly?: boolean; // Solo validar, no procesar
  
  // Tracking de progreso
  campaignKey?: string; // Clave única para WebSocket tracking
  
  // Configuración avanzada
  batchSize?: number;
  timeout?: number; // timeout en segundos
}

/**
 * DTO para request de cierre desde API
 */
export interface ClosureRequestDto {
  clients?: string; // 'cliente1,cliente2,cliente3'
  brands?: string; // 'Fiat,Peugeot,Toyota'
  dryRun?: string; // 'true' | 'false'
  validateOnly?: string; // 'true' | 'false'
  campaignKey?: string; // Clave única para tracking de progreso
}

/**
 * DTO para respuesta de cierre
 */
export interface ClosureResponseDto {
  success: boolean;
  message: string;
  campaignsProcessed: number;
  campaignsClosed: number;
  leadsAssigned: number;
  timestamp: string;
  duration: number;
  durationFormatted: string;
  details?: {
    closedCampaigns: Array<{
      campaignId: number;
      clientName: string;
      brandName: string;
      leadsAssigned: number;
      targetLeads: number;
      closureDate: string;
      finalLeadDate: string;
    }>;
    clientsProcessed: string[];
    validationErrors?: string[];
  };
  error?: string;
}

/**
 * Mapea ClosureRequestDto a ClosureOptions
 */
export function mapClosureRequestToOptions(request: ClosureRequestDto): ClosureOptions {
  return {
    specificClients: request.clients ? request.clients.split(',').map(c => c.trim()) : undefined,
    specificBrands: request.brands ? request.brands.split(',').map(b => b.trim()) : undefined,
    dryRun: request.dryRun === 'true',
    validateOnly: request.validateOnly === 'true',
    campaignKey: request.campaignKey,
    batchSize: 50,
    timeout: 300 // 5 minutos por defecto
  };
}

/**
 * Mapea ClosureResult a ClosureResponseDto
 */
export function mapClosureResultToResponse(result: any): ClosureResponseDto {
  const durationInSeconds = Math.round(result.duration / 1000);
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = durationInSeconds % 60;
  const durationFormatted = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return {
    success: result.success,
    message: result.success 
      ? `Procesamiento completado exitosamente. ${result.campaignsClosed} campañas cerradas.`
      : `Error en el procesamiento: ${result.error}`,
    campaignsProcessed: result.campaignsProcessed || 0,
    campaignsClosed: result.campaignsClosed || 0,
    leadsAssigned: result.leadsAssigned || 0,
    timestamp: result.timestamp,
    duration: result.duration,
    durationFormatted,
    details: result.details ? {
      closedCampaigns: result.details.closedCampaigns?.map((campaign: any) => ({
        campaignId: campaign.campaignDetail?.id || campaign.campaignId || 0,
        clientName: campaign.campaignDetail?.clientName || campaign.clientName,
        brandName: campaign.campaignDetail?.brandName || campaign.brandName,
        leadsAssigned: campaign.campaignDetail?.leadsAssigned || campaign.leadsAssigned,
        targetLeads: campaign.campaignDetail?.targetLeads || campaign.targetLeads,
        closureDate: campaign.campaignDetail?.closureDate?.toISOString() || campaign.closureDate?.toISOString() || new Date().toISOString(),
        finalLeadDate: campaign.campaignDetail?.finalLeadDate?.toISOString() || campaign.finalLeadDate?.toISOString() || new Date().toISOString()
      })) || [],
      clientsProcessed: result.details.clientsProcessed || [],
      validationErrors: result.details.validationErrors
    } : undefined,
    error: result.error
  };
}