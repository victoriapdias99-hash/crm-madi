import type { Express } from "express";
import { sql } from 'drizzle-orm';

export function registerDebugMaterialized(app: Express) {

  app.get('/api/debug/materialized-view', async (req, res) => {
    try {
      console.log('🔍 [DEBUG] Testing materialized view...');

      const { db } = await import('./db');
      const startTime = Date.now();

      // Test simple query to see result structure
      const result = await db.execute(sql`
        SELECT * FROM mv_dashboard_datos_diarios
        LIMIT 3
      `);

      const endTime = Date.now();

      console.log(`⚡ [DEBUG] Query time: ${endTime - startTime}ms`);
      console.log('🔍 [DEBUG] Result type:', typeof result);
      console.log('🔍 [DEBUG] Is array:', Array.isArray(result));
      console.log('🔍 [DEBUG] Result keys:', Object.keys(result || {}));
      console.log('🔍 [DEBUG] Result length:', result?.length);
      console.log('🔍 [DEBUG] First item:', result?.[0]);

      res.json({
        success: true,
        timing: `${endTime - startTime}ms`,
        resultType: typeof result,
        isArray: Array.isArray(result),
        keys: Object.keys(result || {}),
        length: result?.length,
        sample: result?.[0] || null
      });

    } catch (error) {
      console.error('❌ [DEBUG] Error:', error);
      res.status(500).json({
        error: 'Debug error',
        details: error.message
      });
    }
  });
}