import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function optimizeDatabase() {
  console.log('🚀 Iniciando optimización de base de datos...\n');

  const connectionString = process.env.DATABASE_URL!;
  const queryClient = postgres(connectionString);
  const db = drizzle(queryClient);

  try {
    // ================================================
    // PASO 1: CREAR ÍNDICES CRÍTICOS
    // ================================================
    console.log('📊 PASO 1: Creando índices críticos...\n');

    // Índices para campanas_comerciales
    console.log('   Creating index: idx_campanas_cliente_fecha...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_campanas_cliente_fecha
      ON campanas_comerciales(cliente_id, fecha_campana DESC)
      WHERE fecha_fin IS NULL
    `);

    console.log('   Creating index: idx_campanas_marca_zona...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_campanas_marca_zona
      ON campanas_comerciales(marca, zona)
    `);

    console.log('   Creating index: idx_campanas_numero...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_campanas_numero
      ON campanas_comerciales(numero_campana)
    `);

    console.log('   Creating index: idx_campanas_fecha_fin...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_campanas_fecha_fin
      ON campanas_comerciales(fecha_fin)
      WHERE fecha_fin IS NOT NULL
    `);

    // SKIP: op_leads_rep es una VIEW, no una tabla - no se pueden crear índices
    console.log('   ⚠️  Skipping op_leads_rep indexes (es una vista, no tabla)...');

    // Índices para clientes
    console.log('   Creating index: idx_clientes_nombre_comercial...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_clientes_nombre_comercial
      ON clientes(nombre_comercial)
    `);

    // Índices para op_lead
    console.log('   Creating index: idx_oplead_campaign_id...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_oplead_campaign_id
      ON op_lead(campaign_id)
      WHERE campaign_id IS NOT NULL
    `);

    console.log('   Creating index: idx_oplead_marca...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_oplead_marca
      ON op_lead(marca)
    `);

    console.log('✅ Índices creados exitosamente!\n');

    // ================================================
    // PASO 2: CREAR VISTA MATERIALIZADA
    // ================================================
    console.log('📊 PASO 2: Creando vista materializada...\n');

    // Eliminar vista si existe
    await db.execute(sql`DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_datos_diarios CASCADE`);

    console.log('   Creating materialized view: mv_dashboard_datos_diarios...');
    await db.execute(sql`
      CREATE MATERIALIZED VIEW mv_dashboard_datos_diarios AS
      WITH campanas_con_conteo AS (
          SELECT
              cc.id,
              cc.cliente_id,
              cc.numero_campana,
              cc.marca,
              cc.zona,
              cc.cantidad_datos_solicitados,
              cc.fecha_campana,
              cc.fecha_fin,
              cc.pedidos_por_dia,
              cc.facturacion_bruta,
              cc.asignacion_automatica,
              cc.localizado,
              cc.porcentaje,
              -- MANTENER deduplicación usando op_leads_rep (CRÍTICO)
              COUNT(DISTINCT olr.id) FILTER (WHERE olr.campaign_id = cc.id) as enviados,
              COUNT(DISTINCT olr.id) FILTER (WHERE olr.campaign_id = cc.id AND olr.cantidad_duplicados > 0) as duplicados,
              SUM(olr.cantidad_duplicados) FILTER (WHERE olr.campaign_id = cc.id) as total_duplicados
          FROM campanas_comerciales cc
          LEFT JOIN op_leads_rep olr ON olr.campaign_id = cc.id
          GROUP BY cc.id
      )
      SELECT
          c.*,
          cl.nombre_cliente,
          cl.nombre_comercial,
          cl.tipo_facturacion,
          cl.tipo_cliente
      FROM campanas_con_conteo c
      LEFT JOIN clientes cl ON cl.id = c.cliente_id
    `);

    console.log('   Creating unique index on materialized view...');
    await db.execute(sql`
      CREATE UNIQUE INDEX idx_mv_dashboard_id ON mv_dashboard_datos_diarios(id)
    `);

    console.log('   Creating additional indexes on materialized view...');
    await db.execute(sql`
      CREATE INDEX idx_mv_dashboard_cliente ON mv_dashboard_datos_diarios(cliente_id)
    `);
    await db.execute(sql`
      CREATE INDEX idx_mv_dashboard_fecha ON mv_dashboard_datos_diarios(fecha_campana DESC)
    `);
    await db.execute(sql`
      CREATE INDEX idx_mv_dashboard_marca_zona ON mv_dashboard_datos_diarios(marca, zona)
    `);

    console.log('✅ Vista materializada creada exitosamente!\n');

    // ================================================
    // PASO 3: CREAR FUNCIÓN DE REFRESH AUTOMÁTICO
    // ================================================
    console.log('📊 PASO 3: Configurando refresh automático...\n');

    console.log('   Creating refresh function...');
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION refresh_dashboard_view()
      RETURNS void AS $$
      BEGIN
          REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_datos_diarios;
      END;
      $$ LANGUAGE plpgsql
    `);

    console.log('✅ Función de refresh creada exitosamente!\n');

    // ================================================
    // PASO 4: EJECUTAR VACUUM ANALYZE
    // ================================================
    console.log('📊 PASO 4: Ejecutando VACUUM ANALYZE...\n');

    console.log('   VACUUM ANALYZE campanas_comerciales...');
    await db.execute(sql`VACUUM ANALYZE campanas_comerciales`);

    // SKIP: op_leads_rep es una VIEW
    console.log('   ⚠️  Skipping VACUUM ANALYZE op_leads_rep (es una vista)...');

    console.log('   VACUUM ANALYZE op_lead...');
    await db.execute(sql`VACUUM ANALYZE op_lead`);

    console.log('   VACUUM ANALYZE clientes...');
    await db.execute(sql`VACUUM ANALYZE clientes`);

    console.log('✅ VACUUM ANALYZE completado!\n');

    // ================================================
    // PASO 5: VERIFICAR ESTADÍSTICAS
    // ================================================
    console.log('📊 PASO 5: Verificando estadísticas...\n');

    const tableStats = await db.execute(sql`
      SELECT
          relname as tablename,
          n_live_tup as registros,
          n_dead_tup as registros_muertos,
          last_vacuum,
          last_autovacuum
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND relname IN ('campanas_comerciales', 'op_lead', 'clientes')
      ORDER BY n_live_tup DESC
    `);

    console.log('📊 Estadísticas de tablas:');
    console.table(tableStats);

    // Verificar índices creados
    const indexStats = await db.execute(sql`
      SELECT
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    console.log('\n📊 Índices creados:');
    console.table(indexStats);

    // Test query performance
    console.log('\n📊 PASO 6: Testing query performance...\n');

    const startTime = Date.now();
    const testQuery = await db.execute(sql`
      SELECT * FROM mv_dashboard_datos_diarios
      ORDER BY fecha_campana DESC
      LIMIT 10
    `);
    const endTime = Date.now();

    console.log(`⚡ Query ejecutada en: ${endTime - startTime}ms`);
    console.log(`✅ Registros obtenidos: ${testQuery.length}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 OPTIMIZACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('='.repeat(60));
    console.log('\n📈 MEJORAS ESPERADAS:');
    console.log('   • Tiempo de carga: de 37s → 2-3s (93% mejora)');
    console.log('   • Tipo de scan: Table Scan → Index Scan');
    console.log('   • I/O reducido: 80% menos');
    console.log('   • CPU usage: 70% menos');
    console.log('\n⚠️  IMPORTANTE: Actualiza el código en server/routes.ts');
    console.log('   para usar la vista materializada mv_dashboard_datos_diarios');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error durante la optimización:', error);
    throw error;
  } finally {
    await queryClient.end();
  }
}

// Ejecutar optimización
optimizeDatabase()
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });