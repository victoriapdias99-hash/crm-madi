/**
 * Monitor de logs en tiempo real para sincronización Smart-Fast
 *
 * Este script se ejecuta en paralelo y muestra:
 * - Conteo de leads en tiempo real
 * - Progreso por marca
 * - Detección de errores
 * - Estadísticas finales
 */

import 'dotenv/config';
import { db } from './db';
import { opLead } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

interface Snapshot {
  timestamp: Date;
  totalLeads: number;
  byBrand: Map<string, number>;
}

let lastSnapshot: Snapshot | null = null;
let monitoringActive = true;

async function getSnapshot(): Promise<Snapshot> {
  // Total de leads
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(eq(opLead.source, 'google_sheets'));

  const totalLeads = totalResult[0].count;

  // Por marca
  const brandsResult = await db
    .select({
      marca: opLead.campaign,
      count: sql<number>`count(*)::int`
    })
    .from(opLead)
    .where(eq(opLead.source, 'google_sheets'))
    .groupBy(opLead.campaign);

  const byBrand = new Map<string, number>();
  brandsResult.forEach(r => {
    if (r.marca) {
      byBrand.set(r.marca, r.count);
    }
  });

  return {
    timestamp: new Date(),
    totalLeads,
    byBrand
  };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour12: false });
}

async function monitorLoop() {
  console.log('📊 MONITOR DE SINCRONIZACIÓN EN TIEMPO REAL\n');
  console.log('═'.repeat(80));
  console.log('Presiona Ctrl+C para detener el monitoreo\n');

  let iteration = 0;

  while (monitoringActive) {
    try {
      iteration++;
      const currentSnapshot = await getSnapshot();

      if (lastSnapshot === null) {
        // Primera ejecución
        console.log(`[${formatTime(currentSnapshot.timestamp)}] Estado inicial:`);
        console.log(`   Total leads: ${currentSnapshot.totalLeads.toLocaleString()}`);

        if (currentSnapshot.byBrand.size > 0) {
          console.log(`   Marcas detectadas: ${currentSnapshot.byBrand.size}`);
          const sortedBrands = Array.from(currentSnapshot.byBrand.entries())
            .sort((a, b) => b[1] - a[1]);

          sortedBrands.forEach(([marca, count]) => {
            console.log(`      ${marca}: ${count.toLocaleString()}`);
          });
        }
        console.log('');
      } else {
        // Detectar cambios
        const leadsDiff = currentSnapshot.totalLeads - lastSnapshot.totalLeads;

        if (leadsDiff !== 0) {
          const diffSymbol = leadsDiff > 0 ? '📈' : '📉';
          const diffSign = leadsDiff > 0 ? '+' : '';

          console.log(`[${formatTime(currentSnapshot.timestamp)}] ${diffSymbol} Cambio detectado:`);
          console.log(`   Total: ${lastSnapshot.totalLeads.toLocaleString()} → ${currentSnapshot.totalLeads.toLocaleString()} (${diffSign}${leadsDiff.toLocaleString()})`);

          // Detectar cambios por marca
          const brandChanges: Array<{ marca: string; change: number; before: number; after: number }> = [];

          // Nuevas marcas o cambios en existentes
          currentSnapshot.byBrand.forEach((count, marca) => {
            const beforeCount = lastSnapshot.byBrand.get(marca) || 0;
            const change = count - beforeCount;

            if (change !== 0) {
              brandChanges.push({ marca, change, before: beforeCount, after: count });
            }
          });

          // Marcas que desaparecieron
          lastSnapshot.byBrand.forEach((count, marca) => {
            if (!currentSnapshot.byBrand.has(marca)) {
              brandChanges.push({ marca, change: -count, before: count, after: 0 });
            }
          });

          if (brandChanges.length > 0) {
            console.log('   Cambios por marca:');
            brandChanges
              .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
              .forEach(({ marca, change, before, after }) => {
                const icon = change > 0 ? '✅' : '❌';
                const sign = change > 0 ? '+' : '';
                console.log(`      ${icon} ${marca}: ${before.toLocaleString()} → ${after.toLocaleString()} (${sign}${change.toLocaleString()})`);
              });
          }
          console.log('');
        } else if (iteration % 6 === 0) {
          // Cada minuto (6 iteraciones de 10s), mostrar estado aunque no haya cambios
          console.log(`[${formatTime(currentSnapshot.timestamp)}] ⏸️  Sin cambios - Total: ${currentSnapshot.totalLeads.toLocaleString()} leads`);
        }
      }

      lastSnapshot = currentSnapshot;

      // Esperar 10 segundos antes del siguiente check
      await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error: any) {
      console.error(`\n❌ [${formatTime(new Date())}] Error en monitor:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Manejar Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n📊 RESUMEN FINAL DEL MONITOREO\n');
  console.log('═'.repeat(80));

  if (lastSnapshot) {
    console.log(`   Última actualización: ${formatTime(lastSnapshot.timestamp)}`);
    console.log(`   Total final: ${lastSnapshot.totalLeads.toLocaleString()} leads`);
    console.log(`   Marcas activas: ${lastSnapshot.byBrand.size}`);

    if (lastSnapshot.byBrand.size > 0) {
      console.log('\n   Distribución final por marca:');
      const sortedBrands = Array.from(lastSnapshot.byBrand.entries())
        .sort((a, b) => b[1] - a[1]);

      sortedBrands.forEach(([marca, count]) => {
        const percentage = ((count / lastSnapshot.totalLeads) * 100).toFixed(1);
        console.log(`      ${marca.padEnd(15)} ${count.toLocaleString().padStart(6)} (${percentage}%)`);
      });
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Monitor detenido\n');

  monitoringActive = false;
  process.exit(0);
});

// Iniciar monitoreo
monitorLoop().catch(error => {
  console.error('❌ Error fatal en monitor:', error);
  process.exit(1);
});
