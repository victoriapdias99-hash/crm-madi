// Verificar datos diarios de campaña Red Finance #1
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/crm_dashboard'
});

async function verifyDailyData() {
  console.log('📊 ========================================');
  console.log('📊 VERIFICACIÓN: Datos Diarios Red Finance #1');
  console.log('📊 ========================================\n');

  try {
    // Obtener datos de la campaña
    const result = await pool.query(`
      SELECT
        cc.id,
        cc.numero_campana,
        c.nombre_comercial as cliente,
        cc.marca,
        cc.zona,
        cc.cantidad_datos_solicitados,
        cc.fecha_campana,
        cc.fecha_fin,
        -- Datos diarios
        cc.dia_1, cc.dia_2, cc.dia_3, cc.dia_4, cc.dia_5,
        cc.dia_6, cc.dia_7, cc.dia_8, cc.dia_9, cc.dia_10,
        cc.dia_11, cc.dia_12, cc.dia_13, cc.dia_14, cc.dia_15,
        cc.dia_16, cc.dia_17, cc.dia_18, cc.dia_19, cc.dia_20,
        cc.dia_21, cc.dia_22, cc.dia_23, cc.dia_24, cc.dia_25,
        cc.dia_26, cc.dia_27, cc.dia_28, cc.dia_29, cc.dia_30, cc.dia_31
      FROM campanas_comerciales cc
      LEFT JOIN clientes c ON cc.cliente_id = c.id
      WHERE cc.id = 65
    `);

    if (result.rows.length === 0) {
      console.error('❌ Campaña no encontrada');
      return;
    }

    const campaign = result.rows[0];

    console.log('✅ INFORMACIÓN DE CAMPAÑA:');
    console.log('═══════════════════════════════════════════════');
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Cliente: ${campaign.cliente}`);
    console.log(`   Marca: ${campaign.marca}`);
    console.log(`   Zona: ${campaign.zona}`);
    console.log(`   Solicitados: ${campaign.cantidad_datos_solicitados}`);
    console.log(`   Fecha inicio: ${campaign.fecha_campana}`);
    console.log(`   Fecha fin: ${campaign.fecha_fin || 'En proceso'}`);
    console.log('═══════════════════════════════════════════════\n');

    // Procesar datos diarios
    console.log('📅 DATOS DIARIOS DETALLADOS:');
    console.log('═══════════════════════════════════════════════');
    console.log('   Día │ Leads │ Acumulado');
    console.log('   ────┼───────┼──────────');

    let totalLeads = 0;
    const diasConDatos = [];

    for (let i = 1; i <= 31; i++) {
      const diaKey = `dia_${i}`;
      const leadCount = campaign[diaKey] || 0;

      if (leadCount > 0) {
        totalLeads += leadCount;
        diasConDatos.push({ dia: i, leads: leadCount, acumulado: totalLeads });

        console.log(`   ${String(i).padStart(3)} │ ${String(leadCount).padStart(5)} │ ${String(totalLeads).padStart(9)}`);
      }
    }

    console.log('   ────┼───────┼──────────');
    console.log(`   TOT │ ${String(totalLeads).padStart(5)} │           `);
    console.log('═══════════════════════════════════════════════\n');

    // Análisis
    console.log('📊 ANÁLISIS:');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Días con datos: ${diasConDatos.length}`);
    console.log(`   Total en datos diarios: ${totalLeads}`);
    console.log(`   Meta de la campaña: ${campaign.cantidad_datos_solicitados}`);

    const diferencia = totalLeads - campaign.cantidad_datos_solicitados;
    const porcentaje = ((totalLeads / campaign.cantidad_datos_solicitados) * 100).toFixed(1);

    console.log(`   Diferencia: ${diferencia >= 0 ? '+' : ''}${diferencia}`);
    console.log(`   Cumplimiento datos diarios: ${porcentaje}%`);

    if (diferencia > 0) {
      console.log(`   ✅ Datos diarios SUPERAN la meta por ${diferencia} leads`);
    } else if (diferencia === 0) {
      console.log(`   ✅ Datos diarios CUMPLEN exactamente la meta`);
    } else {
      console.log(`   ⚠️ Datos diarios NO alcanzan la meta (faltan ${Math.abs(diferencia)})`);
    }
    console.log('═══════════════════════════════════════════════\n');

    // Verificar leads realmente asignados
    console.log('🔍 VERIFICACIÓN EN BASE DE DATOS:');
    console.log('═══════════════════════════════════════════════');

    const assignedQuery = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM op_lead
      WHERE campaign_id = 65
    `);

    const assignedCount = assignedQuery.rows[0]?.count || 0;
    console.log(`   Leads asignados (op_lead): ${assignedCount}`);

    const diffAssigned = assignedCount - totalLeads;
    console.log(`   Diferencia con datos diarios: ${diffAssigned >= 0 ? '+' : ''}${diffAssigned}`);

    if (diffAssigned < 0) {
      console.log(`   ⚠️ Se asignaron MENOS leads que los indicados en datos diarios`);
      console.log(`   Posibles causas:`);
      console.log(`     - Leads duplicados filtrados en op_leads_rep`);
      console.log(`     - Leads con zona/marca incorrecta`);
      console.log(`     - Leads ya asignados a otras campañas`);
    } else if (diffAssigned > 0) {
      console.log(`   ⚠️ Se asignaron MÁS leads que los indicados en datos diarios`);
      console.log(`   Esto es inusual y requiere investigación`);
    } else {
      console.log(`   ✅ Coincidencia exacta entre datos diarios y asignados`);
    }

    console.log('═══════════════════════════════════════════════\n');

    // Resumen final
    console.log('📋 RESUMEN FINAL:');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Meta solicitada:        ${String(campaign.cantidad_datos_solicitados).padStart(6)}`);
    console.log(`   Datos diarios (total):  ${String(totalLeads).padStart(6)} (${porcentaje}%)`);
    console.log(`   Leads asignados (real): ${String(assignedCount).padStart(6)} (${((assignedCount/campaign.cantidad_datos_solicitados)*100).toFixed(1)}%)`);
    console.log('═══════════════════════════════════════════════\n');

    // Conclusión
    if (totalLeads >= campaign.cantidad_datos_solicitados && assignedCount < campaign.cantidad_datos_solicitados) {
      console.log('⚠️ PROBLEMA DETECTADO:');
      console.log('   Los datos diarios indican que hay suficientes leads,');
      console.log('   pero NO todos pudieron ser asignados a la campaña.');
      console.log('\n   Investigar:');
      console.log('   1. Leads duplicados (verificar op_leads_rep)');
      console.log('   2. Filtros de zona/marca en asignación');
      console.log('   3. Leads ya consumidos por otras campañas');
    } else if (totalLeads < campaign.cantidad_datos_solicitados) {
      console.log('ℹ️ CONCLUSIÓN:');
      console.log('   Los datos diarios NO alcanzan la meta.');
      console.log('   Esto indica que no llegaron suficientes leads');
      console.log('   desde las fuentes (webhooks/sincronización).');
    } else {
      console.log('✅ CONCLUSIÓN:');
      console.log('   Los datos son consistentes.');
      console.log('   La meta fue alcanzada según datos diarios.');
    }

    console.log('\n📊 ========================================');
    console.log('📊 VERIFICACIÓN COMPLETADA');
    console.log('📊 ========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

verifyDailyData();
