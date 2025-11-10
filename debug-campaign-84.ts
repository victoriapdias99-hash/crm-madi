/**
 * Script de debugging para entender por qué campaña 84 tiene enviados pero no retorna leads
 */

import { db } from './server/db';
import { campanasComerciales, opLead } from '@shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';

async function debugCampaign84() {
  console.log('🔍 DEBUG: Investigando campaña 84\n');

  try {
    // PASO 1: Ver datos de la campaña en campanas_comerciales
    console.log('📋 PASO 1: Datos de campanas_comerciales');
    const campaignInfo = await db
      .select()
      .from(campanasComerciales)
      .where(eq(campanasComerciales.id, 84))
      .limit(1);

    if (campaignInfo.length === 0) {
      console.log('❌ Campaña 84 no existe en campanas_comerciales');
      return;
    }

    const campaign = campaignInfo[0];
    console.log('✅ Campaña encontrada:');
    console.log(JSON.stringify(campaign, null, 2));
    console.log('');

    // PASO 2: Ver datos de la vista materializada
    console.log('📊 PASO 2: Datos de mv_dashboard_datos_diarios');
    const viewData = await db.execute(sql`
      SELECT * FROM mv_dashboard_datos_diarios
      WHERE id = 84
    `);

    if (viewData.rows.length > 0) {
      console.log('✅ Datos de la vista:');
      console.log(JSON.stringify(viewData.rows[0], null, 2));
      console.log('');
      console.log(`Campo "enviados": ${viewData.rows[0].enviados}`);
      console.log('');
    } else {
      console.log('⚠️ No se encontró en la vista materializada');
    }

    // PASO 3: Contar leads en op_lead con campaign_id = 84
    console.log('📊 PASO 3: Contando leads en op_lead con campaign_id = 84');
    const countWithCampaignId = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(
        and(
          eq(opLead.campaignId, 84),
          isNotNull(opLead.campaignId)
        )
      );

    const leadsWithCampaignId = countWithCampaignId[0]?.count || 0;
    console.log(`✅ Leads con campaign_id = 84: ${leadsWithCampaignId}`);
    console.log('');

    // PASO 4: Ver definición de la vista materializada
    console.log('📊 PASO 4: Verificando cómo se calcula "enviados" en la vista');
    const viewDefinition = await db.execute(sql`
      SELECT pg_get_viewdef('mv_dashboard_datos_diarios', true) as definition;
    `);

    if (viewDefinition.rows.length > 0) {
      const def = viewDefinition.rows[0].definition;
      // Buscar la parte que calcula enviados
      const enviadosMatch = def.match(/enviados[^,]*/i);
      if (enviadosMatch) {
        console.log('📝 Cálculo de "enviados" en la vista:');
        console.log(enviadosMatch[0]);
        console.log('');
      }
    }

    // PASO 5: Verificar si existen leads con otros identificadores
    console.log('📊 PASO 5: Buscando leads relacionados de otras formas');

    // Verificar por número de campaña y cliente
    const leadsWithQuery = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM op_lead
      WHERE campaign_id = 84
    `);

    console.log(`Total leads con campaign_id = 84: ${leadsWithQuery.rows[0]?.count || 0}`);
    console.log('');

    // Paso 6: Ver cómo se calcula en el endpoint actual
    console.log('📋 PASO 6: Query actual del endpoint /api/leads/sent-by-campaign/84');
    const endpointQuery = await db
      .select({
        id: opLead.id,
        metaLeadId: opLead.metaLeadId,
        campaignId: opLead.campaignId,
      })
      .from(opLead)
      .where(
        and(
          eq(opLead.campaignId, 84),
          isNotNull(opLead.campaignId)
        )
      )
      .limit(5);

    console.log(`Leads retornados por la query del endpoint: ${endpointQuery.length}`);
    if (endpointQuery.length > 0) {
      console.log('Primeros 5 leads:');
      console.log(JSON.stringify(endpointQuery, null, 2));
    }
    console.log('');

    // PASO 7: CONCLUSIÓN
    console.log('🎯 CONCLUSIÓN:');
    console.log(`   - Enviados en la vista: ${viewData.rows[0]?.enviados || 0}`);
    console.log(`   - Leads con campaign_id = 84: ${leadsWithCampaignId}`);
    console.log('');

    if (viewData.rows[0]?.enviados > 0 && leadsWithCampaignId === 0) {
      console.log('⚠️ DISCREPANCIA DETECTADA:');
      console.log('   La vista dice que hay leads enviados, pero no hay leads con campaign_id = 84');
      console.log('');
      console.log('💡 POSIBLES CAUSAS:');
      console.log('   1. La vista usa un cálculo diferente para "enviados"');
      console.log('   2. Los leads están marcados con otro identificador');
      console.log('   3. Hay un desfase entre la vista materializada y los datos reales');
      console.log('');
      console.log('🔧 SOLUCIÓN:');
      console.log('   Necesitas actualizar el endpoint para usar la misma lógica que la vista materializada');
    } else if (viewData.rows[0]?.enviados === leadsWithCampaignId) {
      console.log('✅ Los datos coinciden perfectamente');
    }

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  }

  process.exit(0);
}

debugCampaign84();
