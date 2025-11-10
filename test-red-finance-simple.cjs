// Test simple sin ESM
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/crm_dashboard'
});

async function testRedFinance() {
  console.log('🧪 ========================================');
  console.log('🧪 TEST: Red Finance Campaña #1');
  console.log('🧪 ========================================\n');

  try {
    // PASO 1: Análisis de campaña
    console.log('📋 PASO 1: ANALIZANDO CAMPAÑA...\n');

    const campaignQuery = await pool.query(`
      SELECT
        cc.id,
        cc.numero_campana,
        c.nombre_comercial as cliente,
        cc.marca,
        cc.marca2,
        cc.marca3,
        cc.marca4,
        cc.marca5,
        cc.porcentaje,
        cc.porcentaje2,
        cc.porcentaje3,
        cc.porcentaje4,
        cc.porcentaje5,
        cc.cantidad_datos_solicitados,
        cc.zona,
        cc.fecha_campana,
        cc.fecha_fin,
        cc.asignacion_automatica,
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

    if (campaignQuery.rows.length === 0) {
      console.error('❌ Campaña no encontrada');
      return;
    }

    const campaign = campaignQuery.rows[0];

    console.log('✅ CAMPAÑA ENCONTRADA:');
    console.log('   ID:', campaign.id);
    console.log('   Cliente:', campaign.cliente);
    console.log('   Número:', campaign.numero_campana);
    console.log('   Marca:', campaign.marca);
    console.log('   Marca 2:', campaign.marca2 || 'N/A');
    console.log('   Marca 3:', campaign.marca3 || 'N/A');
    console.log('   Zona:', campaign.zona);
    console.log('   Solicitados:', campaign.cantidad_datos_solicitados);
    console.log('   Asignación Automática:', campaign.asignacion_automatica ? '✅ Sí' : '❌ No');
    console.log('   Fecha inicio:', campaign.fecha_campana);
    console.log('   Fecha fin:', campaign.fecha_fin || 'En proceso');

    // PASO 2: Datos diarios
    console.log('\n📊 PASO 2: VERIFICANDO DATOS DIARIOS...\n');

    let totalDatosDiarios = 0;
    const diasConDatos = [];

    for (let i = 1; i <= 31; i++) {
      const diaKey = `dia_${i}`;
      const leadCount = campaign[diaKey] || 0;
      if (leadCount > 0) {
        diasConDatos.push({ dia: i, leads: leadCount });
        totalDatosDiarios += leadCount;
      }
    }

    console.log('📅 DATOS DIARIOS:', diasConDatos.length, 'días con datos');
    if (diasConDatos.length > 0) {
      console.log('\n   Día | Leads');
      console.log('   ----|------');
      diasConDatos.forEach(row => {
        console.log(`   ${String(row.dia).padStart(2)}  | ${String(row.leads).padStart(5)}`);
      });
      console.log('   ----|------');
      console.log(`   TOT | ${String(totalDatosDiarios).padStart(5)}`);
    }

    // PASO 3: Leads disponibles
    console.log('\n🔍 PASO 3: VERIFICANDO LEADS DISPONIBLES...\n');

    const normalizedClient = campaign.cliente?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
    const normalizedZone = campaign.zona === 'NACIONAL' ? 'Pais' : (campaign.zona === 'Córdoba' ? 'Cordoba' : campaign.zona);

    console.log('   Filtros:');
    console.log('   - Cliente:', normalizedClient);
    console.log('   - Marca:', campaign.marca);
    console.log('   - Zona:', normalizedZone);

    const uniqueLeadsQuery = await pool.query(`
      SELECT
        COUNT(*)::int as unique_count,
        SUM(COALESCE(array_length(duplicate_ids, 1), 1))::int as total_duplicates
      FROM op_leads_rep
      WHERE campaign_id IS NULL
        AND LOWER(marca) LIKE $1
        AND LOWER(cliente) LIKE $2
        AND LOWER(localizacion) LIKE $3
    `, [`%${campaign.marca.toLowerCase()}%`, `%${normalizedClient}%`, `%${normalizedZone.toLowerCase()}%`]);

    const uniqueCount = uniqueLeadsQuery.rows[0]?.unique_count || 0;
    const totalDuplicates = uniqueLeadsQuery.rows[0]?.total_duplicates || 0;

    console.log('\n✅ LEADS DISPONIBLES:');
    console.log('   📦 Leads únicos:', uniqueCount);
    console.log('   📦 Total duplicados:', totalDuplicates);

    // Leads ya asignados
    const assignedQuery = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM op_lead
      WHERE campaign_id = $1
    `, [campaign.id]);

    const countAsignados = assignedQuery.rows[0]?.count || 0;
    console.log('   ✅ Ya asignados:', countAsignados);

    // PASO 4: Análisis comparativo
    console.log('\n📊 PASO 4: ANÁLISIS COMPARATIVO...\n');

    console.log('┌─────────────────────────────────────────────┐');
    console.log('│ COMPARACIÓN DE CONTEOS                      │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│ Solicitados (campaña):        ${String(campaign.cantidad_datos_solicitados).padStart(6)}      │`);
    console.log(`│ Datos Diarios (total):        ${String(totalDatosDiarios).padStart(6)}      │`);
    console.log(`│ Disponibles (únicos):         ${String(uniqueCount).padStart(6)}      │`);
    console.log(`│ Disponibles (duplicados):     ${String(totalDuplicates).padStart(6)}      │`);
    console.log(`│ Ya asignados:                 ${String(countAsignados).padStart(6)}      │`);
    console.log('└─────────────────────────────────────────────┘');

    // Análisis
    console.log('\n🔍 ANÁLISIS DE DISCREPANCIAS:');

    const diffDatosDiarios = totalDatosDiarios - campaign.cantidad_datos_solicitados;
    const diffDisponibles = uniqueCount - campaign.cantidad_datos_solicitados;

    if (Math.abs(diffDatosDiarios) > 0) {
      console.log(`   ${diffDatosDiarios > 0 ? '⚠️' : '❌'} Datos Diarios vs Solicitados: ${diffDatosDiarios > 0 ? '+' : ''}${diffDatosDiarios}`);
    } else {
      console.log('   ✅ Datos Diarios coinciden con Solicitados');
    }

    if (diffDisponibles >= 0) {
      console.log(`   ✅ Disponibles vs Solicitados: +${diffDisponibles} (suficientes)`);
    } else {
      console.log(`   ❌ Disponibles vs Solicitados: ${diffDisponibles} (INSUFICIENTES)`);
    }

    // PASO 5: Recomendación
    console.log('\n🎯 PASO 5: RECOMENDACIÓN DE CIERRE...\n');

    const canClose = uniqueCount >= campaign.cantidad_datos_solicitados;

    if (canClose) {
      console.log('✅ PUEDE CERRARSE:');
      console.log(`   Se asignarán ${campaign.cantidad_datos_solicitados} leads únicos`);
      console.log(`   Total de registros a actualizar: ~${Math.min(totalDuplicates, campaign.cantidad_datos_solicitados)}`);

      console.log('\n📝 Comando para cerrar:');
      console.log(`   curl -X POST "http://localhost:5000/api/campaign-closure/execute" \\`);
      console.log(`        -H "Content-Type: application/json" \\`);
      console.log(`        -d '{"clientName": "Red Finance", "campaignNumber": "1"}'`);
    } else {
      console.log('❌ NO PUEDE CERRARSE:');
      console.log(`   Faltan ${campaign.cantidad_datos_solicitados - uniqueCount} leads únicos`);
    }

    // Investigar discrepancia si existe
    if (totalDatosDiarios > uniqueCount && totalDatosDiarios >= campaign.cantidad_datos_solicitados) {
      console.log('\n⚠️ INVESTIGACIÓN DE DISCREPANCIA:');
      console.log(`   Datos Diarios indican ${totalDatosDiarios} leads`);
      console.log(`   Pero solo ${uniqueCount} están disponibles en op_leads_rep`);
      console.log('\n   Posibles causas:');
      console.log('   1. Leads ya asignados a otras campañas');
      console.log('   2. Filtrado por zona/marca diferente');
      console.log('   3. Leads duplicados no procesados');
      console.log('   4. Sincronización incompleta');

      // Verificar leads en op_lead total (sin filtrar por campaign_id)
      const totalLeadsQuery = await pool.query(`
        SELECT COUNT(*)::int as count
        FROM op_lead
        WHERE LOWER(marca) LIKE $1
          AND LOWER(cliente) LIKE $2
          AND LOWER(localizacion) LIKE $3
      `, [`%${campaign.marca.toLowerCase()}%`, `%${normalizedClient}%`, `%${normalizedZone.toLowerCase()}%`]);

      const totalLeadsCount = totalLeadsQuery.rows[0]?.count || 0;
      console.log(`\n   📊 Total leads en op_lead (filtrados): ${totalLeadsCount}`);

      const assignedToOthersQuery = await pool.query(`
        SELECT COUNT(*)::int as count
        FROM op_lead
        WHERE LOWER(marca) LIKE $1
          AND LOWER(cliente) LIKE $2
          AND LOWER(localizacion) LIKE $3
          AND campaign_id IS NOT NULL
          AND campaign_id != $4
      `, [`%${campaign.marca.toLowerCase()}%`, `%${normalizedClient}%`, `%${normalizedZone.toLowerCase()}%`, campaign.id]);

      const assignedToOthers = assignedToOthersQuery.rows[0]?.count || 0;
      console.log(`   📊 Asignados a otras campañas: ${assignedToOthers}`);
      console.log(`   📊 Sin asignar: ${totalLeadsCount - countAsignados - assignedToOthers}`);
    }

    console.log('\n🧪 ========================================');
    console.log('🧪 TEST COMPLETADO');
    console.log('🧪 ========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testRedFinance();
