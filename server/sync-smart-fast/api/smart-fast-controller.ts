/**
 * Smart-Fast API Controller
 *
 * Endpoints para el sistema de migración simplificado
 */

import { Request, Response } from 'express';
import { migrateSmartFast } from '../migrate-smart-fast';

export class SmartFastController {
  /**
   * POST /api/sync/smart-fast
   * Ejecuta migración completa con ID estable
   */
  async executeMigration(req: Request, res: Response): Promise<void> {
    try {
      console.log('🚀 API: Iniciando migración smart-fast...');

      const startTime = Date.now();
      const stats = await migrateSmartFast();
      const duration = Date.now() - startTime;

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${(duration / 1000).toFixed(2)}s`,
        stats: {
          totalProcessed: stats.totalProcessed,
          inserted: stats.inserted,
          updated: stats.updated,
          skipped: stats.skipped,
          errors: stats.errors
        },
        details: stats.details,
        message: `Migración completada: ${stats.inserted} insertados, ${stats.updated} actualizados`
      };

      console.log(`✅ API: Migración exitosa en ${response.duration}`);
      res.status(200).json(response);

    } catch (error: any) {
      console.error('❌ API: Error en migración smart-fast:', error);

      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        message: 'Error ejecutando migración smart-fast'
      });
    }
  }

  /**
   * GET /api/sync/smart-fast/status
   * Obtiene estadísticas de la última migración
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { db } = await import('../../db');
      const { opLead } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');

      // Estadísticas generales
      const totalLeads = await db.select({ count: sql<number>`COUNT(*)` })
        .from(opLead);

      const recentlyUpdated = await db.select({ count: sql<number>`COUNT(*)` })
        .from(opLead)
        .where(sql`${opLead.updatedAt} > NOW() - INTERVAL '24 hours'`);

      const newToday = await db.select({ count: sql<number>`COUNT(*)` })
        .from(opLead)
        .where(sql`DATE(${opLead.createdAt}) = CURRENT_DATE`);

      // Distribución por marca
      const byMarca = await db.select({
        marca: opLead.marca,
        count: sql<number>`COUNT(*)`,
        lastUpdated: sql<string>`MAX(${opLead.updatedAt})`
      })
        .from(opLead)
        .groupBy(opLead.marca)
        .orderBy(sql`COUNT(*) DESC`);

      res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        stats: {
          totalLeads: totalLeads[0].count,
          recentlyUpdated: recentlyUpdated[0].count,
          newToday: newToday[0].count,
          byMarca: byMarca
        },
        system: 'smart-fast',
        idFormat: '{MARCA}_{YYYYMMDD}_{TELEFONO}_{NANO}'
      });

    } catch (error: any) {
      console.error('❌ API: Error obteniendo status:', error);

      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  /**
   * GET /api/sync/smart-fast/validate
   * Valida integridad de datos (sin duplicados)
   */
  async validateIntegrity(req: Request, res: Response): Promise<void> {
    try {
      const { db } = await import('../../db');
      const { opLead } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');

      // Buscar duplicados por telefono+fecha+marca
      const duplicates = await db.execute(sql`
        SELECT
          telefono,
          fecha_creacion,
          marca,
          COUNT(*) as count,
          array_agg(meta_lead_id) as ids
        FROM ${opLead}
        WHERE telefono IS NOT NULL
          AND fecha_creacion IS NOT NULL
          AND marca IS NOT NULL
        GROUP BY telefono, fecha_creacion, marca
        HAVING COUNT(*) > 1
      `);

      const hasDuplicates = duplicates.rows.length > 0;

      res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        integrity: {
          isValid: !hasDuplicates,
          duplicatesFound: duplicates.rows.length,
          duplicates: duplicates.rows
        },
        message: hasDuplicates
          ? `⚠️ Encontrados ${duplicates.rows.length} grupos duplicados`
          : '✅ Sin duplicados - integridad OK'
      });

    } catch (error: any) {
      console.error('❌ API: Error validando integridad:', error);

      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }
}

// Singleton
export const smartFastController = new SmartFastController();
