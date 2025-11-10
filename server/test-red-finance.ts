import { db } from './db';
import { campanasComerciales, clientes, opLead, opLeadsRep } from '../shared/schema';
import { eq, and, sql, isNull, ilike } from 'drizzle-orm';

/**
 * Test completo de Red Finance #1
 * Analiza campaña, verifica conteo de leads y simula cierre
 */

async function testRedFinanceCampaign() {
  console.log('🧪 ========================================');
  console.log('🧪 TEST: Red Finance Campaña #1');
  console.log('🧪 ========================================\n');

  try {
    // ================================================
    // PASO 1: ANALIZAR CAMPAÑA
    // ================================================
    console.log('📋 PASO 1: ANALIZANDO CAMPAÑA...\n');

    const campaigns = await db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        cliente: clientes.nombreComercial,
        marca: campanasComerciales.marca,
        marca2: campanasComerciales.marca2,
        marca3: campanasComerciales.marca3,
        marca4: campanasComerciales.marca4,
        marca5: campanasComerciales.marca5,
        porcentaje: campanasComerciales.porcentaje,
        porcentaje2: campanasComerciales.porcentaje2,
        porcentaje3: campanasComerciales.porcentaje3,
        porcentaje4: campanasComerciales.porcentaje4,
        porcentaje5: campanasComerciales.porcentaje5,
        cantidadSolicitados: campanasComerciales.cantidadDatosSolicitados,
        zona: campanasComerciales.zona,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
        asignacionAutomatica: campanasComerciales.asignacionAutomatica,
        // Datos diarios
        dia1: campanasComerciales.dia1, dia2: campanasComerciales.dia2, dia3: campanasComerciales.dia3,
        dia4: campanasComerciales.dia4, dia5: campanasComerciales.dia5, dia6: campanasComerciales.dia6,
        dia7: campanasComerciales.dia7, dia8: campanasComerciales.dia8, dia9: campanasComerciales.dia9,
        dia10: campanasComerciales.dia10, dia11: campanasComerciales.dia11, dia12: campanasComerciales.dia12,
        dia13: campanasComerciales.dia13, dia14: campanasComerciales.dia14, dia15: campanasComerciales.dia15,
        dia16: campanasComerciales.dia16, dia17: campanasComerciales.dia17, dia18: campanasComerciales.dia18,
        dia19: campanasComerciales.dia19, dia20: campanasComerciales.dia20, dia21: campanasComerciales.dia21,
        dia22: campanasComerciales.dia22, dia23: campanasComerciales.dia23, dia24: campanasComerciales.dia24,
        dia25: campanasComerciales.dia25, dia26: campanasComerciales.dia26, dia27: campanasComerciales.dia27,
        dia28: campanasComerciales.dia28, dia29: campanasComerciales.dia29, dia30: campanasComerciales.dia30,
        dia31: campanasComerciales.dia31
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
      .where(
        and(
          eq(campanasComerciales.id, 65)
        )
      )
      .limit(1);

    if (campaigns.length === 0) {
      console.error('❌ Campaña no encontrada');
      return;
    }

    const campaign = campaigns[0];

    console.log('✅ CAMPAÑA ENCONTRADA:');
    console.log('   ID:', campaign.id);
    console.log('   Cliente:', campaign.cliente);
    console.log('   Número:', campaign.numeroCampana);
    console.log('   Marca Principal:', campaign.marca);
    console.log('   Marca 2:', campaign.marca2 || 'N/A');
    console.log('   Marca 3:', campaign.marca3 || 'N/A');
    console.log('   Marca 4:', campaign.marca4 || 'N/A');
    console.log('   Marca 5:', campaign.marca5 || 'N/A');
    console.log('   Porcentajes:', campaign.porcentaje, campaign.porcentaje2, campaign.porcentaje3, campaign.porcentaje4, campaign.porcentaje5);
    console.log('   Zona:', campaign.zona);
    console.log('   Solicitados:', campaign.cantidadSolicitados);
    console.log('   Asignación Automática:', campaign.asignacionAutomatica ? '✅ Sí' : '❌ No');
    console.log('   Fecha inicio:', campaign.fechaCampana);
    console.log('   Fecha fin:', campaign.fechaFin || 'En proceso');

    const isMultiBrand = !!(campaign.marca2 || campaign.marca3 || campaign.marca4 || campaign.marca5);
    console.log('   Tipo:', isMultiBrand ? '🎨 MULTI-MARCA' : '🏷️ Una sola marca');

    // ================================================
    // PASO 2: VERIFICAR CONTEO EN DATOS DIARIOS
    // ================================================
    console.log('\n📊 PASO 2: VERIFICANDO DATOS DIARIOS...\n');

    // Procesar datos diarios desde las columnas dia1-dia31
    const datosDiarios = [];
    let totalLeadsDatosDiarios = 0;

    for (let i = 1; i <= 31; i++) {
      const diaKey = `dia${i}` as keyof typeof campaign;
      const leadCount = campaign[diaKey] as number || 0;
      if (leadCount > 0) {
        datosDiarios.push({ dia: i, leads: leadCount });
        totalLeadsDatosDiarios += leadCount;
      }
    }

    console.log('📅 DATOS DIARIOS REGISTRADOS:', datosDiarios.length, 'días con datos');

    if (datosDiarios.length > 0) {
      console.log('\n   Día | Leads');
      console.log('   ----|------');

      datosDiarios.forEach(row => {
        console.log(`   ${String(row.dia).padStart(2)}  | ${String(row.leads).padStart(5)}`);
      });

      console.log('   ----|------');
      console.log(`   TOT | ${String(totalLeadsDatosDiarios).padStart(5)}`);
    } else {
      console.log('   ⚠️ No hay datos diarios registrados para esta campaña');
    }

    // ================================================
    // PASO 3: VERIFICAR LEADS DISPONIBLES REALES
    // ================================================
    console.log('\n🔍 PASO 3: VERIFICANDO LEADS DISPONIBLES EN OP_LEADS_REP...\n');

    // Normalizar cliente
    const normalizedClient = campaign.cliente?.toLowerCase().replace(/\s+/g, ' ').trim() || '';
    const normalizedZone = campaign.zona === 'NACIONAL' ? 'Pais' : campaign.zona;

    console.log('   Filtros normalizados:');
    console.log('   - Cliente:', normalizedClient);
    console.log('   - Marca:', campaign.marca);
    console.log('   - Zona:', normalizedZone);

    // Contar leads únicos disponibles
    const uniqueLeadsAvailable = await db
      .select({
        count: sql<number>`count(*)::int`,
        duplicateCount: sql<number>`sum(COALESCE(array_length(duplicate_ids, 1), 1))::int`
      })
      .from(opLeadsRep)
      .where(
        and(
          isNull(opLeadsRep.campaignId),
          ilike(opLeadsRep.marca, `%${campaign.marca?.toLowerCase()}%`),
          ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
          ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
        )
      );

    const uniqueCount = uniqueLeadsAvailable[0]?.count || 0;
    const totalDuplicatesCount = uniqueLeadsAvailable[0]?.duplicateCount || 0;

    console.log('\n✅ LEADS DISPONIBLES:');
    console.log('   📦 Leads únicos:', uniqueCount);
    console.log('   📦 Total duplicados a asignar:', totalDuplicatesCount);

    // Verificar leads ya asignados a esta campaña
    const leadsAsignados = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(eq(opLead.campaignId, campaign.id));

    const countAsignados = leadsAsignados[0]?.count || 0;
    console.log('   ✅ Ya asignados a campaña:', countAsignados);

    // ================================================
    // PASO 4: COMPARACIÓN Y ANÁLISIS
    // ================================================
    console.log('\n📊 PASO 4: ANÁLISIS COMPARATIVO...\n');

    console.log('┌─────────────────────────────────────────────┐');
    console.log('│ COMPARACIÓN DE CONTEOS                      │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│ Solicitados (campaña):        ${String(campaign.cantidadSolicitados).padStart(6)}      │`);
    console.log(`│ Datos Diarios (total):        ${String(totalLeadsDatosDiarios).padStart(6)}      │`);
    console.log(`│ Disponibles (únicos):         ${String(uniqueCount).padStart(6)}      │`);
    console.log(`│ Disponibles (duplicados):     ${String(totalDuplicatesCount).padStart(6)}      │`);
    console.log(`│ Ya asignados:                 ${String(countAsignados).padStart(6)}      │`);
    console.log('└─────────────────────────────────────────────┘');

    // Análisis de discrepancias
    console.log('\n🔍 ANÁLISIS DE DISCREPANCIAS:');

    const discrepanciaDatosDiarios = Math.abs(campaign.cantidadSolicitados - totalLeadsDatosDiarios);
    const discrepanciaDisponibles = Math.abs(campaign.cantidadSolicitados - uniqueCount);

    if (discrepanciaDatosDiarios > 0) {
      console.log(`   ⚠️ Datos Diarios vs Solicitados: ${discrepanciaDatosDiarios > 0 ? '+' : ''}${totalLeadsDatosDiarios - campaign.cantidadSolicitados}`);
    } else {
      console.log('   ✅ Datos Diarios coinciden con Solicitados');
    }

    if (discrepanciaDisponibles > 0) {
      console.log(`   ⚠️ Disponibles vs Solicitados: ${uniqueCount - campaign.cantidadSolicitados >= 0 ? '+' : ''}${uniqueCount - campaign.cantidadSolicitados}`);
    } else {
      console.log('   ✅ Leads disponibles coinciden con Solicitados');
    }

    // ================================================
    // PASO 5: SIMULACIÓN DE CIERRE
    // ================================================
    console.log('\n🎯 PASO 5: SIMULACIÓN DE CIERRE (DRY RUN)...\n');

    const canClose = uniqueCount >= campaign.cantidadSolicitados;

    if (canClose) {
      console.log('✅ PUEDE CERRARSE:');
      console.log(`   Se pueden asignar ${Math.min(uniqueCount, campaign.cantidadSolicitados)} leads únicos`);
      console.log(`   Total de registros a actualizar: ~${Math.min(totalDuplicatesCount, campaign.cantidadSolicitados)}`);
      console.log(`   Estado final: ${countAsignados + Math.min(uniqueCount, campaign.cantidadSolicitados)}/${campaign.cantidadSolicitados} leads`);
    } else {
      console.log('❌ NO PUEDE CERRARSE:');
      console.log(`   Faltan ${campaign.cantidadSolicitados - uniqueCount} leads únicos`);
      console.log(`   Disponibles: ${uniqueCount} / Solicitados: ${campaign.cantidadSolicitados}`);
    }

    // ================================================
    // PASO 6: RECOMENDACIONES
    // ================================================
    console.log('\n💡 RECOMENDACIONES:\n');

    if (discrepanciaDatosDiarios > 5) {
      console.log('⚠️ 1. DISCREPANCIA SIGNIFICATIVA en Datos Diarios');
      console.log('   Posibles causas:');
      console.log('   - Sincronización incompleta de webhooks');
      console.log('   - Leads filtrados por validación');
      console.log('   - Recomendación: Verificar logs de sync-smart-fast');
    }

    if (uniqueCount < campaign.cantidadSolicitados && totalLeadsDatosDiarios >= campaign.cantidadSolicitados) {
      console.log('\n⚠️ 2. LEADS DISPONIBLES < SOLICITADOS pero Datos Diarios >= Solicitados');
      console.log('   Posibles causas:');
      console.log('   - Leads ya asignados a otras campañas');
      console.log('   - Leads duplicados no procesados correctamente');
      console.log('   - Leads filtrados por zona/marca');
      console.log('   - Recomendación: Ejecutar verificación de duplicados');
    }

    if (canClose) {
      console.log('\n✅ 3. LISTA PARA CIERRE');
      console.log(`   Comando para cerrar:`);
      if (isMultiBrand) {
        console.log(`   curl -X POST "http://localhost:5000/api/campaign-closure/multi-brand/execute/${campaign.id}" \\`);
        console.log(`        -H "Content-Type: application/json" \\`);
        console.log(`        -d '{"clientName": "${campaign.cliente}"}'`);
      } else {
        console.log(`   curl -X POST "http://localhost:5000/api/campaign-closure/execute" \\`);
        console.log(`        -H "Content-Type: application/json" \\`);
        console.log(`        -d '{"clientName": "${campaign.cliente}", "campaignNumber": "${campaign.numeroCampana}"}'`);
      }
    }

    console.log('\n🧪 ========================================');
    console.log('🧪 TEST COMPLETADO');
    console.log('🧪 ========================================\n');

  } catch (error: any) {
    console.error('❌ ERROR EN TEST:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar test
testRedFinanceCampaign();
