import { db } from './db';
import { campanasComerciales, clientes, opLead, opLeadsRep } from '../shared/schema';
import { sql, isNotNull, ne } from 'drizzle-orm';

/**
 * Helper para listar campañas con leads asignados
 * Útil para decidir qué campaña resetear
 */

async function listCampaignsWithAssignedLeads() {
  console.log('📋 CAMPAÑAS CON LEADS ASIGNADOS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Obtener todas las campañas con leads asignados
    const campaignsWithLeads = await db
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
      .leftJoin(clientes, sql`${campanasComerciales.clienteId} = ${clientes.id}`);

    // Para cada campaña, contar leads asignados
    const campaignsData = [];

    for (const campaign of campaignsWithLeads) {
      const [leadsCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLead)
        .where(sql`${opLead.campaignId} = ${campaign.id}`);

      if (leadsCount.count > 0) {
        campaignsData.push({
          ...campaign,
          leadsAsignados: leadsCount.count,
        });
      }
    }

    if (campaignsData.length === 0) {
      console.log('✅ No hay campañas con leads asignados\n');
      return;
    }

    console.log(`Se encontraron ${campaignsData.length} campañas con leads asignados:\n`);

    // Ordenar por cantidad de leads (mayor a menor)
    campaignsData.sort((a, b) => b.leadsAsignados - a.leadsAsignados);

    // Mostrar en formato tabla
    console.log('┌────────────────────────────────────────────────────────────────────────────┐');
    console.log('│  ID │ Cliente               │ #  │ Marca      │ Zona    │ Asig │ Solic │');
    console.log('├────────────────────────────────────────────────────────────────────────────┤');

    campaignsData.forEach(campaign => {
      const id = String(campaign.id).padStart(4);
      const cliente = (campaign.clienteComercial || 'N/A').padEnd(21).substring(0, 21);
      const numero = String(campaign.numeroCampana).padStart(2);
      const marca = campaign.marca.padEnd(10).substring(0, 10);
      const marca2 = campaign.marca2 ? `+${campaign.marca2.substring(0, 3)}` : '   ';
      const zona = (campaign.zona || 'N/A').padEnd(7).substring(0, 7);
      const asignados = String(campaign.leadsAsignados).padStart(4);
      const solicitados = String(campaign.cantidadSolicitados || 0).padStart(5);

      console.log(`│ ${id} │ ${cliente} │ ${numero} │ ${marca}${marca2} │ ${zona} │ ${asignados} │ ${solicitados} │`);
    });

    console.log('└────────────────────────────────────────────────────────────────────────────┘');

    console.log('\n💡 COMANDOS PARA RESETEAR:\n');

    campaignsData.slice(0, 5).forEach(campaign => {
      console.log(`   # ${campaign.clienteComercial} #${campaign.numeroCampana} (${campaign.leadsAsignados} leads):`);
      console.log(`   npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=${campaign.id}`);
      console.log(`   npx tsx server/reset-campaign-leads.ts --campaign-id=${campaign.id}\n`);
    });

    // Mostrar totales
    const totalLeads = campaignsData.reduce((sum, c) => sum + c.leadsAsignados, 0);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 TOTALES: ${campaignsData.length} campañas | ${totalLeads} leads asignados`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

listCampaignsWithAssignedLeads();
