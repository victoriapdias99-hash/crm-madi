import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,
} from "drizzle-orm/pg-core";
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

  // Nuevas columnas desde Google Sheets (columnas G, H, I)
  origen: text("origen"),
  localizacion: text("localizacion"),
  cliente: text("cliente"),

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

// Leads de Google Sheets (tabla optimizada para sincronización)
export const opLead = pgTable("op_lead", {
  id: serial("id").primaryKey(),
  metaLeadId: text("meta_lead_id").unique().notNull(), // ID único garantizado

  // Información básica del lead
  nombre: text("nombre").notNull(), // Con fallback 'S/N'
  telefono: text("telefono").notNull(), // Siempre normalizado
  email: text("email"), // Opcional, siempre aceptado
  ciudad: text("ciudad"), // También llamada "Localidad"
  modelo: text("modelo"), // Modelo del auto
  comentarioHorario: text("comentario_horario"), // Horario de contacto / Comentarios

  // Datos específicos de Google Sheets (columnas G, H, I)
  origen: text("origen"), // WhatsApp, Instagram, etc.
  localizacion: text("localizacion"), // Ubicación geográfica
  cliente: text("cliente"), // Cliente específico

  // Metadatos de campaña
  marca: text("marca").notNull(), // Fiat, Toyota, VW, etc.
  campaign: text("campaign").notNull(), // Nombre de campaña original
  campaignId: integer("campaign_id"), // ID de campaña asignada (para cierre de campañas)

  // Control de sincronización con Google Sheets
  googleSheetsRowNumber: integer("google_sheets_row_number"), // Número de fila exacto en Google Sheets

  // Sistema
  source: text("source").notNull().default("google_sheets"),
  fechaCreacion: timestamp("fecha_creacion").notNull(), // Fecha original del lead
  createdAt: timestamp("created_at").defaultNow(), // Fecha de inserción en DB
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Vista optimizada de leads sin duplicados (op_leads_rep)
export const opLeadsRep = pgTable("op_leads_rep", {
  id: serial("id").primaryKey(),
  metaLeadId: text("meta_lead_id").unique().notNull(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  email: text("email"),
  ciudad: text("ciudad"),
  modelo: text("modelo"),
  comentarioHorario: text("comentario_horario"),
  origen: text("origen"),
  localizacion: text("localizacion"),
  cliente: text("cliente"),
  marca: text("marca").notNull(),
  campaign: text("campaign").notNull(),
  campaignId: integer("campaign_id"), // ✅ NUEVO CAMPO AGREGADO
  googleSheetsRowNumber: integer("google_sheets_row_number"),
  source: text("source").notNull().default("google_sheets"),
  fechaCreacion: timestamp("fecha_creacion").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  cantidadDuplicados: integer("cantidad_duplicados"),
  duplicateIds: integer("duplicate_ids").array(), // ✅ Array de IDs de duplicados
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
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
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
  porcentajeDatosEnviados: numeric("porcentaje_datos_enviados", {
    precision: 5,
    scale: 2,
  }), // % datos enviados (relacionado con campañas)
  datosPedidos: integer("datos_pedidos").default(0), // Cantidad total pedida
  ventaPorCampana: numeric("venta_por_campana", {
    precision: 12,
    scale: 2,
  }).default("0"), // Venta por campaña (input manual)
  faltantesAEnviar: integer("faltantes_a_enviar").default(0), // Pedidos - Enviados
  cpl: numeric("cpl", { precision: 10, scale: 2 }), // Coste por lead en pesos argentinos
  inversionRealizada: numeric("inversion_realizada", {
    precision: 12,
    scale: 2,
  }), // En pesos
  inversionPendiente: numeric("inversion_pendiente", {
    precision: 12,
    scale: 2,
  }), // En pesos
  inversionTotal: numeric("inversion_total", { precision: 12, scale: 2 }), // En pesos
  inversionTotalPendiente: numeric("inversion_total_pendiente", {
    precision: 12,
    scale: 2,
  }), // En pesos
  // Datos diarios (día 1 al 31)
  dia1: integer("dia_1").default(0),
  dia2: integer("dia_2").default(0),
  dia3: integer("dia_3").default(0),
  dia4: integer("dia_4").default(0),
  dia5: integer("dia_5").default(0),
  dia6: integer("dia_6").default(0),
  dia7: integer("dia_7").default(0),
  dia8: integer("dia_8").default(0),
  dia9: integer("dia_9").default(0),
  dia10: integer("dia_10").default(0),
  dia11: integer("dia_11").default(0),
  dia12: integer("dia_12").default(0),
  dia13: integer("dia_13").default(0),
  dia14: integer("dia_14").default(0),
  dia15: integer("dia_15").default(0),
  dia16: integer("dia_16").default(0),
  dia17: integer("dia_17").default(0),
  dia18: integer("dia_18").default(0),
  dia19: integer("dia_19").default(0),
  dia20: integer("dia_20").default(0),
  dia21: integer("dia_21").default(0),
  dia22: integer("dia_22").default(0),
  dia23: integer("dia_23").default(0),
  dia24: integer("dia_24").default(0),
  dia25: integer("dia_25").default(0),
  dia26: integer("dia_26").default(0),
  dia27: integer("dia_27").default(0),
  dia28: integer("dia_28").default(0),
  dia29: integer("dia_29").default(0),
  dia30: integer("dia_30").default(0),
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
  marcasSolicitadas: text("marcas_solicitadas").array(), // Array de marcas: Fiat, Peugeot, Toyota, Chevrolet, Renault, Citroen, VW, Mercedes, Ford, Jeep, China, Otra
  zonas: text("zonas").array(), // Array de zonas: AMBA, NACIONAL, LOCALIZADO
  zonasExcluyentes: text("zonas_excluyentes"), // Zonas a excluir (input de texto)
  provinciaBuenosAires: text("provincia_buenos_aires"), // Provincia específica de Buenos Aires
  exclusionesGeograficas: jsonb("exclusiones_geograficas"), // Exclusiones tipo Google Maps
  integracion: text("integracion"), // Pilot, Tecnom, Asofix, Otro
  tipoCliente: text("tipo_cliente"), // AGENCIA, GRUPO COMERCIAL, COMERCIALIZADORA, VENDEDOR
  informacionAdicional: text("informacion_adicional"), // Campo adicional de 500 caracteres
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Gestión de campañas comerciales
export const campanasComerciales = pgTable("campanas_comerciales", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id")
    .references(() => clientes.id)
    .notNull(),
  numeroCampana: text("numero_campana").notNull(),
  cantidadDatosSolicitados: integer("cantidad_datos_solicitados").notNull(),
  marca: text("marca").notNull(), // Primera marca (obligatoria)
  zona: text("zona").notNull(), // Primera zona (obligatoria)
  porcentaje: integer("porcentaje").notNull().default(100), // Porcentaje de leads para marca 1
  marca2: text("marca2"), // Segunda marca (opcional)
  zona2: text("zona2"), // Segunda zona (opcional)
  porcentaje2: integer("porcentaje2"), // Porcentaje de leads para marca 2
  marca3: text("marca3"), // Tercera marca (opcional)
  zona3: text("zona3"), // Tercera zona (opcional)
  porcentaje3: integer("porcentaje3"), // Porcentaje de leads para marca 3
  marca4: text("marca4"), // Cuarta marca (opcional)
  zona4: text("zona4"), // Cuarta zona (opcional)
  porcentaje4: integer("porcentaje4"), // Porcentaje de leads para marca 4
  marca5: text("marca5"), // Quinta marca (opcional)
  zona5: text("zona5"), // Quinta zona (opcional)
  porcentaje5: integer("porcentaje5"), // Porcentaje de leads para marca 5
  asignacionAutomatica: boolean("asignacion_automatica")
    .notNull()
    .default(false), // Si está activada, distribución aleatoria
  localizado: text("localizado"), // Campo para targeting específico o localización
  fechaCampana: date("fecha_campana"), // Campo fecha cuando se da de alta la campaña
  fechaFin: date("fecha_fin"), // Fecha de finalización para rangos de matching
  pedidosPorDia: integer("pedidos_por_dia").default(0), // Pedidos por día editables
  facturacionBruta: numeric("facturacion_bruta", {
    precision: 12,
    scale: 2,
  }).default("0"), // Facturación bruta por campaña
  fechaCreacion: timestamp("fecha_creacion").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla para valores manuales del dashboard (CPL, ventas, pedidos)
export const dashboardManualValues = pgTable("dashboard_manual_values", {
  id: serial("id").primaryKey(),
  clienteIndex: integer("cliente_index").notNull().unique(),
  cpl: numeric("cpl", { precision: 10, scale: 2 }).default("0"),
  ventaPorCampana: numeric("venta_por_campana", {
    precision: 12,
    scale: 2,
  }).default("0"),
  pedidosPorDia: integer("pedidos_por_dia").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabla para control de sincronización
export const syncControl = pgTable("sync_control", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull(),
  lastSyncAt: timestamp("last_sync_at").notNull(),
  recordCount: integer("record_count").notNull().default(0),
  syncStatus: text("sync_status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabla para métricas de enviados calculadas desde DB
export const enviadosMetrics = pgTable("enviados_metrics", {
  id: serial("id").primaryKey(),
  clienteNombre: text("cliente_nombre").notNull(),
  numeroCampana: text("numero_campana").notNull(),
  datosEnviados: integer("datos_enviados").notNull().default(0),
  fechaInicio: date("fecha_inicio"),
  fechaFin: date("fecha_fin"),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabla para recibir leads desde webhooks externos
export const opLeadWebhook = pgTable("op_lead_webhook", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  auto: text("auto"), // Modelo o tipo de auto
  localidad: text("localidad"),
  cliente: text("cliente"), // Columna para identificar al cliente final
  comentarios: text("comentarios"),
  source: text("source").notNull().default("webhook"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  origen: true,
  localizacion: true,
  cliente: true,
  adName: true,
  adsetName: true,
  campaignName: true,
  status: true,
  source: true,
  cost: true,
  leadDate: true,
});

// Schema para op_lead (Google Sheets)
export const insertOpLeadSchema = createInsertSchema(opLead).pick({
  metaLeadId: true,
  nombre: true,
  telefono: true,
  email: true,
  ciudad: true,
  origen: true,
  localizacion: true,
  cliente: true,
  marca: true,
  campaign: true,
  googleSheetsRowNumber: true,
  fechaCreacion: true,
  source: true,
});

export type InsertOpLead = z.infer<typeof insertOpLeadSchema>;
export type SelectOpLead = typeof opLead.$inferSelect;

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

export const insertSyncControlSchema = createInsertSchema(syncControl).pick({
  tableName: true,
  lastSyncAt: true,
  recordCount: true,
  syncStatus: true,
  errorMessage: true,
});

export const insertEnviadosMetricsSchema = createInsertSchema(
  enviadosMetrics,
).pick({
  clienteNombre: true,
  numeroCampana: true,
  datosEnviados: true,
  fechaInicio: true,
  fechaFin: true,
  lastCalculatedAt: true,
});

export const insertOpLeadWebhookSchema = createInsertSchema(opLeadWebhook).pick(
  {
    nombre: true,
    telefono: true,
    auto: true,
    localidad: true,
    cliente: true, // Se permite que este campo entre en la validación
    comentarios: true,
    source: true,
  },
);

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

export const insertDashboardCampaignSchema = createInsertSchema(
  dashboardCampaigns,
).pick({
  cliente: true,
  campana: true,
  zona: true,
  enviados: true,
  entregadosPorDia: true,
  pedidosPorDia: true,
  porcentajeDesvio: true,
  porcentajeDatosEnviados: true,
  datosPedidos: true,
  faltantesAEnviar: true,
  cpl: true,
  inversionRealizada: true,
  inversionPendiente: true,
  inversionTotal: true,
  inversionTotalPendiente: true,
});

export type DashboardCampaign = typeof dashboardCampaigns.$inferSelect;
export type InsertDashboardCampaign = z.infer<
  typeof insertDashboardCampaignSchema
>;

export const insertClienteSchema = createInsertSchema(clientes).pick({
  nombreCliente: true,
  nombreComercial: true,
  telefono: true,
  email: true,
  userId: true,
  cuitCliente: true,
  tipoFacturacion: true,
  marcasSolicitadas: true,
  zonas: true,
  zonasExcluyentes: true,
  provinciaBuenosAires: true,
  exclusionesGeograficas: true,
  integracion: true,
  tipoCliente: true,
  informacionAdicional: true,
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = z.infer<typeof insertClienteSchema>;

export const insertCampanaComercialSchema = createInsertSchema(
  campanasComerciales,
)
  .pick({
    clienteId: true,
    numeroCampana: true,
    cantidadDatosSolicitados: true,
    marca: true,
    zona: true,
    porcentaje: true,
    marca2: true,
    zona2: true,
    porcentaje2: true,
    marca3: true,
    zona3: true,
    porcentaje3: true,
    marca4: true,
    zona4: true,
    porcentaje4: true,
    marca5: true,
    zona5: true,
    porcentaje5: true,
    asignacionAutomatica: true,
    localizado: true,
    fechaCampana: true,
    fechaFin: true,
    pedidosPorDia: true,
    facturacionBruta: true,
  })
  .extend({
    facturacionBruta: z
      .union([z.string(), z.number()])
      .transform((val) => String(val)),
  });

// Schema para crear campañas sin campos calculados automáticamente
export const createCampanaComercialSchema = createInsertSchema(
  campanasComerciales,
)
  .omit({
    id: true,
    numeroCampana: true,
    fechaFin: true,
    fechaCreacion: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    facturacionBruta: z
      .union([z.string(), z.number()])
      .transform((val) => String(val)),
  });

export type CampanaComercial = typeof campanasComerciales.$inferSelect;
export type InsertCampanaComercial = z.infer<
  typeof insertCampanaComercialSchema
>;

// Enums
export const LEAD_STATUS = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  CONVERTED: "converted",
  REJECTED: "rejected",
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export type SyncControl = typeof syncControl.$inferSelect;
export type InsertSyncControl = z.infer<typeof insertSyncControlSchema>;

export type EnviadosMetrics = typeof enviadosMetrics.$inferSelect;
export type InsertEnviadosMetrics = z.infer<typeof insertEnviadosMetricsSchema>;

export type OpLeadWebhook = typeof opLeadWebhook.$inferSelect;
export type InsertOpLeadWebhook = z.infer<typeof insertOpLeadWebhookSchema>;

export const CAMPAIGN_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  ENDED: "ended",
} as const;

export type CampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const NOTE_TYPES = {
  GENERAL: "general",
  CALL: "call",
  EMAIL: "email",
  MEETING: "meeting",
} as const;

export type NoteType = (typeof NOTE_TYPES)[keyof typeof NOTE_TYPES];

// Nuevas constantes para clientes
export const MARCAS_DISPONIBLES = [
  "Fiat",
  "Peugeot",
  "Toyota",
  "Chevrolet",
  "Renault",
  "Citroen",
  "VW",
  "Mercedes",
  "Ford",
  "Jeep",
  "China",
  "Otra",
] as const;

export const PROVINCIAS_BUENOS_AIRES = [
  "Adolfo Alsina",
  "Alberti",
  "Almirante Brown",
  "Arrecifes",
  "Avellaneda",
  "Ayacucho",
  "Azul",
  "Bahía Blanca",
  "Balcarce",
  "Baradero",
  "Benito Juárez",
  "Berazategui",
  "Berisso",
  "Bolívar",
  "Bragado",
  "Brandsen",
  "Campana",
  "Cañuelas",
  "Capilla del Señor",
  "Capitán Sarmiento",
  "Carapachay",
  "Carhué",
  "Carlos Casares",
  "Carlos Tejedor",
  "Carmen de Areco",
  "Carmen de Patagones",
  "Castelli",
  "Chacabuco",
  "Chascomús",
  "Chivilcoy",
  "Colón",
  "Coronel Dorrego",
  "Coronel Pringles",
  "Coronel Rosales",
  "Coronel Suárez",
  "Daireaux",
  "Dolores",
  "Ensenada",
  "Escobar",
  "Esteban Echeverría",
  "Exaltación de la Cruz",
  "Ezeiza",
  "Florencio Varela",
  "Florentino Ameghino",
  "General Alvarado",
  "General Alvear",
  "General Arenales",
  "General Belgrano",
  "General Guido",
  "General Lamadrid",
  "General Las Heras",
  "General Lavalle",
  "General Madariaga",
  "General Paz",
  "General Pinto",
  "General Pueyrredón",
  "General Rodríguez",
  "General San Martín",
  "General Viamonte",
  "General Villegas",
  "Guaminí",
  "Hipólito Yrigoyen",
  "Hurlingham",
  "Ituzaingó",
  "José C. Paz",
  "Junín",
  "La Costa",
  "La Matanza",
  "La Plata",
  "Lanús",
  "Las Flores",
  "Laprida",
  "Leandro N. Alem",
  "Lincoln",
  "Lobería",
  "Lobos",
  "Lomas de Zamora",
  "Luján",
  "Magdalena",
  "Maipú",
  "Malvinas Argentinas",
  "Mar Chiquita",
  "Marcos Paz",
  "Mercedes",
  "Merlo",
  "Monte",
  "Monte Hermoso",
  "Moreno",
  "Morón",
  "Navarro",
  "Necochea",
  "Nueve de Julio",
  "Olavarría",
  "Patagones",
  "Pehuajó",
  "Pellegrini",
  "Pergamino",
  "Pila",
  "Pilar",
  "Pinamar",
  "Presidente Perón",
  "Puán",
  "Punta Indio",
  "Quilmes",
  "Ramallo",
  "Rauch",
  "Rivadavia",
  "Rojas",
  "Roque Pérez",
  "Saavedra",
  "Saladillo",
  "Salliqueló",
  "Salto",
  "San Andrés de Giles",
  "San Antonio de Areco",
  "San Cayetano",
  "San Fernando",
  "San Isidro",
  "San Miguel",
  "San Nicolás",
  "San Pedro",
  "San Vicente",
  "Suipacha",
  "Tandil",
  "Tapalqué",
  "Tigre",
  "Tordillo",
  "Tornquist",
  "Trenque Lauquen",
  "Tres Arroyos",
  "Tres de Febrero",
  "Tres Lomas",
  "Tupungato",
  "Villarino",
  "Villa Gesell",
  "Zárate",
] as const;

export const TIPOS_INTEGRACION = [
  "Pilot",
  "Tecnom",
  "Asofix",
  "Google Sheets",
  "Otro",
] as const;

export const TIPOS_CLIENTE = [
  "AGENCIA",
  "GRUPO COMERCIAL",
  "COMERCIALIZADORA",
  "VENDEDOR",
] as const;

export type MarcaDisponible = (typeof MARCAS_DISPONIBLES)[number];
export type ProvinciaBuenosAires = (typeof PROVINCIAS_BUENOS_AIRES)[number];
export type TipoIntegracion = (typeof TIPOS_INTEGRACION)[number];
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

// Clientes - Enums
export const TIPO_FACTURACION = {
  C: "C",
  A: "A",
} as const;

export type TipoFacturacion =
  (typeof TIPO_FACTURACION)[keyof typeof TIPO_FACTURACION];

export const MARCAS = {
  FIAT: "FIAT",
  PEUGEOT: "PEUGEOT",
  TOYOTA: "TOYOTA",
  CHEVROLET: "CHEVROLET",
  RENAULT: "RENAULT",
  CITROEN: "CITROEN",
} as const;

export type Marca = (typeof MARCAS)[keyof typeof MARCAS];

export const ZONAS = {
  AMBA: "AMBA",
  NACIONAL: "NACIONAL",
  LOCALIZADO: "LOCALIZADO",
} as const;

export type Zona = (typeof ZONAS)[keyof typeof ZONAS];

// Provincias de Argentina completas para targeting geográfico
export const PROVINCIAS_ARGENTINA = [
  "AMBA",
  "NACIONAL",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

// Zonas como array para formularios (ahora incluye todas las provincias)
export const ZONAS_DISPONIBLES = PROVINCIAS_ARGENTINA;
