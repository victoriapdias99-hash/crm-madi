import { db } from './db';
import { opLeadsRep } from '../shared/schema';
import { sql, isNull } from 'drizzle-orm';

async function finalAnalysis() {
  console.log('📊 ANÁLISIS FINAL: Red Finance #1\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Buscar con cliente correcto: "red_finance"
    console.log('🔍 CONTEO CORRECTO CON "red_finance":\n');

    // Peugeot
    const [peugeotCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)}
            AND lower(${opLeadsRep.campaign}) LIKE '%peugeot%'
            AND ${opLeadsRep.cliente} = 'red_finance'
            AND ${opLeadsRep.localizacion} = 'Mendoza'
            AND ${opLeadsRep.source} = 'google_sheets'`
      );

    console.log('   ✅ Peugeot + Mendoza + red_finance:', peugeotCount.count, 'leads');

    // Fiat
    const [fiatCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)}
            AND lower(${opLeadsRep.campaign}) LIKE '%fiat%'
            AND ${opLeadsRep.cliente} = 'red_finance'
            AND ${opLeadsRep.localizacion} = 'Mendoza'
            AND ${opLeadsRep.source} = 'google_sheets'`
      );

    console.log('   ✅ Fiat + Mendoza + red_finance:', fiatCount.count, 'leads');

    // Multimarca (OR entre ambas)
    const [multiCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(
        sql`${isNull(opLeadsRep.campaignId)}
            AND (lower(${opLeadsRep.campaign}) LIKE '%peugeot%' OR lower(${opLeadsRep.campaign}) LIKE '%fiat%')
            AND ${opLeadsRep.cliente} = 'red_finance'
            AND ${opLeadsRep.localizacion} = 'Mendoza'
            AND ${opLeadsRep.source} = 'google_sheets'`
      );

    console.log('   ✅ Total con OR (Peugeot OR Fiat):', multiCount.count, 'leads');

    // Distribución según porcentajes (60% Peugeot, 40% Fiat)
    console.log('\n💯 DISTRIBUCIÓN SEGÚN PORCENTAJES (Total: 100 solicitados):\n');

    const totalSolicitados = 100;
    const peugeotPorcentaje = 60;
    const fiatPorcentaje = 40;

    const peugeotAsignados = Math.floor(totalSolicitados * peugeotPorcentaje / 100);
    const fiatAsignados = totalSolicitados - peugeotAsignados; // 40

    console.log(`   🚗 Peugeot (${peugeotPorcentaje}%): ${peugeotAsignados} leads`);
    console.log(`      - Disponibles: ${peugeotCount.count}`);
    console.log(`      - Estado: ${peugeotCount.count >= peugeotAsignados ? '✅ Suficientes' : '❌ Faltan ' + (peugeotAsignados - peugeotCount.count)}`);

    console.log(`\n   🚗 Fiat (${fiatPorcentaje}%): ${fiatAsignados} leads`);
    console.log(`      - Disponibles: ${fiatCount.count}`);
    console.log(`      - Estado: ${fiatCount.count >= fiatAsignados ? '✅ Suficientes' : '❌ Faltan ' + (fiatAsignados - fiatCount.count)}`);

    // Resumen
    console.log('\n' + '═'.repeat(63));
    console.log('📈 RESUMEN FINAL:\n');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ CAMPAÑA: Red Finance #1                                 │');
    console.log('│ CONFIGURACIÓN: Multi-marca (Peugeot 60%, Fiat 40%)      │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ Solicitados total:              ${String(totalSolicitados).padStart(4)}                   │`);
    console.log(`│ Disponibles (Peugeot):          ${String(peugeotCount.count).padStart(4)}                   │`);
    console.log(`│ Disponibles (Fiat):             ${String(fiatCount.count).padStart(4)}                   │`);
    console.log(`│ Disponibles (OR total):         ${String(multiCount.count).padStart(4)}                   │`);
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ A asignar (Peugeot 60%):        ${String(peugeotAsignados).padStart(4)}                   │`);
    console.log(`│ A asignar (Fiat 40%):           ${String(fiatAsignados).padStart(4)}                   │`);
    console.log('└─────────────────────────────────────────────────────────┘');

    // Estado de cierre
    const puedeAsignarPeugeot = peugeotCount.count >= peugeotAsignados;
    const puedeAsignarFiat = fiatCount.count >= fiatAsignados;
    const puedeCerrar = puedeAsignarPeugeot && puedeAsignarFiat;

    console.log('\n🎯 ESTADO DE CIERRE:\n');

    if (puedeCerrar) {
      console.log('   ✅ PUEDE CERRARSE - Hay suficientes leads para ambas marcas');
      console.log('\n   📝 Distribución final:');
      console.log(`      - Peugeot: ${peugeotAsignados} leads (${peugeotPorcentaje}%)`);
      console.log(`      - Fiat: ${fiatAsignados} leads (${fiatPorcentaje}%)`);
      console.log(`      - Total: ${totalSolicitados} leads`);
    } else {
      console.log('   ❌ NO PUEDE CERRARSE - Leads insuficientes');
      if (!puedeAsignarPeugeot) {
        console.log(`      - Faltan ${peugeotAsignados - peugeotCount.count} leads de Peugeot`);
      }
      if (!puedeAsignarFiat) {
        console.log(`      - Faltan ${fiatAsignados - fiatCount.count} leads de Fiat`);
      }
    }

    // Problema identificado
    console.log('\n' + '═'.repeat(63));
    console.log('🐛 PROBLEMA IDENTIFICADO:\n');
    console.log('   El cliente en BD es "red_finance" (con guión bajo)');
    console.log('   pero la normalización lo convierte a "red finance" (con espacio)');
    console.log('\n   Función de normalización actual:');
    console.log('   normalizedClient.toLowerCase().replace(/\\s+/g, \' \').trim()');
    console.log('\n   ❌ Esto NO convierte guiones bajos a espacios');
    console.log('   ✅ Debería hacer: .replace(/[_\\s]+/g, \' \')');
    console.log('\n' + '═'.repeat(63) + '\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

finalAnalysis();
