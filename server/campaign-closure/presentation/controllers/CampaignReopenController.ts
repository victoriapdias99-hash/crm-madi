import { Request, Response } from 'express';
import { db } from '../../../db';
import { campanasComerciales, opLead, clientes } from '../../../../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Controlador para reabrir campañas cerradas
 * Útil para testing y correcciones
 */
export class CampaignReopenController {

  /**
   * POST /api/campaign-closure/reopen/:id
   * Reabre una campaña cerrada, desasignando sus leads
   */
  async reopenCampaign(req: Request, res: Response): Promise<void> {
    const campaignId = parseInt(req.params.id);
    const requestId = `REOPEN-${Date.now()}`;

    console.log(`🔓 [${requestId}] Solicitud de reapertura para campaña ${campaignId}`);

    if (!campaignId || isNaN(campaignId)) {
      res.status(400).json({
        success: false,
        error: 'ID de campaña inválido'
      });
      return;
    }

    try {
      // 1. Verificar estado actual
      console.log(`📋 [${requestId}] Verificando estado actual...`);

      const currentStateResult = await db.execute<{
        id: number;
        numero_campana: string;
        cliente: string;
        fecha_fin: Date | null;
        cantidad_datos_solicitados: number;
        marca: string;
        zona: string;
      }>(sql`
        SELECT
          cc.id,
          cc.numero_campana,
          c.nombre_comercial as cliente,
          cc.fecha_fin,
          cc.cantidad_datos_solicitados,
          cc.marca,
          cc.zona
        FROM campanas_comerciales cc
        LEFT JOIN clientes c ON cc.cliente_id = c.id
        WHERE cc.id = ${campaignId}
      `);

      const currentState = currentStateResult.rows || currentStateResult;

      if (!currentState || currentState.length === 0) {
        console.error(`❌ [${requestId}] Campaña no encontrada`);
        res.status(404).json({
          success: false,
          error: 'Campaña no encontrada'
        });
        return;
      }

      const campaign = currentState[0];
      const wasClosed = !!campaign.fecha_fin;

      console.log(`📊 [${requestId}] Estado: ${wasClosed ? 'Cerrada' : 'Abierta'}`);

      if (!wasClosed) {
        console.log(`⚠️ [${requestId}] Campaña ya está abierta`);
        res.status(200).json({
          success: true,
          message: 'Campaña ya estaba abierta',
          alreadyOpen: true,
          campaign: {
            id: campaign.id,
            cliente: campaign.cliente,
            numero_campana: campaign.numero_campana,
            marca: campaign.marca,
            zona: campaign.zona,
            estado: 'Abierta'
          }
        });
        return;
      }

      // 2. Contar leads asignados
      console.log(`📊 [${requestId}] Contando leads asignados...`);

      const leadsCountResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int as count
        FROM op_lead
        WHERE campaign_id = ${campaignId}
      `);

      const leadsCount = leadsCountResult.rows || leadsCountResult;
      const assignedLeads = leadsCount[0]?.count || 0;
      console.log(`📧 [${requestId}] Leads asignados: ${assignedLeads}`);

      // 3. Desasignar leads
      console.log(`🔄 [${requestId}] Desasignando ${assignedLeads} leads...`);

      await db.execute(sql`
        UPDATE op_lead
        SET campaign_id = NULL
        WHERE campaign_id = ${campaignId}
      `);

      console.log(`✅ [${requestId}] Leads desasignados`);

      // 4. Reabrir campaña
      console.log(`🔓 [${requestId}] Reabriendo campaña...`);

      await db.execute(sql`
        UPDATE campanas_comerciales
        SET fecha_fin = NULL,
            updated_at = NOW()
        WHERE id = ${campaignId}
      `);

      console.log(`✅ [${requestId}] Campaña reabierta`);

      // 5. Verificar resultado
      const verificationResult = await db.execute<{
        fecha_fin: Date | null;
      }>(sql`
        SELECT fecha_fin
        FROM campanas_comerciales
        WHERE id = ${campaignId}
      `);

      const verification = verificationResult.rows || verificationResult;
      const reopened = !verification[0]?.fecha_fin;

      if (!reopened) {
        throw new Error('Verificación falló: fecha_fin no es NULL');
      }

      console.log(`🎉 [${requestId}] ÉXITO - Campaña reabierta exitosamente`);

      res.status(200).json({
        success: true,
        message: 'Campaña reabierta exitosamente',
        campaign: {
          id: campaign.id,
          cliente: campaign.cliente,
          numero_campana: campaign.numero_campana,
          marca: campaign.marca,
          zona: campaign.zona,
          cantidad_datos_solicitados: campaign.cantidad_datos_solicitados,
          estado: 'Abierta'
        },
        leadsUnassigned: assignedLeads,
        previousState: {
          fecha_fin: campaign.fecha_fin
        }
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

  /**
   * GET /api/campaign-closure/can-reopen/:id
   * Verifica si una campaña puede ser reabierta
   */
  async canReopen(req: Request, res: Response): Promise<void> {
    const campaignId = parseInt(req.params.id);

    if (!campaignId || isNaN(campaignId)) {
      res.status(400).json({
        canReopen: false,
        reason: 'ID de campaña inválido'
      });
      return;
    }

    try {
      const stateResult = await db.execute<{
        id: number;
        fecha_fin: Date | null;
        leads_asignados: number;
      }>(sql`
        SELECT
          cc.id,
          cc.fecha_fin,
          COUNT(ol.id)::int as leads_asignados
        FROM campanas_comerciales cc
        LEFT JOIN op_lead ol ON ol.campaign_id = cc.id
        WHERE cc.id = ${campaignId}
        GROUP BY cc.id, cc.fecha_fin
      `);

      const state = stateResult.rows || stateResult;

      if (!state || state.length === 0) {
        res.status(404).json({
          canReopen: false,
          reason: 'Campaña no encontrada'
        });
        return;
      }

      const campaign = state[0];
      const isClosed = !!campaign.fecha_fin;
      const hasLeads = campaign.leads_asignados > 0;

      res.status(200).json({
        canReopen: isClosed,
        reason: isClosed
          ? `Campaña cerrada con ${campaign.leads_asignados} leads asignados. Puede reabrirse.`
          : 'Campaña ya está abierta',
        campaign: {
          id: campaign.id,
          isClosed,
          leadsAsignados: campaign.leads_asignados,
          fechaFin: campaign.fecha_fin
        }
      });

    } catch (error: any) {
      res.status(500).json({
        canReopen: false,
        reason: 'Error verificando estado',
        error: error.message
      });
    }
  }
}
