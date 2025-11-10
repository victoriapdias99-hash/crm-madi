import { db } from './db';
import { campanasComerciales, opLead } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Script para reabrir una campaña cerrada
 * Útil para testing y correcciones
 */

const campaignId = parseInt(process.argv[2]);

if (!campaignId || isNaN(campaignId)) {
  console.error('❌ Uso: npx tsx server/reopen-campaign.ts <campaign_id>');
  process.exit(1);
}

async function reopenCampaign() {
  console.log(`🔓 REABRIENDO CAMPAÑA ${campaignId}...`);
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Verificar estado actual
    console.log('📋 PASO 1: Verificando estado actual...');
    const current = await db.execute<{
      id: number;
      numero_campana: string;
      cliente: string;
      fecha_fin: Date | null;
      cantidad_datos_solicitados: number;
    }>(sql`
      SELECT
        cc.id,
        cc.numero_campana,
        c.nombre_comercial as cliente,
        cc.fecha_fin,
        cc.cantidad_datos_solicitados
      FROM campanas_comerciales cc
      LEFT JOIN clientes c ON cc.cliente_id = c.id
      WHERE cc.id = ${campaignId}
    `);

    if (current.length === 0) {
      console.error('❌ Campaña no encontrada');
      process.exit(1);
    }

    const campaign = current[0];
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Cliente: ${campaign.cliente}`);
    console.log(`   Número: ${campaign.numero_campana}`);
    console.log(`   Estado actual: ${campaign.fecha_fin ? '🔒 Cerrada' : '🔓 Abierta'}`);
    console.log(`   Fecha fin: ${campaign.fecha_fin || 'N/A'}`);

    if (!campaign.fecha_fin) {
      console.log('\n⚠️ La campaña ya está abierta. No se requiere acción.');
      process.exit(0);
    }

    // 2. Contar leads asignados
    console.log('\n📊 PASO 2: Verificando leads asignados...');
    const leadsCount = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM op_lead
      WHERE campaign_id = ${campaignId}
    `);

    const assignedLeads = leadsCount[0]?.count || 0;
    console.log(`   Leads asignados: ${assignedLeads}`);

    // 3. Desasignar leads
    console.log('\n🔄 PASO 3: Desasignando leads...');
    const unassignResult = await db.execute(sql`
      UPDATE op_lead
      SET campaign_id = NULL
      WHERE campaign_id = ${campaignId}
    `);

    console.log(`   ✅ ${assignedLeads} leads desasignados`);

    // 4. Reabrir campaña (quitar fecha_fin)
    console.log('\n🔓 PASO 4: Reabriendo campaña...');
    await db.execute(sql`
      UPDATE campanas_comerciales
      SET fecha_fin = NULL,
          updated_at = NOW()
      WHERE id = ${campaignId}
    `);

    console.log(`   ✅ Campaña reabierta exitosamente`);

    // 5. Verificar resultado
    console.log('\n✅ PASO 5: Verificando resultado...');
    const verification = await db.execute<{
      fecha_fin: Date | null;
      leads_asignados: number;
    }>(sql`
      SELECT
        cc.fecha_fin,
        COUNT(ol.id)::int as leads_asignados
      FROM campanas_comerciales cc
      LEFT JOIN op_lead ol ON ol.campaign_id = cc.id
      WHERE cc.id = ${campaignId}
      GROUP BY cc.id, cc.fecha_fin
    `);

    const result = verification[0];
    console.log(`   Fecha fin: ${result.fecha_fin || '✅ NULL (abierta)'}`);
    console.log(`   Leads asignados: ${result.leads_asignados || 0}`);

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 CAMPAÑA REABIERTA EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════\n');

    console.log('📝 Siguiente paso:');
    console.log(`   curl -X GET "http://localhost:5000/api/campaign-closure/debug/${campaignId}"`);
    console.log('   Para verificar los datos diarios');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

reopenCampaign();
