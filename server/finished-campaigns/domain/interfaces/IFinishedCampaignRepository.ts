import { FinishedCampaign, FinishedCampaignFilters, FinishedCampaignStats } from '../entities/FinishedCampaign';

/**
 * Interfaz del repositorio de campañas finalizadas
 * Define el contrato para el acceso a datos de campañas cerradas
 */
export interface IFinishedCampaignRepository {
  /**
   * Obtiene todas las campañas finalizadas con filtros opcionales
   */
  findAllFinished(filters?: FinishedCampaignFilters): Promise<FinishedCampaign[]>;

  /**
   * Obtiene una campaña finalizada por ID
   */
  findById(id: number): Promise<FinishedCampaign | null>;

  /**
   * Obtiene campañas finalizadas por cliente
   */
  findByClient(clientName: string): Promise<FinishedCampaign[]>;

  /**
   * Obtiene campañas finalizadas por marca
   */
  findByBrand(brandName: string): Promise<FinishedCampaign[]>;

  /**
   * Obtiene campañas finalizadas por zona
   */
  findByZone(zone: string): Promise<FinishedCampaign[]>;

  /**
   * Obtiene campañas finalizadas en un rango de fechas de cierre
   */
  findByCloseDateRange(startDate: string, endDate: string): Promise<FinishedCampaign[]>;

  /**
   * Obtiene estadísticas agregadas de campañas finalizadas
   */
  getStatistics(filters?: FinishedCampaignFilters): Promise<FinishedCampaignStats>;

  /**
   * Cuenta campañas finalizadas con filtros
   */
  count(filters?: FinishedCampaignFilters): Promise<number>;

  /**
   * Verifica si existe una campaña finalizada
   */
  exists(id: number): Promise<boolean>;

  /**
   * Reabre una campaña finalizada (elimina fecha_fin)
   */
  reopen(id: number): Promise<void>;

  /**
   * Obtiene clientes con campañas finalizadas
   */
  getClientsWithFinishedCampaigns(): Promise<string[]>;

  /**
   * Obtiene marcas con campañas finalizadas
   */
  getBrandsWithFinishedCampaigns(): Promise<string[]>;

  /**
   * Obtiene zonas con campañas finalizadas
   */
  getZonesWithFinishedCampaigns(): Promise<string[]>;
}
