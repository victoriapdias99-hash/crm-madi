import { Request, Response } from "express";
import { CreateWebhookLeadUseCase } from "../../application/usecases/CreateWebhookLeadUseCase";
import { CreateWebhookLeadDto } from "../../application/dto/WebhookLeadDto";
import { ZodError } from "zod";
import { pool } from "../../../db";
import { normalizeClientName } from "../../../../shared/utils/client-normalization";

/**
 * Controlador para endpoints de webhook
 */
export class WebhookController {
  // Modificamos el constructor para recibir también el repositorio
  // Usamos 'any' temporalmente para evitar conflictos de tipos rápidos
  constructor(
    private readonly createLeadUseCase: CreateWebhookLeadUseCase,
    private readonly repository: any,
  ) {}

  /**
   * POST /api/webhook/lead-webhook
   * Recibe un lead desde un webhook externo (Make, Postman, etc.)
   */
  async createLead(req: Request, res: Response): Promise<void> {
    try {
      console.log(
        "🔍 INSPECCIÓN DE JSON ENTRANTE:",
        JSON.stringify(req.body, null, 2),
      );

      // =================================================================
      // 1. NORMALIZACIÓN DE DATOS (El "Puente" para Make)
      // =================================================================
      const rawBody = req.body;

      // Aquí hacemos la "traducción" de campos para que no se pierdan
      const normalizedBody = {
        ...rawBody,

        // Si Make manda 'cliente', 'client' o 'nombreCliente', lo guardamos en 'cliente'
        cliente:
          rawBody.cliente || rawBody.client || rawBody.nombreCliente || "S/D",

        // Aseguramos que el teléfono sea string
        telefono: rawBody.telefono
          ? String(rawBody.telefono)
          : rawBody.phone
            ? String(rawBody.phone)
            : undefined,

        // Mapeo de modelo/auto
        auto: rawBody.auto || rawBody.modelo || rawBody.adName || "Desconocido",
      };

      console.log(
        "🛠️ Datos Normalizados:",
        JSON.stringify(normalizedBody, null, 2),
      );

      // =================================================================
      // 2. VALIDACIÓN CON ZOD
      // =================================================================
      // Ahora pasamos 'normalizedBody' en lugar de 'req.body'
      const validatedData = CreateWebhookLeadDto.parse(normalizedBody);

      // 3. Ejecutar caso de uso
      const newLead = await this.createLeadUseCase.execute(validatedData);

      console.log("✅ Lead webhook guardado con ID:", newLead.id);

      res.status(201).json({
        success: true,
        message: "Lead guardado exitosamente",
        leadId: newLead.id,
        data: {
          id: newLead.id,
          nombre: newLead.nombre,
          telefono: newLead.telefono,
          auto: newLead.auto,
          localidad: newLead.localidad,
          cliente: newLead.cliente, // ¡Ahora esto debería salir lleno!
          comentarios: newLead.comentarios,
          source: newLead.source,
          createdAt: newLead.createdAt,
          updatedAt: newLead.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error en webhook lead-webhook:", error);

      if (error instanceof ZodError) {
        // Log para ver qué campo exacto falló
        console.error(
          "🔍 Detalles de validación:",
          JSON.stringify(error.errors, null, 2),
        );

        res.status(400).json({
          success: false,
          error: "Datos inválidos según el esquema DTO",
          details: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Error interno procesando webhook",
        message: error.message,
      });
    }
  }

  /**
   * GET /api/webhook/leads
   * Obtiene todos los leads de webhook
   */
  async getLeads(req: Request, res: Response): Promise<void> {
    try {
      console.log("🔄 Consultando base de datos de Webhooks...");

      // Intentamos obtener los leads usando el repositorio
      // ASUMIENDO que tu repositorio tiene un método llamado 'getAll' o 'findAll'
      let leads = [];

      if (typeof this.repository.getAll === "function") {
        leads = await this.repository.getAll();
      } else if (typeof this.repository.findAll === "function") {
        leads = await this.repository.findAll();
      } else {
        throw new Error(
          "El repositorio no tiene un método getAll() o findAll() implementado.",
        );
      }

      res.status(200).json({
        success: true,
        count: leads.length,
        data: leads,
      });
    } catch (error: any) {
      console.error("❌ Error al leer leads:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        hint: "Verifica que PostgresWebhookRepository tenga el método getAll()",
      });
    }
  }

  /**
   * POST /api/webhook/leads/reassign
   * Reasigna múltiples leads a un nuevo cliente
   */
  async reassignLeads(req: Request, res: Response): Promise<void> {
    try {
      const { leadIds, clienteNuevo, leads: leadsWithTable } = req.body;

      console.log("🔄 Reasignando leads:");
      console.log("  - IDs:", leadIds);
      console.log("  - Cliente nuevo:", clienteNuevo);

      if (!clienteNuevo || typeof clienteNuevo !== "string") {
        res.status(400).json({
          success: false,
          message: "Debe proporcionar un cliente válido",
        });
        return;
      }

      let totalUpdated = 0;

      if (Array.isArray(leadsWithTable) && leadsWithTable.length > 0) {
        const opLeadIds = leadsWithTable.filter((l: any) => l.tabla === "op_lead").map((l: any) => l.id);
        const webhookIds = leadsWithTable.filter((l: any) => l.tabla === "op_lead_webhook").map((l: any) => l.id);
        const legacyIds = leadsWithTable.filter((l: any) => l.tabla === "leads").map((l: any) => l.id);

        if (opLeadIds.length > 0) {
          const r = await pool.query(`UPDATE op_lead SET cliente = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [clienteNuevo, opLeadIds]);
          totalUpdated += r.rowCount || 0;
        }
        if (webhookIds.length > 0) {
          const r = await pool.query(`UPDATE op_lead_webhook SET cliente = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [clienteNuevo, webhookIds]);
          totalUpdated += r.rowCount || 0;
        }
        if (legacyIds.length > 0) {
          const r = await pool.query(`UPDATE leads SET cliente = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [clienteNuevo, legacyIds]);
          totalUpdated += r.rowCount || 0;
        }
      } else if (Array.isArray(leadIds) && leadIds.length > 0) {
        const r1 = await pool.query(`UPDATE op_lead SET cliente = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [clienteNuevo, leadIds]);
        totalUpdated += r1.rowCount || 0;
        const r2 = await pool.query(`UPDATE op_lead_webhook SET cliente = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [clienteNuevo, leadIds]);
        totalUpdated += r2.rowCount || 0;
        const r3 = await pool.query(`UPDATE leads SET cliente = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [clienteNuevo, leadIds]);
        totalUpdated += r3.rowCount || 0;
      } else {
        res.status(400).json({
          success: false,
          message: "Debe proporcionar al menos un lead para reasignar",
        });
        return;
      }

      if (totalUpdated === 0) {
        res.status(404).json({
          success: false,
          message: "No se encontraron leads para actualizar",
        });
        return;
      }

      console.log(`✅ ${totalUpdated} lead(s) reasignados exitosamente`);

      res.status(200).json({
        success: true,
        message: `${totalUpdated} lead(s) reasignado(s) exitosamente a ${clienteNuevo}`,
        data: {
          leadsUpdated: totalUpdated,
          clienteNuevo,
          leadIds,
        },
      });
    } catch (error: any) {
      console.error("❌ Error al reasignar leads:", error);
      res.status(500).json({
        success: false,
        message: "Error al reasignar los leads",
        error: error.message,
      });
    }
  }

  async getLeadsPaginated(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));
      const offset = (page - 1) * limit;

      const zone = (req.query.zone as string) || "";
      const brand = (req.query.brand as string) || "";
      const client = (req.query.client as string) || "";
      const startDate = (req.query.startDate as string) || "";
      const endDate = (req.query.endDate as string) || "";
      const searchNombre = (req.query.searchNombre as string) || "";
      const searchTelefono = (req.query.searchTelefono as string) || "";
      const searchLocalidad = (req.query.searchLocalidad as string) || "";

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      const unifiedQuery = `
        SELECT id, 'op_lead' as tabla, nombre, telefono, ciudad as localidad, modelo as auto, cliente, 
               comentario_horario as comentarios, source, fecha_creacion, created_at, campaign as marca
        FROM op_lead
        UNION ALL
        SELECT id, 'op_lead_webhook' as tabla, nombre, telefono, localidad, auto, cliente,
               comentarios, source, NULL::timestamp as fecha_creacion, created_at, NULL as marca
        FROM op_lead_webhook
        UNION ALL
        SELECT id, 'leads' as tabla, COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') as nombre, 
               phone as telefono, city as localidad, interest as auto, cliente,
               NULL as comentarios, source, lead_date as fecha_creacion, created_at, NULL as marca
        FROM leads
      `;

      if (zone) {
        const excludedFromNacional = ["amba", "cordoba", "córdoba", "mendoza", "santa fe"];
        if (zone.toLowerCase() === "nacional") {
          const conditions = excludedFromNacional.map(z => {
            params.push(`%${z}%`);
            return `LOWER(COALESCE(localidad, '')) NOT LIKE $${paramIdx++}`;
          }).join(" AND ");
          whereClauses.push(`(${conditions})`);
        } else {
          params.push(`%${zone.toLowerCase()}%`);
          whereClauses.push(`LOWER(COALESCE(localidad, '')) LIKE $${paramIdx++}`);
        }
      }

      if (brand) {
        params.push(`%${brand.toLowerCase()}%`);
        whereClauses.push(`LOWER(COALESCE(marca, '')) LIKE $${paramIdx++}`);
      }

      if (client) {
        const normalizedClient = normalizeClientName(client);
        params.push(normalizedClient);
        whereClauses.push(`COALESCE(cliente, '') = $${paramIdx++}`);
      }

      if (startDate) {
        params.push(startDate);
        whereClauses.push(`COALESCE(fecha_creacion, created_at) >= $${paramIdx++}::date`);
      }

      if (endDate) {
        params.push(endDate);
        whereClauses.push(`COALESCE(fecha_creacion, created_at) <= ($${paramIdx++}::date + interval '1 day')`);
      }

      if (searchNombre) {
        params.push(`%${searchNombre.toLowerCase()}%`);
        whereClauses.push(`LOWER(COALESCE(nombre, '')) LIKE $${paramIdx++}`);
      }

      if (searchTelefono) {
        params.push(`%${searchTelefono}%`);
        whereClauses.push(`COALESCE(telefono, '') LIKE $${paramIdx++}`);
      }

      if (searchLocalidad) {
        params.push(`%${searchLocalidad.toLowerCase()}%`);
        whereClauses.push(`LOWER(COALESCE(localidad, '')) LIKE $${paramIdx++}`);
      }

      const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countSQL = `SELECT COUNT(*) as total FROM (${unifiedQuery}) AS unified ${whereSQL}`;
      const dataSQL = `
        SELECT * FROM (${unifiedQuery}) AS unified 
        ${whereSQL}
        ORDER BY COALESCE(fecha_creacion, created_at) DESC NULLS LAST
        LIMIT $${paramIdx++} OFFSET $${paramIdx++}
      `;

      const countParams = [...params];
      const dataParams = [...params, limit, offset];

      const [countResult, dataResult] = await Promise.all([
        pool.query(countSQL, countParams),
        pool.query(dataSQL, dataParams),
      ]);

      const total = parseInt(countResult.rows[0]?.total || "0");

      const leads = dataResult.rows.map((row: any) => ({
        id: row.id,
        tabla: row.tabla,
        nombre: row.nombre,
        telefono: row.telefono,
        auto: row.auto || null,
        localidad: row.localidad || null,
        cliente: row.cliente || null,
        comentarios: row.comentarios || null,
        source: row.source || "unknown",
        createdAt: row.created_at,
        fechaCreacion: row.fecha_creacion || null,
      }));

      res.status(200).json({
        success: true,
        count: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        data: leads,
      });
    } catch (error: any) {
      console.error("❌ Error en leads paginados:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
