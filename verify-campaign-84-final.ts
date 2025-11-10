import { db } from './server/db';

async function verifyCampaign84() {
  console.log('🔍 VERIFICANDO CAMPAÑA 84 - ENVIADOS\n');
  console.log('='.repeat(70) + '\n');

  try {
    const campaignId = 84;

    // 1. Vista materializada (como se muestra en el dashboard)
    console.log('📊 1. VISTA MATERIALIZADA (mv_dashboard_datos_diarios):');
    const mvData = await db.execute(`
      SELECT
        id,
        numero_campana,
        nombre_cliente,
        marca,
        zona,
        enviados,
        duplicados,
        total_duplicados
      FROM mv_dashboard_datos_diarios
      WHERE id = ${campaignId}
    `);
    console.log(mvData.rows[0] || 'No encontrado');
    console.log('');

    // 2. op_leads_rep (vista que usa la materializada)
    console.log('📋 2. OP_LEADS_REP (vista de leads únicos):');
    const repData = await db.execute(`
      SELECT COUNT(DISTINCT id) as total_unicos
      FROM op_leads_rep
      WHERE campaign_id = ${campaignId}
    `);
    console.log(`Total leads únicos en op_leads_rep: ${repData.rows[0]?.total_unicos || 0}`);
    console.log('');

    // 3. op_lead (tabla real donde se asignan los leads)
    console.log('💾 3. OP_LEAD (tabla real de leads):');
    const opLeadData = await db.execute(`
      SELECT COUNT(*) as total
      FROM op_lead
      WHERE campaign_id = ${campaignId}
    `);
    console.log(`Total leads en op_lead: ${opLeadData.rows[0]?.total || 0}`);
    console.log('');

    // 4. Verificar la campaña
    console.log('🎯 4. DATOS DE LA CAMPAÑA:');
    const campaignData = await db.execute(`
      SELECT
        id,
        numero_campana,
        cliente_id,
        marca,
        zona,
        cantidad_datos_solicitados,
        enviados,
        disponibles
      FROM campanas_comerciales
      WHERE id = ${campaignId}
    `);
    console.log(campaignData.rows[0] || 'No encontrado');
    console.log('');

    // 5. RESUMEN Y DIAGNÓSTICO
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN Y DIAGNÓSTICO:');
    console.log('='.repeat(70));

    const mvEnviados = mvData.rows[0]?.enviados || 0;
    const repUnicos = repData.rows[0]?.total_unicos || 0;
    const opLeadTotal = opLeadData.rows[0]?.total || 0;
    const campaignEnviados = campaignData.rows[0]?.enviados || 0;

    console.log(`\nVista Materializada (enviados):    ${mvEnviados}`);
    console.log(`op_leads_rep (únicos):             ${repUnicos}`);
    console.log(`op_lead (total con campaign_id):   ${opLeadTotal}`);
    console.log(`campanas_comerciales (enviados):   ${campaignEnviados}\n`);

    console.log('📌 CONCLUSIÓN:');
    console.log('─'.repeat(70));

    if (mvEnviados > 0 && opLeadTotal === 0) {
      console.log('⚠️  DISCREPANCIA DETECTADA:');
      console.log(`   - La vista materializada muestra ${mvEnviados} leads enviados`);
      console.log(`   - Pero op_lead tiene 0 leads con campaign_id=${campaignId}`);
      console.log('\n🔍 Posibles causas:');
      console.log('   1. La vista materializada está desactualizada (necesita REFRESH)');
      console.log('   2. Los leads fueron reasignados a otra campaña');
      console.log('   3. Error en el proceso de asignación');
      console.log('\n💡 Solución: REFRESH MATERIALIZED VIEW mv_dashboard_datos_diarios');
    } else if (mvEnviados === 0 && opLeadTotal === 0) {
      console.log('✅ CORRECTO: La campaña 84 no tiene leads asignados');
      console.log('   Tanto la vista materializada como op_lead muestran 0 leads');
    } else if (mvEnviados === opLeadTotal) {
      console.log('✅ CORRECTO: Los números coinciden perfectamente');
      console.log(`   ${mvEnviados} leads asignados en ambas fuentes`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

verifyCampaign84();
