/**
 * SMART-FAST Migration System
 *
 * Migración simplificada con ID estable basado en teléfono + fecha + marca
 * - Solo ~200 líneas vs ~1,700 del sistema anterior
 * - ID estable aunque las filas cambien de posición
 * - UPSERT automático: inserta nuevos, actualiza existentes
 * - Preserva metaLeadId en actualizaciones
 */

import "dotenv/config";
import { db } from "../db";
import { opLead } from "../../shared/schema";
import { google } from "googleapis";
import { sql, and, eq, like } from "drizzle-orm";
import {
  generateStableMetaLeadId,
  parseSheetDate,
  getBaseMetaLeadId,
} from "./utils/generate-stable-id";
import { normalizeClientName } from "../../shared/utils/client-normalization";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const EXCLUDED_SHEETS = [
  //"Datos Diarios",
  "Control Campañas",
  //"datos diarios",
  "control campañas",
];

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
  source: "google_sheets";
}

export async function migrateSmartFast(): Promise<MigrationStats> {
  console.log("🚀 SMART-FAST Migration System");
  console.log("📋 ID Estable: teléfono + fecha + marca\n");

  if (!SPREADSHEET_ID) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID no configurado en .env");
  }

  const stats: MigrationStats = {
    totalProcessed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // 1. Configurar Google Sheets API
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_SHEETS_API_KEY no configurado en .env");
  }

  // 🔍 Verificar conexión (sin mostrar credenciales completas)
  console.log("🔑 Conexión a Google Sheets: ✅");
  console.log(`📋 Spreadsheet: ${SPREADSHEET_ID.substring(0, 12)}...***\n`);

  const sheets = google.sheets({
    version: "v4",
    auth: apiKey,
  });

  // 2. Obtener lista de pestañas
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const sheetNames = (spreadsheet.data.sheets
    ?.map((s) => s.properties?.title)
    .filter(
      (name): name is string =>
        !!name &&
        !EXCLUDED_SHEETS.some((excluded) =>
          name.toLowerCase().includes(excluded.toLowerCase()),
        ),
    ) || []) as string[];

  console.log(`📋 Marcas encontradas: ${sheetNames.join(", ")}\n`);

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
        range: `${sheetName}!A2:I`,
      });

      const rows = response.data.values || [];
      console.log(`   📊 ${rows.length} filas encontradas`);

      if (rows.length === 0) {
        console.log(`   ⏭️  Sin datos, omitiendo\n`);
        continue;
      }

      // 📦 BATCH PROCESSING: Preparar todos los datos con detección de duplicados
      const batchData: Array<{
        metaLeadId: string;
        leadData: LeadData;
        createdAt: Date;
        updatedAt: Date;
      }> = [];

      // Mapa para rastrear duplicados dentro del mismo batch de Sheets
      const duplicateTracker = new Map<string, number>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Validar que tenga al menos teléfono
        const telefono = row[2]?.toString().trim();
        if (!telefono || telefono === "") {
          stats.skipped++;
          continue;
        }

        const fechaCreacion = parseSheetDate(row[0]);
        const marca = sheetName.toUpperCase();
        const rowNumber = i + 2; // +2 porque: header=1, index empieza en 0

        // Construir datos del lead
        const leadData: LeadData = {
          nombre: row[1]?.toString().trim() || "S/D",
          telefono,
          email: null, // Email no existe en Google Sheets
          ciudad: row[3]?.toString().trim() || null,
          modelo: row[4]?.toString().trim() || null,
          comentarioHorario: row[5]?.toString().trim() || null,
          origen: row[6]?.toString().trim() || null,
          localizacion: row[7]?.toString().trim() || null,
          cliente: normalizeClientName(row[8]), // ✅ Normalización centralizada
          marca,
          campaign: sheetName,
          googleSheetsRowNumber: rowNumber,
          fechaCreacion,
          source: "google_sheets",
        };

        // Generar ID base (sin índice de duplicado)
        const baseId = generateStableMetaLeadId(
          telefono,
          fechaCreacion,
          marca,
          0,
        );

        // Verificar si ya existe en el batch actual
        const currentCount = duplicateTracker.get(baseId) || 0;
        duplicateTracker.set(baseId, currentCount + 1);

        // Generar ID final con índice de duplicado si es necesario
        const finalMetaLeadId = generateStableMetaLeadId(
          telefono,
          fechaCreacion,
          marca,
          currentCount,
        );

        const now = new Date();
        batchData.push({
          metaLeadId: finalMetaLeadId,
          leadData,
          createdAt: fechaCreacion,
          updatedAt: now,
        });
      }

      // 🚀 UPSERT EN LOTES usando ON CONFLICT nativo de PostgreSQL
      const BATCH_SIZE = 50;
      let totalBatchesProcessed = 0;
      let batchInserted = 0;
      let batchUpdated = 0;

      for (let i = 0; i < batchData.length; i += BATCH_SIZE) {
        const batch = batchData.slice(i, i + BATCH_SIZE);

        try {
          // Preparar valores para upsert batch
          const batchValues = batch.map((item) => ({
            metaLeadId: item.metaLeadId,
            ...item.leadData,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }));

          // UPSERT batch usando ON CONFLICT DO UPDATE
          // Usamos metaLeadId como criterio - permite múltiples leads con mismo teléfono+marca
          // El metaLeadId incluye teléfono+fecha+marca, así cada lead de distinta fecha es único
          await db
            .insert(opLead)
            .values(batchValues)
            .onConflictDoUpdate({
              target: opLead.metaLeadId,
              set: {
                nombre: sql`EXCLUDED.nombre`,
                telefono: sql`EXCLUDED.telefono`,
                email: sql`EXCLUDED.email`,
                ciudad: sql`EXCLUDED.ciudad`,
                modelo: sql`EXCLUDED.modelo`,
                comentarioHorario: sql`EXCLUDED.comentario_horario`,
                origen: sql`EXCLUDED.origen`,
                localizacion: sql`EXCLUDED.localizacion`,
                cliente: sql`EXCLUDED.cliente`,
                marca: sql`EXCLUDED.marca`,
                campaign: sql`EXCLUDED.campaign`,
                googleSheetsRowNumber: sql`EXCLUDED.google_sheets_row_number`,
                fechaCreacion: sql`EXCLUDED.fecha_creacion`,
                updatedAt: sql`EXCLUDED.updated_at`,
              },
            });

          // Asumimos que son inserts (primera ejecución) o updates (re-ejecución)
          marcaInserted += batch.length;
          stats.inserted += batch.length;
          stats.totalProcessed += batch.length;
          totalBatchesProcessed++;

          // Mostrar progreso cada batch
          const progress = Math.min(i + BATCH_SIZE, batchData.length);
          const percentage = ((progress / batchData.length) * 100).toFixed(1);
          console.log(
            `   ⏳ Progreso: ${progress}/${batchData.length} (${percentage}%)`,
          );
        } catch (error: any) {
          console.error(
            `   ❌ Error en batch ${totalBatchesProcessed + 1}:`,
            error.message,
          );
          stats.errors += batch.length;
        }
      }

      stats.details.push({
        marca: sheetName,
        processed: rows.length,
        inserted: marcaInserted,
        updated: marcaUpdated,
        rowMoved: marcaRowMoved,
      });

      console.log(
        `   ✅ Insertados: ${marcaInserted} | Actualizados: ${marcaUpdated} | Movidos: ${marcaRowMoved}\n`,
      );

      // Rate limiting: 1 segundo entre marcas
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`   ❌ Error procesando ${sheetName}:`, error.message);
      stats.errors++;
    }
  }

  // Refrescar tabla op_leads_rep (leads consolidados para conteo de campañas)
  console.log("\n🔄 Refrescando tabla op_leads_rep (leads consolidados)...");
  try {
    await db.execute(sql`TRUNCATE TABLE op_leads_rep RESTART IDENTITY`);
    await db.execute(sql`
      INSERT INTO op_leads_rep (
        meta_lead_id, nombre, telefono, email, ciudad, modelo, comentario_horario,
        origen, localizacion, cliente, marca, campaign, campaign_id, 
        google_sheets_row_number, source, fecha_creacion, created_at, updated_at,
        cantidad_duplicados, duplicate_ids
      )
      SELECT 
        (array_agg(meta_lead_id ORDER BY fecha_creacion DESC))[1],
        (array_agg(nombre ORDER BY fecha_creacion DESC))[1],
        telefono,
        (array_agg(email ORDER BY fecha_creacion DESC))[1],
        (array_agg(ciudad ORDER BY fecha_creacion DESC))[1],
        (array_agg(modelo ORDER BY fecha_creacion DESC))[1],
        (array_agg(comentario_horario ORDER BY fecha_creacion DESC))[1],
        (array_agg(origen ORDER BY fecha_creacion DESC))[1],
        (array_agg(localizacion ORDER BY fecha_creacion DESC))[1],
        (array_agg(cliente ORDER BY fecha_creacion DESC))[1],
        marca,
        (array_agg(campaign ORDER BY fecha_creacion DESC))[1],
        (array_agg(campaign_id ORDER BY fecha_creacion DESC))[1],
        (array_agg(google_sheets_row_number ORDER BY fecha_creacion DESC))[1],
        'google_sheets',
        MIN(fecha_creacion),
        MIN(created_at),
        MAX(updated_at),
        COUNT(*),
        array_agg(id ORDER BY fecha_creacion ASC)
      FROM op_lead
      GROUP BY telefono, marca
    `);
    const repResult = await db.execute(sql`SELECT COUNT(*) as count FROM op_leads_rep`);
    const repCount = (repResult as any).rows?.[0]?.count ?? (repResult as any)[0]?.count ?? '?';
    console.log(`✅ op_leads_rep refrescada: ${repCount} leads únicos`);
  } catch (error: any) {
    console.error(`❌ Error refrescando op_leads_rep:`, error.message);
  }

  return stats;
}

// Función principal para ejecutar migración
async function main() {
  try {
    const stats = await migrateSmartFast();

    console.log("\n" + "=".repeat(70));
    console.log("🎉 MIGRACIÓN SMART-FAST COMPLETADA");
    console.log("=".repeat(70));
    console.log(`📊 Total procesado:     ${stats.totalProcessed}`);
    console.log(`✅ Nuevos insertados:   ${stats.inserted}`);
    console.log(`🔄 Actualizados:        ${stats.updated}`);
    console.log(`⏭️  Omitidos (sin tel): ${stats.skipped}`);
    console.log(`❌ Errores:             ${stats.errors}`);
    console.log("=".repeat(70));

    if (stats.details.length > 0) {
      console.log("\n📋 DETALLE POR MARCA:");
      console.log("-".repeat(70));
      stats.details.forEach((detail) => {
        const moved =
          detail.rowMoved > 0 ? ` (${detail.rowMoved} movidos)` : "";
        console.log(
          `   ${detail.marca.padEnd(20)} → ` +
            `${detail.inserted} nuevos, ${detail.updated} actualizados${moved}`,
        );
      });
      console.log("-".repeat(70));
    }

    console.log("\n✅ Migración exitosa - IDs estables preservados\n");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ ERROR FATAL:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar migración SOLO si se ejecuta directamente (no como import)
// Comentado para evitar ejecución automática al importar
// main();
