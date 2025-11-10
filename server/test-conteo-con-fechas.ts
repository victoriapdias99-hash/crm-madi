import { db } from './db';
import { campanasComerciales, clientes, opLeadsRep } from '../shared/schema';
import { eq, and, sql, count, isNull, gte, lte } from 'drizzle-orm';
import { normalizeClientName } from '../shared/utils/client-normalization';
import { extractBrandsFromCampaign, createMultiBrandCondition } from '../shared/utils/multi-brand-utils';

/**
 * Test que verifica el conteo CON filtros de fecha
 */
async function testConteoConFechas() {
  console.log('🧪 TEST: Conteo Red Finance #1 CON filtros de fecha\n');

  try {
    // 1. Obtener campaña
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

    console.log('📋 CAMPAÑA:');
    console.log('   ID:', campana.id);
    console.log('   Cliente:', cliente?.nombreComercial);
    console.log('   Marca:', campana.marca);
    console.log('   Marca2:', campana.marca2);
    console.log('   Porcentajes:', campana.porcentaje, '%', campana.porcentaje2 || 0, '%');
    console.log('   Zona:', campana.zona);
    console.log('   Solicitados:', campana.cantidadDatosSolicitados);
    console.log('   📅 Fecha inicio:', campana.fechaCampana);
    console.log('   📅 Fecha fin:', campana.fechaFin || 'En proceso');

    // 2. Normalizar cliente
    const nombreComercialRaw = cliente?.nombreComercial || '';
    const nombreComercial = normalizeClientName(nombreComercialRaw);

    // 3. Mapear zona
    const mapeoZonas: Record<string, string> = {
      'NACIONAL': 'Pais',
      'AMBA': 'Amba',
      'Córdoba': 'Cordoba',
      'Santa Fe': 'Santa Fe',
      'Mendoza': 'Mendoza'
    };
    const localizacionFiltro = mapeoZonas[campana.zona as keyof typeof mapeoZonas] || campana.zona || 'Pais';

    // 4. Extraer marcas
    const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);

    console.log('\n🏷️ MARCAS EXTRAÍDAS:');
    brands.forEach((brand, idx) => {
      console.log(`   ${idx + 1}. ${brand.marca} - ${brand.porcentaje}%`);
    });

    // 5. Crear condición multimarca
    const multiBrandCondition = createMultiBrandCondition(brands, opLeadsRep.campaign);

    // 6. Conteo SIN filtro de fecha
    console.log('\n📊 CONTEO SIN FILTRO DE FECHA:\n');

    let conditionsSinFecha = [
      multiBrandCondition,
      eq(opLeadsRep.cliente, nombreComercial),
      eq(opLeadsRep.localizacion, localizacionFiltro),
      eq(opLeadsRep.source, 'google_sheets'),
      sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`
    ];

    const [resultSinFecha] = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(and(...conditionsSinFecha));

    console.log('   Total (incluye cualquier fecha):', resultSinFecha.count);

    // 7. Conteo CON filtro de fecha inicio
    if (campana.fechaCampana) {
      console.log('\n📊 CONTEO CON FILTRO DE FECHA INICIO:\n');

      let conditionsConFecha = [
        multiBrandCondition,
        eq(opLeadsRep.cliente, nombreComercial),
        eq(opLeadsRep.localizacion, localizacionFiltro),
        eq(opLeadsRep.source, 'google_sheets'),
        sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`,
        gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
      ];

      const [resultConFechaInicio] = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(and(...conditionsConFecha));

      console.log(`   Total (fecha >= ${campana.fechaCampana}):`, resultConFechaInicio.count);

      // 8. Conteo CON filtro de fecha inicio Y fin
      if (campana.fechaFin) {
        console.log('\n📊 CONTEO CON FILTRO DE FECHA INICIO Y FIN:\n');

        conditionsConFecha.push(
          lte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaFin)
        );

        const [resultConFechaFin] = await db
          .select({ count: count() })
          .from(opLeadsRep)
          .where(and(...conditionsConFecha));

        console.log(`   Total (${campana.fechaCampana} <= fecha <= ${campana.fechaFin}):`, resultConFechaFin.count);
      }
    }

    // 9. Análisis detallado de fechas de los leads disponibles
    console.log('\n📅 ANÁLISIS DE FECHAS DE LEADS DISPONIBLES:\n');

    const leadsConFecha = await db
      .select({
        fechaCreacion: opLeadsRep.fechaCreacion,
        count: count()
      })
      .from(opLeadsRep)
      .where(
        and(
          isNull(opLeadsRep.campaignId),
          multiBrandCondition,
          eq(opLeadsRep.cliente, nombreComercial),
          eq(opLeadsRep.localizacion, localizacionFiltro),
          eq(opLeadsRep.source, 'google_sheets')
        )
      )
      .groupBy(opLeadsRep.fechaCreacion)
      .orderBy(opLeadsRep.fechaCreacion);

    console.log('   Distribución por fecha (solo disponibles):');
    leadsConFecha.forEach(item => {
      const fecha = new Date(item.fechaCreacion).toISOString().split('T')[0];
      const esDespuesDeFechaInicio = campana.fechaCampana
        ? new Date(item.fechaCreacion) >= new Date(campana.fechaCampana)
        : true;
      const marca = esDespuesDeFechaInicio ? '✅' : '❌';
      console.log(`   ${marca} ${fecha}: ${item.count} leads`);
    });

    // 10. Contar por marca individualmente
    console.log('\n🔍 CONTEO POR MARCA INDIVIDUAL (solo disponibles):\n');

    for (const brand of brands) {
      const [countMarca] = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(
          and(
            isNull(opLeadsRep.campaignId),
            sql`lower(${opLeadsRep.campaign}) LIKE ${`%${brand.marca.toLowerCase()}%`}`,
            eq(opLeadsRep.cliente, nombreComercial),
            eq(opLeadsRep.localizacion, localizacionFiltro),
            eq(opLeadsRep.source, 'google_sheets')
          )
        );

      console.log(`   ${brand.marca}:`, countMarca.count, 'leads disponibles');

      if (campana.fechaCampana) {
        const [countMarcaConFecha] = await db
          .select({ count: count() })
          .from(opLeadsRep)
          .where(
            and(
              isNull(opLeadsRep.campaignId),
              sql`lower(${opLeadsRep.campaign}) LIKE ${`%${brand.marca.toLowerCase()}%`}`,
              eq(opLeadsRep.cliente, nombreComercial),
              eq(opLeadsRep.localizacion, localizacionFiltro),
              eq(opLeadsRep.source, 'google_sheets'),
              gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
            )
          );

        console.log(`      Con fecha >= ${campana.fechaCampana}:`, countMarcaConFecha.count, 'leads');
      }
    }

    // 11. Resumen final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📈 RESUMEN:\n');
    console.log(`   Solicitados: ${campana.cantidadDatosSolicitados}`);
    console.log(`   Disponibles (sin filtro fecha): ${resultSinFecha.count}`);

    if (campana.fechaCampana) {
      const [resultFinal] = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(
          and(
            multiBrandCondition,
            eq(opLeadsRep.cliente, nombreComercial),
            eq(opLeadsRep.localizacion, localizacionFiltro),
            eq(opLeadsRep.source, 'google_sheets'),
            sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`,
            gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
          )
        );

      console.log(`   Disponibles (con filtro >= ${campana.fechaCampana}): ${resultFinal.count}`);
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testConteoConFechas();
