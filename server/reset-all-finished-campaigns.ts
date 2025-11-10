import { db } from './db';
import { opLead, campanasComerciales, clientes } from '../shared/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';

/**
 * Script para resetear TODAS las campañas finalizadas (con fecha_fin)
 * Útil para limpiar el ambiente de testing y empezar desde cero
 *
 * USO:
 * 1. Modo DRY RUN: npx tsx server/reset-all-finished-campaigns.ts --dry-run
 * 2. Modo EJECUCIÓN: npx tsx server/reset-all-finished-campaigns.ts --execute
 * 3. Filtrar por fecha: npx tsx server/reset-all-finished-campaigns.ts --dry-run --before="2025-10-01"
 * 4. Solo una campaña específica: npx tsx server/reset-all-finished-campaigns.ts --only-campaign=65
 */

interface ResetAllOptions {
  dryRun: boolean;
  beforeDate?: string;
  afterDate?: string;
  onlyCampaign?: number;
}

async function resetAllFinishedCampaigns(options: ResetAllOptions) {
  const { dryRun, beforeDate, afterDate, onlyCampaign } = options;

  console.log('🔄 RESET DE CAMPAÑAS FINALIZADAS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('⚠️  MODO DRY RUN - No se harán cambios reales\n');
  } else {
    console.log('🚨 MODO EJECUCIÓN - Se limpiarán los campaign_ids\n');
  }

  try {
    // 1. Obtener todas las campañas finalizadas
    console.log('📋 BUSCANDO CAMPAÑAS FINALIZADAS...\n');

    let query = db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        clienteNombre: clientes.nombreCliente,
        clienteComercial: clientes.nombreComercial,
        marca: campanasComerciales.marca,
        marca2: campanasComerciales.marca2,
        zona: campanasComerciales.zona,
        cantidadSolicitados: campanasComerciales.cantidadDatosSolicitados,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
      .where(isNotNull(campanasComerciales.fechaFin));

    // Aplicar filtros opcionales
    if (onlyCampaign) {
      query = query.where(eq(campanasComerciales.id, onlyCampaign)) as any;
    }

    const finishedCampaigns = await query;

    // Filtrar por fechas si se especificaron
    let filteredCampaigns = finishedCampaigns.filter(c => c.fechaFin);

    if (beforeDate) {
      const before = new Date(beforeDate);
      filteredCampaigns = filteredCampaigns.filter(c =>
        c.fechaFin && new Date(c.fechaFin) <= before
      );
      console.log(`   Filtro: Fecha fin <= ${beforeDate}`);
    }

    if (afterDate) {
      const after = new Date(afterDate);
      filteredCampaigns = filteredCampaigns.filter(c =>
        c.fechaFin && new Date(c.fechaFin) >= after
      );
      console.log(`   Filtro: Fecha fin >= ${afterDate}`);
    }

    if (filteredCampaigns.length === 0) {
      console.log('✅ No hay campañas finalizadas que cumplan los criterios\n');
      return;
    }

    console.log(`\n   Se encontraron ${filteredCampaigns.length} campañas finalizadas\n`);

    // 2. Para cada campaña, contar leads asignados
    console.log('📊 ANALIZANDO LEADS ASIGNADOS...\n');

    const campaignsWithLeads = [];
    let totalLeadsToReset = 0;

    for (const campaign of filteredCampaigns) {
      const [leadsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLead)
        .where(eq(opLead.campaignId, campaign.id));

      if (leadsCount.count > 0) {
        campaignsWithLeads.push({
          ...campaign,
          leadsAsignados: leadsCount.count,
        });
        totalLeadsToReset += leadsCount.count;
      }
    }

    if (campaignsWithLeads.length === 0) {
      console.log('✅ Las campañas finalizadas no tienen leads asignados\n');
      return;
    }

    // 3. Mostrar resumen
    console.log('┌────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ CAMPAÑAS FINALIZADAS CON LEADS ASIGNADOS                                   │');
    console.log('├────────────────────────────────────────────────────────────────────────────┤');
    console.log('│  ID │ Cliente               │ #  │ Marca      │ Fecha Fin  │ Leads │');
    console.log('├────────────────────────────────────────────────────────────────────────────┤');

    campaignsWithLeads.forEach(campaign => {
      const id = String(campaign.id).padStart(4);
      const cliente = (campaign.clienteComercial || 'N/A').padEnd(21).substring(0, 21);
      const numero = String(campaign.numeroCampana).padStart(2);
      const marca = (campaign.marca || 'N/A').padEnd(10).substring(0, 10);
      const fechaFin = campaign.fechaFin
        ? new Date(campaign.fechaFin).toISOString().split('T')[0]
        : 'N/A';
      const leads = String(campaign.leadsAsignados).padStart(5);

      console.log(`│ ${id} │ ${cliente} │ ${numero} │ ${marca} │ ${fechaFin} │ ${leads} │`);
    });

    console.log('└────────────────────────────────────────────────────────────────────────────┘');

    // 4. Resumen de operación
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN DE OPERACIÓN:\n');
    console.log(`   Campañas a resetear: ${campaignsWithLeads.length}`);
    console.log(`   Total de leads a liberar: ${totalLeadsToReset}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (dryRun) {
      console.log('✅ DRY RUN completado - No se realizaron cambios\n');
      console.log('Para ejecutar realmente, usa:');
      console.log('   npx tsx server/reset-all-finished-campaigns.ts --execute\n');

      if (beforeDate || afterDate) {
        console.log('Con los mismos filtros:');
        let cmd = '   npx tsx server/reset-all-finished-campaigns.ts --execute';
        if (beforeDate) cmd += ` --before="${beforeDate}"`;
        if (afterDate) cmd += ` --after="${afterDate}"`;
        console.log(cmd + '\n');
      }
      return;
    }

    // 5. EJECUTAR LIMPIEZA
    console.log('🚀 EJECUTANDO LIMPIEZA EN BATCH...\n');

    let cleanedCampaigns = 0;
    let cleanedLeads = 0;
    const errors = [];

    for (const campaign of campaignsWithLeads) {
      try {
        // Limpiar leads de esta campaña
        await db
          .update(opLead)
          .set({ campaignId: null })
          .where(eq(opLead.campaignId, campaign.id));

        // Limpiar fecha_fin para "reabrir" la campaña
        await db
          .update(campanasComerciales)
          .set({ fechaFin: null })
          .where(eq(campanasComerciales.id, campaign.id));

        cleanedCampaigns++;
        cleanedLeads += campaign.leadsAsignados;

        console.log(`   ✅ Campaña ${campaign.id} (${campaign.clienteComercial} #${campaign.numeroCampana}): ${campaign.leadsAsignados} leads liberados + fecha_fin limpiada`);

      } catch (error: any) {
        errors.push({
          campaignId: campaign.id,
          error: error.message,
        });
        console.log(`   ❌ Campaña ${campaign.id}: Error - ${error.message}`);
      }
    }

    // 6. Verificación final
    console.log('\n🔍 VERIFICACIÓN FINAL...\n');

    let remainingTotal = 0;

    for (const campaign of campaignsWithLeads) {
      const [remaining] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLead)
        .where(eq(opLead.campaignId, campaign.id));

      remainingTotal += remaining.count;

      if (remaining.count > 0) {
        console.log(`   ⚠️  Campaña ${campaign.id}: Aún tiene ${remaining.count} leads asignados`);
      }
    }

    // 7. Resumen final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ PROCESO COMPLETADO\n');
    console.log(`   Campañas procesadas: ${cleanedCampaigns} de ${campaignsWithLeads.length}`);
    console.log(`   Leads liberados: ${cleanedLeads}`);
    console.log(`   Leads restantes asignados: ${remainingTotal}`);

    if (errors.length > 0) {
      console.log(`\n   ⚠️  Errores encontrados: ${errors.length}`);
      errors.forEach(err => {
        console.log(`      - Campaña ${err.campaignId}: ${err.error}`);
      });
    } else {
      console.log('\n   ✅ Sin errores - Todas las campañas fueron limpiadas exitosamente');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Parsear argumentos de línea de comandos
function parseArgs(): ResetAllOptions {
  const args = process.argv.slice(2);

  const options: ResetAllOptions = {
    dryRun: !args.includes('--execute'),
  };

  args.forEach(arg => {
    if (arg.startsWith('--before=')) {
      options.beforeDate = arg.split('=')[1].replace(/['"]/g, '');
    } else if (arg.startsWith('--after=')) {
      options.afterDate = arg.split('=')[1].replace(/['"]/g, '');
    } else if (arg.startsWith('--only-campaign=')) {
      options.onlyCampaign = parseInt(arg.split('=')[1]);
    }
  });

  return options;
}

// Ejecutar
const options = parseArgs();
resetAllFinishedCampaigns(options);
