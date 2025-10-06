import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurada');
  process.exit(1);
}

async function createCampaignIdIndex() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Conectando a la base de datos...');
    const client = await pool.connect();

    try {
      console.log('📊 Verificando si el índice ya existe...');

      const checkIndex = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'op_lead'
        AND indexname = 'idx_op_lead_campaign_id'
      `);

      if (checkIndex.rows.length > 0) {
        console.log('✅ El índice idx_op_lead_campaign_id ya existe');
        return;
      }

      console.log('🚀 Creando índice en op_lead.campaign_id...');
      console.log('⏱️  Esto puede tomar algunos minutos dependiendo del tamaño de la tabla...');

      const startTime = Date.now();

      // Crear índice CONCURRENTLY para no bloquear escrituras
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_op_lead_campaign_id
        ON op_lead(campaign_id)
        WHERE campaign_id IS NOT NULL
      `);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Índice creado exitosamente en ${duration}s`);

      // Verificar el índice
      console.log('🔍 Verificando el índice...');
      const verifyIndex = await client.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = 'op_lead'
        AND indexname = 'idx_op_lead_campaign_id'
      `);

      if (verifyIndex.rows.length > 0) {
        console.log('✅ Índice verificado:');
        console.log(verifyIndex.rows[0]);
      }

      // Obtener estadísticas del índice
      console.log('📊 Obteniendo estadísticas...');
      const stats = await client.query(`
        SELECT
          COUNT(*) as total_rows,
          COUNT(campaign_id) as rows_with_campaign_id,
          COUNT(DISTINCT campaign_id) as distinct_campaigns
        FROM op_lead
      `);

      console.log('📊 Estadísticas de la tabla op_lead:');
      console.log(`   Total de filas: ${stats.rows[0].total_rows}`);
      console.log(`   Filas con campaign_id: ${stats.rows[0].rows_with_campaign_id}`);
      console.log(`   Campañas distintas: ${stats.rows[0].distinct_campaigns}`);

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('❌ Error creando índice:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

console.log('🎯 OPTIMIZACIÓN #2: Crear índice en op_lead.campaign_id');
console.log('================================================\n');

createCampaignIdIndex()
  .then(() => {
    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  });
