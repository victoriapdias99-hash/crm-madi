/**
 * Script de testing para el sistema de cierre de campañas
 */

const BASE_URL = 'http://localhost:5000';

async function testCierreCampanas() {
  console.log('=== INICIANDO TESTS DE CIERRE DE CAMPAÑAS ===\n');

  try {
    // 1. Verificar estado del sistema
    console.log('1. Verificando estado del sistema...');
    const statusRes = await fetch(`${BASE_URL}/api/campaign-closure/status`);
    const status = await statusRes.json();
    console.log('   Estado:', JSON.stringify(status, null, 2));
    console.log('   ✅ Sistema activo\n');

    // 2. Obtener clientes con campañas pendientes
    console.log('2. Obteniendo clientes con campañas pendientes...');
    const clientsRes = await fetch(`${BASE_URL}/api/campaign-closure/clients`);
    const clientsData = await clientsRes.json();
    console.log(`   Total de clientes: ${clientsData.count}`);
    console.log('   Clientes:', clientsData.clients);
    console.log('   ✅ Clientes obtenidos\n');

    // 3. Obtener campañas pendientes
    console.log('3. Obteniendo campañas pendientes...');
    const campaignsRes = await fetch(`${BASE_URL}/api/campaign-closure/pending-campaigns`);
    const campaignsData = await campaignsRes.json();
    console.log(`   Total de campañas pendientes: ${campaignsData.count}`);

    if (campaignsData.campaigns && campaignsData.campaigns.length > 0) {
      console.log('\n   Primeras 5 campañas:');
      campaignsData.campaigns.slice(0, 5).forEach((c: any, i: number) => {
        console.log(`   ${i + 1}. ${c.clientName} - ${c.brandName} #${c.campaignNumber} (Meta: ${c.targetLeads}, Actual: ${c.currentLeads})`);
      });
    }
    console.log('   ✅ Campañas pendientes obtenidas\n');

    // 4. Validar cierre (sin ejecutar)
    console.log('4. Validando cierre de campañas (dry-run)...');
    const validateRes = await fetch(`${BASE_URL}/api/campaign-closure/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const validateData = await validateRes.json();
    console.log('   Resultado de validación:');
    console.log('   - Success:', validateData.success);
    console.log('   - Campañas a procesar:', validateData.campaignsProcessed);
    console.log('   ✅ Validación completada\n');

    // 5. Ejecutar cierre para UN cliente específico
    if (clientsData.clients && clientsData.clients.length > 0) {
      const primerCliente = clientsData.clients[0];
      console.log(`5. Ejecutando cierre para cliente: "${primerCliente}"...`);

      const executeRes = await fetch(`${BASE_URL}/api/campaign-closure/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clients: primerCliente
        })
      });

      const executeData = await executeRes.json();
      console.log('\n   Resultado de ejecución:');
      console.log('   - Success:', executeData.success);
      console.log('   - Mensaje:', executeData.message);
      console.log('   - Campañas procesadas:', executeData.campaignsProcessed);
      console.log('   - Campañas cerradas:', executeData.campaignsClosed);
      console.log('   - Leads asignados:', executeData.leadsAssigned);
      console.log('   - Duración:', executeData.durationFormatted);

      if (executeData.details?.closedCampaigns) {
        console.log('\n   Campañas cerradas:');
        executeData.details.closedCampaigns.forEach((c: any, i: number) => {
          console.log(`   ${i + 1}. Campaña ${c.campaignId}: ${c.clientName} - ${c.brandName}`);
          console.log(`      Leads asignados: ${c.leadsAssigned}/${c.targetLeads}`);
          console.log(`      Fecha cierre: ${c.closureDate}`);
        });
      }

      if (executeData.error) {
        console.log('   ❌ Error:', executeData.error);
      } else {
        console.log('   ✅ Ejecución completada\n');
      }
    }

    // 6. Verificar campañas pendientes después del cierre
    console.log('6. Verificando campañas pendientes después del cierre...');
    const afterRes = await fetch(`${BASE_URL}/api/campaign-closure/pending-campaigns`);
    const afterData = await afterRes.json();
    console.log(`   Total de campañas pendientes ahora: ${afterData.count}`);
    console.log(`   Diferencia: ${campaignsData.count - afterData.count} campañas cerradas`);
    console.log('   ✅ Verificación completada\n');

    console.log('=== TESTS COMPLETADOS EXITOSAMENTE ===');

  } catch (error: any) {
    console.error('\n❌ ERROR EN LOS TESTS:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar tests
testCierreCampanas();
