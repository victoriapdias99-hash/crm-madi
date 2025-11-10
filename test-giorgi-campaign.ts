/**
 * Test para verificar el cálculo de conteo de leads y obtención de listado
 * Campaña: Giorgi Automotores #1
 */

import { db } from './server/db';
import { campanasComerciales, clientes, opLeadsRep } from './shared/schema';
import { eq, and, sql, gte, lte, count } from 'drizzle-orm';
import { normalizeClientName } from './shared/utils/client-normalization';
import {
  extractBrandsFromCampaign,
  createMultiBrandCondition,
  mapZonaToLocalizacion,
  getMultiBrandDebugInfo
} from './server/shared/campaign-filters';

async function testGiorgiCampaign() {
  console.log('🔍 ===== TEST GIORGI AUTOMOTORES #1 =====\n');

  try {
    // 1. Buscar la campaña Giorgi Automotores #1
    console.log('📋 PASO 1: Buscar campaña Giorgi Automotores #1');

    const campanasGiorgi = await db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        marca: campanasComerciales.marca,
        marca2: campanasComerciales.marca2,
        marca3: campanasComerciales.marca3,
        marca4: campanasComerciales.marca4,
        marca5: campanasComerciales.marca5,
        zona: campanasComerciales.zona,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
        cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados,
        asignacionAutomatica: campanasComerciales.asignacionAutomatica,
        clienteId: campanasComerciales.clienteId,
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(clientes.id, campanasComerciales.clienteId))
      .where(
        and(
          sql`${clientes.nombreComercial} ILIKE '%giorgi%'`,
          eq(campanasComerciales.numeroCampana, '1')
        )
      )
      .limit(1);

    if (campanasGiorgi.length === 0) {
      console.error('❌ No se encontró la campaña Giorgi Automotores #1');
      return;
    }

    const campana = campanasGiorgi[0];
    console.log(`✅ Campaña encontrada: ID ${campana.id}`);
    console.log(`   - Marca: ${campana.marca}`);
    console.log(`   - Zona: ${campana.zona}`);
    console.log(`   - Fecha inicio: ${campana.fechaCampana}`);
    console.log(`   - Fecha fin: ${campana.fechaFin || 'EN PROCESO'}`);
    console.log(`   - Solicitados: ${campana.cantidadDatosSolicitados}`);
    console.log('');

    // 2. Obtener información del cliente
    console.log('📋 PASO 2: Obtener información del cliente');

    const clienteData = await db
      .select({
        id: clientes.id,
        nombreCliente: clientes.nombreCliente,
        nombreComercial: clientes.nombreComercial,
      })
      .from(clientes)
      .where(eq(clientes.id, campana.clienteId!))
      .limit(1);

    if (clienteData.length === 0) {
      console.error('❌ No se encontró el cliente');
      return;
    }

    const cliente = clienteData[0];
    console.log(`✅ Cliente: ${cliente.nombreCliente}`);
    console.log(`   - Nombre comercial: ${cliente.nombreComercial}`);
    console.log('');

    // 3. Determinar si es campaña finalizada o en proceso
    const esCampanaFinalizada = !!campana.fechaFin;
    console.log(`📊 PASO 3: Tipo de campaña: ${esCampanaFinalizada ? 'FINALIZADA' : 'EN PROCESO'}\n`);

    let leadsCount = 0;
    let leadsList: any[] = [];

    if (esCampanaFinalizada) {
      // ✅ CAMPAÑA FINALIZADA: Contar directamente por campaign_id
      console.log('🔒 Lógica FINALIZADA: campaign_id = ' + campana.id);

      const countResult = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(eq(opLeadsRep.campaignId, campana.id));

      leadsCount = countResult[0]?.count || 0;

      leadsList = await db
        .select()
        .from(opLeadsRep)
        .where(eq(opLeadsRep.campaignId, campana.id))
        .orderBy(opLeadsRep.fechaCreacion);

    } else {
      // 📊 CAMPAÑA EN PROCESO: Usar filtros genéricos
      console.log('🔄 Lógica EN PROCESO: Usando filtros múltiples\n');

      // Normalizar cliente
      const nombreComercialNormalizado = normalizeClientName(cliente.nombreComercial || '');
      console.log(`📝 Cliente normalizado: "${nombreComercialNormalizado}"`);

      // Mapear zona
      const localizacionFiltro = mapZonaToLocalizacion(campana.zona);
      console.log(`🗺️ Zona mapeada: ${campana.zona} → ${localizacionFiltro}`);

      // Extraer marcas
      const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);
      console.log(`🏷️ ${getMultiBrandDebugInfo(campana)}`);

      // Crear condición multi-marca
      const multiBrandCondition = createMultiBrandCondition(brands, opLeadsRep.campaign);

      // Construir condiciones
      const conditions: any[] = [
        multiBrandCondition,
        eq(opLeadsRep.cliente, nombreComercialNormalizado),
        eq(opLeadsRep.localizacion, localizacionFiltro),
        eq(opLeadsRep.source, 'google_sheets'),
        sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`,
        gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
      ];

      if (campana.fechaFin) {
        conditions.push(lte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaFin));
      }

      console.log('\n📋 Condiciones aplicadas:');
      console.log(`   - Campaign IN (${brands.join(', ')})`);
      console.log(`   - Cliente = "${nombreComercialNormalizado}"`);
      console.log(`   - Localización = "${localizacionFiltro}"`);
      console.log(`   - Source = "google_sheets"`);
      console.log(`   - (campaign_id IS NULL OR campaign_id = ${campana.id})`);
      console.log(`   - Fecha >= ${campana.fechaCampana}`);
      if (campana.fechaFin) {
        console.log(`   - Fecha <= ${campana.fechaFin}`);
      }
      console.log('');

      // Contar
      const countResult = await db
        .select({ count: count() })
        .from(opLeadsRep)
        .where(and(...conditions));

      leadsCount = countResult[0]?.count || 0;

      // Obtener listado completo
      leadsList = await db
        .select()
        .from(opLeadsRep)
        .where(and(...conditions))
        .orderBy(opLeadsRep.fechaCreacion);
    }

    // 4. Mostrar resultados
    console.log('📊 ===== RESULTADOS =====\n');
    console.log(`✅ CONTEO DE LEADS: ${leadsCount}`);
    console.log(`✅ LEADS OBTENIDOS EN LISTADO: ${leadsList.length}`);
    console.log(`${leadsCount === leadsList.length ? '✅' : '❌'} Coincidencia: ${leadsCount === leadsList.length ? 'SÍ' : 'NO'}\n`);

    if (leadsCount !== leadsList.length) {
      console.error('❌ ERROR: El conteo no coincide con el listado!');
      console.error(`   Diferencia: ${Math.abs(leadsCount - leadsList.length)} leads`);
      return;
    }

    // 5. Análisis de distribución
    console.log('📊 ANÁLISIS DE DISTRIBUCIÓN:\n');

    const conCampaignId = leadsList.filter(l => l.campaignId !== null && l.campaignId !== undefined);
    const sinCampaignId = leadsList.filter(l => l.campaignId === null || l.campaignId === undefined);

    console.log(`   - Leads con campaign_id asignado: ${conCampaignId.length}`);
    console.log(`   - Leads sin campaign_id (disponibles): ${sinCampaignId.length}\n`);

    // 6. Muestra de leads (primeros 5)
    if (leadsList.length > 0) {
      console.log('📋 MUESTRA DE LEADS (primeros 5):\n');
      leadsList.slice(0, 5).forEach((lead, idx) => {
        console.log(`   ${idx + 1}. ${lead.nombre || 'Sin nombre'}`);
        console.log(`      - Teléfono: ${lead.telefono}`);
        console.log(`      - Marca: ${lead.marca}`);
        console.log(`      - Campaign: ${lead.campaign}`);
        console.log(`      - Cliente: ${lead.cliente}`);
        console.log(`      - Localización: ${lead.localizacion}`);
        console.log(`      - Campaign ID: ${lead.campaignId || 'NULL (disponible)'}`);
        console.log(`      - Fecha creación: ${lead.fechaCreacion}`);
        console.log('');
      });
    }

    // 7. Test del endpoint HTTP
    console.log('🌐 ===== TEST ENDPOINT HTTP =====\n');
    console.log(`🔗 Testeando: GET /api/leads/sent-by-campaign/${campana.id}\n`);

    const response = await fetch(`http://localhost:5000/api/leads/sent-by-campaign/${campana.id}`);

    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status} ${response.statusText}`);
      const errorData = await response.text();
      console.error('Respuesta:', errorData);
      return;
    }

    const endpointData = await response.json();

    console.log(`✅ Respuesta del endpoint:`);
    console.log(`   - Campaign ID: ${endpointData.campaignId}`);
    console.log(`   - Campaign Name: ${endpointData.campaignName}`);
    console.log(`   - Client Name: ${endpointData.clientName}`);
    console.log(`   - Marca: ${endpointData.marca}`);
    console.log(`   - Zona: ${endpointData.zona}`);
    console.log(`   - Total Sent (endpoint): ${endpointData.totalSent}`);
    console.log(`   - Leads array length: ${endpointData.leads?.length || 0}\n`);

    // 8. Comparación final
    console.log('🔍 ===== COMPARACIÓN FINAL =====\n');
    console.log(`   Conteo directo:     ${leadsCount}`);
    console.log(`   Listado directo:    ${leadsList.length}`);
    console.log(`   Endpoint totalSent: ${endpointData.totalSent}`);
    console.log(`   Endpoint leads[]:   ${endpointData.leads?.length || 0}\n`);

    const todosCoinciden =
      leadsCount === leadsList.length &&
      leadsCount === endpointData.totalSent &&
      leadsCount === (endpointData.leads?.length || 0);

    if (todosCoinciden) {
      console.log('✅ ¡ÉXITO! Todos los valores coinciden correctamente.');
    } else {
      console.log('❌ ERROR: Hay discrepancias entre los valores.');
      if (leadsCount !== endpointData.totalSent) {
        console.log(`   - Diferencia conteo vs endpoint: ${Math.abs(leadsCount - endpointData.totalSent)}`);
      }
      if (leadsList.length !== (endpointData.leads?.length || 0)) {
        console.log(`   - Diferencia listado vs endpoint: ${Math.abs(leadsList.length - (endpointData.leads?.length || 0))}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error en test:', error.message);
    console.error(error);
  }
}

// Ejecutar test
testGiorgiCampaign()
  .then(() => {
    console.log('\n✅ Test completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test falló:', error);
    process.exit(1);
  });
