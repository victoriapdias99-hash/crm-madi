import { db } from './server/db';

async function verifyCampaign84() {
  console.log('🔍 VERIFICANDO CAMPAÑA 84 - ENVIADOS vs ASIGNADOS\n');
  console.log('='.repeat(60) + '\n');

  try {
    // 1. Verificar en mv_dashboard_datos_diarios
    console.log('📊 1. Verificando en VISTA MATERIALIZADA (mv_dashboard_datos_diarios):');
    const dashboardData = await db.execute(`
      SELECT
        campaign_id,
        numero_campana,
        cliente,
        marca,
        zona,
        enviados,
        disponibles,
        duplicados
      FROM mv_dashboard_datos_diarios
      WHERE campaign_id = 84
    `);

    console.log('Resultado:', dashboardData.rows);
    console.log('');

    // 2. Verificar en op_lead
    console.log('📋 2. Verificando LEADS en op_lead con campaign_id = 84:');
    const leadsInOpLead = await db.execute(`
      SELECT COUNT(*) as total
      FROM op_lead
      WHERE campaign_id = 84
    `);

    console.log('Total leads en op_lead:', leadsInOpLead.rows);
    console.log('');

    // 3. Verificar en campanas_comerciales
    console.log('🎯 3. Verificando datos de la CAMPAÑA en campanas_comerciales:');
    const campaignData = await db.execute(`
      SELECT
        id,
        numero_campana,
        cliente_id,
        marca,
        zona,
        enviados,
        disponibles
      FROM campanas_comerciales
      WHERE id = 84
    `);

    console.log('Datos de campaña:', campaignData.rows);
    console.log('');

    // 4. Verificar si hay algún lead con metadata que apunte a campaña 84
    console.log('🔍 4. Verificando si hay leads con referencia a campaña 84 en otros campos:');
    const leadsWithCampaignRef = await db.execute(`
      SELECT
        id,
        nombre,
        campaign,
        campaign_id,
        cliente,
        marca,
        fecha_creacion
      FROM op_lead
      WHERE campaign ILIKE '%84%' OR campaign ILIKE '%Campaña #4%'
      LIMIT 10
    `);

    console.log('Leads con referencia a campaña 84:', leadsWithCampaignRef.rows);
    console.log('');

    // 5. Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN:');
    console.log('='.repeat(60));

    const dashboardEnviados = dashboardData.rows[0]?.enviados || 0;
    const realAssigned = leadsInOpLead.rows[0]?.total || 0;
    const campaignEnviados = campaignData.rows[0]?.enviados || 0;

    console.log(`Vista Materializada (enviados): ${dashboardEnviados}`);
    console.log(`Tabla op_lead (campaign_id=84): ${realAssigned}`);
    console.log(`Tabla campañas (enviados):      ${campaignEnviados}`);

    if (dashboardEnviados != realAssigned) {
      console.log('\n⚠️  DISCREPANCIA DETECTADA!');
      console.log(`La vista materializada muestra ${dashboardEnviados} enviados`);
      console.log(`Pero op_lead solo tiene ${realAssigned} leads con campaign_id=84`);
    } else {
      console.log('\n✅ Los números coinciden correctamente');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

verifyCampaign84();
