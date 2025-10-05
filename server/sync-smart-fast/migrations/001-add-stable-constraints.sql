-- =====================================================================
-- SMART-FAST Migration: Constraints para ID estable
-- =====================================================================
-- Ejecutar ANTES de la primera migración smart-fast
--
-- Objetivo:
-- - Cambiar constraint único de (marca, google_sheets_row_number)
--   a (telefono, fecha_creacion, marca)
-- - Esto permite que los IDs sean estables aunque las filas cambien
-- =====================================================================

-- 1. Eliminar constraints antiguos que usan row_number
ALTER TABLE op_lead
  DROP CONSTRAINT IF EXISTS unique_marca_row;

ALTER TABLE op_lead
  DROP CONSTRAINT IF EXISTS unique_marca_google_row;

-- 2. Agregar constraint único basado en datos inmutables
-- Teléfono + Fecha + Marca = Clave natural estable
ALTER TABLE op_lead
  ADD CONSTRAINT unique_telefono_fecha_marca
  UNIQUE (telefono, fecha_creacion, marca);

-- 3. Crear índices para performance
-- Índice para búsqueda rápida en UPSERT
CREATE INDEX IF NOT EXISTS idx_telefono_fecha_marca_lookup
  ON op_lead(telefono, fecha_creacion, marca);

-- Índice para búsqueda por marca (queries frecuentes)
CREATE INDEX IF NOT EXISTS idx_marca_updated
  ON op_lead(marca, updated_at DESC);

-- 4. Verificar integridad actual
-- Esta query debe retornar 0 filas (sin duplicados)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT
      telefono,
      fecha_creacion,
      marca,
      COUNT(*) as count
    FROM op_lead
    WHERE telefono IS NOT NULL
      AND fecha_creacion IS NOT NULL
      AND marca IS NOT NULL
    GROUP BY telefono, fecha_creacion, marca
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE '⚠️  ADVERTENCIA: Encontrados % grupos duplicados por telefono+fecha+marca', duplicate_count;
    RAISE NOTICE '📋 Ver duplicados con: SELECT telefono, fecha_creacion, marca, COUNT(*) FROM op_lead GROUP BY 1,2,3 HAVING COUNT(*) > 1';
  ELSE
    RAISE NOTICE '✅ Sin duplicados - constraint se puede aplicar de forma segura';
  END IF;
END $$;

-- 5. Comentarios en columnas para documentación
COMMENT ON COLUMN op_lead.telefono IS 'Teléfono del lead (inmutable) - Parte de clave única';
COMMENT ON COLUMN op_lead.fecha_creacion IS 'Fecha de creación del lead (inmutable) - Parte de clave única';
COMMENT ON COLUMN op_lead.marca IS 'Marca/campaña (inmutable) - Parte de clave única';
COMMENT ON COLUMN op_lead.google_sheets_row_number IS 'Número de fila en Google Sheets (puede cambiar) - Solo referencia';
COMMENT ON COLUMN op_lead.meta_lead_id IS 'ID único estable: {MARCA}_{FECHA}_{TELEFONO}_{NANO} - Generado una vez, nunca cambia';

-- 6. Vista para detectar registros movidos de fila
CREATE OR REPLACE VIEW op_lead_row_movements AS
SELECT
  meta_lead_id,
  marca,
  telefono,
  nombre,
  google_sheets_row_number as current_row,
  created_at,
  updated_at,
  CASE
    WHEN created_at = updated_at THEN 'NUEVO'
    ELSE 'ACTUALIZADO'
  END as status,
  EXTRACT(EPOCH FROM (updated_at - created_at))/3600 as hours_since_created
FROM op_lead
WHERE updated_at > created_at
ORDER BY updated_at DESC;

COMMENT ON VIEW op_lead_row_movements IS 'Vista para monitorear leads que han sido actualizados (posiblemente porque cambiaron de fila en Sheets)';

-- =====================================================================
-- Queries útiles para verificación post-migración:
-- =====================================================================

-- Ver duplicados por telefono+fecha+marca (debe retornar 0 filas)
-- SELECT telefono, fecha_creacion, marca, COUNT(*) as duplicados
-- FROM op_lead
-- GROUP BY telefono, fecha_creacion, marca
-- HAVING COUNT(*) > 1;

-- Ver últimos registros actualizados (detectar movimientos de fila)
-- SELECT * FROM op_lead_row_movements LIMIT 20;

-- Ver distribución de IDs por formato
-- SELECT
--   CASE
--     WHEN meta_lead_id LIKE '%_R%_%' THEN 'Formato viejo (con row)'
--     WHEN meta_lead_id ~ '^[A-Z]+_[0-9]{8}_[0-9]{8}_[a-zA-Z0-9]{6}$' THEN 'Formato nuevo (smart-fast)'
--     ELSE 'Otro formato'
--   END as formato,
--   COUNT(*) as cantidad
-- FROM op_lead
-- GROUP BY formato;
