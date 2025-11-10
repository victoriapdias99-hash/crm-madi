/**
 * Test para verificar el conteo real que retorna el endpoint
 * /api/dashboard/datos-diarios-db para Red Finance #1
 */

async function testEndpoint() {
  console.log('🧪 TEST: Endpoint /api/dashboard/datos-diarios-db para Red Finance #1\n');

  try {
    const response = await fetch('http://localhost:5000/api/dashboard/datos-diarios-db');

    if (!response.ok) {
      console.error('❌ Error en respuesta:', response.status, response.statusText);
      return;
    }

    const data = await response.json();

    // Buscar Red Finance #1
    const redFinance = data.find((item: any) =>
      item.numeroCampana === 1 &&
      (item.clienteNombre?.toLowerCase().includes('red') ||
       item.cliente?.toLowerCase().includes('red'))
    );

    if (!redFinance) {
      console.log('❌ Red Finance #1 no encontrada en la respuesta');
      console.log('\n📋 Campañas disponibles (primeras 10):');
      data.slice(0, 10).forEach((item: any) => {
        console.log(`   - ${item.clienteNombre} #${item.numeroCampana} - ${item.marca}`);
      });
      return;
    }

    console.log('✅ RED FINANCE #1 ENCONTRADA\n');
    console.log('📊 DATOS RETORNADOS POR EL ENDPOINT:\n');
    console.log('   ID:', redFinance.id);
    console.log('   Cliente:', redFinance.clienteNombre || redFinance.cliente);
    console.log('   Número:', redFinance.numeroCampana);
    console.log('   Marca:', redFinance.marca);
    console.log('   Marca 2:', redFinance.marca2 || 'N/A');
    console.log('   Zona:', redFinance.zona);
    console.log('   Solicitados:', redFinance.cantidadDatosSolicitados);
    console.log('   Enviados:', redFinance.enviados);
    console.log('   Duplicados:', redFinance.duplicados);
    console.log('   Porcentaje:', redFinance.porcentajeDatosEnviados, '%');
    console.log('   Faltantes:', redFinance.faltantesAEnviar);

    console.log('\n📈 ANÁLISIS:');
    if (redFinance.enviados === 0) {
      console.log('   ❌ El endpoint retorna 0 enviados');
      console.log('   🔍 Esto confirma que el problema está en el conteo');
    } else {
      console.log(`   ✅ El endpoint retorna ${redFinance.enviados} enviados`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testEndpoint();
