import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function cleanDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  console.log('🗑️  LIMPIANDO BASE DE DATOS OP_LEAD\n');
  console.log('='.repeat(70));

  // Contar registros antes
  const beforeCount = await client.query('SELECT COUNT(*) as total FROM op_lead');
  console.log(`\n📊 Registros antes: ${beforeCount.rows[0].total}`);

  // Eliminar todos los registros
  await client.query('DELETE FROM op_lead');
  console.log('✅ Todos los registros eliminados');

  // Verificar que esté vacía
  const afterCount = await client.query('SELECT COUNT(*) as total FROM op_lead');
  console.log(`📊 Registros después: ${afterCount.rows[0].total}`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Base de datos limpia y lista para migración\n');

  await client.end();
}

cleanDatabase().catch(console.error);
