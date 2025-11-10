import { db } from './db';
import { campanasComerciales, clientes, opLeadsRep } from '../shared/schema';
import { eq, and, sql, count, isNull } from 'drizzle-orm';
import { normalizeClientName } from '../shared/utils/client-normalization';
import { extractBrandsFromCampaign, createMultiBrandCondition } from '../shared/utils/multi-brand-utils';

/**
 * Test que simula exactamente lo que hace contarLeadsPorCampana
 */
async function testConteoDirecto() {
  console.log('🧪 TEST: Simulación de contarLeadsPorCampana para Red Finance #1\n');

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
    console.log('   Cliente (nombreComercial):', cliente?.nombreComercial);
    console.log('   Marca:', campana.marca);
    console.log('   Marca2:', campana.marca2);
    console.log('   Zona:', campana.zona);
    console.log('   Fecha fin:', campana.fechaFin || 'En proceso');

    // 2. Normalizar cliente usando función centralizada
    const nombreComercialRaw = cliente?.nombreComercial || '';
    const nombreComercial = normalizeClientName(nombreComercialRaw);

    console.log('\n🔧 NORMALIZACIÓN:');
    console.log('   Input:', nombreComercialRaw);
    console.log('   Output:', nombreComercial);

    // 3. Mapear zona
    const mapeoZonas: Record<string, string> = {
      'NACIONAL': 'Pais',
      'AMBA': 'Amba',
      'Córdoba': 'Cordoba',
      'Santa Fe': 'Santa Fe',
      'Mendoza': 'Mendoza'
    };
    const localizacionFiltro = mapeoZonas[campana.zona as keyof typeof mapeoZonas] || campana.zona || 'Pais';

    console.log('\n🗺️ MAPEO ZONA:');
    console.log('   Zona campaña:', campana.zona);
    console.log('   Localización filtro:', localizacionFiltro);

    // 4. Extraer marcas
    const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);

    console.log('\n🏷️ MARCAS EXTRAÍDAS:');
    brands.forEach((brand, idx) => {
      console.log(`   ${idx + 1}. ${brand.marca} - ${brand.porcentaje}%`);
    });

    // 5. Crear condición multimarca
    const multiBrandCondition = createMultiBrandCondition(brands, opLeadsRep.campaign);

    // 6. Construir condiciones exactamente como lo hace contarLeadsPorCampana
    let conditions = [
      multiBrandCondition,
      eq(opLeadsRep.cliente, nombreComercial), // ✅ Comparación exacta
      eq(opLeadsRep.localizacion, localizacionFiltro),
      eq(opLeadsRep.source, 'google_sheets'),
      sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`
    ];

    console.log('\n🔍 CONDICIONES DE BÚSQUEDA:');
    console.log('   1. Multimarca: (Peugeot OR Fiat)');
    console.log('   2. Cliente:', nombreComercial);
    console.log('   3. Localización:', localizacionFiltro);
    console.log('   4. Source: google_sheets');
    console.log('   5. Campaign ID: NULL o', campana.id);

    // 7. Ejecutar query
    console.log('\n⚙️ EJECUTANDO QUERY...\n');

    const result = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(and(...conditions));

    const totalCount = result[0]?.count || 0;

    console.log('📊 RESULTADO:');
    console.log('   Total leads encontrados:', totalCount);

    // 8. Verificar cada condición por separado
    console.log('\n🔬 ANÁLISIS POR CONDICIÓN INDIVIDUAL:\n');

    // Sin campaignId
    const [sinCampaign] = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(isNull(opLeadsRep.campaignId));
    console.log('   1. Solo campaign_id IS NULL:', sinCampaign.count);

    // + Cliente
    const [conCliente] = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          isNull(opLeadsRep.campaignId),
          eq(opLeadsRep.cliente, nombreComercial)
        )
      );
    console.log(`   2. + cliente = "${nombreComercial}":`, conCliente.count);

    // + Localización
    const [conLocalizacion] = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          isNull(opLeadsRep.campaignId),
          eq(opLeadsRep.cliente, nombreComercial),
          eq(opLeadsRep.localizacion, localizacionFiltro)
        )
      );
    console.log(`   3. + localizacion = "${localizacionFiltro}":`, conLocalizacion.count);

    // + Source
    const [conSource] = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          isNull(opLeadsRep.campaignId),
          eq(opLeadsRep.cliente, nombreComercial),
          eq(opLeadsRep.localizacion, localizacionFiltro),
          eq(opLeadsRep.source, 'google_sheets')
        )
      );
    console.log('   4. + source = "google_sheets":', conSource.count);

    // + Multimarca
    const [conMultimarca] = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          isNull(opLeadsRep.campaignId),
          multiBrandCondition,
          eq(opLeadsRep.cliente, nombreComercial),
          eq(opLeadsRep.localizacion, localizacionFiltro),
          eq(opLeadsRep.source, 'google_sheets')
        )
      );
    console.log('   5. + multimarca (Peugeot OR Fiat):', conMultimarca.count);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ CONTEO FINAL:', totalCount);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testConteoDirecto();
