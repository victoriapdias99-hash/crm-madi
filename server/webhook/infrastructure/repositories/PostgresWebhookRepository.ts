import { eq, sql, desc } from "drizzle-orm";
import { db } from "../../../db";
import { opLeadWebhook, opLead, leads } from "../../../../shared/schema";
import { IWebhookRepository } from "../../domain/interfaces/IWebhookRepository";
import { WebhookLead } from "../../domain/entities/WebhookLead";

/**
 * Repositorio Unificado:
 * Escribe en 'op_lead' (Para unificar con Sheets)
 * Lee de 'op_lead', 'op_lead_webhook' (Histórico) y 'leads' (Legacy)
 */
export class PostgresWebhookRepository implements IWebhookRepository {
  // ===========================================================================
  // ✅ CREATE: AHORA GUARDA EN LA TABLA PRINCIPAL (op_lead)
  // ===========================================================================
  async create(
    lead: Omit<WebhookLead, "id" | "createdAt" | "updatedAt">,
  ): Promise<WebhookLead> {
    // 1. Generamos un ID estable (simulando la lógica de Google Sheets)
    // Esto previene que si el mismo lead llega por Sheets mañana, se duplique.
    console.log("🔥 EJECUTANDO REPOSITORIO NUEVO - CREATE 🔥");
    const cleanPhone = (lead.telefono || "").toString().replace(/[^\d]/g, "");
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const brandTag = (lead.cliente || "MAKE").toUpperCase().substring(0, 3);

    // ID Ejemplo: 54911223344_FIA_2023-10-27
    const metaLeadId = `${cleanPhone}_${brandTag}_${dateStr}`;

    console.log(`💾 Guardando Lead de Make en op_lead con ID: ${metaLeadId}`);

    // 2. Insertamos en op_lead (La misma tabla que usa el Sync)
    const [savedLead] = await db
      .insert(opLead)
      .values({
        metaLeadId: metaLeadId,
        nombre: lead.nombre,
        telefono: lead.telefono,
        email: null, // Make no suele mandar email en este flujo, o agrégalo si lo tienes

        // Mapeo de campos Make -> Base de Datos
        modelo: lead.auto || "Indefinido", // auto -> modelo
        localizacion: lead.localidad || null, // localidad -> localizacion
        cliente: lead.cliente || "S/D", // ✅ EL CAMPO QUE FALTABA
        marca: lead.cliente || "GENERICO", // Usamos cliente como marca también
        comentarioHorario: lead.comentarios || null,

        origen: "webhook",
        source: "make", // Para identificarlo en el dashboard
        campaign: "Make Integration",

        fechaCreacion: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      // Si ya existe (Upsert), actualizamos los datos clave
      .onConflictDoUpdate({
        target: opLead.metaLeadId,
        set: {
          nombre: lead.nombre,
          cliente: lead.cliente, // Actualizamos cliente si cambió
          updatedAt: new Date(),
        },
      })
      .returning();

    // 3. Convertimos el resultado al formato que espera el Caso de Uso
    return this.mapToEntityFromSheet(savedLead);
  }

  // --- FIND BY ID: Busca en orden de prioridad ---
  async findById(id: number): Promise<WebhookLead | null> {
    // 1. Si el ID es positivo pequeño, busca en Webhooks (Legacy)
    if (id > 0) {
      const [webhookLead] = await db
        .select()
        .from(opLeadWebhook)
        .where(eq(opLeadWebhook.id, id))
        .limit(1);
      if (webhookLead) return this.mapToEntity(webhookLead);

      // 1.1 Si no está en Webhooks, buscamos en la tabla LEADS Legacy
      const [legacyLead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, id))
        .limit(1);
      if (legacyLead) return this.mapToEntityFromLeads(legacyLead);
    }

    // 2. Si es negativo (o estrategia de ID Sheets), busca en Sheets/Unified
    const searchId = Math.abs(id);
    const [sheetLead] = await db
      .select()
      .from(opLead)
      .where(eq(opLead.id, searchId))
      .limit(1);

    if (sheetLead) return this.mapToEntityFromSheet(sheetLead);

    return null;
  }

  // --- FIND ALL: La Unión de los TRES Mundos ---
  async findAll(options?: {
    limit?: number;
    offset?: number;
    source?: string;
  }): Promise<WebhookLead[]> {
    // 1. Preparamos consulta a Webhooks (Legacy)
    let queryWebhooks = db.select().from(opLeadWebhook).$dynamic();

    // 2. Preparamos consulta a Google Sheets / Unificado (opLead)
    let querySheets = db.select().from(opLead).$dynamic();

    // 3. Preparamos consulta a Leads (Legacy General)
    let queryLeads = db.select().from(leads).$dynamic();

    // Filtros por Source
    if (options?.source) {
      queryWebhooks = queryWebhooks.where(
        eq(opLeadWebhook.source, options.source),
      );
      querySheets = querySheets.where(eq(opLead.source, options.source));
      // queryLeads = queryLeads.where(eq(leads.source, options.source)); // Descomentar si leads tiene source
    }

    // Ejecutamos las 3 consultas simultáneamente
    const [webhooksResults, sheetsResults, leadsResults] = await Promise.all([
      queryWebhooks,
      querySheets,
      queryLeads,
    ]);
    console.log("🔍 Ejemplo de lead de Sheets:", sheetsResults[0]);
    console.log(
      "🔍 Propiedades disponibles:",
      Object.keys(sheetsResults[0] || {}),
    );

    // Combinamos los arrays
    const allLeadsRaw = [...webhooksResults, ...sheetsResults, ...leadsResults];

    // Ordenamos por fecha (más reciente arriba)
    allLeadsRaw.sort((a: any, b: any) => {
      const dateA = new Date(
        a.createdAt || a.fechaCreacion || a.created_at || 0,
      ).getTime();
      const dateB = new Date(
        b.createdAt || b.fechaCreacion || b.created_at || 0,
      ).getTime();
      return dateB - dateA;
    });

    // Mapeamos cada resultado
    return allLeadsRaw.map((raw: any) => {
      // A. Es de Google Sheets / Unificado?
      if (
        raw.source === "google_sheets" ||
        raw.source === "make" ||
        raw.metaLeadId !== undefined
      ) {
        return this.mapToEntityFromSheet(raw);
      }
      // B. Es de la tabla Leads Legacy?
      if (raw.created_at !== undefined && raw.fechaCreacion === undefined) {
        return this.mapToEntityFromLeads(raw);
      }
      // C. Por defecto, Webhook Legacy
      return this.mapToEntity(raw);
    });
  }

  // ✅ COUNT ACTUALIZADO PARA 3 TABLAS
  async countBySource(source?: string): Promise<number> {
    const q1 = db.select({ count: sql<number>`count(*)` }).from(opLeadWebhook);
    const q2 = db.select({ count: sql<number>`count(*)` }).from(opLead);
    const q3 = db.select({ count: sql<number>`count(*)` }).from(leads);

    if (source) {
      q1.where(eq(opLeadWebhook.source, source));
      q2.where(eq(opLead.source, source));
      // q3.where(eq(leads.source, source));
    }

    const [res1, res2, res3] = await Promise.all([q1, q2, q3]);
    return (
      Number(res1[0].count) + Number(res2[0].count) + Number(res3[0].count)
    );
  }

  // --- MAPEOS (TRADUCTORES) ---

  // 1. Webhooks (Legacy Table)
  private mapToEntity(data: any): WebhookLead {
    return new WebhookLead(
      data.id,
      data.nombre,
      data.telefono,
      data.auto,
      data.localidad,
      data.cliente,
      data.comentarios,
      data.source,
      data.createdAt,
      data.updatedAt,
    );
  }

  // 2. Google Sheets / Unificado (opLead Table)
  private mapToEntityFromSheet(data: any): WebhookLead {
    return new WebhookLead(
      // Usamos ID negativo para diferenciarlos visualmente en logs si quieres, o positivo
      data.id,
      data.nombre,
      data.telefono,
      data.modelo, // Mapeo BD -> Entidad
      data.localizacion, // Mapeo BD -> Entidad
      data.cliente,
      data.comentarioHorario,
      data.source || "google_sheets",
      data.createdAt,
      data.updatedAt,
      data.fechaCreacion,
    );
  }

  // 3. Leads Legacy
  private mapToEntityFromLeads(data: any): WebhookLead {
    return new WebhookLead(
      data.id,
      data.nombre,
      data.telefono,
      data.auto || data.modelo,
      data.localidad || data.ciudad,
      data.cliente,
      data.comentarios || data.comentario,
      data.source || "legacy_leads",
      data.createdAt || data.created_at,
      data.updatedAt || data.updated_at,
    );
  }
}
