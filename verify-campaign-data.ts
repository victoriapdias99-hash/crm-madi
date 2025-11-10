import { db } from './server/db';
import { opLeadsRep } from './shared/schema';
import { eq, isNotNull, count, sql } from 'drizzle-orm';

async function verifyCampaignData() {
  console.log('🔍 Verificando datos de campañas en op_leads_rep...\n');

  try {
    // 1. Contar total de leads con campaign_id
    const totalWithCampaignId = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(isNotNull(opLeadsRep.campaignId));

    console.log(`📊 Total de leads con campaign_id: ${totalWithCampaignId[0]?.count || 0}`);

    // 2. Contar total de leads sin campaign_id
    const totalWithoutCampaignId = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(sql`${opLeadsRep.campaignId} IS NULL`);

    console.log(`📊 Total de leads SIN campaign_id: ${totalWithoutCampaignId[0]?.count || 0}\n`);

    // 3. Obtener distribución de leads por campaign_id
    const leadsPerCampaign = await db
      .select({
        campaignId: opLeadsRep.campaignId,
        totalLeads: count(),
        duplicados: sql<number>`SUM(CASE WHEN ${opLeadsRep.cantidadDuplicados} > 0 THEN 1 ELSE 0 END)`
      })
      .from(opLeadsRep)
      .where(isNotNull(opLeadsRep.campaignId))
      .groupBy(opLeadsRep.campaignId)
      .orderBy(opLeadsRep.campaignId)
      .limit(20);

    if (leadsPerCampaign.length > 0) {
      console.log('📋 Leads por campaña (primeras 20):');
      console.log('campaign_id | total_leads | duplicados');
      console.log('------------|-------------|------------');
      leadsPerCampaign.forEach(row => {
        console.log(`${String(row.campaignId).padEnd(11)} | ${String(row.totalLeads).padEnd(11)} | ${row.duplicados}`);
      });
    } else {
      console.log('❌ No se encontraron leads con campaign_id asignado');
    }

    // 4. Verificar campañas específicas (IDs de campañas finalizadas)
    console.log('\n🔍 Verificando campañas finalizadas específicas:');
    const campaignIdsToCheck = [37, 38, 65, 84, 85, 86]; // IDs del curl anterior

    for (const campaignId of campaignIdsToCheck) {
      const result = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(eq(opLeadsRep.campaignId, campaignId));

      const leadsCount = result[0]?.count || 0;
      console.log(`  Campaña ${campaignId}: ${leadsCount} leads`);
    }

  } catch (error: any) {
    console.error('❌ Error verificando datos:', error);
    throw error;
  }

  process.exit(0);
}

verifyCampaignData();
