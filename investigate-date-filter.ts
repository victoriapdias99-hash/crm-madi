import { db } from './server/db';
import { opLead } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

async function investigate() {
  console.log('🔍 Investigando los 2 leads faltantes...\n');

  // Todos los leads de campaña 65
  const allLeads = await db
    .select({
      id: opLead.id,
      nombre: opLead.nombre,
      fechaCreacion: opLead.fechaCreacion,
      campaign: opLead.campaign,
      cliente: opLead.cliente
    })
    .from(opLead)
    .where(eq(opLead.campaignId, 65))
    .orderBy(opLead.fechaCreacion);

  console.log(`Total leads con campaign_id = 65: ${allLeads.length}\n`);

  // Agrupar por fecha
  const byDate = new Map<string, number>();
  allLeads.forEach(lead => {
    const dateStr = lead.fechaCreacion?.toISOString().split('T')[0] || 'null';
    byDate.set(dateStr, (byDate.get(dateStr) || 0) + 1);
  });

  console.log('Distribución por fecha:');
  Array.from(byDate.entries())
    .sort()
    .forEach(([date, count]) => {
      const isAfterClosure = date > '2025-10-02';
      console.log(`   ${date}: ${count} leads ${isAfterClosure ? '⚠️  DESPUÉS del cierre' : ''}`);
    });

  console.log('\n📅 Fecha de cierre de la campaña: 2025-10-02');
  console.log('❓ ¿Hay leads con fecha > 2025-10-02?');

  const leadsAfterClosure = allLeads.filter(l => {
    const dateStr = l.fechaCreacion?.toISOString().split('T')[0] || '';
    return dateStr > '2025-10-02';
  });

  if (leadsAfterClosure.length > 0) {
    console.log(`\n⚠️  SÍ - ${leadsAfterClosure.length} leads tienen fecha posterior al cierre:\n`);
    leadsAfterClosure.forEach(lead => {
      console.log(`   ID ${lead.id}: ${lead.nombre} - ${lead.fechaCreacion?.toISOString().split('T')[0]}`);
    });
    console.log('\n💡 Esto explica la discrepancia:');
    console.log('   - Legacy cuenta TODOS los leads con campaign_id = 65 (incluye los 2 posteriores)');
    console.log('   - Generic filtra por fecha_creacion <= 2025-10-02 (excluye los 2 posteriores)');
  } else {
    console.log('\n✅ NO - Todos los leads están dentro del rango de fechas');
  }

  await db.$client.end();
}

investigate();
