/**
 * Test del sistema Smart-Fast en producción
 *
 * Este script:
 * 1. Valida el estado actual antes de sincronizar
 * 2. Ejecuta la sincronización Smart-Fast
 * 3. Valida el estado después de sincronizar
 * 4. Compara los resultados
 */

import 'dotenv/config';
import { db } from './db';
import { opLead } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';
import { migrateSmartFast } from './sync-smart-fast/migrate-smart-fast';

interface PreSyncState {
  totalLeads: number;
  byBrand: Map<string, {
    count: number;
    maxRow: number;
    gaps: number[];
  }>;
}

async function getPreSyncState(): Promise<PreSyncState> {
  console.log('📊 Capturando estado PRE-sincronización...\n');

  // Total de leads
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(eq(opLead.source, 'google_sheets'));

  const totalLeads = totalResult[0].count;
  console.log(`   Total leads actuales: ${totalLeads.toLocaleString()}`);

  // Estado por marca
  const brandsResult = await db
    .selectDistinct({ marca: opLead.campaign })
    .from(opLead)
    .where(eq(opLead.source, 'google_sheets'));

  const brands = brandsResult
    .map(r => r.marca)
    .filter(m => m && m.trim() !== '')
    .sort();

  console.log(`   Marcas detectadas: ${brands.length}\n`);

  const byBrand = new Map<string, { count: number; maxRow: number; gaps: number[] }>();

  for (const marca of brands) {
    // Contar leads
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(
        sql`lower(${opLead.campaign}) LIKE ${`%${marca!.toLowerCase()}%`}
        AND ${opLead.source} = 'google_sheets'`
      );

    const count = countResult[0].count;

    // Obtener máxima fila
    const maxRowResult = await db
      .select({ maxRow: sql<number>`MAX(${opLead.googleSheetsRowNumber})::int` })
      .from(opLead)
      .where(
        sql`lower(${opLead.campaign}) LIKE ${`%${marca!.toLowerCase()}%`}
        AND ${opLead.source} = 'google_sheets'`
      );

    const maxRow = maxRowResult[0].maxRow || 0;

    // Detectar gaps
    const rowsResult = await db
      .select({ rowNumber: opLead.googleSheetsRowNumber })
      .from(opLead)
      .where(
        sql`lower(${opLead.campaign}) LIKE ${`%${marca!.toLowerCase()}%`}
        AND ${opLead.source} = 'google_sheets'`
      )
      .orderBy(opLead.googleSheetsRowNumber);

    const existingRows = rowsResult
      .map(r => r.rowNumber)
      .filter(r => r !== null) as number[];

    const gaps: number[] = [];
    for (let i = 2; i <= maxRow; i++) {
      if (!existingRows.includes(i)) {
        gaps.push(i);
      }
    }

    byBrand.set(marca!, { count, maxRow, gaps });

    console.log(`   ${marca}: ${count} leads, fila max: ${maxRow}, gaps: ${gaps.length}`);
  }

  console.log('');
  return { totalLeads, byBrand };
}

async function getPostSyncState(): Promise<PreSyncState> {
  console.log('\n📊 Capturando estado POST-sincronización...\n');
  return await getPreSyncState();
}

