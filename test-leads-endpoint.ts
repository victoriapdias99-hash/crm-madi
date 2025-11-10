/**
 * Script de prueba para verificar consistencia entre conteo y listado de leads
 *
 * OBJETIVO: Verificar que el endpoint de listado use la misma lógica que contarLeadsPorCampana
 *
 * USO:
 * 1. Asegúrate de que el servidor esté corriendo (npm run dev)
 * 2. Ejecuta: npx tsx test-leads-endpoint.ts
 */

async function testLeadsEndpointConsistency() {
  const BASE_URL = 'http://localhost:5000';

  console.log('🧪 TEST: Consistencia entre Conteo y Listado de Leads\n');
  console.log('=' .repeat(60));

  try {
    // 1. Obtener una campaña pendiente
    console.log('\n📋 PASO 1: Obteniendo campaña pendiente...\n');

    const pendingCampaignsResponse = await fetch(`${BASE_URL}/api/pending-campaigns`);
    const pendingCampaignsData = await pendingCampaignsResponse.json();

    if (!pendingCampaignsData.campaigns || pendingCampaignsData.campaigns.length === 0) {
      console.log('❌ No hay campañas pendientes para probar');
      return;
    }

    const testCampaign = pendingCampaignsData.campaigns[0];
    const campaignId = testCampaign.id;

    console.log(`✅ Campaña seleccionada: ID ${campaignId}`);
    console.log(`   Cliente: ${testCampaign.clienteNombre}`);
    console.log(`   Marca: ${testCampaign.marca}`);
    console.log(`   Zona: ${testCampaign.zona}`);
    console.log(`   Número: ${testCampaign.numeroCampana}`);

    // 2. Obtener conteo desde datos-diarios (usa contarLeadsPorCampana)
    console.log('\n📊 PASO 2: Obteniendo conteo desde /api/datos-diarios...\n');

    const datosDiariosResponse = await fetch(`${BASE_URL}/api/datos-diarios`);
    const datosDiariosData = await datosDiariosResponse.json();

    const campaignData = datosDiariosData.find((c: any) => c.id === campaignId);

    if (!campaignData) {
      console.log('❌ No se encontró la campaña en datos-diarios');
      return;
    }

    const enviadosConteo = campaignData.enviados || 0;
    console.log(`✅ Conteo de enviados: ${enviadosConteo}`);

    // 3. Obtener listado de leads (nuevo endpoint con misma lógica)
    console.log('\n📋 PASO 3: Obteniendo listado desde /api/leads/sent-by-campaign...\n');

    const leadsResponse = await fetch(`${BASE_URL}/api/leads/sent-by-campaign/${campaignId}`);
    const leadsData = await leadsResponse.json();

    const enviadosListado = leadsData.totalSent || 0;
    console.log(`✅ Total en listado: ${enviadosListado}`);
    console.log(`✅ Leads individuales: ${leadsData.leads?.length || 0}`);

    // 4. Comparar resultados
    console.log('\n🔍 PASO 4: Comparando resultados...\n');
    console.log('=' .repeat(60));
    console.log(`Conteo (datos-diarios):           ${enviadosConteo}`);
    console.log(`Listado (sent-by-campaign):       ${enviadosListado}`);
    console.log(`Diferencia:                       ${Math.abs(enviadosConteo - enviadosListado)}`);
    console.log('=' .repeat(60));

    if (enviadosConteo === enviadosListado) {
      console.log('\n✅ ¡ÉXITO! El conteo y el listado son CONSISTENTES');
      console.log('   La misma lógica se está aplicando en ambos endpoints');
    } else {
      console.log('\n❌ ERROR: Hay una diferencia en el conteo');
      console.log('   Revisar la lógica de filtros en ambos endpoints');
    }

    // 5. Mostrar muestra de leads
    if (leadsData.leads && leadsData.leads.length > 0) {
      console.log('\n📋 MUESTRA DE LEADS (primeros 5):');
      leadsData.leads.slice(0, 5).forEach((lead: any, index: number) => {
        console.log(`\n   Lead ${index + 1}:`);
        console.log(`   - ID: ${lead.id}`);
        console.log(`   - Nombre: ${lead.nombre}`);
        console.log(`   - Teléfono: ${lead.telefono}`);
        console.log(`   - Marca: ${lead.marca}`);
        console.log(`   - Campaign: ${lead.campaign}`);
        console.log(`   - Localización: ${lead.localizacion}`);
        console.log(`   - Cliente: ${lead.cliente}`);
        console.log(`   - Fecha: ${lead.fechaCreacion}`);
      });
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ TEST COMPLETADO\n');

  } catch (error: any) {
    console.error('\n❌ ERROR EN TEST:', error.message);
    console.error('\nAsegúrate de que:');
    console.error('1. El servidor esté corriendo (npm run dev)');
    console.error('2. La base de datos esté disponible');
    console.error('3. Las rutas /api/pending-campaigns y /api/leads/sent-by-campaign estén registradas');
  }
}

// Ejecutar test
testLeadsEndpointConsistency();
