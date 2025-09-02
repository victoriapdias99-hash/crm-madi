import { CampaignClosure, ClosedCampaignDetail } from '../entities/CampaignClosure';

/**
 * Interface para repositorio de campañas
 * Define las operaciones de acceso a datos para el proceso de cierre de campañas
 */
export interface ICampaignRepository {
  // Obtener campañas pendientes de cierre
  getPendingCampaigns(): Promise<CampaignClosure[]>;
  
  // Obtener campañas por cliente (ordenadas por fecha)
  getCampaignsByClient(clientName: string): Promise<CampaignClosure[]>;
  
  // Marcar campaña como finalizada
  closeCampaign(campaignId: number, finalLeadDate: Date): Promise<void>;
  
  // Obtener campaña por ID
  getCampaignById(campaignId: number): Promise<CampaignClosure | null>;
  
  // Verificar si una campaña está finalizada
  isCampaignClosed(campaignId: number): Promise<boolean>;
  
  // Obtener lista de clientes únicos con campañas pendientes
  getClientsWithPendingCampaigns(): Promise<string[]>;
}