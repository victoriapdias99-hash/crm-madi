import { db } from './db';
import { campanasComerciales, clientes, opLeadsRep } from '../shared/schema';
import { sql, eq, ilike, and, count } from 'drizzle-orm';
import { normalizeClientName } from '../shared/utils/client-normalization';

/**
 * Test de diagnóstico específico para Red Finance
 * Analiza por qué las campañas aparecen con conteo en 0
 */
async function diagnoseRedFinance() {
  console.log('🔍 DIAGNÓSTICO RED FINANCE - Iniciando análisis...\n');

  try {
    // 1. Buscar campañas de Red Finance
    console.log('📊 PASO 1: Buscando campañas de Red Finance en BD');
    const campanasRedFinance = await db
      .select({
        id: campanasComerciales.id,
        clienteId: campanasComerciales.clienteId,
        marca: campanasComerciales.marca,
        numeroCampana: campanasComerciales.numeroCampana,
        zona: campanasComerciales.zona,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
        cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados
      })
      .from(campanasComerciales)
      .where(ilike(campanasComerciales.marca, '%finance%'));

    console.log(`✅ Encontradas ${campanasRedFinance.length} campañas con 'finance' en la marca:`);
    campanasRedFinance.forEach(c => {
      console.log(`   - ID: ${c.id}, Marca: ${c.marca}, Campaña: ${c.numeroCampana}, Cliente ID: ${c.clienteId}, Zona: ${c.zona}`);
    });

    if (campanasRedFinance.length === 0) {
      console.log('❌ No se encontraron campañas con "finance" en la marca');
      return;
    }

    // 2. Para cada campaña, obtener datos del cliente
    console.log('\n📊 PASO 2: Analizando datos de clientes');
    for (const campana of campanasRedFinance) {
      console.log(`\n🔍 CAMPAÑA ${campana.marca} ${campana.numeroCampana}:`);

      const cliente = await db
        .select()
        .from(clientes)
        .where(eq(clientes.id, campana.clienteId))
        .limit(1);

      if (cliente.length === 0) {
        console.log(`❌ Cliente ID ${campana.clienteId} no encontrado`);
        continue;
      }

      const clienteData = cliente[0];
      console.log(`   📋 Cliente: ${clienteData.nombreCliente}`);
      console.log(`   📋 Nombre Comercial: ${clienteData.nombreComercial}`);

      // 3. Verificar normalización
      const nombreComercialNormalizado = normalizeClientName(clienteData.nombreComercial);
      console.log(`   🔧 Normalizado: "${clienteData.nombreComercial}" → "${nombreComercialNormalizado}"`);

      // 4. Mapeo de zona
      const mapeoZonas: Record<string, string> = {
        'NACIONAL': 'Pais',
        'AMBA': 'Amba',
        'Córdoba': 'Cordoba',
        'Santa Fe': 'Santa Fe'
      };
      const localizacionFiltro = mapeoZonas[campana.zona as keyof typeof mapeoZonas] || campana.zona || 'Pais';
      console.log(`   🗺️ Zona campaña: "${campana.zona}" → Filtro: "${localizacionFiltro}"`);

      // 5. Verificar datos en op_leads_rep
      console.log(`\n   🔍 VERIFICANDO LEADS EN op_leads_rep:`);

      // 5a. Buscar por marca
      const leadsPorMarca = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`));

      console.log(`   📊 Leads con marca "${campana.marca.toLowerCase()}": ${leadsPorMarca[0]?.count || 0}`);

      // 5b. Buscar por cliente normalizado
      const leadsPorCliente = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(eq(opLeadsRep.cliente, nombreComercialNormalizado));

      console.log(`   📊 Leads con cliente "${nombreComercialNormalizado}": ${leadsPorCliente[0]?.count || 0}`);

      // 5c. Buscar por localización
      const leadsPorLocalizacion = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(eq(opLeadsRep.localizacion, localizacionFiltro));

      console.log(`   📊 Leads con localización "${localizacionFiltro}": ${leadsPorLocalizacion[0]?.count || 0}`);

      // 5d. Verificar combinación de filtros (la query real)
      const conditions = [
        ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`),
        eq(opLeadsRep.cliente, nombreComercialNormalizado),
        eq(opLeadsRep.localizacion, localizacionFiltro),
        eq(opLeadsRep.source, 'google_sheets'),
        sql`${opLeadsRep.campaignId} IS NULL`
      ];

      const leadsConFiltros = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(and(...conditions));

      console.log(`   🎯 QUERY COMPLETA (todos los filtros): ${leadsConFiltros[0]?.count || 0}`);

      // 5e. Mostrar algunos registros de ejemplo
      const ejemplosLeads = await db
        .select({
          id: opLeadsRep.id,
          campaign: opLeadsRep.campaign,
          cliente: opLeadsRep.cliente,
          localizacion: opLeadsRep.localizacion,
          marca: opLeadsRep.marca,
          source: opLeadsRep.source,
          campaignId: opLeadsRep.campaignId
        })
        .from(opLeadsRep)
        .where(ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`))
        .limit(3);

      console.log(`   📋 Ejemplos de leads con marca "${campana.marca.toLowerCase()}":`);
      ejemplosLeads.forEach(lead => {
        console.log(`      - Campaign: "${lead.campaign}", Cliente: "${lead.cliente}", Loc: "${lead.localizacion}", CampañaID: ${lead.campaignId}`);
      });
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Ejecutar diagnóstico
diagnoseRedFinance().then(() => {
  console.log('\n✅ Diagnóstico completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error ejecutando diagnóstico:', error);
  process.exit(1);
});