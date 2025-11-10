import { db } from './db';
import { opLead, opLeadsRep, campanasComerciales, clientes } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Script para resetear (limpiar) los campaign_id de leads asignados a una campaña
 * Esto permite realizar pruebas de cierre de campaña desde cero
 *
 * USO:
 * 1. Modo DRY RUN (solo previsualización): npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=65
 * 2. Modo EJECUCIÓN real: npx tsx server/reset-campaign-leads.ts --campaign-id=65
 * 3. Reset por cliente: npx tsx server/reset-campaign-leads.ts --client="red finance" --campaign-number=1
 */

interface ResetOptions {
  dryRun: boolean;
  campaignId?: number;
  clientName?: string;
  campaignNumber?: number;
}

async function resetCampaignLeads(options: ResetOptions) {
  const { dryRun, campaignId, clientName, campaignNumber } = options;

  console.log('🔄 RESET DE CAMPAIGN IDS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('⚠️  MODO DRY RUN - No se harán cambios reales\n');
  } else {
    console.log('🚨 MODO EJECUCIÓN - Se limpiarán los campaign_ids\n');
  }

  try {
    let targetCampaignId: number | undefined;

    // 1. Determinar la campaña objetivo
    if (campaignId) {
      targetCampaignId = campaignId;
      console.log(`🎯 Campaña objetivo: ID ${campaignId}\n`);
    } else if (clientName && campaignNumber !== undefined) {
      // Buscar campaña por nombre de cliente y número
      const campaigns = await db
        .select({
          id: campanasComerciales.id,
          numeroCampana: campanasComerciales.numeroCampana,
          clienteNombre: clientes.nombreCliente,
          clienteComercial: clientes.nombreComercial,
          marca: campanasComerciales.marca,
          zona: campanasComerciales.zona,
        })
        .from(campanasComerciales)
        .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
        .where(
          and(
            eq(campanasComerciales.numeroCampana, campaignNumber),
            sql`lower(${clientes.nombreComercial}) LIKE ${`%${clientName.toLowerCase()}%`}`
          )
        );

      if (campaigns.length === 0) {
        console.error(`❌ No se encontró campaña "${clientName}" #${campaignNumber}`);
        return;
      }

      if (campaigns.length > 1) {
        console.error(`⚠️  Se encontraron ${campaigns.length} campañas que coinciden:`);
        campaigns.forEach(c => {
          console.log(`   - ID ${c.id}: ${c.clienteComercial} #${c.numeroCampana} - ${c.marca}`);
        });
        console.error('\n❌ Por favor, usa --campaign-id para especificar cuál quieres resetear');
        return;
      }

      targetCampaignId = campaigns[0].id;
      console.log(`🎯 Campaña encontrada: ${campaigns[0].clienteComercial} #${campaigns[0].numeroCampana}\n`);
    } else {
      console.error('❌ Debes especificar --campaign-id O (--client Y --campaign-number)');
      console.log('\nEjemplos:');
      console.log('  npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=65');
      console.log('  npx tsx server/reset-campaign-leads.ts --client="red finance" --campaign-number=1');
      return;
    }

    // 2. Obtener información de la campaña
    const [campaign] = await db
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
      .where(eq(campanasComerciales.id, targetCampaignId));

    if (!campaign) {
      console.error(`❌ Campaña ${targetCampaignId} no encontrada`);
      return;
    }

    console.log('📋 INFORMACIÓN DE LA CAMPAÑA:\n');
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Cliente: ${campaign.clienteComercial}`);
    console.log(`   Número: ${campaign.numeroCampana}`);
    console.log(`   Marca: ${campaign.marca}${campaign.marca2 ? ` + ${campaign.marca2}` : ''}`);
    console.log(`   Zona: ${campaign.zona}`);
    console.log(`   Solicitados: ${campaign.cantidadSolicitados}`);
    console.log(`   Fecha inicio: ${campaign.fechaCampana}`);
    console.log(`   Fecha fin: ${campaign.fechaFin || 'En proceso'}`);

    // 3. Contar leads asignados en op_lead
    const [leadsInOpLead] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(eq(opLead.campaignId, targetCampaignId));

    console.log('\n📊 LEADS ASIGNADOS:\n');
    console.log(`   op_lead: ${leadsInOpLead.count} registros`);

    // 4. Contar leads asignados en op_leads_rep
    const [leadsInOpLeadsRep] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(eq(opLeadsRep.campaignId, targetCampaignId));

    console.log(`   op_leads_rep: ${leadsInOpLeadsRep.count} registros`);

    const totalLeads = leadsInOpLead.count;

    if (totalLeads === 0) {
      console.log('\n✅ Esta campaña no tiene leads asignados. No hay nada que resetear.\n');
      return;
    }

    // 5. Mostrar ejemplos de leads que serán afectados
    console.log('\n📄 EJEMPLOS DE LEADS QUE SERÁN LIBERADOS (primeros 5):\n');

    const examples = await db
      .select({
        id: opLead.id,
        marca: opLead.marca,
        cliente: opLead.cliente,
        localizacion: opLead.localizacion,
        fechaCreacion: opLead.fechaCreacion,
      })
      .from(opLead)
      .where(eq(opLead.campaignId, targetCampaignId))
      .limit(5);

    examples.forEach((lead, idx) => {
      console.log(`   ${idx + 1}. ID ${lead.id} - ${lead.marca} - ${lead.cliente} - ${lead.localizacion}`);
    });

    // 6. Confirmación de seguridad
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚠️  RESUMEN DE OPERACIÓN:\n');
    console.log(`   Se limpiarán ${totalLeads} leads de la campaña ${campaign.id}`);
    console.log(`   Cliente: ${campaign.clienteComercial} #${campaign.numeroCampana}`);
    console.log(`   Marca: ${campaign.marca}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (dryRun) {
      console.log('✅ DRY RUN completado - No se realizaron cambios');
      console.log('\nPara ejecutar realmente, usa:');
      console.log(`   npx tsx server/reset-campaign-leads.ts --campaign-id=${targetCampaignId}\n`);
      return;
    }

    // 7. EJECUTAR LIMPIEZA
    console.log('🚀 EJECUTANDO LIMPIEZA...\n');

    // Limpiar op_lead (op_leads_rep es una vista que se actualiza automáticamente)
    const resultOpLead = await db
      .update(opLead)
      .set({ campaignId: null })
      .where(eq(opLead.campaignId, targetCampaignId));

    console.log(`   ✅ op_lead: ${leadsInOpLead.count} registros limpiados`);
    console.log(`   ℹ️  op_leads_rep: Se actualizará automáticamente (es una vista)`);

    // Limpiar fecha_fin para "reabrir" la campaña si estaba finalizada
    if (campaign.fechaFin) {
      await db
        .update(campanasComerciales)
        .set({ fechaFin: null })
        .where(eq(campanasComerciales.id, targetCampaignId));

      console.log(`   ✅ fecha_fin: Limpiada (campaña reabierta para pruebas)`);
    } else {
      console.log(`   ℹ️  fecha_fin: Ya estaba NULL (campaña en proceso)`);
    }

    // 8. Verificar limpieza
    console.log('\n🔍 VERIFICANDO LIMPIEZA...\n');

    const [remainingOpLead] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(eq(opLead.campaignId, targetCampaignId));

    const [remainingOpLeadsRep] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(eq(opLeadsRep.campaignId, targetCampaignId));

    if (remainingOpLead.count === 0 && remainingOpLeadsRep.count === 0) {
      console.log('   ✅ Limpieza exitosa - Todos los campaign_id fueron removidos');
    } else {
      console.log(`   ⚠️  Aún quedan registros: op_lead=${remainingOpLead.count}, op_leads_rep=${remainingOpLeadsRep.count}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ PROCESO COMPLETADO\n');
    console.log(`   ${totalLeads} leads fueron liberados de la campaña ${targetCampaignId}`);
    console.log('   Ahora puedes realizar pruebas de cierre desde cero\n');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Parsear argumentos de línea de comandos
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);

  const options: ResetOptions = {
    dryRun: args.includes('--dry-run'),
  };

  args.forEach(arg => {
    if (arg.startsWith('--campaign-id=')) {
      options.campaignId = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--client=')) {
      options.clientName = arg.split('=')[1].replace(/['"]/g, '');
    } else if (arg.startsWith('--campaign-number=')) {
      options.campaignNumber = parseInt(arg.split('=')[1]);
    }
  });

  return options;
}

// Ejecutar
const options = parseArgs();
resetCampaignLeads(options);
