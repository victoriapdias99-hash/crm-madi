import { db } from './db';
import { campanasComerciales, clientes } from '../shared/schema';
import { eq, isNotNull } from 'drizzle-orm';

/**
 * Script para "reabrir" campañas finalizadas limpiando su fecha_fin
 * Útil después de limpiar leads para dejar las campañas listas para cierre desde cero
 *
 * USO:
 * 1. Modo DRY RUN: npx tsx server/reopen-finished-campaigns.ts --dry-run
 * 2. Modo EJECUCIÓN: npx tsx server/reopen-finished-campaigns.ts --execute
 */

interface ReopenOptions {
  dryRun: boolean;
}

async function reopenFinishedCampaigns(options: ReopenOptions) {
  const { dryRun } = options;

  console.log('📂 REAPERTURA DE CAMPAÑAS FINALIZADAS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('⚠️  MODO DRY RUN - No se harán cambios reales\n');
  } else {
    console.log('🚨 MODO EJECUCIÓN - Se limpiarán las fecha_fin\n');
  }

  try {
    // 1. Obtener todas las campañas con fecha_fin
    console.log('📋 BUSCANDO CAMPAÑAS CON FECHA FIN...\n');

    const finishedCampaigns = await db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        clienteNombre: clientes.nombreCliente,
        clienteComercial: clientes.nombreComercial,
        marca: campanasComerciales.marca,
        zona: campanasComerciales.zona,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
      .where(isNotNull(campanasComerciales.fechaFin));

    if (finishedCampaigns.length === 0) {
      console.log('✅ No hay campañas con fecha_fin\n');
      return;
    }

    console.log(`   Se encontraron ${finishedCampaigns.length} campañas con fecha_fin\n`);

    // 2. Mostrar tabla
    console.log('┌────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ CAMPAÑAS A REABRIR                                                          │');
    console.log('├────────────────────────────────────────────────────────────────────────────┤');
    console.log('│  ID │ Cliente               │ #  │ Marca      │ Fecha Fin  │');
    console.log('├────────────────────────────────────────────────────────────────────────────┤');

    finishedCampaigns.forEach(campaign => {
      const id = String(campaign.id).padStart(4);
      const cliente = (campaign.clienteComercial || 'N/A').padEnd(21).substring(0, 21);
      const numero = String(campaign.numeroCampana).padStart(2);
      const marca = (campaign.marca || 'N/A').padEnd(10).substring(0, 10);
      const fechaFin = campaign.fechaFin
        ? new Date(campaign.fechaFin).toISOString().split('T')[0]
        : 'N/A';

      console.log(`│ ${id} │ ${cliente} │ ${numero} │ ${marca} │ ${fechaFin} │`);
    });

    console.log('└────────────────────────────────────────────────────────────────────────────┘');

    // 3. Resumen
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN:\n');
    console.log(`   Campañas a reabrir: ${finishedCampaigns.length}`);
    console.log('   Acción: Limpiar fecha_fin (NULL)');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (dryRun) {
      console.log('✅ DRY RUN completado - No se realizaron cambios\n');
      console.log('Para ejecutar realmente, usa:');
      console.log('   npx tsx server/reopen-finished-campaigns.ts --execute\n');
      return;
    }

    // 4. EJECUTAR LIMPIEZA
    console.log('🚀 REABRIENDO CAMPAÑAS...\n');

    let reopenedCount = 0;
    const errors = [];

    for (const campaign of finishedCampaigns) {
      try {
        await db
          .update(campanasComerciales)
          .set({ fechaFin: null })
          .where(eq(campanasComerciales.id, campaign.id));

        reopenedCount++;
        console.log(`   ✅ Campaña ${campaign.id} (${campaign.clienteComercial} #${campaign.numeroCampana}): Reabierta`);

      } catch (error: any) {
        errors.push({
          campaignId: campaign.id,
          error: error.message,
        });
        console.log(`   ❌ Campaña ${campaign.id}: Error - ${error.message}`);
      }
    }

    // 5. Verificación
    console.log('\n🔍 VERIFICANDO...\n');

    const [stillFinished] = await db
      .select({ count: db.$count() })
      .from(campanasComerciales)
      .where(isNotNull(campanasComerciales.fechaFin));

    console.log(`   Campañas que aún tienen fecha_fin: ${stillFinished?.count || 0}`);

    // 6. Resumen final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ PROCESO COMPLETADO\n');
    console.log(`   Campañas reabiertas: ${reopenedCount} de ${finishedCampaigns.length}`);

    if (errors.length > 0) {
      console.log(`\n   ⚠️  Errores encontrados: ${errors.length}`);
      errors.forEach(err => {
        console.log(`      - Campaña ${err.campaignId}: ${err.error}`);
      });
    } else {
      console.log('\n   ✅ Sin errores - Todas las campañas fueron reabiertas');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Parsear argumentos
function parseArgs(): ReopenOptions {
  const args = process.argv.slice(2);
  return {
    dryRun: !args.includes('--execute'),
  };
}

// Ejecutar
const options = parseArgs();
reopenFinishedCampaigns(options);
