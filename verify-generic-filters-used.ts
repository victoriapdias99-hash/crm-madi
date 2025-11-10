/**
 * VERIFICACIÓN: Confirmar que se usan filtros genéricos
 */

import { PostgresLeadRepository } from './server/campaign-closure/infrastructure/repositories/PostgresLeadRepository';
import { db } from './server/db';

async function verify() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICACIÓN: Uso de Filtros Genéricos                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const leadRepo = new PostgresLeadRepository();

  console.log('🔍 Feature Flag Status:');
  console.log(`   USE_GENERIC_CAMPAIGN_FILTERS = ${process.env.USE_GENERIC_CAMPAIGN_FILTERS}\n`);

  console.log('📊 Probando conteo para Red Finance #1 (campaña 65)...\n');

  // Test con feature flag deshabilitado
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Método Legacy (useGenericFilters = false)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const legacyCount = await leadRepo.countAssignedLeadsForCampaign(65, false);
  console.log(`\n✅ Resultado Legacy: ${legacyCount} leads\n`);

  // Test con feature flag habilitado
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Método Nuevo (useGenericFilters = true)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const genericCount = await leadRepo.countAssignedLeadsForCampaign(65, true);
  console.log(`\n✅ Resultado Generic: ${genericCount} leads\n`);

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                      RESULTADO                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`Legacy:  ${legacyCount} leads`);
  console.log(`Generic: ${genericCount} leads`);
  console.log(`Match:   ${legacyCount === genericCount ? '✅ SÍ' : '❌ NO'}\n`);

  if (legacyCount === genericCount) {
    console.log('🎉 Los filtros genéricos funcionan correctamente!');
    console.log('✅ Ambos métodos retornan el mismo conteo.\n');
  } else {
    console.log('⚠️  Hay discrepancia entre los métodos.');
    console.log('🔍 Revisa los logs arriba para ver qué filtros se aplicaron.\n');
  }

  console.log('💡 Busca en los logs mensajes que contengan:');
  console.log('   - "[LEGACY]" para el método legacy');
  console.log('   - "[GENERIC FILTERS]" para el método nuevo');
  console.log('   - "Marcas: Peugeot, Fiat" para confirmar multi-marca\n');

  await db.$client.end();
}

verify();
