import { db } from './db';
import { campanasComerciales, clientes, opLeadsRep } from '../shared/schema';
import { sql, eq, ilike, and, count } from 'drizzle-orm';
import { normalizeClientName } from '../shared/utils/client-normalization';

/**
 * Diagnóstico expandido para Red Finance
 * Busca con múltiples criterios ya que "finance" no aparece en marca
 */
async function expandedRedFinanceDiagnosis() {
  console.log('🔍 DIAGNÓSTICO EXPANDIDO RED FINANCE\n');

  try {
    // 1. Buscar en clientes con múltiples criterios
    console.log('📊 PASO 1: Buscando clientes Red Finance');
    const clientesRedFinance = await db
      .select()
      .from(clientes)
      .where(
        sql`lower(${clientes.nombreCliente}) LIKE '%red%' OR
            lower(${clientes.nombreCliente}) LIKE '%finance%' OR
            lower(${clientes.nombreComercial}) LIKE '%red%' OR
            lower(${clientes.nombreComercial}) LIKE '%finance%'`
      );

    console.log(`✅ Encontrados ${clientesRedFinance.length} clientes con "red" o "finance":`);
    clientesRedFinance.forEach(c => {
      console.log(`   - ID: ${c.id}, Nombre: "${c.nombreCliente}", Comercial: "${c.nombreComercial}"`);
    });

    // 2. Para cada cliente encontrado, buscar sus campañas
    if (clientesRedFinance.length > 0) {
      console.log('\n📊 PASO 2: Buscando campañas para estos clientes');

      for (const cliente of clientesRedFinance) {
        const campanas = await db
          .select()
          .from(campanasComerciales)
          .where(eq(campanasComerciales.clienteId, cliente.id));

        console.log(`\n🔍 CLIENTE: ${cliente.nombreCliente} (ID: ${cliente.id})`);
        console.log(`   📋 Campañas encontradas: ${campanas.length}`);

        campanas.forEach(c => {
          console.log(`   - Marca: "${c.marca}", Campaña: ${c.numeroCampana}, Zona: ${c.zona}, Solicitados: ${c.cantidadDatosSolicitados}`);
        });

        if (campanas.length > 0) {
          // Verificar normalización
          const nombreNormalizado = normalizeClientName(cliente.nombreComercial);
          console.log(`   🔧 Normalizado: "${cliente.nombreComercial}" → "${nombreNormalizado}"`);

          // Para cada campaña, verificar leads
          for (const campana of campanas) {
            console.log(`\n   🎯 ANALIZANDO CAMPAÑA: ${campana.marca} ${campana.numeroCampana}`);

            const mapeoZonas: Record<string, string> = {
              'NACIONAL': 'Pais',
              'AMBA': 'Amba',
              'Córdoba': 'Cordoba',
              'Santa Fe': 'Santa Fe'
            };
            const localizacionFiltro = mapeoZonas[campana.zona as keyof typeof mapeoZonas] || campana.zona || 'Pais';

            // Query completa igual que en routes.ts
            const conditions = [
              ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`),
              eq(opLeadsRep.cliente, nombreNormalizado),
              eq(opLeadsRep.localizacion, localizacionFiltro),
              eq(opLeadsRep.source, 'google_sheets'),
              sql`${opLeadsRep.campaignId} IS NULL`
            ];

            const leadsCount = await db
              .select({ count: count() })
              .from(opLeadsRep)
              .where(and(...conditions));

            console.log(`      🎯 RESULTADO QUERY COMPLETA: ${leadsCount[0]?.count || 0} leads`);

            // Verificar cada filtro individualmente
            const leadsPorMarca = await db
              .select({ count: count() })
              .from(opLeadsRep)
              .where(ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`));
            console.log(`      📊 Solo marca "${campana.marca}": ${leadsPorMarca[0]?.count || 0}`);

            const leadsPorCliente = await db
              .select({ count: count() })
              .from(opLeadsRep)
              .where(eq(opLeadsRep.cliente, nombreNormalizado));
            console.log(`      📊 Solo cliente "${nombreNormalizado}": ${leadsPorCliente[0]?.count || 0}`);

            const leadsPorZona = await db
              .select({ count: count() })
              .from(opLeadsRep)
              .where(eq(opLeadsRep.localizacion, localizacionFiltro));
            console.log(`      📊 Solo zona "${localizacionFiltro}": ${leadsPorZona[0]?.count || 0}`);
          }
        }
      }
    }

    // 3. Buscar directamente en op_leads_rep por "red" o "finance"
    console.log('\n📊 PASO 3: Búsqueda directa en op_leads_rep');

    const leadsRedFinance = await db
      .select({
        campaign: opLeadsRep.campaign,
        cliente: opLeadsRep.cliente,
        marca: opLeadsRep.marca,
        localizacion: opLeadsRep.localizacion,
        count: sql<number>`count(*)`
      })
      .from(opLeadsRep)
      .where(
        sql`lower(${opLeadsRep.campaign}) LIKE '%red%' OR
            lower(${opLeadsRep.campaign}) LIKE '%finance%' OR
            lower(${opLeadsRep.cliente}) LIKE '%red%' OR
            lower(${opLeadsRep.cliente}) LIKE '%finance%' OR
            lower(${opLeadsRep.marca}) LIKE '%red%' OR
            lower(${opLeadsRep.marca}) LIKE '%finance%'`
      )
      .groupBy(opLeadsRep.campaign, opLeadsRep.cliente, opLeadsRep.marca, opLeadsRep.localizacion)
      .limit(10);

    console.log(`✅ Leads con "red" o "finance" en op_leads_rep:`);
    leadsRedFinance.forEach(l => {
      console.log(`   - Campaign: "${l.campaign}", Cliente: "${l.cliente}", Marca: "${l.marca}", Loc: "${l.localizacion}", Count: ${l.count}`);
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico expandido:', error);
  }
}

// Ejecutar diagnóstico
expandedRedFinanceDiagnosis().then(() => {
  console.log('\n✅ Diagnóstico expandido completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});