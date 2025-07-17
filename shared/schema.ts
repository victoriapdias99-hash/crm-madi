import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Usuario y autenticación
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: text("role").notNull().default("user"), // admin, user
  createdAt: timestamp("created_at").defaultNow(),
});

// Campañas de Meta Ads
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  metaCampaignId: text("meta_campaign_id").unique(),
  status: text("status").notNull().default("active"), // active, paused, ended
  budget: numeric("budget", { precision: 10, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leads de Meta Ads
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  metaLeadId: text("meta_lead_id").unique(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  
  // Información del lead
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  
  // Datos adicionales del formulario
  age: integer("age"),
  city: text("city"),
  interest: text("interest"),
  budget: text("budget"),
  
  // Metadatos de Meta
  adName: text("ad_name"),
  adsetName: text("adset_name"),
  campaignName: text("campaign_name"),
  
  // Seguimiento
  status: text("status").notNull().default("new"), // new, contacted, qualified, converted, rejected
  source: text("source").notNull().default("meta_ads"),
  cost: numeric("cost", { precision: 8, scale: 2 }),
  
  // Fechas
  leadDate: timestamp("lead_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Estadísticas diarias
export const dailyStats = pgTable("daily_stats", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  
  // Métricas
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  spend: numeric("spend", { precision: 10, scale: 2 }).notNull().default("0"),
  
  // Calculadas
  ctr: numeric("ctr", { precision: 5, scale: 4 }), // Click Through Rate
  cpl: numeric("cpl", { precision: 8, scale: 2 }), // Cost Per Lead
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Notas y seguimiento de leads
export const leadNotes = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id),
  userId: integer("user_id").notNull().references(() => users.id),
  note: text("note").notNull(),
  type: text("type").notNull().default("general"), // general, call, email, meeting
  createdAt: timestamp("created_at").defaultNow(),
});

// Dashboard de campañas según estructura de Google Sheets
export const dashboardCampaigns = pgTable("dashboard_campaigns", {
  id: serial("id").primaryKey(),
  cliente: text("cliente").notNull(), // Cliente (A, B, etc.)
  campana: text("campana").notNull(), // Campaña (1, 2, etc.)
  zona: text("zona").notNull(), // NACIONAL, AMBA, CORDOBA
  enviados: integer("enviados").default(0), // Total enviados
  entregadosPorDia: numeric("entregados_por_dia", { precision: 10, scale: 2 }), // Promedio entregados
  pedidosPorDia: integer("pedidos_por_dia").default(0), // Número fijo manual
  pedidosTotal: integer("pedidos_total").default(0), // Total de pedidos
  numeroCampana: integer("numero_campana").default(1), // Número de campaña por cliente
  porcentajeDesvio: numeric("porcentaje_desvio", { precision: 5, scale: 2 }), // % desvío
  datosPedidos: integer("datos_pedidos").default(0), // Cantidad total pedida
  ventaPorCampana: numeric("venta_por_campana", { precision: 12, scale: 2 }).default("0"), // Venta por campaña (input manual)
  faltantesAEnviar: integer("faltantes_a_enviar").default(0), // Pedidos - Enviados
  cpl: numeric("cpl", { precision: 10, scale: 2 }), // Coste por lead en pesos argentinos
  inversionRealizada: numeric("inversion_realizada", { precision: 12, scale: 2 }), // En pesos
  inversionPendiente: numeric("inversion_pendiente", { precision: 12, scale: 2 }), // En pesos
  inversionTotal: numeric("inversion_total", { precision: 12, scale: 2 }), // En pesos
  inversionTotalPendiente: numeric("inversion_total_pendiente", { precision: 12, scale: 2 }), // En pesos
  // Datos diarios (día 1 al 31)
  dia1: integer("dia_1").default(0), dia2: integer("dia_2").default(0), dia3: integer("dia_3").default(0),
  dia4: integer("dia_4").default(0), dia5: integer("dia_5").default(0), dia6: integer("dia_6").default(0),
  dia7: integer("dia_7").default(0), dia8: integer("dia_8").default(0), dia9: integer("dia_9").default(0),
  dia10: integer("dia_10").default(0), dia11: integer("dia_11").default(0), dia12: integer("dia_12").default(0),
  dia13: integer("dia_13").default(0), dia14: integer("dia_14").default(0), dia15: integer("dia_15").default(0),
  dia16: integer("dia_16").default(0), dia17: integer("dia_17").default(0), dia18: integer("dia_18").default(0),
  dia19: integer("dia_19").default(0), dia20: integer("dia_20").default(0), dia21: integer("dia_21").default(0),
  dia22: integer("dia_22").default(0), dia23: integer("dia_23").default(0), dia24: integer("dia_24").default(0),
  dia25: integer("dia_25").default(0), dia26: integer("dia_26").default(0), dia27: integer("dia_27").default(0),
  dia28: integer("dia_28").default(0), dia29: integer("dia_29").default(0), dia30: integer("dia_30").default(0),
  dia31: integer("dia_31").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Gestión de clientes
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nombreCliente: text("nombre_cliente").notNull(),
  nombreComercial: text("nombre_comercial").notNull(),
  telefono: text("telefono"),
  email: text("email"),
  fechaAlta: timestamp("fecha_alta").defaultNow(),
  cuitCliente: text("cuit_cliente"),
  tipoFacturacion: text("tipo_facturacion").notNull(), // "C" o "A"
  marcasSolicitadas: text("marcas_solicitadas").array(), // Array de marcas
  zonas: text("zonas").array(), // Array de zonas: AMBA, NACIONAL, LOCALIZADO
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  role: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  name: true,
  metaCampaignId: true,
  status: true,
  budget: true,
  startDate: true,
  endDate: true,
});

export const insertLeadSchema = createInsertSchema(leads).pick({
  metaLeadId: true,
  campaignId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  age: true,
  city: true,
  interest: true,
  budget: true,
  adName: true,
  adsetName: true,
  campaignName: true,
  status: true,
  source: true,
  cost: true,
  leadDate: true,
});

export const insertDailyStatsSchema = createInsertSchema(dailyStats).pick({
  date: true,
  campaignId: true,
  impressions: true,
  clicks: true,
  leads: true,
  spend: true,
  ctr: true,
  cpl: true,
});

export const insertLeadNoteSchema = createInsertSchema(leadNotes).pick({
  leadId: true,
  userId: true,
  note: true,
  type: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type DailyStats = typeof dailyStats.$inferSelect;
export type InsertDailyStats = z.infer<typeof insertDailyStatsSchema>;

export type LeadNote = typeof leadNotes.$inferSelect;
export type InsertLeadNote = z.infer<typeof insertLeadNoteSchema>;

export const insertDashboardCampaignSchema = createInsertSchema(dashboardCampaigns).pick({
  cliente: true,
  campana: true,
  zona: true,
  enviados: true,
  entregadosPorDia: true,
  pedidosPorDia: true,
  porcentajeDesvio: true,
  datosPedidos: true,
  faltantesAEnviar: true,
  cpl: true,
  inversionRealizada: true,
  inversionPendiente: true,
  inversionTotal: true,
  inversionTotalPendiente: true,
});

export type DashboardCampaign = typeof dashboardCampaigns.$inferSelect;
export type InsertDashboardCampaign = z.infer<typeof insertDashboardCampaignSchema>;

export const insertClienteSchema = createInsertSchema(clientes).pick({
  nombreCliente: true,
  nombreComercial: true,
  telefono: true,
  email: true,
  cuitCliente: true,
  tipoFacturacion: true,
  marcasSolicitadas: true,
  zonas: true,
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;

// Enums
export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  CONVERTED: 'converted',
  REJECTED: 'rejected'
} as const;

export type LeadStatus = typeof LEAD_STATUS[keyof typeof LEAD_STATUS];

export const CAMPAIGN_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended'
} as const;

export type CampaignStatus = typeof CAMPAIGN_STATUS[keyof typeof CAMPAIGN_STATUS];

export const NOTE_TYPES = {
  GENERAL: 'general',
  CALL: 'call',
  EMAIL: 'email',
  MEETING: 'meeting'
} as const;

export type NoteType = typeof NOTE_TYPES[keyof typeof NOTE_TYPES];

// Clientes - Enums
export const TIPO_FACTURACION = {
  C: 'C',
  A: 'A'
} as const;

export type TipoFacturacion = typeof TIPO_FACTURACION[keyof typeof TIPO_FACTURACION];

export const MARCAS = {
  FIAT: 'FIAT',
  PEUGEOT: 'PEUGEOT',
  TOYOTA: 'TOYOTA',
  CHEVROLET: 'CHEVROLET',
  RENAULT: 'RENAULT',
  CITROEN: 'CITROEN'
} as const;

export type Marca = typeof MARCAS[keyof typeof MARCAS];

export const ZONAS = {
  AMBA: 'AMBA',
  NACIONAL: 'NACIONAL',
  LOCALIZADO: 'LOCALIZADO'
} as const;

export type Zona = typeof ZONAS[keyof typeof ZONAS];