async function compareStates(pre: PreSyncState, post: PreSyncState) {
  console.log('\n📈 COMPARACIÓN DE RESULTADOS\n');
  console.log('═'.repeat(80));

  const leadsAdded = post.totalLeads - pre.totalLeads;
  console.log(`\n   Total leads:`);
  console.log(`   - Antes:  ${pre.totalLeads.toLocaleString()}`);
  console.log(`   - Después: ${post.totalLeads.toLocaleString()}`);
  console.log(`   - ${leadsAdded >= 0 ? '➕' : '➖'} Diferencia: ${Math.abs(leadsAdded).toLocaleString()}`);

  console.log(`\n   Análisis por marca:\n`);

  // Obtener todas las marcas (pre y post)
  const allBrands = new Set([...pre.byBrand.keys(), ...post.byBrand.keys()]);

  let totalGapsCorrected = 0;

  for (const marca of Array.from(allBrands).sort()) {
    const preBrand = pre.byBrand.get(marca) || { count: 0, maxRow: 0, gaps: [] };
    const postBrand = post.byBrand.get(marca) || { count: 0, maxRow: 0, gaps: [] };

    const countDiff = postBrand.count - preBrand.count;
    const gapsCorrected = preBrand.gaps.length - postBrand.gaps.length;
    totalGapsCorrected += gapsCorrected;

    const icon = gapsCorrected > 0 ? '✅' : postBrand.gaps.length > 0 ? '⚠️' : '✓';

    console.log(`   ${icon} ${marca}:`);
    console.log(`      Leads: ${preBrand.count} → ${postBrand.count} (${countDiff >= 0 ? '+' : ''}${countDiff})`);
    console.log(`      Gaps: ${preBrand.gaps.length} → ${postBrand.gaps.length} (${gapsCorrected >= 0 ? '-' : '+'}${Math.abs(gapsCorrected)} corregidos)`);

    if (postBrand.gaps.length > 0) {
      if (postBrand.gaps.length <= 5) {
        console.log(`      Gaps restantes: [${postBrand.gaps.join(', ')}]`);
      } else {
        console.log(`      Gaps restantes: [${postBrand.gaps.slice(0, 5).join(', ')}... y ${postBrand.gaps.length - 5} más]`);
      }
    }
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log(`\n   📊 RESUMEN:`);
  console.log(`      Leads nuevos: ${leadsAdded}`);
  console.log(`      Gaps corregidos: ${totalGapsCorrected}`);
  console.log(`      Marcas procesadas: ${allBrands.size}`);

  // Evaluación final
  const remainingGaps = Array.from(post.byBrand.values()).reduce((sum, b) => sum + b.gaps.length, 0);

  if (remainingGaps === 0) {
    console.log(`\n   ✅ EXCELENTE: Sistema completamente sincronizado`);
  } else if (remainingGaps < 20) {
    console.log(`\n   🟡 BUENO: ${remainingGaps} gaps restantes (aceptable)`);
  } else if (remainingGaps < 100) {
    console.log(`\n   🟠 REQUIERE ATENCIÓN: ${remainingGaps} gaps restantes`);
  } else {
    console.log(`\n   🔴 CRÍTICO: ${remainingGaps} gaps restantes (requiere revisión)`);
  }

  console.log('\n' + '═'.repeat(80));
}

async function main() {
  console.log('\n🧪 TEST COMPLETO DEL SISTEMA SMART-FAST\n');
  console.log('═'.repeat(80));
  console.log('Este proceso validará la sincronización en producción');
  console.log('═'.repeat(80));

  try {
    // FASE 1: Estado PRE-sincronización
    console.log('\n📋 FASE 1: ESTADO ACTUAL\n');
    const preState = await getPreSyncState();

    const totalGapsPre = Array.from(preState.byBrand.values())
      .reduce((sum, b) => sum + b.gaps.length, 0);

    console.log(`   Total gaps detectados: ${totalGapsPre}`);

    if (totalGapsPre === 0) {
      console.log('\n   ✅ No hay gaps detectados - el sistema está sincronizado');
      console.log('\n   Ejecutando sincronización de todas formas para validar...\n');
    }

    // FASE 2: Ejecutar sincronización Smart-Fast
    console.log('\n🚀 FASE 2: SINCRONIZACIÓN SMART-FAST\n');
    console.log('═'.repeat(80));

    const startTime = Date.now();
    const syncStats = await migrateSmartFast();
    const duration = Date.now() - startTime;

    console.log('\n' + '═'.repeat(80));
    console.log(`   ⏱️  Tiempo de ejecución: ${(duration / 1000).toFixed(2)}s`);
    console.log('═'.repeat(80));

    // FASE 3: Estado POST-sincronización
    console.log('\n📋 FASE 3: ESTADO DESPUÉS DE SINCRONIZACIÓN\n');
    const postState = await getPostSyncState();

    // FASE 4: Comparación
    await compareStates(preState, postState);

    console.log('\n✅ Test completado exitosamente\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error durante el test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar test
main();
