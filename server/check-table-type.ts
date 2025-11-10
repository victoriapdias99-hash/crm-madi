import { db } from './db';
import { sql } from 'drizzle-orm';

async function checkTableType() {
  console.log('🔍 Verificando tipo de op_leads_rep\n');

  try {
    // Verificar si es una tabla o vista
    const result = await db.execute(sql`
      SELECT table_type
      FROM information_schema.tables
      WHERE table_name = 'op_leads_rep'
    `);

    console.log('Resultado:', result);

    if (result.rows && result.rows.length > 0) {
      const tableType = (result.rows[0] as any).table_type;
      console.log(`\nop_leads_rep es: ${tableType}`);

      if (tableType === 'VIEW') {
        console.log('\n⚠️  Es una VISTA - No se puede actualizar directamente');
        console.log('Solo necesitamos actualizar op_lead');
      } else {
        console.log('\n✅ Es una TABLA - Se puede actualizar');
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

checkTableType();
