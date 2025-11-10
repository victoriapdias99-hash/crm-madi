import { db } from './db';
import { opLeadsRep } from '../shared/schema';
import { sql, isNull, ilike } from 'drizzle-orm';

async function debugLeads() {
  console.log('🔍 DEBUG: Investigando leads disponibles para Red Finance\n');

  try {
    // 1. Verificar total de leads sin asignar
    console.log('1️⃣ TOTAL DE LEADS SIN ASIGNAR:');
    const [totalUnassigned] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(isNull(opLeadsRep.campaignId));
    console.log('   Total sin asignar:', totalUnassigned.count);

    // 2. Buscar leads con cliente "Red Finance" (varias variaciones)
    console.log('\n2️⃣ LEADS CON CLIENTE SIMILAR A "RED FINANCE":');
    const clientVariations = ['red finance', 'redfinance', 'red', 'finance'];

    for (const variation of clientVariations) {
      const [count] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLeadsRep)
        .where(
          sql`${isNull(opLeadsRep.campaignId)} AND lower(${opLeadsRep.cliente}) LIKE ${`%${variation}%`}`
        );
      console.log(`   "${variation}":`, count.count);
    }

    // 3. Ver ejemplos de clientes disponibles
    console.log('\n3️⃣ EJEMPLOS DE CLIENTES DISPONIBLES (primeros 20):');
    const clients = await db
      .selectDistinct({ cliente: opLeadsRep.cliente })
      .from(opLeadsRep)
      .where(isNull(opLeadsRep.campaignId))
      .limit(20);

    clients.forEach((c, idx) => {
      console.log(`   ${idx + 1}. "${c.cliente}"`);
    });

    // 4. Buscar leads con marcas Peugeot o Fiat
    console.log('\n4️⃣ LEADS CON MARCAS PEUGEOT O FIAT:');

    const [peugeotCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)} AND lower(${opLeadsRep.campaign}) LIKE '%peugeot%'`
      );
    console.log('   Peugeot:', peugeotCount.count);

    const [fiatCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)} AND lower(${opLeadsRep.campaign}) LIKE '%fiat%'`
      );
    console.log('   Fiat:', fiatCount.count);

    // 5. Ver ejemplos de campaigns disponibles
    console.log('\n5️⃣ EJEMPLOS DE CAMPAIGNS DISPONIBLES (primeros 20):');
    const campaigns = await db
      .selectDistinct({ campaign: opLeadsRep.campaign })
      .from(opLeadsRep)
      .where(isNull(opLeadsRep.campaignId))
      .limit(20);

    campaigns.forEach((c, idx) => {
      console.log(`   ${idx + 1}. "${c.campaign}"`);
    });

    // 6. Buscar leads en Mendoza
    console.log('\n6️⃣ LEADS EN MENDOZA:');
    const [mendozaCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)} AND lower(${opLeadsRep.localizacion}) LIKE '%mendoza%'`
      );
    console.log('   Mendoza:', mendozaCount.count);

    // 7. Ver ejemplos de localizaciones disponibles
    console.log('\n7️⃣ LOCALIZACIONES DISPONIBLES:');
    const locations = await db
      .selectDistinct({ localizacion: opLeadsRep.localizacion })
      .from(opLeadsRep)
      .where(isNull(opLeadsRep.campaignId));

    locations.forEach((l, idx) => {
      console.log(`   ${idx + 1}. "${l.localizacion}"`);
    });

    // 8. Buscar combinación exacta: Peugeot + Mendoza
    console.log('\n8️⃣ COMBINACIÓN: PEUGEOT + MENDOZA:');
    const [peugeotMendoza] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)}
            AND lower(${opLeadsRep.campaign}) LIKE '%peugeot%'
            AND lower(${opLeadsRep.localizacion}) LIKE '%mendoza%'`
      );
    console.log('   Peugeot + Mendoza:', peugeotMendoza.count);

    // 9. Buscar combinación exacta: Fiat + Mendoza
    console.log('\n9️⃣ COMBINACIÓN: FIAT + MENDOZA:');
    const [fiatMendoza] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)}
            AND lower(${opLeadsRep.campaign}) LIKE '%fiat%'
            AND lower(${opLeadsRep.localizacion}) LIKE '%mendoza%'`
      );
    console.log('   Fiat + Mendoza:', fiatMendoza.count);

    // 10. Ver un ejemplo completo de lead
    console.log('\n🔟 EJEMPLO DE LEAD COMPLETO (primer registro):');
    const [exampleLead] = await db
      .select({
        id: opLeadsRep.id,
        campaign: opLeadsRep.campaign,
        cliente: opLeadsRep.cliente,
        localizacion: opLeadsRep.localizacion,
        source: opLeadsRep.source,
        campaignId: opLeadsRep.campaignId,
        fechaCreacion: opLeadsRep.fechaCreacion,
      })
      .from(opLeadsRep)
      .where(isNull(opLeadsRep.campaignId))
      .limit(1);

    if (exampleLead) {
      console.log('   ID:', exampleLead.id);
      console.log('   Campaign:', exampleLead.campaign);
      console.log('   Cliente:', exampleLead.cliente);
      console.log('   Localización:', exampleLead.localizacion);
      console.log('   Source:', exampleLead.source);
      console.log('   Campaign ID:', exampleLead.campaignId);
      console.log('   Fecha:', exampleLead.fechaCreacion);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

debugLeads();
