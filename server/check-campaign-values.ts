import { db } from './db';
import { opLeadsRep } from '../shared/schema';
import { sql, eq, and } from 'drizzle-orm';

async function checkCampaignValues() {
  console.log('🔍 VERIFICACIÓN: Valores de "campaign" en op_leads_rep\n');

  try {
    // Ver todos los valores únicos de campaign para red_finance + Mendoza
    const campaignValues = await db
      .select({
        campaign: opLeadsRep.campaign,
        count: sql<number>`count(*)::int`
      })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      )
      .groupBy(opLeadsRep.campaign);

    console.log('📊 DISTRIBUCIÓN POR CAMPAIGN:\n');

    let totalPeugeot = 0;
    let totalFiat = 0;
    let totalOtros = 0;

    campaignValues.forEach((row) => {
      const campaign = row.campaign.toLowerCase();

      if (campaign.includes('peugeot')) {
        totalPeugeot += row.count;
        console.log(`   ✅ Peugeot: "${row.campaign}" - ${row.count} leads`);
      } else if (campaign.includes('fiat')) {
        totalFiat += row.count;
        console.log(`   ✅ Fiat: "${row.campaign}" - ${row.count} leads`);
      } else {
        totalOtros += row.count;
        console.log(`   ⚠️ Otro: "${row.campaign}" - ${row.count} leads`);
      }
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📈 RESUMEN:\n');
    console.log(`   Total Peugeot: ${totalPeugeot}`);
    console.log(`   Total Fiat: ${totalFiat}`);
    console.log(`   Total Otros: ${totalOtros}`);
    console.log(`   TOTAL: ${totalPeugeot + totalFiat + totalOtros}`);

    // Ahora verificar cuántos están disponibles vs asignados
    console.log('\n\n🔍 DISPONIBILIDAD POR MARCA:\n');

    // Peugeot disponibles
    const [peugeotDisponibles] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        and(
          sql`${opLeadsRep.campaignId} IS NULL`,
          sql`lower(${opLeadsRep.campaign}) LIKE '%peugeot%'`,
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      );

    const [peugeotAsignados] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        and(
          sql`${opLeadsRep.campaignId} IS NOT NULL`,
          sql`lower(${opLeadsRep.campaign}) LIKE '%peugeot%'`,
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      );

    console.log('   Peugeot:');
    console.log(`      Disponibles (NULL): ${peugeotDisponibles.count}`);
    console.log(`      Asignados (NOT NULL): ${peugeotAsignados.count}`);
    console.log(`      Total: ${totalPeugeot}`);

    // Fiat disponibles
    const [fiatDisponibles] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        and(
          sql`${opLeadsRep.campaignId} IS NULL`,
          sql`lower(${opLeadsRep.campaign}) LIKE '%fiat%'`,
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      );

    const [fiatAsignados] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        and(
          sql`${opLeadsRep.campaignId} IS NOT NULL`,
          sql`lower(${opLeadsRep.campaign}) LIKE '%fiat%'`,
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      );

    console.log('\n   Fiat:');
    console.log(`      Disponibles (NULL): ${fiatDisponibles.count}`);
    console.log(`      Asignados (NOT NULL): ${fiatAsignados.count}`);
    console.log(`      Total: ${totalFiat}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('💡 CONCLUSIÓN:\n');

    if (peugeotAsignados.count === 82 && peugeotDisponibles.count === 0) {
      console.log('   ✅ Los 82 leads de Peugeot están ASIGNADOS a la campaña 65');
      console.log('   ⚠️ Por eso el conteo muestra 0 disponibles para asignar');
      console.log('   ✅ Pero el total (212) incluye estos 82 ya asignados');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkCampaignValues();
