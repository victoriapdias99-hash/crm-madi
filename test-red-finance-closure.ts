/**
 * TEST: Cierre de Campaña Red Finance #1
 *
 * Este script prueba el cierre de la campaña Red Finance #1 usando
 * el nuevo método de filtros genéricos con soporte multi-marca.
 */

import { db } from './server/db';

async function testRedFinanceClosure() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     TEST: Cierre de Campaña Red Finance #1               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // PASO 1: Verificar estado inicial
    console.log('📊 PASO 1: Verificando estado inicial de la campaña...\n');

    const { campanasComerciales, clientes } = await import('./shared/schema');
    const { eq } = await import('drizzle-orm');

    const campaigns = await db
      .select()
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
      .where(eq(campanasComerciales.id, 65))
      .limit(1);

    if (campaigns.length === 0) {
      console.log('❌ Campaña 65 no encontrada\n');
      await db.$client.end();
      process.exit(1);
    }

    const campaign = campaigns[0];
    const campaignData = campaign.campanas_comerciales;
    const clientData = campaign.clientes;

    console.log('📋 Información de Campaña:');
    console.log(`   ID: ${campaignData.id}`);
    console.log(`   Cliente: ${clientData?.nombreComercial}`);
    console.log(`   Número: ${campaignData.numeroCampana}`);
    console.log(`   Marca Principal: ${campaignData.marca}`);
    console.log(`   Marca 2: ${campaignData.marca2 || 'N/A'}`);
    console.log(`   Zona: ${campaignData.zona}`);
    console.log(`   Meta: ${campaignData.cantidadDatosSolicitados} leads`);
    console.log(`   Estado: ${campaignData.estadoCampana}`);
    console.log(`   Asignación Automática: ${campaignData.asignacionAutomatica ? 'Sí' : 'No'}`);
    console.log(`   Fecha Inicio: ${campaignData.fechaCampana}`);
    console.log(`   Fecha Fin: ${campaignData.fechaFin || 'En proceso'}\n`);

    // PASO 2: Ejecutar el cierre usando la API
    console.log('🚀 PASO 2: Ejecutando cierre de campaña...\n');

    const response = await fetch('http://localhost:5000/api/campaign-closure/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientName: clientData?.nombreComercial || 'Red Finance',
        campaignNumber: campaignData.numeroCampana
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error en la petición: ${response.status} ${response.statusText}`);
      console.log(`   Respuesta: ${errorText}\n`);
      await db.$client.end();
      process.exit(1);
    }

    const result = await response.json();

    console.log('📊 Resultado del cierre:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // PASO 3: Verificar estado final
    console.log('🔍 PASO 3: Verificando estado final de la campaña...\n');

    // Esperar un momento para que se actualice la BD
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalCampaigns = await db
      .select()
      .from(campanasComerciales)
      .where(eq(campanasComerciales.id, 65))
      .limit(1);

    if (finalCampaigns.length === 0) {
      console.log('❌ No se pudo verificar el estado final\n');
      await db.$client.end();
      process.exit(1);
    }

    const finalCampaign = finalCampaigns[0];

    console.log('📋 Estado Final de Campaña:');
    console.log(`   Estado: ${finalCampaign.estadoCampana}`);
    console.log(`   Fecha Fin: ${finalCampaign.fechaFin || 'N/A'}`);
    console.log('');

    // PASO 4: Contar leads asignados
    console.log('📊 PASO 4: Contando leads asignados finales...\n');

    const { opLead } = await import('./shared/schema');
    const { sql } = await import('drizzle-orm');

    const leadCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(eq(opLead.campaignId, 65));

    const totalAssigned = leadCount[0]?.count || 0;

    console.log(`✅ Total de leads asignados: ${totalAssigned}`);
    console.log(`🎯 Meta de la campaña: ${campaignData.cantidadDatosSolicitados}`);
    console.log(`📈 Progreso: ${totalAssigned}/${campaignData.cantidadDatosSolicitados} (${Math.round(totalAssigned / campaignData.cantidadDatosSolicitados * 100)}%)`);
    console.log('');

    // RESUMEN FINAL
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMEN DEL TEST                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const expectedBehavior = totalAssigned >= campaignData.cantidadDatosSolicitados
      ? 'Campaña debería estar CERRADA'
      : 'Campaña debería seguir EN PROCESO';

    const actualState = finalCampaign.estadoCampana;
    const isCorrect =
      (totalAssigned >= campaignData.cantidadDatosSolicitados && actualState === 'Finalizada') ||
      (totalAssigned < campaignData.cantidadDatosSolicitados && actualState === 'En proceso');

    console.log(`📊 Leads asignados: ${totalAssigned}/${campaignData.cantidadDatosSolicitados}`);
    console.log(`🎯 Comportamiento esperado: ${expectedBehavior}`);
    console.log(`📋 Estado actual: ${actualState}`);
    console.log(`${isCorrect ? '✅' : '❌'} Test: ${isCorrect ? 'EXITOSO' : 'FALLIDO'}\n`);

    if (isCorrect) {
      console.log('🎉 El cierre de campaña funcionó correctamente!');
      console.log('✅ Los filtros genéricos están operando como se esperaba.\n');
    } else {
      console.log('⚠️  El cierre de campaña no funcionó como se esperaba.');
      console.log('🔍 Revisa los logs del servidor para más detalles.\n');
    }

    // VERIFICACIÓN DE LOGS
    console.log('💡 VERIFICACIÓN:');
    console.log('   Revisa los logs del servidor y busca:');
    console.log('   - Mensajes "[GENERIC FILTERS]" para confirmar uso de filtros genéricos');
    console.log('   - Marcas detectadas: Peugeot, Fiat');
    console.log('   - Cliente normalizado: red_finance');
    console.log('   - Zona: Mendoza\n');

    await db.$client.end();
    process.exit(isCorrect ? 0 : 1);

  } catch (error: any) {
    console.error('❌ Error durante el test:', error);
    await db.$client.end();
    process.exit(1);
  }
}

// Ejecutar test
testRedFinanceClosure();
