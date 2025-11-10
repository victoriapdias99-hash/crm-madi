/**
 * Snapshot del estado ANTES de borrar los datos
 * Guarda información importante para comparar después
 */

import 'dotenv/config';
import { db } from './db';
import { opLead } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function createPreDeleteSnapshot() {
  console.log('📸 CREANDO SNAPSHOT PRE-DELETE\n');
  console.log('═'.repeat(80));

  try {
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
        count: sql<number>`count(*)::int`,
        maxRow: sql<number>`MAX(${opLead.googleSheetsRowNumber})::int`,
        minRow: sql<number>`MIN(${opLead.googleSheetsRowNumber})::int`
      })
      .from(opLead)
      .where(eq(opLead.source, 'google_sheets'))
      .groupBy(opLead.campaign);

    const snapshot = {
      timestamp: new Date().toISOString(),
      totalLeads,
      brands: brandsResult.map(r => ({
        marca: r.marca,
        count: r.count,
        maxRow: r.maxRow,
        minRow: r.minRow
      }))
    };

    // Guardar en archivo JSON
    const snapshotPath = path.join(__dirname, 'pre-delete-snapshot.json');
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

    console.log(`✅ Snapshot guardado en: ${snapshotPath}\n`);
    console.log('📊 ESTADO ACTUAL:\n');
    console.log(`   Total leads: ${totalLeads.toLocaleString()}`);
    console.log(`   Marcas: ${brandsResult.length}\n`);

    console.log('   Detalle por marca:');
    brandsResult
      .sort((a, b) => b.count - a.count)
      .forEach(r => {
        console.log(`      ${r.marca?.padEnd(15)} ${r.count.toLocaleString().padStart(6)} leads (filas ${r.minRow}-${r.maxRow})`);
      });

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Snapshot completado - Puedes proceder a borrar los datos\n');

  } catch (error: any) {
    console.error('❌ Error creando snapshot:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

createPreDeleteSnapshot();
