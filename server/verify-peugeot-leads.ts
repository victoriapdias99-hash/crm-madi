import { db } from './db';
import { opLead, opLeadsRep } from '../shared/schema';
import { sql, isNull, eq, and } from 'drizzle-orm';

async function verifyPeugeotLeads() {
  console.log('🔍 VERIFICACIÓN: Leads de Peugeot para Red Finance en Mendoza\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Query en op_lead (tabla que mencionas)
    console.log('📊 BÚSQUEDA EN TABLA op_lead:\n');

    const leadsInOpLead = await db
      .select()
      .from(opLead)
      .where(
        and(
          eq(opLead.marca, 'PEUGEOT'),
          eq(opLead.cliente, 'red_finance'),
          eq(opLead.localizacion, 'Mendoza')
        )
      )
      .orderBy(opLead.fechaCreacion);

    console.log(`   ✅ Encontrados: ${leadsInOpLead.length} leads en op_lead`);

    if (leadsInOpLead.length > 0) {
      console.log('\n   Primeros 10 registros:');
      leadsInOpLead.slice(0, 10).forEach((lead, idx) => {
        console.log(`   ${idx + 1}. ID: ${lead.id} | Fecha: ${lead.fechaCreacion} | Campaign ID: ${lead.campaignId || 'NULL'}`);
      });

      // Contar por campaignId
      const byCampaignId = leadsInOpLead.reduce((acc: any, lead) => {
        const key = lead.campaignId || 'NULL';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      console.log('\n   Distribución por campaign_id:');
      Object.entries(byCampaignId).forEach(([campaignId, count]) => {
        console.log(`      Campaign ${campaignId}: ${count} leads`);
      });
    }

    // 2. Query en op_leads_rep (tabla que usamos para conteo)
    console.log('\n\n📊 BÚSQUEDA EN TABLA op_leads_rep:\n');

    const leadsInOpLeadsRep = await db
      .select()
      .from(opLeadsRep)
      .where(
        and(
          sql`lower(${opLeadsRep.campaign}) LIKE '%peugeot%'`,
          eq(opLeadsRep.cliente, 'red_finance'),
          eq(opLeadsRep.localizacion, 'Mendoza')
        )
      )
      .orderBy(opLeadsRep.fechaCreacion);

    console.log(`   ✅ Encontrados: ${leadsInOpLeadsRep.length} leads en op_leads_rep`);

    if (leadsInOpLeadsRep.length > 0) {
      console.log('\n   Primeros 10 registros:');
      leadsInOpLeadsRep.slice(0, 10).forEach((lead, idx) => {
        console.log(`   ${idx + 1}. ID: ${lead.id} | Campaign: ${lead.campaign} | Fecha: ${lead.fechaCreacion} | Campaign ID: ${lead.campaignId || 'NULL'}`);
      });

      // Contar por campaignId
      const byCampaignId = leadsInOpLeadsRep.reduce((acc: any, lead) => {
        const key = lead.campaignId || 'NULL';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      console.log('\n   Distribución por campaign_id:');
      Object.entries(byCampaignId).forEach(([campaignId, count]) => {
        console.log(`      Campaign ${campaignId}: ${count} leads`);
      });

      // Contar solo disponibles (sin campaign_id)
      const disponibles = leadsInOpLeadsRep.filter(lead => lead.campaignId === null);
      console.log(`\n   📦 Disponibles (campaign_id IS NULL): ${disponibles.length}`);
    }

    // 3. Comparación de diferencias
    console.log('\n\n🔍 ANÁLISIS DE DIFERENCIAS:\n');

    console.log('   ┌─────────────────────────────────────────────┐');
    console.log(`   │ op_lead:          ${String(leadsInOpLead.length).padStart(6)} leads        │`);
    console.log(`   │ op_leads_rep:     ${String(leadsInOpLeadsRep.length).padStart(6)} leads        │`);
    console.log('   └─────────────────────────────────────────────┘');

    if (leadsInOpLead.length !== leadsInOpLeadsRep.length) {
      console.log('\n   ⚠️ HAY DIFERENCIA entre las dos tablas');
      console.log(`   Diferencia: ${Math.abs(leadsInOpLead.length - leadsInOpLeadsRep.length)} leads`);
    } else {
      console.log('\n   ✅ Ambas tablas tienen la misma cantidad');
    }

    // 4. Verificar campo "campaign" vs "marca"
    console.log('\n\n🔍 DIFERENCIA DE CAMPOS:\n');
    console.log('   op_lead usa: "marca" = \'PEUGEOT\' (columna específica)');
    console.log('   op_leads_rep usa: "campaign" LIKE \'%peugeot%\' (búsqueda en texto)');

    // 5. Ver valores únicos de "campaign" en op_leads_rep para red_finance + Mendoza
    console.log('\n\n📋 VALORES DE "campaign" EN op_leads_rep (red_finance + Mendoza):\n');

    const [campaignValues] = await db.execute(sql`
      SELECT DISTINCT campaign, COUNT(*) as count
      FROM op_leads_rep
      WHERE cliente = 'red_finance'
        AND localizacion = 'Mendoza'
      GROUP BY campaign
      ORDER BY campaign
    `);

    console.log('   Campañas encontradas:');
    if (Array.isArray(campaignValues)) {
      campaignValues.forEach((row: any) => {
        console.log(`      ${row.campaign}: ${row.count} leads`);
      });
    }

    // 6. RAZÓN DEL PROBLEMA
    console.log('\n\n💡 RAZÓN DEL PROBLEMA:\n');
    console.log('   La tabla op_lead tiene una columna "marca" específica');
    console.log('   La tabla op_leads_rep tiene "campaign" que puede contener otra info');
    console.log('\n   El conteo usa op_leads_rep porque es la tabla de sincronización');
    console.log('   desde Google Sheets, mientras que op_lead es la tabla de asignación.');

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

verifyPeugeotLeads();
