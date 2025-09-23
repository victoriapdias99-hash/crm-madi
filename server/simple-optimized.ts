// ENDPOINT SUPER SIMPLIFICADO PARA TESTEAR VISTA MATERIALIZADA
import type { Express } from "express";
import { sql } from 'drizzle-orm';

export function registerSimpleOptimized(app: Express) {

  app.get('/api/dashboard/datos-diarios-simple-test', async (req, res) => {
    try {
      console.log('🚀 [SIMPLE] Test vista materializada...');

      const { db } = await import('./db');
      const startTime = Date.now();

      // Test simple - solo obtener datos de la vista materializada
      const result = await db.execute(sql`
        SELECT * FROM mv_dashboard_datos_diarios
        ORDER BY fecha_campana DESC
        LIMIT 5
      `);

      const endTime = Date.now();

      console.log(`⚡ [SIMPLE] Vista consultada en: ${endTime - startTime}ms`);
      console.log(`📊 [SIMPLE] Tipo resultado:`, typeof result);
      console.log(`📊 [SIMPLE] Es array:`, Array.isArray(result));
      console.log(`📊 [SIMPLE] Propiedades:`, Object.keys(result || {}));

      // Normalizar resultado
      let datos = [];
      if (Array.isArray(result)) {
        datos = result;
      } else if (result && result.rows) {
        datos = result.rows;
      } else if (result && typeof result === 'object') {
        datos = Object.values(result);
      }

      res.json({
        success: true,
        timing: `${endTime - startTime}ms`,
        count: datos.length,
        data: datos.slice(0, 3), // Solo primeros 3 para debug
        debug: {
          resultType: typeof result,
          isArray: Array.isArray(result),
          keys: Object.keys(result || {})
        }
      });

    } catch (error) {
      console.error('❌ [SIMPLE] Error:', error);
      res.status(500).json({
        error: 'Error en test simple',
        details: error.message
      });
    }
  });

  // Test directo de la vista sin ningún procesamiento
  app.get('/api/dashboard/test-materialized-view', async (req, res) => {
    try {
      console.log('🔍 [RAW] Test directo vista materializada...');

      const { db } = await import('./db');
      const startTime = Date.now();

      const result = await db.execute(sql`SELECT COUNT(*) as total FROM mv_dashboard_datos_diarios`);

      const endTime = Date.now();

      console.log(`⚡ [RAW] COUNT query: ${endTime - startTime}ms`);

      res.json({
        success: true,
        timing: `${endTime - startTime}ms`,
        result: result,
        message: 'Vista materializada funciona correctamente'
      });

    } catch (error) {
      console.error('❌ [RAW] Error:', error);
      res.status(500).json({
        error: 'Error en test raw',
        details: error.message
      });
    }
  });
}