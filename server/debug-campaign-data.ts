import { db } from './db';
import { campanasComerciales, clientes, opLead } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { Request, Response } from 'express';

/**
 * Endpoint temporal para debug de datos de campaña
 */
export async function debugCampaignData(req: Request, res: Response) {
  const campaignId = parseInt(req.params.id);

  if (!campaignId || isNaN(campaignId)) {
    res.status(400).json({ error: 'ID de campaña inválido' });
    return;
  }

  try {
    console.log(`🔍 DEBUG: Obteniendo datos de campaña ${campaignId}...`);

    // Obtener campaña con datos diarios usando SQL directo
    const campaignsResult = await db.execute<{
      id: number;
      numero_campana: string;
      cliente: string;
      marca: string;
      zona: string;
      cantidad_datos_solicitados: number;
      fecha_campana: Date;
      fecha_fin: Date | null;
      dia1: number; dia2: number; dia3: number; dia4: number; dia5: number;
      dia6: number; dia7: number; dia8: number; dia9: number; dia10: number;
      dia11: number; dia12: number; dia13: number; dia14: number; dia15: number;
      dia16: number; dia17: number; dia18: number; dia19: number; dia20: number;
      dia21: number; dia22: number; dia23: number; dia24: number; dia25: number;
      dia26: number; dia27: number; dia28: number; dia29: number; dia30: number; dia31: number;
    }>(sql`
      SELECT
        cc.id,
        cc.numero_campana,
        c.nombre_comercial as cliente,
        cc.marca,
        cc.zona,
        cc.cantidad_datos_solicitados,
        cc.fecha_campana,
        cc.fecha_fin,
        COALESCE(cc."dia_1", 0) as dia1, COALESCE(cc."dia_2", 0) as dia2, COALESCE(cc."dia_3", 0) as dia3,
        COALESCE(cc."dia_4", 0) as dia4, COALESCE(cc."dia_5", 0) as dia5, COALESCE(cc."dia_6", 0) as dia6,
        COALESCE(cc."dia_7", 0) as dia7, COALESCE(cc."dia_8", 0) as dia8, COALESCE(cc."dia_9", 0) as dia9,
        COALESCE(cc."dia_10", 0) as dia10, COALESCE(cc."dia_11", 0) as dia11, COALESCE(cc."dia_12", 0) as dia12,
        COALESCE(cc."dia_13", 0) as dia13, COALESCE(cc."dia_14", 0) as dia14, COALESCE(cc."dia_15", 0) as dia15,
        COALESCE(cc."dia_16", 0) as dia16, COALESCE(cc."dia_17", 0) as dia17, COALESCE(cc."dia_18", 0) as dia18,
        COALESCE(cc."dia_19", 0) as dia19, COALESCE(cc."dia_20", 0) as dia20, COALESCE(cc."dia_21", 0) as dia21,
        COALESCE(cc."dia_22", 0) as dia22, COALESCE(cc."dia_23", 0) as dia23, COALESCE(cc."dia_24", 0) as dia24,
        COALESCE(cc."dia_25", 0) as dia25, COALESCE(cc."dia_26", 0) as dia26, COALESCE(cc."dia_27", 0) as dia27,
        COALESCE(cc."dia_28", 0) as dia28, COALESCE(cc."dia_29", 0) as dia29, COALESCE(cc."dia_30", 0) as dia30,
        COALESCE(cc."dia_31", 0) as dia31
      FROM campanas_comerciales cc
      LEFT JOIN clientes c ON cc.cliente_id = c.id
      WHERE cc.id = ${campaignId}
    `);

    const campaigns = campaignsResult.rows || campaignsResult;

    if (!campaigns || campaigns.length === 0) {
      res.status(404).json({ error: 'Campaña no encontrada' });
      return;
    }

    const campaign = campaigns[0];

    // Validar que cantidadSolicitados existe
    const cantidadSolicitados = campaign.cantidad_datos_solicitados || 0;
    if (cantidadSolicitados === 0) {
      res.status(400).json({
        error: 'Campaña sin meta definida',
        campaign: {
          id: campaign.id,
          cliente: campaign.cliente,
          cantidad_datos_solicitados: cantidadSolicitados
        }
      });
      return;
    }

    // Procesar datos diarios
    const datosDiarios = [];
    let totalDatosDiarios = 0;

    for (let i = 1; i <= 31; i++) {
      const diaKey = `dia${i}` as keyof typeof campaign;
      const leadCount = (campaign[diaKey] as number) || 0;

      if (leadCount > 0) {
        totalDatosDiarios += leadCount;
        datosDiarios.push({
          dia: i,
          leads: leadCount,
          acumulado: totalDatosDiarios
        });
      }
    }

    // Contar leads asignados
    const assignedResultQuery = await db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(opLead)
      .where(eq(opLead.campaignId, campaignId));

    const leadsAsignados = Number(assignedResultQuery[0]?.count || 0);

    // Preparar respuesta
    const response = {
      campaignInfo: {
        id: campaign.id,
        cliente: campaign.cliente,
        marca: campaign.marca,
        zona: campaign.zona,
        numeroCampana: campaign.numero_campana,
        cantidadSolicitados: cantidadSolicitados,
        fechaCampana: campaign.fecha_campana,
        fechaFin: campaign.fecha_fin,
        estado: campaign.fecha_fin ? 'Cerrada' : 'En proceso'
      },
      datosDiarios: {
        diasConDatos: datosDiarios.length,
        detalles: datosDiarios,
        total: totalDatosDiarios,
        porcentajeMeta: ((totalDatosDiarios / cantidadSolicitados) * 100).toFixed(1)
      },
      leadsAsignados: {
        total: leadsAsignados,
        porcentajeMeta: ((leadsAsignados / cantidadSolicitados) * 100).toFixed(1)
      },
      analisis: {
        metaSolicitada: cantidadSolicitados,
        datosDiariosTotal: totalDatosDiarios,
        leadsAsignadosTotal: leadsAsignados,
        diferenciaDiariosVsMeta: totalDatosDiarios - cantidadSolicitados,
        diferenciaAsignadosVsMeta: leadsAsignados - cantidadSolicitados,
        diferenciaAsignadosVsDiarios: leadsAsignados - totalDatosDiarios,
        status: {
          datosDiariosAlcanzaMeta: totalDatosDiarios >= cantidadSolicitados,
          asignadosAlcanzaMeta: leadsAsignados >= cantidadSolicitados,
          consistenciaDiariosAsignados: Math.abs(leadsAsignados - totalDatosDiarios) <= 5
        },
        conclusiones: []
      }
    };

    // Agregar conclusiones
    if (totalDatosDiarios >= cantidadSolicitados && leadsAsignados < cantidadSolicitados) {
      response.analisis.conclusiones.push(
        '⚠️ PROBLEMA: Datos diarios indican suficientes leads pero no todos fueron asignados',
        'Posibles causas: duplicados, filtros de zona/marca, leads ya consumidos'
      );
    } else if (totalDatosDiarios < cantidadSolicitados) {
      response.analisis.conclusiones.push(
        'ℹ️ Los datos diarios no alcanzan la meta',
        'Indica que no llegaron suficientes leads desde las fuentes'
      );
    } else if (leadsAsignados >= cantidadSolicitados) {
      response.analisis.conclusiones.push(
        '✅ Meta alcanzada según leads asignados',
        'Datos consistentes'
      );
    }

    if (Math.abs(leadsAsignados - totalDatosDiarios) > 5) {
      response.analisis.conclusiones.push(
        `⚠️ DISCREPANCIA: ${Math.abs(leadsAsignados - totalDatosDiarios)} leads de diferencia entre datos diarios y asignados`
      );
    }

    console.log(`✅ DEBUG completado para campaña ${campaignId}`);
    res.status(200).json(response);

  } catch (error: any) {
    console.error(`❌ Error obteniendo datos de campaña ${campaignId}:`, error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
