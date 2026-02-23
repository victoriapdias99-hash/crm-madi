import { db } from '../../../db';
import { opLead, campanasComerciales, clientes } from '../../../../shared/schema';
import { eq, sql, isNotNull, and, gte, lte } from 'drizzle-orm';
import { ICampaignResetRepository } from '../../domain/interfaces/ICampaignResetRepository';

export class PostgresCampaignResetRepository implements ICampaignResetRepository {

  async clearCampaignLeads(campaignId: number): Promise<number> {
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM op_lead WHERE ${campaignId} = ANY(campaign_ids)
    `);
    const leadsCount = ((countResult as any).rows?.[0]?.count ?? (countResult as any)[0]?.count) || 0;

    if (leadsCount === 0) {
      return 0;
    }

    await db.execute(sql`
      UPDATE op_lead 
      SET campaign_ids = array_remove(campaign_ids, ${campaignId}),
          campaign_id = CASE WHEN array_length(array_remove(campaign_ids, ${campaignId}), 1) > 0 
                        THEN (array_remove(campaign_ids, ${campaignId}))[array_length(array_remove(campaign_ids, ${campaignId}), 1)]
                        ELSE NULL END,
          updated_at = NOW()
      WHERE ${campaignId} = ANY(campaign_ids)
    `);

    return leadsCount;
  }

  async clearCampaignEndDate(campaignId: number): Promise<void> {
    await db
      .update(campanasComerciales)
      .set({ fechaFin: null })
      .where(eq(campanasComerciales.id, campaignId));
  }

  async getAssignedLeadsCount(campaignId: number): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM op_lead WHERE ${campaignId} = ANY(campaign_ids)
    `);
    return ((result as any).rows?.[0]?.count ?? (result as any)[0]?.count) || 0;
  }

  async getFinishedCampaigns(beforeDate?: Date, afterDate?: Date) {
    let query = db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        clienteNombre: clientes.nombreComercial,
        marca: campanasComerciales.marca,
        zona: campanasComerciales.zona,
        fechaFin: campanasComerciales.fechaFin,
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
      .where(isNotNull(campanasComerciales.fechaFin));

    const campaigns = await query;

    // Filtrar por fechas si se especificaron
    let filtered = campaigns
      .filter(c => c.fechaFin !== null)
      .map(c => ({
        id: c.id,
        numeroCampana: typeof c.numeroCampana === 'string' ? parseInt(c.numeroCampana) : c.numeroCampana,
        clienteNombre: c.clienteNombre || '',
        marca: c.marca,
        zona: c.zona,
        fechaFin: new Date(c.fechaFin!)
      }));

    if (beforeDate) {
      filtered = filtered.filter(c => new Date(c.fechaFin) <= beforeDate);
    }

    if (afterDate) {
      filtered = filtered.filter(c => new Date(c.fechaFin) >= afterDate);
    }

    return filtered;
  }

  async isCampaignFinished(campaignId: number): Promise<boolean> {
    const [campaign] = await db
      .select({ fechaFin: campanasComerciales.fechaFin })
      .from(campanasComerciales)
      .where(eq(campanasComerciales.id, campaignId));

    return campaign?.fechaFin !== null;
  }
}
