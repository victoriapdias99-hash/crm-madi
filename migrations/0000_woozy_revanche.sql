CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"meta_campaign_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"budget" numeric(10, 2),
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "campaigns_meta_campaign_id_unique" UNIQUE("meta_campaign_id")
);
--> statement-breakpoint
CREATE TABLE "campanas_comerciales" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"numero_campana" text NOT NULL,
	"cantidad_datos_solicitados" integer NOT NULL,
	"marca" text NOT NULL,
	"zona" text NOT NULL,
	"porcentaje" integer DEFAULT 100 NOT NULL,
	"marca2" text,
	"zona2" text,
	"porcentaje2" integer,
	"marca3" text,
	"zona3" text,
	"porcentaje3" integer,
	"marca4" text,
	"zona4" text,
	"porcentaje4" integer,
	"marca5" text,
	"zona5" text,
	"porcentaje5" integer,
	"asignacion_automatica" boolean DEFAULT false NOT NULL,
	"localizado" text,
	"fecha_campana" date,
	"fecha_fin" date,
	"pedidos_por_dia" integer DEFAULT 0,
	"facturacion_bruta" numeric(12, 2) DEFAULT '0',
	"fecha_creacion" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_cliente" text NOT NULL,
	"nombre_comercial" text NOT NULL,
	"telefono" text,
	"email" text,
	"fecha_alta" timestamp DEFAULT now(),
	"cuit_cliente" text,
	"tipo_facturacion" text NOT NULL,
	"marcas_solicitadas" text[],
	"zonas" text[],
	"zonas_excluyentes" text,
	"provincia_buenos_aires" text,
	"exclusiones_geograficas" jsonb,
	"integracion" text,
	"tipo_cliente" text,
	"informacion_adicional" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"campaign_id" integer,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"ctr" numeric(5, 4),
	"cpl" numeric(8, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente" text NOT NULL,
	"campana" text NOT NULL,
	"zona" text NOT NULL,
	"enviados" integer DEFAULT 0,
	"entregados_por_dia" numeric(10, 2),
	"pedidos_por_dia" integer DEFAULT 0,
	"pedidos_total" integer DEFAULT 0,
	"numero_campana" integer DEFAULT 1,
	"porcentaje_desvio" numeric(5, 2),
	"porcentaje_datos_enviados" numeric(5, 2),
	"datos_pedidos" integer DEFAULT 0,
	"venta_por_campana" numeric(12, 2) DEFAULT '0',
	"faltantes_a_enviar" integer DEFAULT 0,
	"cpl" numeric(10, 2),
	"inversion_realizada" numeric(12, 2),
	"inversion_pendiente" numeric(12, 2),
	"inversion_total" numeric(12, 2),
	"inversion_total_pendiente" numeric(12, 2),
	"dia_1" integer DEFAULT 0,
	"dia_2" integer DEFAULT 0,
	"dia_3" integer DEFAULT 0,
	"dia_4" integer DEFAULT 0,
	"dia_5" integer DEFAULT 0,
	"dia_6" integer DEFAULT 0,
	"dia_7" integer DEFAULT 0,
	"dia_8" integer DEFAULT 0,
	"dia_9" integer DEFAULT 0,
	"dia_10" integer DEFAULT 0,
	"dia_11" integer DEFAULT 0,
	"dia_12" integer DEFAULT 0,
	"dia_13" integer DEFAULT 0,
	"dia_14" integer DEFAULT 0,
	"dia_15" integer DEFAULT 0,
	"dia_16" integer DEFAULT 0,
	"dia_17" integer DEFAULT 0,
	"dia_18" integer DEFAULT 0,
	"dia_19" integer DEFAULT 0,
	"dia_20" integer DEFAULT 0,
	"dia_21" integer DEFAULT 0,
	"dia_22" integer DEFAULT 0,
	"dia_23" integer DEFAULT 0,
	"dia_24" integer DEFAULT 0,
	"dia_25" integer DEFAULT 0,
	"dia_26" integer DEFAULT 0,
	"dia_27" integer DEFAULT 0,
	"dia_28" integer DEFAULT 0,
	"dia_29" integer DEFAULT 0,
	"dia_30" integer DEFAULT 0,
	"dia_31" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_manual_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_index" integer NOT NULL,
	"cpl" numeric(10, 2) DEFAULT '0',
	"venta_por_campana" numeric(12, 2) DEFAULT '0',
	"pedidos_por_dia" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dashboard_manual_values_cliente_index_unique" UNIQUE("cliente_index")
);
--> statement-breakpoint
CREATE TABLE "enviados_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_nombre" text NOT NULL,
	"numero_campana" text NOT NULL,
	"datos_enviados" integer DEFAULT 0 NOT NULL,
	"fecha_inicio" date,
	"fecha_fin" date,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"note" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"meta_lead_id" text,
	"campaign_id" integer,
	"first_name" text,
	"last_name" text,
	"email" text,
	"phone" text,
	"age" integer,
	"city" text,
	"interest" text,
	"budget" text,
	"origen" text,
	"localizacion" text,
	"cliente" text,
	"ad_name" text,
	"adset_name" text,
	"campaign_name" text,
	"status" text DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'meta_ads' NOT NULL,
	"cost" numeric(8, 2),
	"lead_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "leads_meta_lead_id_unique" UNIQUE("meta_lead_id")
);
--> statement-breakpoint
CREATE TABLE "op_lead" (
	"id" serial PRIMARY KEY NOT NULL,
	"meta_lead_id" text NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text,
	"ciudad" text,
	"modelo" text,
	"comentario_horario" text,
	"origen" text,
	"localizacion" text,
	"cliente" text,
	"marca" text NOT NULL,
	"campaign" text NOT NULL,
	"campaign_id" integer,
	"google_sheets_row_number" integer,
	"source" text DEFAULT 'google_sheets' NOT NULL,
	"fecha_creacion" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "op_lead_meta_lead_id_unique" UNIQUE("meta_lead_id")
);
--> statement-breakpoint
CREATE TABLE "op_lead_webhook" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"auto" text,
	"localidad" text,
	"comentarios" text,
	"source" text DEFAULT 'webhook' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "op_leads_rep" (
	"id" serial PRIMARY KEY NOT NULL,
	"meta_lead_id" text NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text,
	"ciudad" text,
	"modelo" text,
	"comentario_horario" text,
	"origen" text,
	"localizacion" text,
	"cliente" text,
	"marca" text NOT NULL,
	"campaign" text NOT NULL,
	"campaign_id" integer,
	"google_sheets_row_number" integer,
	"source" text DEFAULT 'google_sheets' NOT NULL,
	"fecha_creacion" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"cantidad_duplicados" integer,
	"duplicate_ids" integer[],
	CONSTRAINT "op_leads_rep_meta_lead_id_unique" UNIQUE("meta_lead_id")
);
--> statement-breakpoint
CREATE TABLE "sync_control" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"last_sync_at" timestamp NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "campanas_comerciales" ADD CONSTRAINT "campanas_comerciales_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;