// Script para verificar el conteo de leads de Borussia (campaña 84)

async function testBorussia() {
  try {
    console.log('🔍 Verificando conteo de campaña 84 (Borussia - Fiat)\n');

    // 1. Obtener el conteo del dashboard
    const dashboardRes = await fetch('http://localhost:5000/api/dashboard/campanas-pendientes');
    const campanas = await dashboardRes.json();
    const camp84 = campanas.find(c => c.campaignId === 84);

    console.log('📊 Dashboard (contarLeadsPorCampana):');
    console.log(`   Enviados: ${camp84.enviados}`);
    console.log('');

    // 2. Obtener el listado del endpoint
    const endpointRes = await fetch('http://localhost:5000/api/leads/sent-by-campaign/84');
    const endpointData = await endpointRes.json();

    console.log('📋 Endpoint (getSentLeadsByCampaign):');
    console.log(`   Total: ${endpointData.totalSent}`);
    console.log('');

    // 3. Comparar
    console.log('📊 Comparación:');
    console.log(`   Dashboard: ${camp84.enviados}`);
    console.log(`   Endpoint:  ${endpointData.totalSent}`);
    console.log(`   Diferencia: ${Math.abs(camp84.enviados - endpointData.totalSent)}`);
    console.log('');

    if (camp84.enviados === endpointData.totalSent) {
      console.log('✅ COINCIDEN - La centralización funciona perfectamente');
    } else {
      console.log('⚠️ NO COINCIDEN - Investigando causa...\n');

      // Analizar algunos leads del endpoint para ver su campaign_id
      console.log('🔍 Analizando primeros 10 leads del endpoint:');
      const sample = endpointData.leads.slice(0, 10);

      sample.forEach((lead, i) => {
        console.log(`   ${i + 1}. ID: ${lead.id} | campaign_id: ${lead.campaignId || 'NULL'}`);
      });

      console.log('\n💡 Nota:');
      console.log('   - Si todos tienen campaign_id = 84: endpoint cuenta solo asignados');
      console.log('   - Si hay NULLs: endpoint cuenta disponibles + asignados');
      console.log('   - Dashboard usa la MISMA función, debería coincidir');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBorussia();
