import { db } from './server/db';
import { campanasComerciales, clientes } from './shared/schema';
import { isNotNull, eq, desc } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function getClosedCampaigns() {
  console.log('📊 Consultando campañas cerradas...\n');

  const closedCampaigns = await db
    .select({
      id: campanasComerciales.id,
      campana: campanasComerciales.numeroCampana,
      marca: campanasComerciales.marca,
      zona: campanasComerciales.zona,
      meta: campanasComerciales.cantidadDatosSolicitados,
      inicio: campanasComerciales.fechaCampana,
      cierre: campanasComerciales.fechaFin,
      cliente: clientes.nombreComercial,
      clienteId: campanasComerciales.clienteId,
    })
    .from(campanasComerciales)
    .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
    .where(isNotNull(campanasComerciales.fechaFin))
    .orderBy(desc(campanasComerciales.fechaFin))
    .limit(100);

  // Generar el reporte
  let report = '';

  report += '╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗\n';
  report += '║                                      REPORTE DE CAMPAÑAS CERRADAS                                                 ║\n';
  report += '║                                     Generado: ' + new Date().toLocaleString('es-AR').padEnd(60) + '║\n';
  report += '╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝\n\n';

  report += `Total de campañas cerradas: ${closedCampaigns.length}\n\n`;
  report += '═'.repeat(120) + '\n';
  report +=
    'ID'.padEnd(6) +
    'Cliente'.padEnd(25) +
    'Campaña'.padEnd(10) +
    'Marca'.padEnd(15) +
    'Zona'.padEnd(12) +
    'Meta'.padEnd(8) +
    'Fecha Inicio'.padEnd(20) +
    'Fecha Cierre\n';
  report += '═'.repeat(120) + '\n';

  closedCampaigns.forEach((camp) => {
    const inicio = camp.inicio ? new Date(camp.inicio).toISOString().split('T')[0] : 'N/A';
    const cierre = camp.cierre ? new Date(camp.cierre).toISOString().split('T')[0] : 'N/A';

    report +=
      String(camp.id).padEnd(6) +
      (camp.cliente || 'N/A').substring(0, 24).padEnd(25) +
      String(camp.campana || 'N/A').padEnd(10) +
      (camp.marca || 'N/A').substring(0, 14).padEnd(15) +
      (camp.zona || 'N/A').substring(0, 11).padEnd(12) +
      String(camp.meta || 0).padEnd(8) +
      inicio.padEnd(20) +
      cierre + '\n';
  });

  report += '═'.repeat(120) + '\n\n';

  // Estadísticas por cliente
  const clientStats = closedCampaigns.reduce((acc, camp) => {
    const cliente = camp.cliente || 'N/A';
    if (!acc[cliente]) {
      acc[cliente] = { count: 0, totalLeads: 0 };
    }
    acc[cliente].count++;
    acc[cliente].totalLeads += camp.meta || 0;
    return acc;
  }, {} as Record<string, { count: number; totalLeads: number }>);

  report += '📈 ESTADÍSTICAS POR CLIENTE\n';
  report += '─'.repeat(80) + '\n';
  Object.entries(clientStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([cliente, stats]) => {
      report +=
        cliente.padEnd(40) +
        `Campañas: ${stats.count}`.padEnd(20) +
        `Leads totales: ${stats.totalLeads}\n`;
    });

  // Estadísticas por marca
  const brandStats = closedCampaigns.reduce((acc, camp) => {
    const marca = camp.marca || 'N/A';
    if (!acc[marca]) {
      acc[marca] = { count: 0, totalLeads: 0 };
    }
    acc[marca].count++;
    acc[marca].totalLeads += camp.meta || 0;
    return acc;
  }, {} as Record<string, { count: number; totalLeads: number }>);

  report += '\n📊 ESTADÍSTICAS POR MARCA\n';
  report += '─'.repeat(80) + '\n';
  Object.entries(brandStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([marca, stats]) => {
      report +=
        marca.padEnd(40) +
        `Campañas: ${stats.count}`.padEnd(20) +
        `Leads totales: ${stats.totalLeads}\n`;
    });

  // Estadísticas por zona
  const zoneStats = closedCampaigns.reduce((acc, camp) => {
    const zona = camp.zona || 'N/A';
    if (!acc[zona]) {
      acc[zona] = { count: 0, totalLeads: 0 };
    }
    acc[zona].count++;
    acc[zona].totalLeads += camp.meta || 0;
    return acc;
  }, {} as Record<string, { count: number; totalLeads: number }>);

  report += '\n🗺️  ESTADÍSTICAS POR ZONA\n';
  report += '─'.repeat(80) + '\n';
  Object.entries(zoneStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([zona, stats]) => {
      report +=
        zona.padEnd(40) +
        `Campañas: ${stats.count}`.padEnd(20) +
        `Leads totales: ${stats.totalLeads}\n`;
    });

  // Resumen general
  const totalLeads = closedCampaigns.reduce((sum, camp) => sum + (camp.meta || 0), 0);
  report += '\n' + '═'.repeat(120) + '\n';
  report += '📊 RESUMEN GENERAL\n';
  report += '─'.repeat(80) + '\n';
  report += `Total de campañas cerradas: ${closedCampaigns.length}\n`;
  report += `Total de leads procesados: ${totalLeads}\n`;
  report += `Promedio de leads por campaña: ${Math.round(totalLeads / closedCampaigns.length)}\n`;
  report += `Clientes únicos: ${Object.keys(clientStats).length}\n`;
  report += `Marcas únicas: ${Object.keys(brandStats).length}\n`;
  report += `Zonas únicas: ${Object.keys(zoneStats).length}\n`;
  report += '═'.repeat(120) + '\n';

  // Guardar el reporte en archivo
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `reporte-campanas-cerradas-${timestamp}.txt`;
  const filepath = path.join(process.cwd(), filename);

  fs.writeFileSync(filepath, report, 'utf-8');

  console.log(report);
  console.log(`\n✅ Reporte guardado en: ${filepath}`);

  process.exit(0);
}

getClosedCampaigns().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
