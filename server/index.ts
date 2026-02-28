import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { pool } from "./db";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Declaración global para TypeScript
declare global {
  var metaAdsService: any;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configuración de sesiones con PostgreSQL
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool: pool as any, // Pool de conexiones de Neon
      tableName: "user_sessions", // Nombre de la tabla de sesiones
      createTableIfMissing: true, // Crear tabla automáticamente si no existe
    }),
    secret: process.env.SESSION_SECRET || "desarrollo-secreto-cambiar-en-produccion",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS solo en producción
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    },
  })
);

console.log("✅ Sistema de sesiones configurado con PostgreSQL");

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Inicializar servicios críticos
  console.log('🚀 Inicializando servicios del sistema...');
  
  // Importar y configurar Meta Ads
  try {
    const metaAdsModule = await import('./meta-ads-service');
    if (metaAdsModule.setupMetaAds) {
      await metaAdsModule.setupMetaAds();
      console.log('✅ Meta Ads configurado');
    }
  } catch (error) {
    console.warn('⚠️ Meta Ads no disponible:', (error as Error)?.message || 'Error desconocido');
  }


  // NOTA: Sincronización automática ahora manejada por el sistema refactorizado
  console.log('🧪 Modo testing activado - sincronización manual únicamente');

  const server = await registerRoutes(app);

  // Configuración automática de Meta Ads al arrancar si las credenciales están disponibles
  if (process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID) {
    console.log('Auto-configuring Meta Ads with environment credentials...');
    
    setTimeout(async () => {
      try {
        const { MetaAdsService } = await import("./meta-ads-service");
        const { metaTokenRefreshService } = await import("./meta-token-refresh-service");

        // Inicializar el servicio de refresco de token (exchange + guardado en BD)
        await metaTokenRefreshService.initialize();

        // Obtener el token (desde BD si ya fue guardado, si no del env var)
        const token = await metaTokenRefreshService.getToken();

        const metaService = new MetaAdsService({
          accessToken: token,
          accountId: process.env.META_AD_ACCOUNT_ID!,
          appSecret: process.env.META_APP_SECRET
        });

        console.log('✅ Meta Ads configured successfully at startup');
        
        // Exportar instancia configurada para uso en rutas
        global.metaAdsService = metaService;

        // Programar auto-refresh del token cada 24 horas
        metaTokenRefreshService.scheduleAutoRefresh();
        
      } catch (error) {
        console.log('❌ Meta Ads auto-configuration failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }, 2000); // Delay para permitir que el servidor termine de arrancar
  } else {
    console.log('Meta Ads credentials not found, skipping auto-configuration');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
