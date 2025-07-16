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
