import { db } from './db';
import { opLeadsRep, campanasComerciales } from '../shared/schema';
import { eq, sql, and, isNull } from 'drizzle-orm';

/**
 * Testing completo del sistema de sincronización en producción
 *
 * Este script valida:
 * 1. Estado actual de la sincronización
 * 2. Integridad de datos (gaps en filas)
 * 3. Estadísticas por marca
 * 4. Duplicados y consistencia
 * 5. Estado de campañas activas
 */

interface BrandStats {
  marca: string;
  totalLeads: number;
  leadsConCampaña: number;
  leadsSinCampaña: number;
  leadsGoogleSheets: number;
  ultimaFila: number;
  gapsDetectados: number[];
  campanasActivas: number;
  estado: 'OK' | 'WARNING' | 'ERROR';
  mensajes: string[];
}

async function testSyncProduction() {
  console.log('🧪 TESTING DE SINCRONIZACIÓN EN PRODUCCIÓN\n');
  console.log('═'.repeat(80));

  try {
    // ========== 1. ESTADO GENERAL ==========
    console.log('\n📊 1. ESTADO GENERAL DEL SISTEMA\n');

    const totalLeads = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep);

    const leadsGoogleSheets = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(eq(opLeadsRep.source, 'google_sheets'));

    const leadsConCampaña = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(sql`${opLeadsRep.campaignId} IS NOT NULL`);

    const leadsSinCampaña = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLeadsRep)
      .where(isNull(opLeadsRep.campaignId));

    console.log('   Total de leads:', totalLeads[0].count.toLocaleString());
    console.log('   Leads de Google Sheets:', leadsGoogleSheets[0].count.toLocaleString());
    console.log('   Leads asignados a campañas:', leadsConCampaña[0].count.toLocaleString());
    console.log('   Leads disponibles (sin campaña):', leadsSinCampaña[0].count.toLocaleString());

    // ========== 2. ANÁLISIS POR MARCA ==========
    console.log('\n\n📈 2. ANÁLISIS POR MARCA\n');
    console.log('─'.repeat(80));

    // Obtener todas las marcas únicas
    const marcasResult = await db
      .selectDistinct({ marca: opLeadsRep.campaign })
      .from(opLeadsRep)
      .where(eq(opLeadsRep.source, 'google_sheets'));

    const marcas = marcasResult
      .map(r => r.marca)
      .filter(m => m && m.trim() !== '')
      .sort();

    console.log(`   Marcas detectadas: ${marcas.length}\n`);

    const brandStatsArray: BrandStats[] = [];

    for (const marca of marcas) {
      console.log(`\n🔍 Analizando: ${marca}`);
      console.log('   ' + '─'.repeat(76));

      const stats: BrandStats = {
        marca,
        totalLeads: 0,
        leadsConCampaña: 0,
        leadsSinCampaña: 0,
        leadsGoogleSheets: 0,
        ultimaFila: 0,
        gapsDetectados: [],
        campanasActivas: 0,
        estado: 'OK',
        mensajes: []
      };

      // Total de leads de esta marca
      const totalMarca = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLeadsRep)
        .where(
          and(
            sql`lower(${opLeadsRep.campaign}) LIKE ${`%${marca.toLowerCase()}%`}`,
            eq(opLeadsRep.source, 'google_sheets')
          )
        );
      stats.totalLeads = totalMarca[0].count;

      // Leads con campaña
      const conCampaña = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(opLeadsRep)
        .where(
          and(
            sql`lower(${opLeadsRep.campaign}) LIKE ${`%${marca.toLowerCase()}%`}`,
            eq(opLeadsRep.source, 'google_sheets'),
            sql`${opLeadsRep.campaignId} IS NOT NULL`
          )
        );
      stats.leadsConCampaña = conCampaña[0].count;

      // Leads sin campaña (disponibles)
      stats.leadsSinCampaña = stats.totalLeads - stats.leadsConCampaña;

      // Obtener última fila procesada
      const ultimaFilaResult = await db
        .select({
          maxRow: sql<number>`MAX(${opLeadsRep.googleSheetsRowNumber})::int`
        })
        .from(opLeadsRep)
        .where(
          and(
            sql`lower(${opLeadsRep.campaign}) LIKE ${`%${marca.toLowerCase()}%`}`,
            eq(opLeadsRep.source, 'google_sheets')
          )
        );
      stats.ultimaFila = ultimaFilaResult[0].maxRow || 0;

      // Detectar gaps en las filas
      if (stats.ultimaFila > 0) {
        const filasResult = await db
          .select({
            rowNumber: opLeadsRep.googleSheetsRowNumber
          })
          .from(opLeadsRep)
          .where(
            and(
              sql`lower(${opLeadsRep.campaign}) LIKE ${`%${marca.toLowerCase()}%`}`,
              eq(opLeadsRep.source, 'google_sheets')
            )
          )
          .orderBy(opLeadsRep.googleSheetsRowNumber);

        const filasExistentes = filasResult
          .map(r => r.rowNumber)
          .filter(r => r !== null) as number[];

        // Detectar gaps (filas faltantes en la secuencia)
        const gaps: number[] = [];
        for (let i = 2; i <= stats.ultimaFila; i++) {
          if (!filasExistentes.includes(i)) {
            gaps.push(i);
          }
        }
        stats.gapsDetectados = gaps;

        if (gaps.length > 0) {
          stats.estado = 'WARNING';
          stats.mensajes.push(`${gaps.length} gaps detectados en filas`);
        }
      }

      // Campañas activas para esta marca
      const campanasActivasResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(campanasComerciales)
        .where(
          and(
            sql`(
              lower(${campanasComerciales.marca}) LIKE ${`%${marca.toLowerCase()}%`} OR
              lower(${campanasComerciales.marca2}) LIKE ${`%${marca.toLowerCase()}%`} OR
              lower(${campanasComerciales.marca3}) LIKE ${`%${marca.toLowerCase()}%`} OR
              lower(${campanasComerciales.marca4}) LIKE ${`%${marca.toLowerCase()}%`} OR
              lower(${campanasComerciales.marca5}) LIKE ${`%${marca.toLowerCase()}%`}
            )`,
            isNull(campanasComerciales.fechaFin)
          )
        );
      stats.campanasActivas = campanasActivasResult[0].count;

      // Evaluaciones adicionales
      if (stats.totalLeads === 0) {
        stats.estado = 'ERROR';
        stats.mensajes.push('No hay leads sincronizados');
      } else if (stats.leadsSinCampaña === 0 && stats.campanasActivas > 0) {
        stats.estado = 'WARNING';
        stats.mensajes.push('No hay leads disponibles para campañas activas');
      }

      // Mostrar estadísticas
      console.log(`   Total leads: ${stats.totalLeads.toLocaleString()}`);
      console.log(`   Asignados: ${stats.leadsConCampaña.toLocaleString()}`);
      console.log(`   Disponibles: ${stats.leadsSinCampaña.toLocaleString()}`);
      console.log(`   Última fila: ${stats.ultimaFila}`);
      console.log(`   Gaps: ${stats.gapsDetectados.length}`);
      if (stats.gapsDetectados.length > 0 && stats.gapsDetectados.length <= 10) {
        console.log(`   Filas faltantes: [${stats.gapsDetectados.join(', ')}]`);
      } else if (stats.gapsDetectados.length > 10) {
        console.log(`   Filas faltantes: [${stats.gapsDetectados.slice(0, 10).join(', ')}... y ${stats.gapsDetectados.length - 10} más]`);
      }
      console.log(`   Campañas activas: ${stats.campanasActivas}`);
      console.log(`   Estado: ${stats.estado === 'OK' ? '✅' : stats.estado === 'WARNING' ? '⚠️' : '❌'} ${stats.estado}`);
      if (stats.mensajes.length > 0) {
        stats.mensajes.forEach(msg => console.log(`   📌 ${msg}`));
      }

      brandStatsArray.push(stats);
    }

    // ========== 3. DETECCIÓN DE DUPLICADOS ==========
    console.log('\n\n🔍 3. DETECCIÓN DE DUPLICADOS\n');
    console.log('─'.repeat(80));

    // Duplicados por teléfono
    const duplicadosTelefono = await db
      .select({
        telefono: opLeadsRep.telefono,
        count: sql<number>`count(*)::int`
      })
      .from(opLeadsRep)
      .where(eq(opLeadsRep.source, 'google_sheets'))
      .groupBy(opLeadsRep.telefono)
      .having(sql`count(*) > 1`)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    console.log(`   Teléfonos duplicados: ${duplicadosTelefono.length > 0 ? duplicadosTelefono.length + ' encontrados' : 'ninguno'}`);
    if (duplicadosTelefono.length > 0) {
      console.log('\n   Top 10 duplicados:');
      duplicadosTelefono.forEach(d => {
        console.log(`   - ${d.telefono}: ${d.count} ocurrencias`);
      });
    }

    // Duplicados por fila (mismo marca + fila)
    const duplicadosFila = await db
      .select({
        marca: opLeadsRep.campaign,
        fila: opLeadsRep.googleSheetsRowNumber,
        count: sql<number>`count(*)::int`
      })
      .from(opLeadsRep)
      .where(eq(opLeadsRep.source, 'google_sheets'))
      .groupBy(opLeadsRep.campaign, opLeadsRep.googleSheetsRowNumber)
      .having(sql`count(*) > 1`)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    console.log(`\n   Filas duplicadas (mismo marca+fila): ${duplicadosFila.length > 0 ? duplicadosFila.length + ' encontradas' : 'ninguna'}`);
    if (duplicadosFila.length > 0) {
      console.log('\n   ⚠️ ATENCIÓN: Estas filas están duplicadas en la BD:');
      duplicadosFila.forEach(d => {
        console.log(`   - ${d.marca} fila ${d.fila}: ${d.count} copias`);
      });
    }

    // ========== 4. CAMPAÑAS ACTIVAS ==========
    console.log('\n\n📋 4. CAMPAÑAS ACTIVAS (SIN FECHA FIN)\n');
    console.log('─'.repeat(80));

    const campanasActivas = await db
      .select()
      .from(campanasComerciales)
      .where(isNull(campanasComerciales.fechaFin))
      .orderBy(campanasComerciales.id);

    console.log(`   Total: ${campanasActivas.length} campañas activas\n`);

    for (const campana of campanasActivas) {
      console.log(`   Campaña #${campana.id} - ${campana.marca || 'Sin marca'}`);
      console.log(`   - Número: ${campana.numeroCampana}`);
      console.log(`   - Solicitados: ${campana.cantidadDatosSolicitados}`);
      console.log(`   - Enviados: ${campana.cantidadDatosEnviados || 0}`);
      console.log(`   - Faltantes: ${campana.cantidadDatosSolicitados - (campana.cantidadDatosEnviados || 0)}`);
      const fechaInicio = campana.fechaCampana
        ? (typeof campana.fechaCampana === 'string'
          ? campana.fechaCampana.split('T')[0]
          : campana.fechaCampana.toISOString().split('T')[0])
        : 'N/A';
      console.log(`   - Fecha inicio: ${fechaInicio}`);
      console.log('');
    }

    // ========== 5. RESUMEN FINAL ==========
    console.log('\n📊 5. RESUMEN FINAL\n');
    console.log('═'.repeat(80));

    const marcasOK = brandStatsArray.filter(s => s.estado === 'OK').length;
    const marcasWarning = brandStatsArray.filter(s => s.estado === 'WARNING').length;
    const marcasError = brandStatsArray.filter(s => s.estado === 'ERROR').length;

    const totalGaps = brandStatsArray.reduce((sum, s) => sum + s.gapsDetectados.length, 0);
    const totalDisponibles = brandStatsArray.reduce((sum, s) => sum + s.leadsSinCampaña, 0);

    console.log(`   Marcas analizadas: ${brandStatsArray.length}`);
    console.log(`   - ✅ OK: ${marcasOK}`);
    console.log(`   - ⚠️ Warning: ${marcasWarning}`);
    console.log(`   - ❌ Error: ${marcasError}`);
    console.log('');
    console.log(`   Total leads sincronizados: ${leadsGoogleSheets[0].count.toLocaleString()}`);
    console.log(`   Leads disponibles: ${totalDisponibles.toLocaleString()}`);
    console.log(`   Gaps totales detectados: ${totalGaps}`);
    console.log(`   Campañas activas: ${campanasActivas.length}`);
    console.log('');

    // Estado general del sistema
    let estadoGeneral: 'EXCELENTE' | 'BUENO' | 'REQUIERE ATENCIÓN' | 'CRÍTICO';
    if (marcasError > 0 || totalGaps > 100) {
      estadoGeneral = 'CRÍTICO';
    } else if (marcasWarning > 0 || totalGaps > 20) {
      estadoGeneral = 'REQUIERE ATENCIÓN';
    } else if (totalGaps > 0) {
      estadoGeneral = 'BUENO';
    } else {
      estadoGeneral = 'EXCELENTE';
    }

    console.log(`   Estado general del sistema: ${
      estadoGeneral === 'EXCELENTE' ? '🟢' :
      estadoGeneral === 'BUENO' ? '🟡' :
      estadoGeneral === 'REQUIERE ATENCIÓN' ? '🟠' : '🔴'
    } ${estadoGeneral}`);

    // ========== 6. RECOMENDACIONES ==========
    if (estadoGeneral !== 'EXCELENTE') {
      console.log('\n\n💡 6. RECOMENDACIONES\n');
      console.log('─'.repeat(80));

      if (totalGaps > 0) {
        console.log('   📌 Ejecutar sincronización inteligente para corregir gaps:');
        console.log('      POST /api/sync/smart');
        console.log('');
      }

      if (duplicadosFila.length > 0) {
        console.log('   📌 Limpiar duplicados detectados (mismo marca+fila)');
        console.log('');
      }

      const marcasProblema = brandStatsArray.filter(s => s.estado !== 'OK');
      if (marcasProblema.length > 0) {
        console.log('   📌 Revisar marcas con problemas:');
        marcasProblema.forEach(m => {
          console.log(`      - ${m.marca}: ${m.mensajes.join(', ')}`);
        });
        console.log('');
      }

      if (campanasActivas.length > 0) {
        const campanasProblema = campanasActivas.filter(c => {
          const marca = c.marca || '';
          const stats = brandStatsArray.find(s =>
            marca.toLowerCase().includes(s.marca.toLowerCase())
          );
          return stats && stats.leadsSinCampaña === 0;
        });

        if (campanasProblema.length > 0) {
          console.log('   📌 Campañas sin leads disponibles:');
          campanasProblema.forEach(c => {
            console.log(`      - Campaña #${c.id} (${c.marca}): requiere más leads`);
          });
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ Testing completado\n');

  } catch (error: any) {
    console.error('\n❌ Error durante el testing:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

// Ejecutar testing
testSyncProduction();
