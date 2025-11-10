/**
 * Interfaz para operaciones de reset de campañas
 */
export interface ICampaignResetRepository {
  /**
   * Limpia los campaign_id de todos los leads asignados a una campaña
   */
  clearCampaignLeads(campaignId: number): Promise<number>;

  /**
   * Limpia la fecha_fin de una campaña para "reabrirla"
   */
  clearCampaignEndDate(campaignId: number): Promise<void>;

  /**
   * Obtiene el conteo de leads asignados a una campaña
   */
  getAssignedLeadsCount(campaignId: number): Promise<number>;

  /**
   * Obtiene todas las campañas con fecha_fin
   */
  getFinishedCampaigns(beforeDate?: Date, afterDate?: Date): Promise<Array<{
    id: number;
    numeroCampana: number;
    clienteNombre: string;
    marca: string;
    zona: string;
    fechaFin: Date;
  }>>;

  /**
   * Verifica si una campaña tiene fecha_fin
   */
  isCampaignFinished(campaignId: number): Promise<boolean>;
}
