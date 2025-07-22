import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Declaración global para TypeScript
declare global {
  var metaAdsService: any;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

  // Inicializar sincronización automática de Google Sheets
  try {
    const { GoogleSheetsSyncService } = await import('./google-sheets-sync-service');
    const googleSheetsModule = await import('./google-sheets');
    
    // Crear un adaptador simple para el servicio
    const sheetsServiceAdapter = {
      fetchDataFromSheets: async () => {
        // Usar la función existente de sincronización
        console.log('🔄 Adaptador: obteniendo datos de Google Sheets...');
        return []; // Placeholder, se implementará correctamente en el servicio
      }
    };
    
    const syncService = new GoogleSheetsSyncService(sheetsServiceAdapter);
    syncService.startAutoSync();
    console.log('✅ Sincronización automática Google Sheets iniciada (cada 15 minutos)');
  } catch (error) {
    console.error('❌ Error iniciando sincronización Google Sheets:', (error as Error)?.message || 'Error desconocido');
  }

  const server = await registerRoutes(app);

  // Configuración automática de Meta Ads al arrancar si las credenciales están disponibles
  if (process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID && 
      process.env.META_APP_ID && process.env.META_APP_SECRET) {
    console.log('Auto-configuring Meta Ads with environment credentials...');
    
    setTimeout(async () => {
      try {
        const { MetaAdsService } = await import("./meta-ads-service");
        const metaService = new MetaAdsService({
          accessToken: process.env.META_ACCESS_TOKEN!,
          accountId: process.env.META_AD_ACCOUNT_ID!,
          appSecret: process.env.META_APP_SECRET
        });

        console.log('✅ Meta Ads configured successfully at startup');
        
        // Exportar instancia configurada para uso en rutas
        global.metaAdsService = metaService;
        
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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
