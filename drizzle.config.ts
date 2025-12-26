import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Solo se gestionan las tablas oficiales
  tablesFilter: [
    "users",
    "campaigns",
    "leads",
    "op_*", // Cubre: op_lead, op_lead_webhook, op_leads_rep
    "daily_stats",
    "lead_notes",
    "dashboard_*", // Cubre: dashboard_campaigns, dashboard_manual_values
    "clientes",
    "campanas_*", // Cubre: campanas_comerciales
    "sync_control",
    "enviados_metrics",
  ],
});
