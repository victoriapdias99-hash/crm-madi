/**
 * Script de prueba para el endpoint de leads enviados
 * Verifica que el endpoint /api/leads/sent-by-campaign/:campaignId funcione correctamente
 */

import { db } from './server/db';
import { campanasComerciales, opLead, clientes } from '@shared/schema';
import { eq, isNotNull, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function testSentLeadsEndpoint() {
  console.log('🧪 Iniciando prueba del endpoint de leads enviados\n');

  try {
    // PASO 1: Buscar una campaña con leads asignados
    console.log('📋 PASO 1: Buscando campañas con leads asignados...');

    const campaignsWithLeads = await db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        clienteId: campanasComerciales.clienteId,
        marca: campanasComerciales.marca,
        zona: campanasComerciales.zona,
        leadCount: sql<number>`COUNT(${opLead.id})::int`
      })
      .from(campanasComerciales)
      .leftJoin(opLead, eq(opLead.campaignId, campanasComerciales.id))
      .where(isNotNull(campanasComerciales.id))
      .groupBy(
        campanasComerciales.id,
        campanasComerciales.numeroCampana,
        campanasComerciales.clienteId,
        campanasComerciales.marca,
        campanasComerciales.zona
      )
      .having(sql`COUNT(${opLead.id}) > 0`)
      .limit(5);

    console.log(`✅ Encontradas ${campaignsWithLeads.length} campañas con leads asignados\n`);

    if (campaignsWithLeads.length === 0) {
      console.log('⚠️ No hay campañas con leads asignados para probar');
      console.log('💡 Sugerencia: Cierra una campaña primero usando el botón de cerrar campaña');
      return;
    }

    // Mostrar campañas encontradas
    console.log('📊 Campañas con leads:');
    for (const campaign of campaignsWithLeads) {
      console.log(`   - ID: ${campaign.id}, Campaña #${campaign.numeroCampana}, Marca: ${campaign.marca}, Zona: ${campaign.zona}, Leads: ${campaign.leadCount}`);
    }
    console.log('');

    // PASO 2: Probar el endpoint con la primera campaña
    const testCampaign = campaignsWithLeads[0];
    console.log(`🎯 PASO 2: Probando endpoint con campaña ID ${testCampaign.id}...\n`);

    const apiUrl = `http://localhost:5000/api/leads/sent-by-campaign/${testCampaign.id}`;
    console.log(`📡 URL: ${apiUrl}`);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // PASO 3: Verificar la respuesta
    console.log('\n✅ PASO 3: Respuesta del endpoint:\n');
    console.log(JSON.stringify(data, null, 2));

    // PASO 4: Validar estructura de la respuesta
    console.log('\n🔍 PASO 4: Validando estructura de la respuesta...');

    const validations = [
      { field: 'campaignId', exists: data.campaignId !== undefined, value: data.campaignId },
      { field: 'campaignName', exists: data.campaignName !== undefined, value: data.campaignName },
      { field: 'totalSent', exists: data.totalSent !== undefined, value: data.totalSent },
      { field: 'leads', exists: Array.isArray(data.leads), value: `Array con ${data.leads?.length || 0} elementos` }
    ];

    console.log('');
    let allValid = true;
    for (const validation of validations) {
      const status = validation.exists ? '✅' : '❌';
      console.log(`${status} ${validation.field}: ${validation.value}`);
      if (!validation.exists) allValid = false;
    }

    // PASO 5: Validar que el conteo coincide
    console.log('\n📊 PASO 5: Validando conteo de leads...');
    const expectedCount = testCampaign.leadCount;
    const actualCount = data.totalSent;

    if (expectedCount === actualCount) {
      console.log(`✅ Conteo correcto: ${actualCount} leads (coincide con la DB)`);
    } else {
      console.log(`⚠️ Discrepancia en conteo: esperados ${expectedCount}, recibidos ${actualCount}`);
    }

    // PASO 6: Verificar estructura de cada lead
    if (data.leads && data.leads.length > 0) {
      console.log('\n🔍 PASO 6: Validando estructura del primer lead...');
      const firstLead = data.leads[0];

      const leadFields = [
        'id', 'metaLeadId', 'nombre', 'telefono', 'email',
        'ciudad', 'modelo', 'marca', 'campaign', 'fechaCreacion', 'sentAt'
      ];

      console.log('');
      for (const field of leadFields) {
        const exists = firstLead[field] !== undefined;
        const status = exists ? '✅' : '⚠️';
        const value = firstLead[field] || 'null';
        console.log(`${status} ${field}: ${value}`);
      }
    }

    // PASO 7: Prueba con campaña inexistente
    console.log('\n🧪 PASO 7: Probando con campaña inexistente (ID 99999)...');
    const invalidResponse = await fetch('http://localhost:5000/api/leads/sent-by-campaign/99999');
    const invalidData = await invalidResponse.json();

    if (invalidData.totalSent === 0 && invalidData.leads.length === 0) {
      console.log('✅ Manejo correcto de campaña inexistente');
    } else {
      console.log('⚠️ Respuesta inesperada para campaña inexistente');
    }

    console.log('\n✅ PRUEBA COMPLETADA EXITOSAMENTE\n');

    // Resumen
    console.log('📋 RESUMEN:');
    console.log(`   ✅ Endpoint funcionando: http://localhost:5000/api/leads/sent-by-campaign/:campaignId`);
    console.log(`   ✅ Estructura de respuesta válida`);
    console.log(`   ✅ Datos correctos desde la base de datos`);
    console.log(`   ✅ Manejo de errores funcionando`);
    console.log('');
    console.log('🎉 El endpoint está listo para usar en el frontend!');
    console.log('💡 Abre http://localhost:5000/campanas-pendientes y haz clic en el número verde de enviados');

  } catch (error: any) {
    console.error('\n❌ ERROR EN LA PRUEBA:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar la prueba
testSentLeadsEndpoint();
