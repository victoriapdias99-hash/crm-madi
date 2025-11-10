// Script simple para probar el endpoint de leads enviados

async function test() {
  try {
    // 1. Obtener campañas pendientes
    console.log('📡 1. Obteniendo campañas pendientes...\n');
    const campanasRes = await fetch('http://localhost:5000/api/dashboard/campanas-pendientes');
    const campanas = await campanasRes.json();

    console.log(`✅ Total de campañas pendientes: ${campanas.length}\n`);

    // 2. Buscar campaña con enviados numéricos (no "-")
    const campanasConEnviados = campanas.filter(c =>
      typeof c.enviados === 'number' && c.enviados > 0
    );

    console.log(`📊 Campañas con leads enviados: ${campanasConEnviados.length}\n`);

    if (campanasConEnviados.length === 0) {
      console.log('⚠️ No hay campañas con leads enviados para probar');
      console.log('💡 Intenta cerrar una campaña primero desde el frontend');
      return;
    }

    // Mostrar primeras 3 campañas
    console.log('📋 Primeras 3 campañas con enviados:\n');
    campanasConEnviados.slice(0, 3).forEach((c, i) => {
      console.log(`${i + 1}. ID: ${c.campaignId} | ${c.clienteNombre} - Campaña #${c.numeroCampana}`);
      console.log(`   Marca: ${c.marca} | Zona: ${c.zona}`);
      console.log(`   Enviados: ${c.enviados} | Pedidos: ${c.pedidosTotal}`);
      console.log('');
    });

    // 3. Probar endpoint con la primera campaña
    const testCampaign = campanasConEnviados[0];
    console.log(`🎯 2. Probando endpoint de leads enviados con campaña ID ${testCampaign.campaignId}...\n`);

    const leadsRes = await fetch(`http://localhost:5000/api/leads/sent-by-campaign/${testCampaign.campaignId}`);

    if (!leadsRes.ok) {
      throw new Error(`HTTP ${leadsRes.status}: ${leadsRes.statusText}`);
    }

    const leadsData = await leadsRes.json();

    console.log('✅ Respuesta del endpoint:\n');
    console.log(`   Campaign ID: ${leadsData.campaignId}`);
    console.log(`   Campaign Name: ${leadsData.campaignName}`);
    console.log(`   Client Name: ${leadsData.clientName}`);
    console.log(`   Marca: ${leadsData.marca}`);
    console.log(`   Zona: ${leadsData.zona}`);
    console.log(`   Total Sent: ${leadsData.totalSent}`);
    console.log(`   Leads array length: ${leadsData.leads.length}`);

    // 4. Comparar números
    console.log('\n📊 3. Comparación de conteos:\n');
    console.log(`   Dashboard muestra: ${testCampaign.enviados} enviados`);
    console.log(`   Endpoint retorna: ${leadsData.totalSent} leads`);

    if (testCampaign.enviados === leadsData.totalSent) {
      console.log(`   ✅ ¡COINCIDEN PERFECTAMENTE! La lógica está alineada.\n`);
    } else {
      const diff = Math.abs(testCampaign.enviados - leadsData.totalSent);
      console.log(`   ⚠️ DIFERENCIA DE ${diff} leads\n`);
    }

    // 5. Mostrar primeros 2 leads
    if (leadsData.leads.length > 0) {
      console.log('👥 4. Primeros 2 leads (muestra):\n');
      leadsData.leads.slice(0, 2).forEach((lead, i) => {
        console.log(`   Lead #${i + 1}:`);
        console.log(`   - Nombre: ${lead.nombre}`);
        console.log(`   - Teléfono: ${lead.telefono}`);
        console.log(`   - Email: ${lead.email || 'N/A'}`);
        console.log(`   - Marca: ${lead.marca}`);
        console.log(`   - Campaign: ${lead.campaign}`);
        console.log(`   - Cliente: ${lead.cliente || 'N/A'}`);
        console.log(`   - Localización: ${lead.localizacion || 'N/A'}`);
        console.log(`   - Fecha Creación: ${lead.fechaCreacion}`);
        console.log('');
      });
    }

    console.log('✅ TEST COMPLETADO\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

test();
