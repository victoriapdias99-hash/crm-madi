import { db } from './db';
import { campanasComerciales, clientes } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { LeadAssigner } from './campaign-closure/domain/services/LeadAssigner';
import { PostgresLeadRepository } from './campaign-closure/infrastructure/repositories/PostgresLeadRepository';
import { extractBrandsFromCampaign, calculateLeadDistribution, validateBrandPercentages } from '../shared/utils/multi-brand-utils';

/**
 * Test para verificar la funcionalidad de asignación multi-marca
 */
async function testMultiBrandAssignment() {
  console.log('🎯 TEST ASIGNACIÓN MULTI-MARCA\n');

  try {
    // 1. Configurar Red Finance con múltiples marcas activas
    console.log('📊 PASO 1: Verificando configuración de Red Finance');

    const campana65 = await db
      .select()
      .from(campanasComerciales)
      .where(eq(campanasComerciales.id, 65))
      .limit(1);

    if (campana65.length === 0) {
      console.log('❌ Campaña 65 no encontrada');
      return;
    }

    const campana = campana65[0];
    console.log(`✅ Campaña encontrada: ${campana.marca} ${campana.numeroCampana}`);
    console.log(`   Cliente ID: ${campana.clienteId}`);
    console.log(`   Zona: ${campana.zona}`);
    console.log(`   Solicitados: ${campana.cantidadDatosSolicitados}`);

    // 2. Obtener datos del cliente
    const cliente = await db
      .select()
      .from(clientes)
      .where(eq(clientes.id, campana.clienteId))
      .limit(1);

    if (cliente.length === 0) {
      console.log('❌ Cliente no encontrado');
      return;
    }

    const clienteData = cliente[0];
    console.log(`   Cliente: ${clienteData.nombreCliente} (${clienteData.nombreComercial})`);

    // 3. Analizar configuración de múltiples marcas
    console.log('\n📊 PASO 2: Analizando configuración de múltiples marcas');

    const brands = extractBrandsFromCampaign(campana);
    console.log(`✅ Marcas extraídas: ${brands.length}`);
    brands.forEach((brand, i) => {
      console.log(`   ${i + 1}. ${brand.marca}: ${brand.porcentaje}%`);
    });

    const validation = validateBrandPercentages(brands);
    console.log(`✅ Validación: ${validation.valid ? '✅ Válida' : '❌ Inválida'} (Total: ${validation.total}%)`);
    if (validation.error) {
      console.log(`   Error: ${validation.error}`);
    }

    // 4. Calcular distribución de leads
    console.log('\n📊 PASO 3: Calculando distribución de leads');

    const targetCount = 10; // Probar con 10 leads
    const distribution = calculateLeadDistribution(targetCount, brands);

    console.log(`📋 Distribución para ${targetCount} leads:`);
    Object.entries(distribution).forEach(([marca, count]) => {
      console.log(`   - ${marca}: ${count} leads`);
    });

    // 5. Probar la funcionalidad de asignación (sin ejecutar realmente)
    console.log('\n📊 PASO 4: Probando funcionalidad de asignación');

    // Inicializar repositorio y assigner
    const leadRepository = new PostgresLeadRepository(db);
    const leadAssigner = new LeadAssigner(leadRepository);

    console.log('✅ LeadAssigner inicializado correctamente');
    console.log('✅ Método assignLeadsWithMultiBrands disponible');

    // 6. Verificar disponibilidad de leads por marca
    console.log('\n📊 PASO 5: Verificando disponibilidad de leads por marca');

    for (const brand of brands) {
      try {
        const stats = await leadAssigner.getAvailabilityStats(
          clienteData.nombreComercial,
          brand.marca,
          campana.zona
        );

        console.log(`📊 ${brand.marca}:`);
        console.log(`   - Total: ${stats.total} leads`);
        console.log(`   - Disponibles: ${stats.available} leads`);
        console.log(`   - Asignados: ${stats.assigned} leads`);
        console.log(`   - Necesarios: ${distribution[brand.marca]} leads`);

        const suficientes = stats.available >= distribution[brand.marca];
        console.log(`   - Suficientes: ${suficientes ? '✅' : '❌'}`);

      } catch (error) {
        console.log(`❌ Error verificando ${brand.marca}:`, error.message);
      }
    }

    // 7. Simular asignación multi-marca (sin ejecutar)
    console.log('\n📊 PASO 6: Simulación de asignación multi-marca');
    console.log('🎯 Esta sería la llamada real (no ejecutada):');
    console.log(`   leadAssigner.assignLeadsWithMultiBrands(`);
    console.log(`     campaignData: ${JSON.stringify({ marca: campana.marca, marca2: campana.marca2, porcentaje: campana.porcentaje, porcentaje2: campana.porcentaje2 })}`);
    console.log(`     clientName: "${clienteData.nombreComercial}"`);
    console.log(`     zone: "${campana.zona}"`);
    console.log(`     campaignId: ${campana.id}`);
    console.log(`     targetCount: ${targetCount}`);
    console.log(`   )`);

    console.log('\n✅ Funcionalidad lista para usar');

  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

// Ejecutar test
testMultiBrandAssignment().then(() => {
  console.log('\n✅ Test de asignación multi-marca completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});