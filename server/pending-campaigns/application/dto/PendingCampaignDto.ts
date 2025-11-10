import { PendingCampaign, PendingCampaignStats, PendingCampaignFilters } from '../../domain/entities/PendingCampaign';

/**
 * DTO para request de consulta de campañas pendientes
 */
export interface GetPendingCampaignsRequestDto {
  zona?: string;
  marca?: string;
  cliente?: string;
  clienteNombre?: string;
  fechaInicio?: string;
  fechaFin?: string;
  showDuplicatesOnly?: string | boolean; // Puede venir como string desde query params
  sortBy?: 'fecha' | 'cliente' | 'marca';
  sortOrder?: 'asc' | 'desc';
}

/**
 * DTO para response de campañas pendientes
 */
export interface PendingCampaignsResponseDto {
  success: boolean;
  count: number;
  campaigns: PendingCampaign[];
  stats?: PendingCampaignStats;
  filters?: PendingCampaignFilters;
  timestamp: string;
}

/**
 * DTO para response de una campaña individual
 */
export interface SinglePendingCampaignResponseDto {
  success: boolean;
  campaign: PendingCampaign | null;
  message?: string;
  timestamp: string;
}

/**
 * DTO para request de actualización
 */
export interface UpdatePendingCampaignRequestDto {
  cpl?: number;
  pedidosPorDia?: number;
  cantidadDatosSolicitados?: number;
  zona?: string;
  marca?: string;
  // Agregar más campos según necesidad
}

/**
 * DTO para response de actualización
 */
export interface UpdatePendingCampaignResponseDto {
  success: boolean;
  campaign?: PendingCampaign;
  message: string;
  errors?: string[];
  timestamp: string;
}

/**
 * DTO para response de estadísticas
 */
export interface PendingCampaignStatsResponseDto {
  success: boolean;
  stats: PendingCampaignStats;
  totalCampaigns: number;
  filters?: PendingCampaignFilters;
  timestamp: string;
}

/**
 * DTO para response de opciones de filtros
 */
export interface FilterOptionsResponseDto {
  success: boolean;
  clientes: string[];
  marcas: string[];
  zonas: string[];
  timestamp: string;
}

/**
 * Mapea request DTO a filtros de dominio
 */
export function mapRequestToFilters(requestDto: GetPendingCampaignsRequestDto): PendingCampaignFilters {
  return {
    zona: requestDto.zona,
    marca: requestDto.marca,
    cliente: requestDto.cliente,
    clienteNombre: requestDto.clienteNombre,
    fechaInicio: requestDto.fechaInicio,
    fechaFin: requestDto.fechaFin,
    showDuplicatesOnly: typeof requestDto.showDuplicatesOnly === 'string'
      ? requestDto.showDuplicatesOnly === 'true'
      : Boolean(requestDto.showDuplicatesOnly),
    sortBy: requestDto.sortBy || 'fecha',
    sortOrder: requestDto.sortOrder || 'desc'
  };
}

/**
 * Mapea campañas del dominio a response DTO
 */
export function mapCampaignsToResponse(
  campaigns: PendingCampaign[],
  filters?: PendingCampaignFilters,
  stats?: PendingCampaignStats
): PendingCampaignsResponseDto {
  return {
    success: true,
    count: campaigns.length,
    campaigns,
    stats,
    filters,
    timestamp: new Date().toISOString()
  };
}

/**
 * Mapea campaña individual a response DTO
 */
export function mapCampaignToResponse(campaign: PendingCampaign | null): SinglePendingCampaignResponseDto {
  return {
    success: campaign !== null,
    campaign,
    message: campaign ? 'Campaña encontrada' : 'Campaña no encontrada',
    timestamp: new Date().toISOString()
  };
}

/**
 * Mapea resultado de actualización a response DTO
 */
export function mapUpdateToResponse(
  success: boolean,
  campaign?: PendingCampaign,
  message?: string,
  errors?: string[]
): UpdatePendingCampaignResponseDto {
  return {
    success,
    campaign,
    message: message || (success ? 'Campaña actualizada exitosamente' : 'Error al actualizar campaña'),
    errors,
    timestamp: new Date().toISOString()
  };
}

/**
 * Mapea estadísticas a response DTO
 */
export function mapStatsToResponse(
  stats: PendingCampaignStats,
  totalCampaigns: number,
  filters?: PendingCampaignFilters
): PendingCampaignStatsResponseDto {
  return {
    success: true,
    stats,
    totalCampaigns,
    filters,
    timestamp: new Date().toISOString()
  };
}
