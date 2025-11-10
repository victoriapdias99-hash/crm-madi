import { db } from './db';
import { campanasComerciales, clientes, opLeadsRep } from '../shared/schema';
import { eq, and, sql, isNull, or } from 'drizzle-orm';
import { extractBrandsFromCampaign, createMultiBrandCondition } from '../shared/utils/multi-brand-utils';

async function testRedFinance() {
  console.log('🧪 TEST: Red Finance #1 - Análisis de Conteo\n');

  try {
    // Obtener campaña Red Finance #1 (ID 65)
    const [campaign] = await db
      .select()
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
      .where(eq(campanasComerciales.id, 65));

    if (!campaign) {
      console.error('❌ Campaña no encontrada');
      return;
    }

    const campana = campaign.campanas_comerciales;
    const cliente = campaign.clientes;

    console.log('📋 DATOS DE LA CAMPAÑA:');
    console.log('   ID:', campana.id);
    console.log('   Cliente:', cliente?.nombreComercial);
    console.log('   Número:', campana.numeroCampana);
    console.log('   Zona:', campana.zona);
    console.log('   Solicitados:', campana.cantidadDatosSolicitados);
    console.log('   Asignación Automática:', campana.asignacionAutomatica);
    console.log('   Fecha inicio:', campana.fechaCampana);
    console.log('   Fecha fin:', campana.fechaFin || 'En proceso');

    console.log('\n🏷️ CONFIGURACIÓN DE MARCAS:');
    console.log('   Marca 1:', campana.marca, '- Porcentaje:', campana.porcentaje || 100);
    console.log('   Marca 2:', campana.marca2 || 'N/A', '- Porcentaje:', campana.porcentaje2 || 0);
    console.log('   Marca 3:', campana.marca3 || 'N/A', '- Porcentaje:', campana.porcentaje3 || 0);
    console.log('   Marca 4:', campana.marca4 || 'N/A', '- Porcentaje:', campana.porcentaje4 || 0);
    console.log('   Marca 5:', campana.marca5 || 'N/A', '- Porcentaje:', campana.porcentaje5 || 0);

    // Extraer marcas usando la utilidad
    const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);

    console.log('\n🔧 MARCAS EXTRAÍDAS (según lógica multimarca):');
    brands.forEach((brand, idx) => {
      console.log(`   ${idx + 1}. ${brand.marca} - ${brand.porcentaje}%`);
    });

    // Normalizar valores para consulta
    const normalizedClient = cliente?.nombreComercial?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
    const normalizedZone = campana.zona === 'NACIONAL' ? 'Pais' : campana.zona;

    console.log('\n🔍 CONTEO POR CADA MARCA INDIVIDUAL:');

    let totalLeadsMultimarca = 0;
    const countsByBrand: { marca: string; count: number }[] = [];

    // Contar leads por cada marca individualmente
    for (const brand of brands) {
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLeadsRep)
        .where(
          and(
            isNull(opLeadsRep.campaignId),
            sql`lower(${opLeadsRep.campaign}) LIKE ${`%${brand.marca.toLowerCase()}%`}`,
            eq(opLeadsRep.cliente, normalizedClient),
            eq(opLeadsRep.localizacion, normalizedZone),
            eq(opLeadsRep.source, 'google_sheets')
          )
        );

      const count = countResult[0]?.count || 0;
      countsByBrand.push({ marca: brand.marca, count });
      totalLeadsMultimarca += count;

      console.log(`   ${brand.marca}:`, count, 'leads');
    }

    // Crear condición multimarca con OR
    const multiBrandCondition = createMultiBrandCondition(brands, opLeadsRep.campaign);

    // Contar con la condición multimarca (con OR)
    console.log('\n🎯 CONTEO CON CONDICIÓN MULTIMARCA (OR entre marcas):');

    const multiCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        and(
          isNull(opLeadsRep.campaignId),
          multiBrandCondition,
          eq(opLeadsRep.cliente, normalizedClient),
          eq(opLeadsRep.localizacion, normalizedZone),
          eq(opLeadsRep.source, 'google_sheets')
        )
      );

    const multiCount = multiCountResult[0]?.count || 0;
    console.log('   Total con OR:', multiCount, 'leads');

    // Verificar si hay overlaps (leads que coinciden con múltiples marcas)
    console.log('\n📊 ANÁLISIS DE DISTRIBUCIÓN:');
    console.log('   Suma individual:', totalLeadsMultimarca, 'leads');
    console.log('   Con OR (único):', multiCount, 'leads');

    if (totalLeadsMultimarca > multiCount) {
      console.log(`   ⚠️ Hay ${totalLeadsMultimarca - multiCount} leads que coinciden con múltiples marcas`);
    } else if (totalLeadsMultimarca === multiCount) {
      console.log('   ✅ No hay overlaps - cada lead pertenece a una sola marca');
    }

    // Calcular distribución según porcentajes
    console.log('\n💯 DISTRIBUCIÓN SEGÚN PORCENTAJES:');
    const totalToDistribute = Math.min(multiCount, campana.cantidadDatosSolicitados);

    brands.forEach((brand) => {
      const leadsForBrand = Math.floor((totalToDistribute * brand.porcentaje) / 100);
      const available = countsByBrand.find(b => b.marca === brand.marca)?.count || 0;
      console.log(`   ${brand.marca}: ${leadsForBrand} leads (${brand.porcentaje}%) - Disponibles: ${available}`);
    });

    console.log('\n📈 RESUMEN FINAL:');
    console.log('┌────────────────────────────────────────┐');
    console.log(`│ Solicitados:              ${String(campana.cantidadDatosSolicitados).padStart(6)}     │`);
    console.log(`│ Disponibles (con OR):     ${String(multiCount).padStart(6)}     │`);
    console.log(`│ Suma individual marcas:   ${String(totalLeadsMultimarca).padStart(6)}     │`);
    console.log(`│ A distribuir:             ${String(totalToDistribute).padStart(6)}     │`);
    console.log('└────────────────────────────────────────┘');

    if (multiCount >= campana.cantidadDatosSolicitados) {
      console.log('\n✅ Hay suficientes leads para cerrar la campaña');
    } else {
      console.log(`\n❌ Faltan ${campana.cantidadDatosSolicitados - multiCount} leads para cerrar`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testRedFinance();
