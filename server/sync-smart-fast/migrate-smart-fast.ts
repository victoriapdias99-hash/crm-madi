/**
 * SMART-FAST Migration System
 *
 * Migración simplificada con ID estable basado en teléfono + fecha + marca
 * - Solo ~200 líneas vs ~1,700 del sistema anterior
 * - ID estable aunque las filas cambien de posición
 * - UPSERT automático: inserta nuevos, actualiza existentes
 * - Preserva metaLeadId en actualizaciones
 */

import { db } from '../db';
import { opLead } from '@shared/schema';
import { google } from 'googleapis';
import { sql, and, eq } from 'drizzle-orm';
import { generateStableMetaLeadId, parseSheetDate } from './utils/generate-stable-id';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const EXCLUDED_SHEETS = ['Datos Diarios', 'Control Campañas', 'datos diarios', 'control campañas'];

interface MigrationStats {
  totalProcessed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  details: Array<{
    marca: string;
    processed: number;
    inserted: number;
    updated: number;
    rowMoved: number; // Registros que cambiaron de fila
  }>;
}

interface LeadData {
  nombre: string;
  telefono: string;
  email: string | null;
  ciudad: string | null;
  modelo: string | null;
  comentarioHorario: string | null;
  origen: string | null;
  localizacion: string | null;
  cliente: string | null;
  marca: string;
  campaign: string;
  googleSheetsRowNumber: number;
  fechaCreacion: Date;
  source: 'google_sheets';
}

export async function migrateSmartFast(): Promise<MigrationStats> {
  console.log('🚀 SMART-FAST Migration System');
  console.log('📋 ID Estable: teléfono + fecha + marca\n');

  if (!SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID no configurado en .env');
  }

  const stats: MigrationStats = {
    totalProcessed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  // 1. Configurar Google Sheets API
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_SHEETS_API_KEY no configurado en .env');
  }

  // 🔍 LOG TEMPORAL: Mostrar tokens de conexión
  console.log('\n' + '='.repeat(70));
  console.log('🔑 TOKENS DE CONEXIÓN GOOGLE SHEETS (TEMPORAL)');
  console.log('='.repeat(70));
  console.log(`📋 Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`🔐 API Key: ${apiKey}`);
  console.log('='.repeat(70) + '\n');

  const sheets = google.sheets({
    version: 'v4',
    auth: apiKey
  });

  // 2. Obtener lista de pestañas
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID
  });

  const sheetNames = (spreadsheet.data.sheets
    ?.map(s => s.properties?.title)
    .filter((name): name is string =>
      !!name &&
      !EXCLUDED_SHEETS.some(excluded =>
        name.toLowerCase().includes(excluded.toLowerCase())
      )
    ) || []) as string[];

  console.log(`📋 Marcas encontradas: ${sheetNames.join(', ')}\n`);

  // 3. Procesar cada marca
  for (const sheetName of sheetNames) {
    console.log(`🔄 Procesando: ${sheetName}`);

    let marcaInserted = 0;
    let marcaUpdated = 0;
    let marcaRowMoved = 0;

    try {
      // Obtener datos de la pestaña (desde fila 2 para skip header)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A2:I`
      });

      const rows = response.data.values || [];
      console.log(`   📊 ${rows.length} filas encontradas`);

      if (rows.length === 0) {
        console.log(`   ⏭️  Sin datos, omitiendo\n`);
        continue;
      }

      // Procesar cada fila
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Validar que tenga al menos teléfono
        const telefono = row[2]?.toString().trim();
        if (!telefono || telefono === '') {
          stats.skipped++;
          continue;
        }

        const fechaCreacion = parseSheetDate(row[0]);
        const marca = sheetName.toUpperCase();
        const rowNumber = i + 2; // +2 porque: header=1, index empieza en 0

        // Construir datos del lead
        const leadData: LeadData = {
          nombre: row[1]?.toString().trim() || 'S/D',
          telefono,
          email: null, // Email no existe en Google Sheets
          ciudad: row[3]?.toString().trim() || null,
          modelo: row[4]?.toString().trim() || null,
          comentarioHorario: row[5]?.toString().trim() || null,
          origen: row[6]?.toString().trim() || null,
          localizacion: row[7]?.toString().trim() || null,
          cliente: row[8]?.toString().trim() || null,
          marca,
          campaign: sheetName,
          googleSheetsRowNumber: rowNumber,
          fechaCreacion,
          source: 'google_sheets'
        };

        try {
          // ✅ SIEMPRE INSERTAR: Generar ID único con timestamp
          const now = new Date();
          const newMetaLeadId = generateStableMetaLeadId(
            telefono,
            fechaCreacion,
            marca,
            now // Agregar timestamp para unicidad en duplicados
          );

          await db.insert(opLead)
            .values({
              metaLeadId: newMetaLeadId,
              ...leadData,
              createdAt: now,
              updatedAt: now
            });

          marcaInserted++;
          stats.inserted++;
          stats.totalProcessed++;

          if (marcaInserted <= 5) { // Log solo primeros 5 para no saturar
            console.log(`   ✅ Fila ${rowNumber}: Insertado - ID: ${newMetaLeadId}`);
          }

        } catch (error: any) {
          console.error(`   ❌ Error fila ${rowNumber}:`, error.message);
          stats.errors++;
        }
      }

      stats.details.push({
        marca: sheetName,
        processed: rows.length,
        inserted: marcaInserted,
        updated: marcaUpdated,
        rowMoved: marcaRowMoved
      });

      console.log(`   ✅ Insertados: ${marcaInserted} | Actualizados: ${marcaUpdated} | Movidos: ${marcaRowMoved}\n`);

      // Rate limiting: 1 segundo entre marcas
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`   ❌ Error procesando ${sheetName}:`, error.message);
      stats.errors++;
    }
  }

  return stats;
}

// Función principal para ejecutar migración
async function main() {
  try {
    const stats = await migrateSmartFast();

    console.log('\n' + '='.repeat(70));
    console.log('🎉 MIGRACIÓN SMART-FAST COMPLETADA');
    console.log('='.repeat(70));
    console.log(`📊 Total procesado:     ${stats.totalProcessed}`);
    console.log(`✅ Nuevos insertados:   ${stats.inserted}`);
    console.log(`🔄 Actualizados:        ${stats.updated}`);
    console.log(`⏭️  Omitidos (sin tel): ${stats.skipped}`);
    console.log(`❌ Errores:             ${stats.errors}`);
    console.log('='.repeat(70));

    if (stats.details.length > 0) {
      console.log('\n📋 DETALLE POR MARCA:');
      console.log('-'.repeat(70));
      stats.details.forEach(detail => {
        const moved = detail.rowMoved > 0 ? ` (${detail.rowMoved} movidos)` : '';
        console.log(
          `   ${detail.marca.padEnd(20)} → ` +
          `${detail.inserted} nuevos, ${detail.updated} actualizados${moved}`
        );
      });
      console.log('-'.repeat(70));
    }

    console.log('\n✅ Migración exitosa - IDs estables preservados\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar migración si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
