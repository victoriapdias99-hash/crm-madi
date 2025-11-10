/**
 * Test de debugging para encontrar la discrepancia en Giorgi Automotores #1
 * El frontend muestra 44 leads pero el endpoint devuelve 0
 */

import { db } from './server/db';
import { campanasComerciales, clientes, opLeadsRep } from './shared/schema';
import { eq, and, sql, gte, lte, count, or } from 'drizzle-orm';
import { normalizeClientName } from './shared/utils/client-normalization';
import {
  extractBrandsFromCampaign,
  createMultiBrandCondition,
  mapZonaToLocalizacion,
  getMultiBrandDebugInfo
} from './server/shared/campaign-filters';

async function debugGiorgiCampaign() {
  console.log('🔍 ===== DEBUG GIORGI AUTOMOTORES #1 =====\n');

  try {
    // 1. Buscar la campaña
    const campanasGiorgi = await db
      .select({
        id: campanasComerciales.id,
        numeroCampana: campanasComerciales.numeroCampana,
        marca: campanasComerciales.marca,
        marca2: campanasComerciales.marca2,
        marca3: campanasComerciales.marca3,
        marca4: campanasComerciales.marca4,
        marca5: campanasComerciales.marca5,
        zona: campanasComerciales.zona,
        fechaCampana: campanasComerciales.fechaCampana,
        fechaFin: campanasComerciales.fechaFin,
        cantidadDatosSolicitados: campanasComerciales.cantidadDatosSolicitados,
        asignacionAutomatica: campanasComerciales.asignacionAutomatica,
        clienteId: campanasComerciales.clienteId,
      })
      .from(campanasComerciales)
      .leftJoin(clientes, eq(clientes.id, campanasComerciales.clienteId))
      .where(
        and(
          sql`${clientes.nombreComercial} ILIKE '%giorgi%'`,
          eq(campanasComerciales.numeroCampana, '1')
        )
      )
      .limit(1);

    const campana = campanasGiorgi[0];
    console.log(`✅ Campaña ID: ${campana.id}`);
    console.log(`   Marca: ${campana.marca}`);
    console.log(`   Zona: ${campana.zona}`);
    console.log(`   Fecha inicio: ${campana.fechaCampana}`);
    console.log(`   Fecha fin: ${campana.fechaFin || 'EN PROCESO'}\n`);

    // 2. Cliente
    const clienteData = await db
      .select({
        id: clientes.id,
        nombreCliente: clientes.nombreCliente,
        nombreComercial: clientes.nombreComercial,
      })
      .from(clientes)
      .where(eq(clientes.id, campana.clienteId!))
      .limit(1);

    const cliente = clienteData[0];
    const nombreComercialNormalizado = normalizeClientName(cliente.nombreComercial || '');

    console.log(`Cliente original: "${cliente.nombreComercial}"`);
    console.log(`Cliente normalizado: "${nombreComercialNormalizado}"\n`);

    // 3. Configuración de filtros
    const localizacionFiltro = mapZonaToLocalizacion(campana.zona);
    const brands = extractBrandsFromCampaign(campana, campana.asignacionAutomatica);

    console.log(`Zona original: ${campana.zona}`);
    console.log(`Localización filtro: ${localizacionFiltro}`);
    console.log(`Marcas: ${brands.join(', ')}\n`);

    // 4. PRUEBA 1: Buscar leads SIN filtros restrictivos
    console.log('📊 PRUEBA 1: Buscar leads con marca "Ford" y cliente "giorgi automotores"');

    const test1 = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`LOWER(${opLeadsRep.cliente}) = 'giorgi automotores'`
        )
      );

    console.log(`   Resultado: ${test1[0]?.count || 0} leads\n`);

    // 5. PRUEBA 2: Agregar filtro de localización
    console.log('📊 PRUEBA 2: Agregar filtro de localización');

    const test2 = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`LOWER(${opLeadsRep.cliente}) = 'giorgi automotores'`,
          eq(opLeadsRep.localizacion, localizacionFiltro)
        )
      );

    console.log(`   Resultado: ${test2[0]?.count || 0} leads\n`);

    // 6. PRUEBA 3: Agregar filtro de source
    console.log('📊 PRUEBA 3: Agregar filtro de source = google_sheets');

    const test3 = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`LOWER(${opLeadsRep.cliente}) = 'giorgi automotores'`,
          eq(opLeadsRep.localizacion, localizacionFiltro),
          eq(opLeadsRep.source, 'google_sheets')
        )
      );

    console.log(`   Resultado: ${test3[0]?.count || 0} leads\n`);

    // 7. PRUEBA 4: Agregar filtro de campaign_id
    console.log('📊 PRUEBA 4: Agregar filtro (campaign_id IS NULL OR campaign_id = 38)');

    const test4 = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`LOWER(${opLeadsRep.cliente}) = 'giorgi automotores'`,
          eq(opLeadsRep.localizacion, localizacionFiltro),
          eq(opLeadsRep.source, 'google_sheets'),
          sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`
        )
      );

    console.log(`   Resultado: ${test4[0]?.count || 0} leads\n`);

    // 8. PRUEBA 5: Agregar filtro de fecha inicio
    console.log('📊 PRUEBA 5: Agregar filtro de fecha >= 2025-08-16');

    const test5 = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`LOWER(${opLeadsRep.cliente}) = 'giorgi automotores'`,
          eq(opLeadsRep.localizacion, localizacionFiltro),
          eq(opLeadsRep.source, 'google_sheets'),
          sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`,
          gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
        )
      );

    console.log(`   Resultado: ${test5[0]?.count || 0} leads\n`);

    // 9. Ver qué valores únicos existen en la BD
    console.log('📊 ANÁLISIS: Valores únicos en op_leads_rep para Ford + Giorgi\n');

    const valoresUnicos = await db
      .select({
        cliente: opLeadsRep.cliente,
        campaign: opLeadsRep.campaign,
        localizacion: opLeadsRep.localizacion,
        source: opLeadsRep.source,
        count: count()
      })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`${opLeadsRep.cliente} ILIKE '%giorgi%'`
        )
      )
      .groupBy(opLeadsRep.cliente, opLeadsRep.campaign, opLeadsRep.localizacion, opLeadsRep.source);

    console.log('Valores únicos encontrados:');
    valoresUnicos.forEach(v => {
      console.log(`   Cliente: "${v.cliente}" | Campaign: "${v.campaign}" | Loc: "${v.localizacion}" | Source: "${v.source}" | Count: ${v.count}`);
    });
    console.log('');

    // 10. Verificar si el problema está en la normalización del cliente
    console.log('📊 PRUEBA 6: Buscar con ILIKE en lugar de comparación exacta\n');

    const test6 = await db
      .select({ count: count() })
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`${opLeadsRep.cliente} ILIKE '%giorgi%'`,
          eq(opLeadsRep.localizacion, localizacionFiltro),
          eq(opLeadsRep.source, 'google_sheets'),
          sql`(${opLeadsRep.campaignId} IS NULL OR ${opLeadsRep.campaignId} = ${campana.id})`,
          gte(sql`date(${opLeadsRep.fechaCreacion})`, campana.fechaCampana)
        )
      );

    console.log(`   Resultado con ILIKE: ${test6[0]?.count || 0} leads\n`);

    // 11. Muestra de los primeros 5 leads encontrados
    const sampleLeads = await db
      .select()
      .from(opLeadsRep)
      .where(
        and(
          eq(opLeadsRep.campaign, 'Ford'),
          sql`${opLeadsRep.cliente} ILIKE '%giorgi%'`
        )
      )
      .limit(5);

    if (sampleLeads.length > 0) {
      console.log('📋 MUESTRA DE LEADS:\n');
      sampleLeads.forEach((lead, idx) => {
        console.log(`   ${idx + 1}. Cliente: "${lead.cliente}"`);
        console.log(`      Campaign: "${lead.campaign}"`);
        console.log(`      Localización: "${lead.localizacion}"`);
        console.log(`      Source: "${lead.source}"`);
        console.log(`      Campaign ID: ${lead.campaignId}`);
        console.log(`      Fecha: ${lead.fechaCreacion}`);
        console.log('');
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugGiorgiCampaign()
  .then(() => {
    console.log('✅ Debug completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Debug falló:', error);
    process.exit(1);
  });
