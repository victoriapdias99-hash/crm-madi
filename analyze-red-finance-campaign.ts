/**
 * ANÁLISIS DETALLADO: Red Finance Campaña #1
 *
 * Este script analiza el estado actual de la campaña antes de cerrarla
 * y verifica que el conteo de leads sea consistente con las condiciones esperadas.
 */

import { db } from './server/db';
import { campanasComerciales, opLead, opLeadsRep } from './shared/schema';
import { eq, and, isNull, sql, ilike, asc } from 'drizzle-orm';

async function analyzeRedFinanceCampaign() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ANÁLISIS: Red Finance Campaña #1 (Mendoza)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ═══════════════════════════════════════════════════════════
  // PASO 1: OBTENER DATOS DE LA CAMPAÑA
  // ═══════════════════════════════════════════════════════════
  console.log('📋 PASO 1: Obteniendo datos de la campaña comercial...\n');

  const campaign = await db
    .select()
    .from(campanasComerciales)
    .where(eq(campanasComerciales.id, 65))
    .limit(1);

  if (campaign.length === 0) {
    console.error('❌ Campaña no encontrada!');
    process.exit(1);
  }

  const campaignData = campaign[0];

  console.log('✅ Campaña encontrada:');
  console.log(`   ID: ${campaignData.id}`);
  console.log(`   Cliente ID: ${campaignData.clienteId}`);
  console.log(`   Número: ${campaignData.numeroCampana}`);
  console.log(`   Marca: ${campaignData.marca}`);
  console.log(`   Zona: ${campaignData.zona}`);
  console.log(`   Meta (cantidad solicitada): ${campaignData.cantidadDatosSolicitados}`);
  console.log(`   Fecha inicio: ${campaignData.fechaCampana}`);
  console.log(`   Fecha fin: ${campaignData.fechaFin || 'null (EN PROCESO)'}`);
  console.log(`   Pedidos por día: ${campaignData.pedidosPorDia}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // PASO 2: CONTAR LEADS YA ASIGNADOS
  // ═══════════════════════════════════════════════════════════
  console.log('📊 PASO 2: Contando leads YA ASIGNADOS a esta campaña...\n');

  const assignedCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(eq(opLead.campaignId, 65));

  const currentAssigned = assignedCount[0]?.count || 0;

  console.log(`✅ Leads asignados actualmente: ${currentAssigned}`);
  console.log(`   Meta de la campaña: ${campaignData.cantidadDatosSolicitados}`);
  console.log(`   Progreso: ${((currentAssigned / campaignData.cantidadDatosSolicitados!) * 100).toFixed(2)}%`);
  console.log(`   Faltantes para meta: ${Math.max(0, campaignData.cantidadDatosSolicitados! - currentAssigned)}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // PASO 3: ANALIZAR LEADS DISPONIBLES (NO ASIGNADOS)
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 PASO 3: Analizando leads DISPONIBLES (no asignados)...\n');

  // Normalizar nombres según la lógica del sistema
  const normalizedClient = 'red finance';
  const normalizedBrand = 'peugeot';
  const normalizedZone = 'Mendoza';

  console.log(`   Filtros de búsqueda:`);
  console.log(`   - Cliente: "${normalizedClient}"`);
  console.log(`   - Marca: "${normalizedBrand}"`);
  console.log(`   - Zona: "${normalizedZone}"`);
  console.log('');

  // Contar leads únicos disponibles en op_leads_rep
  const uniqueLeadsAvailable = await db
    .select()
    .from(opLeadsRep)
    .where(
      and(
        isNull(opLeadsRep.campaignId),
        ilike(opLeadsRep.marca, `%${normalizedBrand}%`),
        ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
        ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
      )
    )
    .orderBy(asc(opLeadsRep.fechaCreacion));

  console.log(`✅ Leads ÚNICOS disponibles en op_leads_rep: ${uniqueLeadsAvailable.length}`);

  if (uniqueLeadsAvailable.length > 0) {
    console.log(`   Primer lead: ${uniqueLeadsAvailable[0].fechaCreacion} - ${uniqueLeadsAvailable[0].nombre}`);
    console.log(`   Último lead: ${uniqueLeadsAvailable[uniqueLeadsAvailable.length - 1].fechaCreacion} - ${uniqueLeadsAvailable[uniqueLeadsAvailable.length - 1].nombre}`);
  }
  console.log('');

  // Calcular total de duplicados de esos leads únicos
  let totalDuplicates = 0;
  for (const uniqueLead of uniqueLeadsAvailable) {
    const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
    totalDuplicates += duplicateIds.length;
  }

  console.log(`📦 Total de DUPLICADOS que se asignarían: ${totalDuplicates}`);
  console.log(`   (de ${uniqueLeadsAvailable.length} leads únicos)`);
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // PASO 4: VERIFICAR CONDICIONES DE CONTEO
  // ═══════════════════════════════════════════════════════════
  console.log('✅ PASO 4: Verificando condiciones de conteo...\n');

  const leadsNeeded = Math.max(0, campaignData.cantidadDatosSolicitados! - currentAssigned);
  const leadsToAssign = Math.min(uniqueLeadsAvailable.length, leadsNeeded);

  console.log(`📊 CONDICIONES PARA CIERRE:`);
  console.log(`   1. Leads actualmente asignados: ${currentAssigned}`);
  console.log(`   2. Leads necesarios para meta: ${leadsNeeded}`);
  console.log(`   3. Leads únicos disponibles: ${uniqueLeadsAvailable.length}`);
  console.log(`   4. Leads que SE ASIGNARÍAN: ${leadsToAssign}`);
  console.log('');

  // Calcular duplicados que se asignarían
  let duplicatesToAssign = 0;
  const selectedUniqueLeads = uniqueLeadsAvailable.slice(0, leadsToAssign);
  for (const uniqueLead of selectedUniqueLeads) {
    const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
    duplicatesToAssign += duplicateIds.length;
  }

  console.log(`📦 DUPLICADOS que se asignarían: ${duplicatesToAssign}`);
  console.log(`   (de ${leadsToAssign} leads únicos seleccionados)`);
  console.log('');

  const totalAfterAssignment = currentAssigned + duplicatesToAssign;

  console.log(`🎯 RESULTADO ESPERADO DESPUÉS DE CIERRE:`);
  console.log(`   Leads asignados actuales: ${currentAssigned}`);
  console.log(`   + Duplicados a asignar: ${duplicatesToAssign}`);
  console.log(`   = TOTAL después del cierre: ${totalAfterAssignment}`);
  console.log(`   Meta de la campaña: ${campaignData.cantidadDatosSolicitados}`);
  console.log('');

  const wouldReachGoal = totalAfterAssignment >= campaignData.cantidadDatosSolicitados!;
  const percentage = ((totalAfterAssignment / campaignData.cantidadDatosSolicitados!) * 100).toFixed(2);

  if (wouldReachGoal) {
    console.log(`✅ ¡ALCANZARÍA LA META! (${percentage}%)`);
    console.log(`   La campaña se CERRARÍA automáticamente`);
  } else {
    console.log(`⚠️  NO alcanzaría la meta (${percentage}%)`);
    console.log(`   Faltarían: ${campaignData.cantidadDatosSolicitados! - totalAfterAssignment} leads`);
    console.log(`   La campaña NO se cerraría automáticamente`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // PASO 5: ANÁLISIS DE DISCREPANCIAS
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 PASO 5: Análisis de posibles discrepancias...\n');

  // Verificar si hay leads en op_lead que no están en op_leads_rep
  const allLeadsInOpLead = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(
      and(
        isNull(opLead.campaignId),
        ilike(opLead.campaign, `%${normalizedBrand}%`),
        ilike(opLead.cliente, `%${normalizedClient}%`),
        ilike(opLead.localizacion, `%${normalizedZone}%`)
      )
    );

  const totalInOpLead = allLeadsInOpLead[0]?.count || 0;

  console.log(`📊 Comparación de tablas:`);
  console.log(`   Leads únicos en op_leads_rep: ${uniqueLeadsAvailable.length}`);
  console.log(`   Total duplicados calculados: ${totalDuplicates}`);
  console.log(`   Leads en op_lead (no asignados): ${totalInOpLead}`);

  if (totalDuplicates === totalInOpLead) {
    console.log(`   ✅ CONSISTENCIA PERFECTA: Los conteos coinciden`);
  } else {
    const diff = Math.abs(totalDuplicates - totalInOpLead);
    console.log(`   ⚠️  DISCREPANCIA detectada: ${diff} leads de diferencia`);
    console.log(`   Esto puede indicar leads duplicados que fueron marcados incorrectamente`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // PASO 6: SIMULACIÓN DEL CIERRE
  // ═══════════════════════════════════════════════════════════
  console.log('🧪 PASO 6: SIMULACIÓN del proceso de cierre...\n');

  console.log(`📝 PASOS que ejecutaría el sistema:`);
  console.log(`   1. Obtener ${leadsToAssign} leads únicos de op_leads_rep`);
  console.log(`   2. Extraer todos los duplicate_ids (${duplicatesToAssign} total)`);
  console.log(`   3. Actualizar op_lead: SET campaign_id = 65 para esos ${duplicatesToAssign} duplicados`);
  console.log(`   4. Verificar conteo: esperados ${duplicatesToAssign}, asignados ${duplicatesToAssign}`);

  if (wouldReachGoal) {
    console.log(`   5. ✅ META ALCANZADA: Actualizar campanas_comerciales SET fecha_fin = [fecha último lead]`);
  } else {
    console.log(`   5. ⚠️  META NO ALCANZADA: NO cerrar la campaña`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RESUMEN FINAL');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Estado actual de la campaña:`);
  console.log(`   Meta: ${campaignData.cantidadDatosSolicitados} leads`);
  console.log(`   Asignados actualmente: ${currentAssigned} leads`);
  console.log(`   Progreso actual: ${((currentAssigned / campaignData.cantidadDatosSolicitados!) * 100).toFixed(2)}%`);
  console.log('');

  console.log(`Disponibilidad:`);
  console.log(`   Leads únicos disponibles: ${uniqueLeadsAvailable.length}`);
  console.log(`   Duplicados disponibles: ${totalDuplicates}`);
  console.log('');

  console.log(`Resultado esperado al ejecutar cierre:`);
  console.log(`   Leads únicos a procesar: ${leadsToAssign}`);
  console.log(`   Duplicados a asignar: ${duplicatesToAssign}`);
  console.log(`   Total después del cierre: ${totalAfterAssignment} leads`);
  console.log(`   Progreso después del cierre: ${percentage}%`);
  console.log(`   ¿Se cerraría la campaña?: ${wouldReachGoal ? '✅ SÍ' : '❌ NO'}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════\n');

  await db.$client.end();

  return {
    campaignId: 65,
    currentAssigned,
    meta: campaignData.cantidadDatosSolicitados,
    uniqueLeadsAvailable: uniqueLeadsAvailable.length,
    duplicatesAvailable: totalDuplicates,
    uniqueLeadsToAssign: leadsToAssign,
    duplicatesToAssign,
    totalAfterAssignment,
    wouldReachGoal,
    percentage: parseFloat(percentage)
  };
}

// Ejecutar análisis
analyzeRedFinanceCampaign()
  .then((result) => {
    console.log('✅ Análisis completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en análisis:', error);
    process.exit(1);
  });
