import { db } from './db';
import { opLeadsRep } from '../shared/schema';
import { sql, isNull } from 'drizzle-orm';

async function checkFiatMendoza() {
  console.log('🔍 INVESTIGANDO LEADS: Fiat + Mendoza\n');

  try {
    // Ver clientes con Fiat + Mendoza
    const clientsWithFiatMendoza = await db
      .select({
        cliente: opLeadsRep.cliente,
        count: sql<number>`count(*)::int`
      })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)}
            AND lower(${opLeadsRep.campaign}) LIKE '%fiat%'
            AND ${opLeadsRep.localizacion} = 'Mendoza'`
      )
      .groupBy(opLeadsRep.cliente);

    console.log('📊 CLIENTES CON FIAT + MENDOZA:');
    clientsWithFiatMendoza.forEach((item) => {
      console.log(`   Cliente: "${item.cliente}" - ${item.count} leads`);
    });

    // Ver ejemplos completos
    console.log('\n📋 EJEMPLOS DE LEADS (primeros 5):');
    const examples = await db
      .select({
        id: opLeadsRep.id,
        campaign: opLeadsRep.campaign,
        cliente: opLeadsRep.cliente,
        localizacion: opLeadsRep.localizacion,
        marca: opLeadsRep.marca,
        fechaCreacion: opLeadsRep.fechaCreacion,
      })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)}
            AND lower(${opLeadsRep.campaign}) LIKE '%fiat%'
            AND ${opLeadsRep.localizacion} = 'Mendoza'`
      )
      .limit(5);

    examples.forEach((lead, idx) => {
      console.log(`\n   Lead ${idx + 1}:`);
      console.log(`      ID: ${lead.id}`);
      console.log(`      Campaign: ${lead.campaign}`);
      console.log(`      Cliente: ${lead.cliente}`);
      console.log(`      Marca: ${lead.marca}`);
      console.log(`      Localización: ${lead.localizacion}`);
      console.log(`      Fecha: ${lead.fechaCreacion}`);
    });

    // Verificar el nombre exacto del cliente en la campaña
    console.log('\n🔍 VERIFICANDO NOMBRE DEL CLIENTE EN LA CAMPAÑA:');
    const { campanasComerciales, clientes } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');

    const [campaign] = await db
      .select({
        nombreComercial: clientes.nombreComercial,
        nombreCliente: clientes.nombreCliente,
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
      .where(eq(campanasComerciales.id, 65));

    if (campaign) {
      console.log('   Nombre Comercial:', campaign.nombreComercial);
      console.log('   Nombre Cliente:', campaign.nombreCliente);
      console.log('   Normalizado:', campaign.nombreComercial?.toLowerCase().replace(/\s+/g, ' ').trim());
    }

    // Verificar si hay match con alguna variación
    console.log('\n🔍 PROBANDO VARIACIONES DE NORMALIZACIÓN:');

    const possibleNames = [
      'red finance',
      'redfinance',
      'red_finance',
      'Red Finance'
    ];

    for (const name of possibleNames) {
      const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
      console.log(`\n   Buscando: "${normalized}"`);

      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLeadsRep)
        .where(
          sql`${isNull(opLeadsRep.campaignId)}
              AND lower(${opLeadsRep.campaign}) LIKE '%fiat%'
              AND ${opLeadsRep.localizacion} = 'Mendoza'
              AND ${opLeadsRep.cliente} = ${normalized}`
        );

      console.log(`   Resultado: ${result.count} leads`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkFiatMendoza();
