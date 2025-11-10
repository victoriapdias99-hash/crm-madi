import { PendingCampaign, PendingCampaignFilters, PendingCampaignStats } from '../entities/PendingCampaign';

/**
 * Contrato para el repositorio de campañas pendientes
 * Define las operaciones de acceso a datos
 */
export interface IPendingCampaignRepository {
  /**
   * Obtiene todas las campañas pendientes (fechaFin = null)
   * @param filters - Filtros opcionales para la consulta
   * @returns Array de campañas pendientes
   */
  findAllPending(filters?: PendingCampaignFilters): Promise<PendingCampaign[]>;

  /**
   * Obtiene una campaña pendiente por ID
   * @param id - ID de la campaña
   * @returns Campaña pendiente o null si no existe
   */
  findById(id: number): Promise<PendingCampaign | null>;

  /**
   * Obtiene campañas pendientes por cliente
   * @param clientName - Nombre del cliente
   * @returns Array de campañas pendientes del cliente
   */
  findByClient(clientName: string): Promise<PendingCampaign[]>;

  /**
   * Obtiene campañas pendientes por marca
   * @param brandName - Nombre de la marca
   * @returns Array de campañas pendientes de la marca
   */
  findByBrand(brandName: string): Promise<PendingCampaign[]>;

  /**
   * Obtiene campañas pendientes por zona
   * @param zone - Zona geográfica
   * @returns Array de campañas pendientes de la zona
   */
  findByZone(zone: string): Promise<PendingCampaign[]>;

  /**
   * Actualiza una campaña pendiente
   * @param id - ID de la campaña
   * @param data - Datos parciales a actualizar
   */
  update(id: number, data: Partial<PendingCampaign>): Promise<void>;

  /**
   * Obtiene estadísticas agregadas de campañas pendientes
   * @param filters - Filtros opcionales
   * @returns Estadísticas calculadas
   */
  getStatistics(filters?: PendingCampaignFilters): Promise<PendingCampaignStats>;

  /**
   * Cuenta el total de campañas pendientes
   * @param filters - Filtros opcionales
   * @returns Número total de campañas pendientes
   */
  count(filters?: PendingCampaignFilters): Promise<number>;

  /**
   * Verifica si existe una campaña pendiente
   * @param id - ID de la campaña
   * @returns true si existe, false en caso contrario
   */
  exists(id: number): Promise<boolean>;

  /**
   * Obtiene clientes con campañas pendientes
   * @returns Array de nombres de clientes únicos
   */
  getClientsWithPendingCampaigns(): Promise<string[]>;

  /**
   * Obtiene marcas con campañas pendientes
   * @returns Array de nombres de marcas únicos
   */
  getBrandsWithPendingCampaigns(): Promise<string[]>;

  /**
   * Obtiene zonas con campañas pendientes
   * @returns Array de zonas únicas
   */
  getZonesWithPendingCampaigns(): Promise<string[]>;
}
