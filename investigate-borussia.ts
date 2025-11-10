import { db } from './server/db';
import { opLead } from './shared/schema';
import { sql, and, eq } from 'drizzle-orm';

async function investigate() {
  console.log('🔍 Investigando Borussia campaña 84...\n');

  // Check which campaigns have Borussia leads
  const borussiaLeads = await db
    .select({
      campaignId: opLead.campaignId,
      count: sql<number>`count(*)::int`
    })
    .from(opLead)
    .where(
      and(
        eq(opLead.cliente, 'borussia'),
        eq(opLead.localizacion, 'Pais'),
        sql`${opLead.campaignId} IS NOT NULL`
      )
    )
    .groupBy(opLead.campaignId);

  console.log('📊 Leads de Borussia por campaña:');
  borussiaLeads.forEach(row => {
    console.log(`   Campaña ${row.campaignId}: ${row.count} leads`);
  });

  const total = borussiaLeads.reduce((sum, row) => sum + row.count, 0);
  console.log(`   TOTAL: ${total} leads\n`);

  // Check leads matching Borussia 84 filters with multi-brand
  console.log('📊 Leads con filtros genéricos (multi-marca Fiat, VW, Chevrolet, Peugeot):');
  const multiBrandLeads = await db
    .select({
      campaignId: opLead.campaignId,
      campaign: opLead.campaign,
      count: sql<number>`count(*)::int`
    })
    .from(opLead)
    .where(
      and(
        sql`(
          lower(${opLead.campaign}) LIKE '%fiat%' OR
          lower(${opLead.campaign}) LIKE '%vw%' OR
          lower(${opLead.campaign}) LIKE '%chevrolet%' OR
          lower(${opLead.campaign}) LIKE '%peugeot%'
        )`,
        eq(opLead.cliente, 'borussia'),
        eq(opLead.localizacion, 'Pais'),
        sql`${opLead.campaignId} IS NOT NULL`,
        sql`date(${opLead.fechaCreacion}) >= '2025-09-22'`
      )
    )
    .groupBy(opLead.campaignId, opLead.campaign);

  multiBrandLeads.forEach(row => {
    console.log(`   Campaña ${row.campaignId} (${row.campaign}): ${row.count} leads`);
  });

  const totalMulti = multiBrandLeads.reduce((sum, row) => sum + row.count, 0);
  console.log(`   TOTAL: ${totalMulti} leads`);

  await db.$client.end();
}

investigate();
