import { db } from './db';
import { opLeadsRep } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function checkSyncResult() {
  console.log('\n📊 RESUMEN DE SINCRONIZACIÓN SMART-FAST\n');

  // Contar por marca
  const byBrand = await db
    .select({
      brand: opLeadsRep.campaign,
      count: sql<number>`count(*)::int`
    })
    .from(opLeadsRep)
    .groupBy(opLeadsRep.campaign)
    .orderBy(opLeadsRep.campaign);

  console.log('Leads por marca:');
  let total = 0;
  byBrand.forEach(b => {
    console.log(`   ${b.brand}: ${b.count} leads`);
    total += b.count;
  });

  console.log(`\n✅ TOTAL: ${total} leads sincronizados`);

  // Contar por source
  const bySource = await db
    .select({
      source: opLeadsRep.source,
      count: sql<number>`count(*)::int`
    })
    .from(opLeadsRep)
    .groupBy(opLeadsRep.source);

  console.log('\nPor fuente:');
  bySource.forEach(s => {
    console.log(`   ${s.source}: ${s.count} leads`);
  });

  process.exit(0);
}

checkSyncResult();
