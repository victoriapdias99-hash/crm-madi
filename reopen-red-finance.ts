/**
 * Reabrir campaña Red Finance #1 para análisis
 */

import { db } from './server/db';
import { campanasComerciales, opLead } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

async function reopenCampaign() {
  console.log('🔓 Reabriendo Red Finance Campaña #1...\n');

  // Reabrir campaña
  await db
    .update(campanasComerciales)
    .set({
      fechaFin: null,
      estadoCampana: 'En proceso'
    })
    .where(eq(campanasComerciales.id, 65));

  console.log('✅ Campaña 65 reabierta\n');

  // Verificar estado
  const campaign = await db
    .select()
    .from(campanasComerciales)
    .where(eq(campanasComerciales.id, 65))
    .limit(1);

  if (campaign.length > 0) {
    console.log('📋 Estado actual:');
    console.log(`   ID: ${campaign[0].id}`);
    console.log(`   Número: ${campaign[0].numeroCampana}`);
    console.log(`   Estado: ${campaign[0].estadoCampana}`);
    console.log(`   Fecha Fin: ${campaign[0].fechaFin || 'NULL (en proceso)'}`);
    console.log(`   Meta: ${campaign[0].cantidadDatosSolicitados} leads\n`);
  }

  // Contar leads asignados
  const leadsCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(eq(opLead.campaignId, 65));

  console.log(`📊 Leads asignados: ${leadsCount[0]?.count || 0}\n`);

  await db.$client.end();
}

reopenCampaign();
