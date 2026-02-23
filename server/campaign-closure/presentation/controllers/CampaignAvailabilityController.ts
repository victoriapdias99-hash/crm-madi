import { Request, Response } from 'express';
import { db } from '../../../db';
import { sql } from 'drizzle-orm';

/**
 * Controlador para verificar disponibilidad de leads para campañas
 * Sin ejecutar cierres
 */
export class CampaignAvailabilityController {

  /**
   * GET /api/campaign-closure/availability/:id
   * Verifica cuántos leads están disponibles para una campaña
   */
  async checkAvailability(req: Request, res: Response): Promise<void> {
    const campaignId = parseInt(req.params.id);
    const requestId = `AVAIL-${Date.now()}`;

    console.log(`🔍 [${requestId}] Verificando disponibilidad para campaña ${campaignId}`);

    if (!campaignId || isNaN(campaignId)) {
      res.status(400).json({
        success: false,
        error: 'ID de campaña inválido'
      });
      return;
    }

    try {
      // 1. Obtener información de la campaña
      const campaignResult = await db.execute<{
        id: number;
        numero_campana: string;
        cliente: string;
        marca: string;
        zona: string;
        cantidad_datos_solicitados: number;
        fecha_fin: Date | null;
      }>(sql`
        SELECT
          cc.id,
          cc.numero_campana,
          c.nombre_comercial as cliente,
          cc.marca,
          cc.zona,
          cc.cantidad_datos_solicitados,
          cc.fecha_fin
        FROM campanas_comerciales cc
        LEFT JOIN clientes c ON cc.cliente_id = c.id
        WHERE cc.id = ${campaignId}
      `);

      const campaigns = campaignResult.rows || campaignResult;

      if (!campaigns || campaigns.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Campaña no encontrada'
        });
        return;
      }

      const campaign = campaigns[0];

      // 2. Normalizar parámetros
      const normalizedClient = campaign.cliente.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedZone = campaign.zona === 'NACIONAL' ? 'Pais' :
                            (campaign.zona === 'Córdoba' ? 'Cordoba' : campaign.zona);

      console.log(`📊 [${requestId}] Cliente: ${campaign.cliente}, Marca: ${campaign.marca}, Zona: ${campaign.zona}`);

      // 3. Leads ya asignados
      const assignedResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int as count
        FROM op_lead
        WHERE campaign_id = ${campaignId}
      `);

      const assignedRows = assignedResult.rows || assignedResult;
      const leadsAsignados = assignedRows[0]?.count || 0;

      // 4. Leads únicos disponibles
      const uniqueAvailableResult = await db.execute<{
        count: number;
        total_duplicates: number;
      }>(sql`
        SELECT
          COUNT(*)::int as count,
          SUM(COALESCE(array_length(duplicate_ids, 1), 1))::int as total_duplicates
        FROM op_leads_rep
        WHERE (campaign_ids IS NULL OR NOT (${campaignId} = ANY(campaign_ids)))
          AND LOWER(marca) LIKE ${`%${campaign.marca.toLowerCase()}%`}
          AND LOWER(cliente) LIKE ${`%${normalizedClient}%`}
          AND LOWER(localizacion) LIKE ${`%${normalizedZone.toLowerCase()}%`}
      `);

      const uniqueRows = uniqueAvailableResult.rows || uniqueAvailableResult;
      const uniqueCount = uniqueRows[0]?.count || 0;
      const totalDuplicates = uniqueRows[0]?.total_duplicates || 0;

      // 5. Total de leads
      const totalLeadsResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int as count
        FROM op_lead
        WHERE LOWER(marca) LIKE ${`%${campaign.marca.toLowerCase()}%`}
          AND LOWER(cliente) LIKE ${`%${normalizedClient}%`}
          AND LOWER(localizacion) LIKE ${`%${normalizedZone.toLowerCase()}%`}
      `);

      const totalRows = totalLeadsResult.rows || totalLeadsResult;
      const totalLeads = totalRows[0]?.count || 0;

      // 6. Leads en otras campañas
      const otherCampaignsResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int as count
        FROM op_lead
        WHERE LOWER(marca) LIKE ${`%${campaign.marca.toLowerCase()}%`}
          AND LOWER(cliente) LIKE ${`%${normalizedClient}%`}
          AND LOWER(localizacion) LIKE ${`%${normalizedZone.toLowerCase()}%`}
          AND campaign_ids IS NOT NULL
          AND array_length(campaign_ids, 1) > 0
      `);

      const otherRows = otherCampaignsResult.rows || otherCampaignsResult;
      const otherCampaigns = otherRows[0]?.count || 0;

      // 7. Cálculos
      const faltantes = campaign.cantidad_datos_solicitados - leadsAsignados;
      const puedenAsignarse = Math.min(uniqueCount, faltantes);
      const cumplimientoActual = (leadsAsignados / campaign.cantidad_datos_solicitados) * 100;
      const cumplimientoFinal = ((leadsAsignados + puedenAsignarse) / campaign.cantidad_datos_solicitados) * 100;
      const puedeCerrarse = uniqueCount >= faltantes;

      console.log(`✅ [${requestId}] Disponibles: ${uniqueCount}, Faltantes: ${faltantes}, Puede cerrar: ${puedeCerrarse}`);

      // 8. Respuesta
      res.status(200).json({
        success: true,
        campaign: {
          id: campaign.id,
          cliente: campaign.cliente,
          numero_campana: campaign.numero_campana,
          marca: campaign.marca,
          zona: campaign.zona,
          meta: campaign.cantidad_datos_solicitados,
          estado: campaign.fecha_fin ? 'Cerrada' : 'Abierta',
          fechaFin: campaign.fecha_fin
        },
        leads: {
          yaAsignados: leadsAsignados,
          disponiblesUnicos: uniqueCount,
          disponiblesConDuplicados: totalDuplicates,
          faltantesParaMeta: faltantes,
          puedenAsignarse: puedenAsignarse,
          totalEnBaseDatos: totalLeads,
          asignadosOtrasCampañas: otherCampaigns,
          sinAsignar: totalLeads - leadsAsignados - otherCampaigns
        },
        analisis: {
          cumplimientoActual: parseFloat(cumplimientoActual.toFixed(1)),
          cumplimientoFinalEsperado: parseFloat(cumplimientoFinal.toFixed(1)),
          puedeCerrarseCompletamente: puedeCerrarse,
          tipoCierre: puedeCerrarse ? 'completo' : 'parcial',
          mensaje: puedeCerrarse
            ? `✅ Hay suficientes leads disponibles (${uniqueCount}) para completar la meta (${faltantes} faltantes)`
            : `⚠️ Solo hay ${uniqueCount} leads disponibles de ${faltantes} faltantes. Cierre parcial al ${cumplimientoFinal.toFixed(1)}%`
        },
        busqueda: {
          clienteNormalizado: normalizedClient,
          zonaNormalizada: normalizedZone,
          marca: campaign.marca
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error(`❌ [${requestId}] ERROR:`, error.message);
      console.error(error.stack);

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }
}
