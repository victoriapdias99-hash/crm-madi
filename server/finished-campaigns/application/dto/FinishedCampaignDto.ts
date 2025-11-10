import { FinishedCampaign, FinishedCampaignStats, FinishedCampaignFilters } from '../../domain/entities/FinishedCampaign';

/**
 * DTO para respuesta de lista de campañas finalizadas
 */
export interface FinishedCampaignsResponseDto {
  success: boolean;
  data: FinishedCampaign[];
  count: number;
  stats?: FinishedCampaignStats;
  timestamp: string;
}

/**
 * DTO para respuesta de una campaña finalizada
 */
export interface SingleFinishedCampaignResponseDto {
  success: boolean;
  data: FinishedCampaign | null;
  timestamp: string;
}

/**
 * DTO para respuesta de estadísticas
 */
export interface FinishedCampaignStatsResponseDto {
  success: boolean;
  data: FinishedCampaignStats;
  timestamp: string;
}

/**
 * DTO para opciones de filtros
 */
export interface FilterOptionsResponseDto {
  success: boolean;
  data: {
    clientes: string[];
    marcas: string[];
    zonas: string[];
  };
  timestamp: string;
}

/**
 * DTO para request de reapertura de campaña
 */
export interface ReopenFinishedCampaignRequestDto {
  campaignId: number;
  reason?: string;
}

/**
 * DTO para respuesta de reapertura de campaña
 */
export interface ReopenFinishedCampaignResponseDto {
  success: boolean;
  message: string;
  campaignId: number;
  timestamp: string;
}
