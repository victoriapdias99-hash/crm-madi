/**
 * VERIFICACIÓN DE DISCREPANCIA DE CONTEO
 *
 * Este script investiga la discrepancia entre:
 * - Dashboard: muestra 212 enviados
 * - Sistema de cierre: cuenta 82 asignados
 */

import { db } from './server/db';
import { campanasComerciales, opLead, opLeadsRep, clientes } from './shared/schema';
import { eq, and, isNull, sql, ilike, asc, inArray } from 'drizzle-orm';

async function investigateCountingDiscrepancy() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  INVESTIGACIÓN: Discrepancia de Conteo Red Finance #1   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const campaignId = 65;

  // ═══════════════════════════════════════════════════════════
  // CONTEO 1: Sistema de Cierre (op_lead WHERE campaign_id = 65)
  // ═══════════════════════════════════════════════════════════
  console.log('📊 CONTEO 1: Leads asignados según sistema de cierre\n');

  const assignedInOpLead = await db
    .select()
    .from(opLead)
    .where(eq(opLead.campaignId, campaignId));

  console.log(`✅ Registros en op_lead con campaign_id = ${campaignId}: ${assignedInOpLead.length}`);

  if (assignedInOpLead.length > 0) {
    console.log(`   Primer registro: ${assignedInOpLead[0].fechaCreacion} - ${assignedInOpLead[0].nombre}`);
    console.log(`   Último registro: ${assignedInOpLead[assignedInOpLead.length - 1].fechaCreacion} - ${assignedInOpLead[assignedInOpLead.length - 1].nombre}`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // CONTEO 2: Dashboard (op_lead WHERE cliente/marca/zona match)
  // ═══════════════════════════════════════════════════════════
  console.log('📊 CONTEO 2: Leads según criterios del dashboard\n');

  const normalizedClient = 'red finance';
  const normalizedBrand = 'peugeot';
  const normalizedZone = 'Mendoza';

  // Contar TODOS los leads que coinciden con cliente/marca/zona (sin filtrar por campaign_id)
  const allMatchingLeads = await db
    .select()
    .from(opLead)
    .where(
      and(
        ilike(opLead.cliente, `%${normalizedClient}%`),
        ilike(opLead.campaign, `%${normalizedBrand}%`),
        ilike(opLead.localizacion, `%${normalizedZone}%`)
      )
    );

  console.log(`✅ Total de leads con cliente/marca/zona: ${allMatchingLeads.length}`);
  console.log('');

  // Analizar asignación
  const withCampaignId = allMatchingLeads.filter(l => l.campaignId !== null);
  const withoutCampaignId = allMatchingLeads.filter(l => l.campaignId === null);

  console.log('   Distribución:');
  console.log(`   - Con campaign_id asignado: ${withCampaignId.length}`);
  console.log(`   - Sin campaign_id (disponibles): ${withoutCampaignId.length}`);
  console.log('');

  // Agrupar por campaign_id
  const byCampaign = new Map<number | null, number>();
  allMatchingLeads.forEach(lead => {
    const count = byCampaign.get(lead.campaignId) || 0;
    byCampaign.set(lead.campaignId, count + 1);
  });

  console.log('   Por campaña:');
  Array.from(byCampaign.entries())
    .sort((a, b) => (b[1] - a[1]))
    .forEach(([campId, count]) => {
      if (campId === null) {
        console.log(`   - Sin asignar: ${count} leads`);
      } else {
        console.log(`   - Campaña ${campId}: ${count} leads ${campId === campaignId ? '← ESTA' : ''}`);
      }
    });
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // CONTEO 3: Verificar duplicados en op_leads_rep
  // ═══════════════════════════════════════════════════════════
  console.log('📊 CONTEO 3: Leads únicos en op_leads_rep\n');

  const uniqueLeadsAll = await db
    .select()
    .from(opLeadsRep)
    .where(
      and(
        ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
        ilike(opLeadsRep.marca, `%${normalizedBrand}%`),
        ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
      )
    );

  console.log(`✅ Leads ÚNICOS en op_leads_rep: ${uniqueLeadsAll.length}`);

  const uniqueAssigned = uniqueLeadsAll.filter(l => l.campaignId !== null);
  const uniqueAvailable = uniqueLeadsAll.filter(l => l.campaignId === null);

  console.log(`   - Asignados: ${uniqueAssigned.length}`);
  console.log(`   - Disponibles: ${uniqueAvailable.length}`);
  console.log('');

  // Calcular total de duplicados
  let totalDuplicatesFromUnique = 0;
  let duplicatesAssignedToCampaign65 = 0;

  for (const uniqueLead of uniqueLeadsAll) {
    const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
    totalDuplicatesFromUnique += duplicateIds.length;

    if (uniqueLead.campaignId === campaignId) {
      duplicatesAssignedToCampaign65 += duplicateIds.length;
    }
  }

  console.log(`📦 Total de DUPLICADOS calculados desde únicos: ${totalDuplicatesFromUnique}`);
  console.log(`   - Asignados a campaña 65: ${duplicatesAssignedToCampaign65}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // ANÁLISIS DE DISCREPANCIA
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 ANÁLISIS DE DISCREPANCIA\n');

  const dashboardValue = 212; // Del JSON que obtuvimos
  const systemValue = assignedInOpLead.length;
  const discrepancy = dashboardValue - systemValue;

  console.log(`Dashboard muestra: ${dashboardValue} enviados`);
  console.log(`Sistema cuenta: ${systemValue} asignados`);
  console.log(`Discrepancia: ${discrepancy} leads\n`);

  // Hipótesis
  console.log('💡 HIPÓTESIS:\n');

  console.log('Hipótesis 1: Dashboard cuenta TODOS los leads del cliente/marca/zona');
  console.log(`  - Leads totales en op_lead: ${allMatchingLeads.length}`);
  console.log(`  - ¿Coincide con dashboard? ${allMatchingLeads.length === dashboardValue ? '✅ SÍ' : '❌ NO'}`);
  console.log('');

  console.log('Hipótesis 2: Dashboard usa duplicados de op_leads_rep');
  console.log(`  - Total duplicados calculados: ${totalDuplicatesFromUnique}`);
  console.log(`  - ¿Coincide con dashboard? ${totalDuplicatesFromUnique === dashboardValue ? '✅ SÍ' : '❌ NO'}`);
  console.log('');

  console.log('Hipótesis 3: Dashboard cuenta asignados + disponibles');
  const totalOpLead = withCampaignId.length + withoutCampaignId.length;
  console.log(`  - Asignados + disponibles: ${totalOpLead}`);
  console.log(`  - ¿Coincide con dashboard? ${totalOpLead === dashboardValue ? '✅ SÍ' : '❌ NO'}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // VERIFICAR QUERY DEL DASHBOARD
  // ═══════════════════════════════════════════════════════════
  console.log('📋 SIMULACIÓN: Query del dashboard de datos diarios\n');

  // El dashboard probablemente ejecuta algo como esto
  const dashboardQuery = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ol.id) as total_leads,
      cc.id as campaign_id,
      cc.numero_campana,
      cc.cantidad_datos_solicitados
    FROM op_lead ol
    JOIN campanas_comerciales cc ON ol.cliente ILIKE '%red finance%'
    WHERE cc.id = 65
      AND ol.campaign ILIKE '%peugeot%'
      AND ol.localizacion ILIKE '%Mendoza%'
    GROUP BY cc.id, cc.numero_campana, cc.cantidad_datos_solicitados
  `);

  console.log('Query del dashboard:');
  console.log(dashboardQuery);
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // RESUMEN Y CONCLUSIÓN
  // ═══════════════════════════════════════════════════════════
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                      RESUMEN FINAL                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('📊 Conteos encontrados:\n');
  console.log(`1. Sistema de cierre (op_lead WHERE campaign_id = 65):`);
  console.log(`   ${systemValue} leads asignados\n`);

  console.log(`2. Dashboard (valor mostrado):`);
  console.log(`   ${dashboardValue} enviados\n`);

  console.log(`3. Todos los leads matching cliente/marca/zona:`);
  console.log(`   ${allMatchingLeads.length} leads totales`);
  console.log(`   - ${withCampaignId.length} asignados a campañas`);
  console.log(`   - ${withoutCampaignId.length} sin asignar\n`);

  console.log(`4. Leads únicos en op_leads_rep:`);
  console.log(`   ${uniqueLeadsAll.length} leads únicos`);
  console.log(`   → ${totalDuplicatesFromUnique} duplicados totales`);
  console.log(`   → ${duplicatesAssignedToCampaign65} duplicados asignados a campaña 65\n`);

  console.log('🎯 CONCLUSIÓN:\n');

  if (totalDuplicatesFromUnique === dashboardValue) {
    console.log('✅ El dashboard está contando DUPLICADOS TOTALES de leads únicos');
    console.log('   (incluye asignados y no asignados)');
  } else if (allMatchingLeads.length === dashboardValue) {
    console.log('✅ El dashboard está contando TODOS los leads con matching de cliente/marca/zona');
    console.log('   (incluye leads de todas las campañas)');
  } else if (systemValue === dashboardValue) {
    console.log('✅ Dashboard y sistema están sincronizados');
  } else {
    console.log('⚠️  El dashboard usa una lógica de conteo diferente');
    console.log(`   Posible diferencia: ${Math.abs(dashboardValue - systemValue)} leads`);
  }

  console.log('');
  console.log('💡 RECOMENDACIÓN:\n');
  console.log('   Verificar la query exacta que usa el dashboard en:');
  console.log('   → server/routes.ts (endpoint /api/dashboard/campanas-pendientes)');
  console.log('   → Comparar con la lógica de countAssignedLeadsForCampaign()');
  console.log('');

  await db.$client.end();
}

investigateCountingDiscrepancy()
  .then(() => {
    console.log('✅ Investigación completada\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
