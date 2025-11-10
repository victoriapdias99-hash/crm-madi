import { db } from './server/db';
import { opLead } from './shared/schema';
import { eq } from 'drizzle-orm';

async function debugQuery() {
  const campaignId = 84;

  console.log('🔍 QUERY EXACTO PARA CAMPAÑA 84:');
  console.log('================================\n');

  // Query directo con logging
  console.log('📋 SQL Query:');
  console.log(`SELECT * FROM op_lead WHERE campaign_id = ${campaignId} ORDER BY fecha_creacion;\n`);

  try {
    // Ejecutar con Drizzle
    const results = await db
      .select()
      .from(opLead)
      .where(eq(opLead.campaignId, campaignId))
      .orderBy(opLead.fechaCreacion);

    console.log(`✅ Resultados: ${results.length} leads encontrados\n`);

    if (results.length > 0) {
      console.log('📊 Primeros 5 leads:');
      results.slice(0, 5).forEach((lead, idx) => {
        console.log(`\n${idx + 1}. Lead ID: ${lead.id}`);
        console.log(`   Nombre: ${lead.nombre}`);
        console.log(`   Campaign ID: ${lead.campaignId}`);
        console.log(`   Fecha Creación: ${lead.fechaCreacion}`);
        console.log(`   Updated At: ${lead.updatedAt}`);
      });
    } else {
      console.log('⚠️ NO SE ENCONTRARON LEADS CON campaign_id = 84');
      console.log('\n🔍 Verificando si existen leads con campaign_id = 84 en la BD...\n');

      // Query raw para verificar
      const rawResults = await db.execute(
        `SELECT id, nombre, campaign_id, fecha_creacion, updated_at
         FROM op_lead
         WHERE campaign_id = 84
         LIMIT 10`
      );

      console.log('Raw query results:', rawResults);
    }

    // Verificar cuántos leads tienen la campaña 84 asignada (sin importar NULL)
    console.log('\n🔍 Verificando todos los valores de campaign_id = 84 (incluyendo verificación):');
    const allWithCampaign84 = await db.execute(
      `SELECT COUNT(*) as total FROM op_lead WHERE campaign_id = 84`
    );
    console.log('Total en BD:', allWithCampaign84);

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

debugQuery();
