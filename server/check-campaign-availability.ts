import { db } from './db';
import { campanasComerciales, clientes, opLead, opLeadsRep } from '../shared/schema';
import { eq, sql, isNull, ilike, and } from 'drizzle-orm';

/**
 * Script para verificar disponibilidad de leads para una campaña
 * Sin ejecutar el cierre
 */

const campaignId = parseInt(process.argv[2] || '65');

async function checkAvailability() {
  console.log('🔍 ========================================');
  console.log('🔍 VERIFICACIÓN DE DISPONIBILIDAD');
  console.log('🔍 ========================================\n');

  try {
    // 1. Obtener información de la campaña
    console.log('📋 PASO 1: Obteniendo información de campaña...');

    const campaignResult = await db.execute<{
      id: number;
      numero_campana: string;
      cliente: string;
      marca: string;
      zona: string;
      cantidad_datos_solicitados: number;
      fecha_fin: Date | null;
    }>(sql`
      SELECT
        cc.id,
        cc.numero_campana,
        c.nombre_comercial as cliente,
        cc.marca,
        cc.zona,
        cc.cantidad_datos_solicitados,
        cc.fecha_fin
      FROM campanas_comerciales cc
      LEFT JOIN clientes c ON cc.cliente_id = c.id
      WHERE cc.id = ${campaignId}
    `);

    const campaigns = campaignResult.rows || campaignResult;

    if (!campaigns || campaigns.length === 0) {
      console.error('❌ Campaña no encontrada');
      process.exit(1);
    }

    const campaign = campaigns[0];

    console.log('═══════════════════════════════════════════════');
    console.log(`   ID: ${campaign.id}`);
    console.log(`   Cliente: ${campaign.cliente}`);
    console.log(`   Número: ${campaign.numero_campana}`);
    console.log(`   Marca: ${campaign.marca}`);
    console.log(`   Zona: ${campaign.zona}`);
    console.log(`   Meta: ${campaign.cantidad_datos_solicitados}`);
    console.log(`   Estado: ${campaign.fecha_fin ? '🔒 Cerrada' : '🔓 Abierta'}`);
    console.log('═══════════════════════════════════════════════\n');

    // 2. Normalizar parámetros de búsqueda
    const normalizedClient = campaign.cliente.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedZone = campaign.zona === 'NACIONAL' ? 'Pais' :
                          (campaign.zona === 'Córdoba' ? 'Cordoba' : campaign.zona);

    console.log('📊 PASO 2: Parámetros de búsqueda normalizados...');
    console.log(`   Cliente normalizado: "${normalizedClient}"`);
    console.log(`   Zona normalizada: "${normalizedZone}"`);
    console.log(`   Marca: "${campaign.marca}"\n`);

    // 3. Leads ya asignados a esta campaña
    console.log('📧 PASO 3: Verificando leads ya asignados...');

    const assignedResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM op_lead
      WHERE campaign_id = ${campaignId}
    `);

    const assignedRows = assignedResult.rows || assignedResult;
    const leadsAsignados = assignedRows[0]?.count || 0;

    console.log(`   ✅ Leads ya asignados: ${leadsAsignados}`);
    console.log(`   📊 Progreso: ${leadsAsignados}/${campaign.cantidad_datos_solicitados} (${((leadsAsignados/campaign.cantidad_datos_solicitados)*100).toFixed(1)}%)\n`);

    // 4. Leads disponibles (únicos)
    console.log('🔍 PASO 4: Contando leads ÚNICOS disponibles...');

    const uniqueAvailableResult = await db.execute<{
      count: number;
      total_duplicates: number;
    }>(sql`
      SELECT
        COUNT(*)::int as count,
        SUM(COALESCE(array_length(duplicate_ids, 1), 1))::int as total_duplicates
      FROM op_leads_rep
      WHERE campaign_id IS NULL
        AND LOWER(marca) LIKE ${`%${campaign.marca.toLowerCase()}%`}
        AND LOWER(cliente) LIKE ${`%${normalizedClient}%`}
        AND LOWER(localizacion) LIKE ${`%${normalizedZone.toLowerCase()}%`}
    `);

    const uniqueRows = uniqueAvailableResult.rows || uniqueAvailableResult;
    const uniqueCount = uniqueRows[0]?.count || 0;
    const totalDuplicates = uniqueRows[0]?.total_duplicates || 0;

    console.log(`   📦 Leads únicos disponibles: ${uniqueCount}`);
    console.log(`   📦 Total con duplicados: ${totalDuplicates}`);
    console.log(`   📊 Promedio duplicados por único: ${uniqueCount > 0 ? (totalDuplicates / uniqueCount).toFixed(1) : '0'}\n`);

    // 5. Total de leads en op_lead para este filtro (incluyendo asignados a otras campañas)
    console.log('🔍 PASO 5: Verificando leads TOTALES en op_lead...');

    const totalLeadsResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM op_lead
      WHERE LOWER(marca) LIKE ${`%${campaign.marca.toLowerCase()}%`}
        AND LOWER(cliente) LIKE ${`%${normalizedClient}%`}
        AND LOWER(localizacion) LIKE ${`%${normalizedZone.toLowerCase()}%`}
    `);

    const totalRows = totalLeadsResult.rows || totalLeadsResult;
    const totalLeads = totalRows[0]?.count || 0;

    console.log(`   📊 Total leads (todos): ${totalLeads}`);

    // 6. Leads asignados a OTRAS campañas
    const otherCampaignsResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM op_lead
      WHERE LOWER(marca) LIKE ${`%${campaign.marca.toLowerCase()}%`}
        AND LOWER(cliente) LIKE ${`%${normalizedClient}%`}
        AND LOWER(localizacion) LIKE ${`%${normalizedZone.toLowerCase()}%`}
        AND campaign_id IS NOT NULL
        AND campaign_id != ${campaignId}
    `);

    const otherRows = otherCampaignsResult.rows || otherCampaignsResult;
    const otherCampaigns = otherRows[0]?.count || 0;

    console.log(`   📊 Asignados a otras campañas: ${otherCampaigns}`);
    console.log(`   📊 Sin asignar (disponibles): ${totalLeads - leadsAsignados - otherCampaigns}\n`);

    // 7. RESUMEN FINAL
    console.log('═══════════════════════════════════════════════');
    console.log('📊 RESUMEN FINAL');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Meta solicitada:              ${String(campaign.cantidad_datos_solicitados).padStart(6)}`);
    console.log(`   Ya asignados (esta campaña):  ${String(leadsAsignados).padStart(6)}`);
    console.log(`   Disponibles (únicos):         ${String(uniqueCount).padStart(6)}`);
    console.log(`   Disponibles (con duplicados): ${String(totalDuplicates).padStart(6)}`);
    console.log(`   Faltantes para meta:          ${String(campaign.cantidad_datos_solicitados - leadsAsignados).padStart(6)}`);
    console.log('═══════════════════════════════════════════════\n');

    // 8. ANÁLISIS
    console.log('💡 ANÁLISIS:');
    console.log('═══════════════════════════════════════════════');

    const faltantes = campaign.cantidad_datos_solicitados - leadsAsignados;
    const disponibles = uniqueCount;

    if (disponibles >= faltantes) {
      console.log(`   ✅ HAY SUFICIENTES LEADS DISPONIBLES`);
      console.log(`   📊 Se pueden asignar ${Math.min(disponibles, faltantes)} leads más`);
      console.log(`   🎯 La campaña puede cerrarse completamente`);

      if (disponibles > faltantes) {
        console.log(`   ℹ️ Sobran ${disponibles - faltantes} leads únicos`);
      }
    } else {
      console.log(`   ⚠️ NO HAY SUFICIENTES LEADS DISPONIBLES`);
      console.log(`   📊 Solo se pueden asignar ${disponibles} de ${faltantes} faltantes`);
      console.log(`   📊 Faltan ${faltantes - disponibles} leads para completar la meta`);
      console.log(`   🔧 La campaña se cerraría con cierre parcial`);

      const cumplimientoFinal = ((leadsAsignados + disponibles) / campaign.cantidad_datos_solicitados) * 100;
      console.log(`   📊 Cumplimiento final esperado: ${cumplimientoFinal.toFixed(1)}%`);
    }

    console.log('═══════════════════════════════════════════════\n');

    // 9. INVESTIGAR DISCREPANCIAS
    if (totalLeads > uniqueCount) {
      const discrepancia = totalLeads - uniqueCount;
      console.log('🔍 INVESTIGACIÓN DE DISCREPANCIAS:');
      console.log('═══════════════════════════════════════════════');
      console.log(`   Total en op_lead: ${totalLeads}`);
      console.log(`   Únicos en op_leads_rep: ${uniqueCount}`);
      console.log(`   Diferencia: ${discrepancia}`);
      console.log('\n   Explicación de la diferencia:');
      console.log(`   - Ya asignados (esta campaña): ${leadsAsignados}`);
      console.log(`   - Asignados a otras campañas: ${otherCampaigns}`);
      console.log(`   - Duplicados filtrados: ~${discrepancia - leadsAsignados - otherCampaigns}`);
      console.log('═══════════════════════════════════════════════\n');
    }

    console.log('🔍 ========================================');
    console.log('🔍 VERIFICACIÓN COMPLETADA');
    console.log('🔍 ========================================\n');

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

checkAvailability();
