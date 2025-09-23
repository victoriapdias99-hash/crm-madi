import { db } from './db';
import { opLeadsRep } from '../shared/schema';
import { sql, eq, ilike, and } from 'drizzle-orm';

/**
 * Test específico para verificar los valores exactos de source y campaignId
 * en los registros de Red Finance
 */
async function specificRedFinanceTest() {
  console.log('🔬 TEST ESPECÍFICO RED FINANCE - Verificando filtros problemáticos\n');

  try {
    // 1. Verificar todos los registros de red_finance con Peugeot en Mendoza
    console.log('📊 PASO 1: Registros exactos de Red Finance + Peugeot + Mendoza');
    const registrosRedFinance = await db
      .select({
        id: opLeadsRep.id,
        campaign: opLeadsRep.campaign,
        cliente: opLeadsRep.cliente,
        localizacion: opLeadsRep.localizacion,
        marca: opLeadsRep.marca,
        source: opLeadsRep.source,
        campaignId: opLeadsRep.campaignId,
        fechaCreacion: opLeadsRep.fechaCreacion
      })
      .from(opLeadsRep)
      .where(
        and(
          ilike(opLeadsRep.campaign, '%peugeot%'),
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      )
      .limit(5);

    console.log(`✅ Encontrados ${registrosRedFinance.length} registros de Red Finance + Peugeot + Mendoza:`);
    registrosRedFinance.forEach((r, i) => {
      console.log(`   ${i+1}. ID: ${r.id}`);
      console.log(`      Campaign: "${r.campaign}"`);
      console.log(`      Cliente: "${r.cliente}"`);
      console.log(`      Localización: "${r.localizacion}"`);
      console.log(`      Marca: "${r.marca}"`);
      console.log(`      Source: "${r.source}"`);
      console.log(`      CampaignID: ${r.campaignId}`);
      console.log(`      Fecha: ${r.fechaCreacion}`);
      console.log('');
    });

    // 2. Verificar específicamente los valores de source
    console.log('📊 PASO 2: Análisis de valores de SOURCE');
    const sourceValues = await db
      .select({
        source: opLeadsRep.source,
        count: sql<number>`count(*)`
      })
      .from(opLeadsRep)
      .where(
        and(
          ilike(opLeadsRep.campaign, '%peugeot%'),
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      )
      .groupBy(opLeadsRep.source);

    console.log('✅ Valores de source en registros Red Finance + Peugeot + Mendoza:');
    sourceValues.forEach(s => {
      console.log(`   - Source: "${s.source}" → Count: ${s.count}`);
    });

    // 3. Verificar específicamente los valores de campaignId
    console.log('\n📊 PASO 3: Análisis de valores de CAMPAIGN_ID');
    const campaignIdValues = await db
      .select({
        campaignId: opLeadsRep.campaignId,
        count: sql<number>`count(*)`
      })
      .from(opLeadsRep)
      .where(
        and(
          ilike(opLeadsRep.campaign, '%peugeot%'),
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      )
      .groupBy(opLeadsRep.campaignId);

    console.log('✅ Valores de campaignId en registros Red Finance + Peugeot + Mendoza:');
    campaignIdValues.forEach(c => {
      console.log(`   - CampaignID: ${c.campaignId} → Count: ${c.count}`);
    });

    // 4. Test sin filtros problemáticos
    console.log('\n📊 PASO 4: Query SIN filtros problemáticos (source y campaignId)');
    const sinFiltrosProblematicos = await db
      .select({ count: sql<number>`count(*)` })
      .from(opLeadsRep)
      .where(
        and(
          ilike(opLeadsRep.campaign, '%peugeot%'),
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      );

    console.log(`✅ Sin filtros problemáticos: ${sinFiltrosProblematicos[0]?.count || 0} leads`);

    // 5. Test con filtro source = 'google_sheets'
    console.log('\n📊 PASO 5: Query CON filtro source = "google_sheets"');
    const conFiltroSource = await db
      .select({ count: sql<number>`count(*)` })
      .from(opLeadsRep)
      .where(
        and(
          ilike(opLeadsRep.campaign, '%peugeot%'),
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza'),
          eq(opLeadsRep.source, 'google_sheets')
        )
      );

    console.log(`✅ Con filtro source: ${conFiltroSource[0]?.count || 0} leads`);

    // 6. Test con filtro campaignId IS NULL
    console.log('\n📊 PASO 6: Query CON filtro campaignId IS NULL');
    const conFiltroCampaignId = await db
      .select({ count: sql<number>`count(*)` })
      .from(opLeadsRep)
      .where(
        and(
          ilike(opLeadsRep.campaign, '%peugeot%'),
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza'),
          sql`${opLeadsRep.campaignId} IS NULL`
        )
      );

    console.log(`✅ Con filtro campaignId IS NULL: ${conFiltroCampaignId[0]?.count || 0} leads`);

  } catch (error) {
    console.error('❌ Error en test específico:', error);
  }
}

// Ejecutar test
specificRedFinanceTest().then(() => {
  console.log('\n✅ Test específico completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});