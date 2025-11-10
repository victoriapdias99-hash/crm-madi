/**
 * SCRIPT DE VALIDACIÓN: Comparación de Métodos de Conteo
 *
 * Este script compara los dos métodos de conteo de leads:
 * 1. Método Legacy: Cuenta por campaign_id
 * 2. Método Nuevo: Cuenta por filtros genéricos (cliente/marca/zona/fechas)
 *
 * Propósito: Validar que el método nuevo funciona correctamente antes
 * de habilitar el feature flag USE_GENERIC_CAMPAIGN_FILTERS=true
 */

import { db } from './server/db';
import { PostgresLeadRepository } from './server/campaign-closure/infrastructure/repositories/PostgresLeadRepository';

interface ComparisonResult {
  campaignId: number;
  campaignNumber: number;
  clientName: string;
  brandName: string;
  zone: string;
  targetLeads: number;
  legacyCount: number;
  genericCount: number;
  difference: number;
  status: 'MATCH' | 'MISMATCH';
  dashboardValue?: number;
}

async function validateCountingMethods() {
  console.log('╔═════════════════════════════════════════════════════════════╗');
  console.log('║      VALIDACIÓN: Métodos de Conteo de Leads               ║');
  console.log('╚═════════════════════════════════════════════════════════════╝\n');

  try {
    // Inicializar repositorio
    const leadRepository = new PostgresLeadRepository();

    // Campañas a validar (puedes agregar más IDs aquí)
    const campaignIdsToValidate = [65, 38, 84]; // Red Finance #1, y otras campañas

    const results: ComparisonResult[] = [];

    console.log('🔍 Validando campañas:', campaignIdsToValidate.join(', '));
    console.log('');

    for (const campaignId of campaignIdsToValidate) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`   CAMPAÑA ID: ${campaignId}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Obtener información de la campaña
      const { campanasComerciales, clientes } = await import('./shared/schema');
      const { eq } = await import('drizzle-orm');

      const campaigns = await db
        .select()
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
        .where(eq(campanasComerciales.id, campaignId))
        .limit(1);

      if (campaigns.length === 0) {
        console.log(`⚠️  Campaña ${campaignId} no encontrada\n`);
        continue;
      }

      const campaign = campaigns[0];
      const clientName = campaign.clientes?.nombreComercial || '';
      const brandName = campaign.campanas_comerciales.marca || '';
      const zone = campaign.campanas_comerciales.zona || '';
      const campaignNumber = campaign.campanas_comerciales.numeroCampana;
      const targetLeads = campaign.campanas_comerciales.cantidadDatosSolicitados;

      console.log(`📋 Detalles de Campaña:`);
      console.log(`   Cliente: ${clientName}`);
      console.log(`   Marca: ${brandName}`);
      console.log(`   Zona: ${zone}`);
      console.log(`   Número: ${campaignNumber}`);
      console.log(`   Meta: ${targetLeads} leads`);
      console.log('');

      // MÉTODO 1: Conteo Legacy (por campaign_id)
      console.log('📊 MÉTODO 1: Conteo Legacy (campaign_id)');
      const legacyStart = Date.now();

      // Forzar uso del método legacy pasando false
      const legacyCount = await leadRepository.countAssignedLeadsForCampaign(campaignId, false);

      const legacyTime = Date.now() - legacyStart;
      console.log(`   Resultado: ${legacyCount} leads`);
      console.log(`   Tiempo: ${legacyTime}ms\n`);

      // MÉTODO 2: Conteo Nuevo (filtros genéricos)
      console.log('📊 MÉTODO 2: Conteo Nuevo (filtros genéricos)');
      const genericStart = Date.now();

      // Temporalmente habilitar el feature flag para esta prueba
      const originalFlag = process.env.USE_GENERIC_CAMPAIGN_FILTERS;
      process.env.USE_GENERIC_CAMPAIGN_FILTERS = 'true';

      const genericCount = await leadRepository.countAssignedLeadsForCampaign(campaignId, true);

      // Restaurar flag original
      process.env.USE_GENERIC_CAMPAIGN_FILTERS = originalFlag;

      const genericTime = Date.now() - genericStart;
      console.log(`   Resultado: ${genericCount} leads`);
      console.log(`   Tiempo: ${genericTime}ms\n`);

      // COMPARACIÓN
      const difference = genericCount - legacyCount;
      const status: 'MATCH' | 'MISMATCH' = difference === 0 ? 'MATCH' : 'MISMATCH';

      console.log('🔍 COMPARACIÓN:');
      console.log(`   Legacy:  ${legacyCount} leads`);
      console.log(`   Generic: ${genericCount} leads`);
      console.log(`   Diferencia: ${difference > 0 ? '+' : ''}${difference} leads`);
      console.log(`   Estado: ${status === 'MATCH' ? '✅ MATCH' : '⚠️  MISMATCH'}\n`);

      // Performance
      const performanceDiff = genericTime - legacyTime;
      console.log('⚡ PERFORMANCE:');
      console.log(`   Legacy:  ${legacyTime}ms`);
      console.log(`   Generic: ${genericTime}ms`);
      console.log(`   Diferencia: ${performanceDiff > 0 ? '+' : ''}${performanceDiff}ms`);
      console.log('');

      results.push({
        campaignId,
        campaignNumber,
        clientName,
        brandName,
        zone,
        targetLeads,
        legacyCount,
        genericCount,
        difference,
        status
      });
    }

    // RESUMEN FINAL
    console.log('\n╔═════════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMEN DE VALIDACIÓN                   ║');
    console.log('╚═════════════════════════════════════════════════════════════╝\n');

    const matches = results.filter(r => r.status === 'MATCH').length;
    const mismatches = results.filter(r => r.status === 'MISMATCH').length;

    console.log(`📊 Total de campañas validadas: ${results.length}`);
    console.log(`✅ Coincidencias (MATCH): ${matches}`);
    console.log(`⚠️  Discrepancias (MISMATCH): ${mismatches}\n`);

    if (mismatches > 0) {
      console.log('⚠️  CAMPAÑAS CON DISCREPANCIAS:\n');
      results
        .filter(r => r.status === 'MISMATCH')
        .forEach(r => {
          console.log(`   Campaña ${r.campaignNumber} (ID: ${r.campaignId})`);
          console.log(`   Cliente: ${r.clientName}`);
          console.log(`   Legacy: ${r.legacyCount} | Generic: ${r.genericCount} | Diff: ${r.difference > 0 ? '+' : ''}${r.difference}`);
          console.log('');
        });
    }

    // TABLA COMPARATIVA
    console.log('📋 TABLA COMPARATIVA:\n');
    console.log('┌─────┬────────┬─────────────────┬──────────┬─────────┬────────────┬──────────┐');
    console.log('│ ID  │ Número │     Cliente     │  Legacy  │ Generic │ Diferencia │  Status  │');
    console.log('├─────┼────────┼─────────────────┼──────────┼─────────┼────────────┼──────────┤');

    results.forEach(r => {
      const id = r.campaignId.toString().padEnd(3);
      const num = r.campaignNumber.toString().padEnd(6);
      const client = r.clientName.substring(0, 15).padEnd(15);
      const legacy = r.legacyCount.toString().padStart(8);
      const generic = r.genericCount.toString().padStart(7);
      const diff = `${r.difference > 0 ? '+' : ''}${r.difference}`.padStart(10);
      const status = r.status === 'MATCH' ? '   ✅   ' : '   ⚠️    ';

      console.log(`│ ${id} │ ${num} │ ${client} │ ${legacy} │ ${generic} │ ${diff} │ ${status} │`);
    });

    console.log('└─────┴────────┴─────────────────┴──────────┴─────────┴────────────┴──────────┘\n');

    // RECOMENDACIÓN
    console.log('💡 RECOMENDACIÓN:\n');

    if (mismatches === 0) {
      console.log('✅ Todos los métodos coinciden perfectamente.');
      console.log('✅ Es SEGURO habilitar el feature flag USE_GENERIC_CAMPAIGN_FILTERS=true\n');
      console.log('📝 Próximos pasos:');
      console.log('   1. Actualizar .env: USE_GENERIC_CAMPAIGN_FILTERS=true');
      console.log('   2. Reiniciar el servidor');
      console.log('   3. Probar el cierre de campaña con Red Finance #1');
      console.log('   4. Monitorear el dashboard para verificar sincronización\n');
    } else {
      console.log('⚠️  Se detectaron discrepancias entre los métodos.');
      console.log('⚠️  NO es seguro habilitar el feature flag todavía.\n');
      console.log('🔍 Acciones requeridas:');
      console.log('   1. Investigar las campañas con discrepancias');
      console.log('   2. Verificar la lógica de filtrado genérico');
      console.log('   3. Ajustar el código si es necesario');
      console.log('   4. Re-ejecutar este script de validación\n');
    }

    await db.$client.end();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Error durante validación:', error);
    await db.$client.end();
    process.exit(1);
  }
}

// Ejecutar validación
validateCountingMethods();
