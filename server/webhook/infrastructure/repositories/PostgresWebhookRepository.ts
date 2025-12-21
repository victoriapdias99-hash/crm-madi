import { eq, sql } from "drizzle-orm";
import { db } from "../../../db";
import { opLeadWebhook } from "../../../../shared/schema";
import { IWebhookRepository } from "../../domain/interfaces/IWebhookRepository";
import { WebhookLead } from "../../domain/entities/WebhookLead";

/**
 * Implementación del repositorio de webhooks usando PostgreSQL
 */
export class PostgresWebhookRepository implements IWebhookRepository {
  async create(
    lead: Omit<WebhookLead, "id" | "createdAt" | "updatedAt">,
  ): Promise<WebhookLead> {
    const [newLead] = await db
      .insert(opLeadWebhook)
      .values({
        nombre: lead.nombre,
        telefono: lead.telefono,
        auto: lead.auto || null,
        localidad: lead.localidad || null,
        comentarios: lead.comentarios || null,
        source: lead.source,
      })
      .returning();

    return new WebhookLead(
      newLead.id,
      newLead.nombre,
      newLead.telefono,
      newLead.auto,
      newLead.localidad,
      newLead.comentarios,
      newLead.source,
      newLead.createdAt,
      newLead.updatedAt,
    );
  }

  async findById(id: number): Promise<WebhookLead | null> {
    const [lead] = await db
      .select()
      .from(opLeadWebhook)
      .where(eq(opLeadWebhook.id, id))
      .limit(1);

    if (!lead) return null;

    return new WebhookLead(
      lead.id,
      lead.nombre,
      lead.telefono,
      lead.auto,
      lead.localidad,
      lead.comentarios,
      lead.source,
      lead.createdAt,
      lead.updatedAt,
    );
  }

  async findAll(options?: {
    limit?: number;
    offset?: number;
    source?: string;
  }): Promise<WebhookLead[]> {
    let query = db.select().from(opLeadWebhook);

    if (options?.source) {
      query = query.where(eq(opLeadWebhook.source, options.source)) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    const leads = await query;

    return leads.map(
      (lead) =>
        new WebhookLead(
          lead.id,
          lead.nombre,
          lead.telefono,
          lead.auto,
          lead.localidad,
          lead.comentarios,
          lead.source,
          lead.createdAt,
          lead.updatedAt,
        ),
    );
  }

  async countBySource(source?: string): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(opLeadWebhook);

    if (source) {
      query = query.where(eq(opLeadWebhook.source, source)) as any;
    }

    const [result] = await query;
    return Number(result.count);
  }
}
