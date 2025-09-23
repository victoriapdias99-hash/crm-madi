import { db } from './db';
import { campanasComerciales, clientes, opLeadsRep } from '../shared/schema';
import { sql, eq, ilike, and, count } from 'drizzle-orm';
import { normalizeClientName } from '../shared/utils/client-normalization';

/**
 * Test para verificar que la corrección del filtro campaignId funcione
 * Simula exactamente la misma lógica que el endpoint principal
 */
async function verifyRedFinanceFix() {
  console.log('🔬 VERIFICACIÓN DE CORRECCIÓN - Red Finance\n');

  try {
    // 1. Obtener campaña de Red Finance
    console.log('📊 PASO 1: Obteniendo datos de Red Finance');
    const clienteRedFinance = await db
      .select()
      .from(clientes)
      .where(eq(clientes.id, 18))
      .limit(1);

    if (clienteRedFinance.length === 0) {
      console.log('❌ Cliente Red Finance no encontrado');
      return;
    }

    const cliente = clienteRedFinance[0];
    console.log(`✅ Cliente: ${cliente.nombreCliente} (${cliente.nombreComercial})`);

    const campanasRedFinance = await db
      .select()
      .from(campanasComerciales)
      .where(eq(campanasComerciales.clienteId, 18));

    console.log(`✅ Encontradas ${campanasRedFinance.length} campañas de Red Finance`);

    // 2. Para cada campaña, aplicar la NUEVA lógica corregida
    for (const campana of campanasRedFinance) {
      console.log(`\n🎯 PROBANDO CAMPAÑA: ${campana.marca} ${campana.numeroCampana}`);
      console.log(`   - ID: ${campana.id}, Zona: ${campana.zona}, FechaFin: ${campana.fechaFin}`);

      // Aplicar la misma lógica que routes.ts después de la corrección
      const nombreComercial = normalizeClientName(cliente.nombreComercial);

      const mapeoZonas: Record<string, string> = {
        'NACIONAL': 'Pais',
        'AMBA': 'Amba',
        'Córdoba': 'Cordoba',
        'Santa Fe': 'Santa Fe',
        'Mendoza': 'Mendoza'
      };
      const localizacionFiltro = mapeoZonas[campana.zona as keyof typeof mapeoZonas] || campana.zona || 'Pais';

      console.log(`   - Cliente normalizado: "${nombreComercial}"`);
      console.log(`   - Localización filtro: "${localizacionFiltro}"`);

      // ✅ NUEVA LÓGICA CORREGIDA: (campaignId IS NULL OR campaignId = campana.id)
      console.log('\n   🧪 APLICANDO NUEVA LÓGICA CORREGIDA:');

      let conditions = [
        ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`),
        eq(opLeadsRep.cliente, nombreComercial),
        eq(opLeadsRep.localizacion, localizacionFiltro),
        eq(opLeadsRep.source, 'google_sheets'),
        sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})` // 🎯 CORRECCIÓN APLICADA
      ];

      const resultadoCorregido = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(and(...conditions));

      console.log(`   ✅ RESULTADO CON CORRECCIÓN: ${resultadoCorregido[0]?.count || 0} leads`);

      // 🔍 COMPARACIÓN: Probar con la lógica anterior para mostrar la diferencia
      console.log('\n   📊 COMPARACIÓN CON LÓGICA ANTERIOR:');

      let conditionsAnterior = [
        ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`),
        eq(opLeadsRep.cliente, nombreComercial),
        eq(opLeadsRep.localizacion, localizacionFiltro),
        eq(opLeadsRep.source, 'google_sheets'),
        sql`${opLeadsRep.campaignId} IS NULL` // ❌ LÓGICA ANTERIOR PROBLEMÁTICA
      ];

      const resultadoAnterior = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(and(...conditions));

      console.log(`   ❌ RESULTADO CON LÓGICA ANTERIOR: ${resultadoAnterior[0]?.count || 0} leads`);

      // 📈 ANÁLISIS DE LA MEJORA
      const mejora = (resultadoCorregido[0]?.count || 0) - (resultadoAnterior[0]?.count || 0);
      if (mejora > 0) {
        console.log(`   🎉 MEJORA DETECTADA: +${mejora} leads ahora se cuentan correctamente`);
      } else if (mejora === 0) {
        console.log(`   ⚠️ Sin cambios detectados para esta campaña`);
      }

      // 🔍 DETALLES ADICIONALES: Verificar qué campaignId tienen los leads
      const detallesLeads = await db
        .select({
          campaignId: opLeadsRep.campaignId,
          count: sql<number>`count(*)`
        })
        .from(opLeadsRep)
        .where(
          and(
            ilike(opLeadsRep.campaign, `%${campana.marca.toLowerCase()}%`),
            eq(opLeadsRep.cliente, nombreComercial),
            eq(opLeadsRep.localizacion, localizacionFiltro),
            eq(opLeadsRep.source, 'google_sheets')
          )
        )
        .groupBy(opLeadsRep.campaignId);

      console.log(`   📋 Distribución de campaignId en los leads:`);
      detallesLeads.forEach(d => {
        console.log(`      - CampaignID: ${d.campaignId} → ${d.count} leads`);
      });
    }

  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

// Ejecutar verificación
verifyRedFinanceFix().then(() => {
  console.log('\n✅ Verificación de corrección completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});