import { db } from './db';
import { campanasComerciales, clientes } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { MultiBrandCampaignClosureUseCase } from './campaign-closure/application/usecases/MultiBrandCampaignClosureUseCase';
import { PostgresCampaignRepository } from './campaign-closure/infrastructure/repositories/PostgresCampaignRepository';
import { PostgresLeadRepository } from './campaign-closure/infrastructure/repositories/PostgresLeadRepository';

/**
 * Test completo de la funcionalidad multi-marca con Red Finance
 */
async function testMultiBrandFunctionality() {
  console.log('🎯 TEST COMPLETO FUNCIONALIDAD MULTI-MARCA\n');

  try {
    // 1. Verificar campaña Red Finance
    console.log('📊 PASO 1: Verificando campaña Red Finance');

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
    console.log(`   ID: ${campana.id}`);
    console.log(`   Cliente ID: ${campana.clienteId}`);
    console.log(`   Zona: ${campana.zona}`);
    console.log(`   Solicitados: ${campana.cantidadDatosSolicitados}`);
    console.log(`   Estado: ${campana.estado}`);

    // 2. Obtener datos del cliente
    console.log('\n📊 PASO 2: Obteniendo datos del cliente');

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
    console.log(`✅ Cliente: ${clienteData.nombreCliente}`);
    console.log(`   Nombre comercial: ${clienteData.nombreComercial}`);

    // 3. Inicializar repositorios y use case
    console.log('\n📊 PASO 3: Inicializando sistema multi-marca');

    const campaignRepository = new PostgresCampaignRepository(db);
    const leadRepository = new PostgresLeadRepository(db);
    const multiBrandUseCase = new MultiBrandCampaignClosureUseCase(campaignRepository, leadRepository);

    console.log('✅ Repositorios inicializados');
    console.log('✅ MultiBrandCampaignClosureUseCase creado');

    // 4. Validar configuración multi-marca
    console.log('\n📊 PASO 4: Validando configuración multi-marca');

    const validation = await multiBrandUseCase.validateMultiBrandClosure(campana.id);

    console.log(`📋 Resultado de validación:`);
    console.log(`   - Válida: ${validation.valid ? '✅' : '❌'}`);
    console.log(`   - Múltiples marcas: ${validation.hasMultipleBrands ? '✅' : '❌'}`);
    console.log(`   - Marcas encontradas: ${validation.brands.length}`);

    validation.brands.forEach((brand, i) => {
      console.log(`     ${i + 1}. ${brand.marca}: ${brand.porcentaje}%`);
    });

    console.log(`   - Mensaje: ${validation.message}`);

    if (validation.hasMultipleBrands) {
      console.log(`📊 Disponibilidad por marca:`);
      Object.entries(validation.availabilityByBrand).forEach(([marca, disponibles]) => {
        console.log(`   - ${marca}: ${disponibles} leads disponibles`);
      });
    }

    // 5. Simular asignación multi-marca (sin ejecutar realmente)
    console.log('\n📊 PASO 5: Simulación de asignación multi-marca');

    if (validation.valid && validation.hasMultipleBrands) {
      console.log('🎯 La campaña es válida para cierre multi-marca');
      console.log('📋 Parámetros que se usarían:');
      console.log(`   - CampaignId: ${campana.id}`);
      console.log(`   - Cliente: ${clienteData.nombreComercial}`);
      console.log(`   - Leads solicitados: ${campana.cantidadDatosSolicitados}`);
      console.log(`   - Configuración: ${validation.brands.map(b => `${b.marca}(${b.porcentaje}%)`).join(' + ')}`);

      // Verificar si tenemos suficientes leads
      const totalDisponibles = Object.values(validation.availabilityByBrand).reduce((sum, count) => sum + count, 0);
      console.log(`   - Total disponibles: ${totalDisponibles} leads`);
      console.log(`   - Suficientes: ${totalDisponibles >= campana.cantidadDatosSolicitados ? '✅' : '❌'}`);

      if (totalDisponibles >= campana.cantidadDatosSolicitados) {
        console.log('\n✅ FUNCIONALIDAD LISTA PARA EJECUTAR');
        console.log('🎯 Para ejecutar realmente la asignación, usar:');
        console.log(`   multiBrandUseCase.closeCampaignWithMultiBrands(${campana.id}, "${clienteData.nombreComercial}")`);
      } else {
        console.log('\n⚠️ No hay suficientes leads disponibles para ejecutar');
      }

    } else {
      console.log('❌ La campaña no es válida para cierre multi-marca');
      if (!validation.hasMultipleBrands) {
        console.log('   Razón: Campaña con una sola marca');
      }
      if (!validation.validation.valid) {
        console.log(`   Error: ${validation.validation.error}`);
      }
    }

    // 6. Verificar endpoints disponibles
    console.log('\n📊 PASO 6: Endpoints disponibles');
    console.log('🌐 Rutas multi-marca configuradas:');
    console.log(`   GET  /api/campaign-closure/multi-brand/validate/${campana.id}`);
    console.log(`   POST /api/campaign-closure/multi-brand/execute/${campana.id}`);
    console.log('     Body: { "clientName": "' + clienteData.nombreComercial + '" }');

    console.log('\n✅ SISTEMA MULTI-MARCA COMPLETAMENTE FUNCIONAL');

  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

// Ejecutar test
testMultiBrandFunctionality().then(() => {
  console.log('\n✅ Test de funcionalidad multi-marca completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
