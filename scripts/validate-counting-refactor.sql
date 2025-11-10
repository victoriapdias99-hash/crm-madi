/**
 * ============================================================================
 * SCRIPT DE VALIDACIÓN - REFACTOR DE CONTEO DE LEADS
 * ============================================================================
 *
 * Este script valida que el refactor de conteo de leads mantiene consistencia
 * entre campañas pendientes y finalizadas.
 *
 * PROPÓSITO:
 * - Comparar conteos ANTES y DESPUÉS del refactor
 * - Identificar discrepancias en duplicados
 * - Validar transición pendiente → finalizada
 *
 * EJECUTAR:
 * 1. ANTES del deploy: Guardar resultados como baseline
 * 2. DESPUÉS del deploy: Comparar con baseline
 * 3. Investigar diferencias significativas (>10%)
 * ============================================================================
 */

-- ============================================================================
-- PASO 1: Validar Campañas FINALIZADAS (con fecha_fin)
-- ============================================================================

SELECT
  '=== CAMPAÑAS FINALIZADAS ===' as seccion;

SELECT
  cc.id as campaign_id,
  cc.numero_campana,
  cl.nombre_cliente,
  cc.marca,
  cc.zona,
  cc.fecha_fin,

  -- ========================================
  -- MÉTODO ANTIGUO (op_lead directo)
  -- ========================================
  (SELECT COUNT(*)
   FROM op_lead
   WHERE campaign_id = cc.id) as enviados_metodo_antiguo,

  (SELECT COUNT(*)
   FROM op_lead
   WHERE campaign_id = cc.id
     AND LOWER(campaign) LIKE '%duplicado%') as duplicados_metodo_antiguo,

  -- ========================================
  -- MÉTODO NUEVO (op_leads_rep con meta_lead_id)
  -- ========================================
  (SELECT COUNT(*)
   FROM op_leads_rep
   WHERE campaign_id = cc.id) as enviados_metodo_nuevo,

  -- Duplicados: Sumar duplicate_ids[] de leads asignados
  (SELECT COALESCE(SUM(array_length(olr.duplicate_ids, 1)), 0)
   FROM op_leads_rep olr
   WHERE olr.meta_lead_id IN (
     SELECT meta_lead_id
     FROM op_lead
     WHERE campaign_id = cc.id
   )) as duplicados_metodo_nuevo,

  -- ========================================
  -- DIFERENCIAS
  -- ========================================
  (SELECT COUNT(*) FROM op_leads_rep WHERE campaign_id = cc.id) -
  (SELECT COUNT(*) FROM op_lead WHERE campaign_id = cc.id) as diff_enviados,

  (SELECT COALESCE(SUM(array_length(olr.duplicate_ids, 1)), 0)
   FROM op_leads_rep olr
   WHERE olr.meta_lead_id IN (SELECT meta_lead_id FROM op_lead WHERE campaign_id = cc.id)) -
  (SELECT COUNT(*) FROM op_lead WHERE campaign_id = cc.id AND LOWER(campaign) LIKE '%duplicado%') as diff_duplicados

FROM campanas_comerciales cc
LEFT JOIN clientes cl ON cl.id = cc.cliente_id
WHERE cc.fecha_fin IS NOT NULL
ORDER BY cc.fecha_fin DESC
LIMIT 20;


-- ============================================================================
-- PASO 2: Validar Campañas PENDIENTES (sin fecha_fin)
-- ============================================================================

SELECT
  '=== CAMPAÑAS PENDIENTES ===' as seccion;

SELECT
  cc.id as campaign_id,
  cc.numero_campana,
  cl.nombre_cliente,
  cl.nombre_comercial,
  cc.marca,
  cc.zona,
  cc.fecha_campana,

  -- Para pendientes, ambos métodos deberían ser idénticos
  -- (ya usaban op_leads_rep con filtros genéricos)
  'Sin cambio esperado - ya usaba op_leads_rep' as nota

FROM campanas_comerciales cc
LEFT JOIN clientes cl ON cl.id = cc.cliente_id
WHERE cc.fecha_fin IS NULL
ORDER BY cc.fecha_campana DESC
LIMIT 10;


-- ============================================================================
-- PASO 3: Análisis de Discrepancias
-- ============================================================================

SELECT
  '=== ANÁLISIS DE DISCREPANCIAS ===' as seccion;

-- Campañas con diferencias significativas en ÚNICOS
WITH differences AS (
  SELECT
    cc.id,
    cc.numero_campana,
    cl.nombre_cliente,
    cc.marca,
    (SELECT COUNT(*) FROM op_lead WHERE campaign_id = cc.id) as old_count,
    (SELECT COUNT(*) FROM op_leads_rep WHERE campaign_id = cc.id) as new_count,
    ABS((SELECT COUNT(*) FROM op_leads_rep WHERE campaign_id = cc.id) -
        (SELECT COUNT(*) FROM op_lead WHERE campaign_id = cc.id)) as diff
  FROM campanas_comerciales cc
  LEFT JOIN clientes cl ON cl.id = cc.cliente_id
  WHERE cc.fecha_fin IS NOT NULL
)
SELECT
  id,
  numero_campana,
  nombre_cliente,
  marca,
  old_count,
  new_count,
  diff,
  CASE
    WHEN old_count = 0 THEN 0
    ELSE ROUND((diff::numeric / old_count::numeric) * 100, 2)
  END as porcentaje_diferencia
FROM differences
WHERE diff > 0
ORDER BY diff DESC
LIMIT 10;


-- Campañas con diferencias significativas en DUPLICADOS
WITH dup_differences AS (
  SELECT
    cc.id,
    cc.numero_campana,
    cl.nombre_cliente,
    cc.marca,
    (SELECT COUNT(*)
     FROM op_lead
     WHERE campaign_id = cc.id AND LOWER(campaign) LIKE '%duplicado%') as old_dups,
    (SELECT COALESCE(SUM(array_length(olr.duplicate_ids, 1)), 0)
     FROM op_leads_rep olr
     WHERE olr.meta_lead_id IN (SELECT meta_lead_id FROM op_lead WHERE campaign_id = cc.id)) as new_dups,
    ABS((SELECT COALESCE(SUM(array_length(olr.duplicate_ids, 1)), 0)
         FROM op_leads_rep olr
         WHERE olr.meta_lead_id IN (SELECT meta_lead_id FROM op_lead WHERE campaign_id = cc.id)) -
        (SELECT COUNT(*) FROM op_lead WHERE campaign_id = cc.id AND LOWER(campaign) LIKE '%duplicado%')) as diff
  FROM campanas_comerciales cc
  LEFT JOIN clientes cl ON cl.id = cc.cliente_id
  WHERE cc.fecha_fin IS NOT NULL
)
SELECT
  id,
  numero_campana,
  nombre_cliente,
  marca,
  old_dups,
  new_dups,
  diff,
  CASE
    WHEN old_dups = 0 THEN
      CASE WHEN new_dups = 0 THEN 0 ELSE 100 END
    ELSE ROUND((diff::numeric / old_dups::numeric) * 100, 2)
  END as porcentaje_diferencia
FROM dup_differences
WHERE diff > 0
ORDER BY diff DESC
LIMIT 10;


-- ============================================================================
-- PASO 4: Verificar Sincronización op_lead ↔ op_leads_rep
-- ============================================================================

SELECT
  '=== VERIFICACIÓN DE SINCRONIZACIÓN ===' as seccion;

-- Leads en op_lead pero NO en op_leads_rep
SELECT
  'Leads en op_lead sin meta_lead_id en op_leads_rep' as issue,
  COUNT(*) as count
FROM op_lead ol
LEFT JOIN op_leads_rep olr ON olr.meta_lead_id = ol.meta_lead_id
WHERE ol.campaign_id IS NOT NULL
  AND olr.id IS NULL;

-- Leads en op_lead con meta_lead_id NULL
SELECT
  'Leads en op_lead con meta_lead_id NULL' as issue,
  COUNT(*) as count
FROM op_lead
WHERE campaign_id IS NOT NULL
  AND meta_lead_id IS NULL;


-- ============================================================================
-- PASO 5: Estadísticas Generales
-- ============================================================================

SELECT
  '=== ESTADÍSTICAS GENERALES ===' as seccion;

SELECT
  'Total campañas finalizadas' as metric,
  COUNT(*) as value
FROM campanas_comerciales
WHERE fecha_fin IS NOT NULL

UNION ALL

SELECT
  'Total campañas pendientes' as metric,
  COUNT(*) as value
FROM campanas_comerciales
WHERE fecha_fin IS NULL

UNION ALL

SELECT
  'Total leads en op_lead con campaign_id' as metric,
  COUNT(*) as value
FROM op_lead
WHERE campaign_id IS NOT NULL

UNION ALL

SELECT
  'Total leads en op_leads_rep con campaign_id' as metric,
  COUNT(*) as value
FROM op_leads_rep
WHERE campaign_id IS NOT NULL

UNION ALL

SELECT
  'Total registros en op_leads_rep' as metric,
  COUNT(*) as value
FROM op_leads_rep

UNION ALL

SELECT
  'Total registros con duplicados' as metric,
  COUNT(*) as value
FROM op_leads_rep
WHERE cantidad_duplicados > 0;


-- ============================================================================
-- INSTRUCCIONES DE USO
-- ============================================================================

/*

CÓMO USAR ESTE SCRIPT:

1. ANTES DEL DEPLOY:
   - Ejecutar este script completo
   - Guardar resultados en archivo: validation-results-BEFORE.txt
   - Revisar sección "ANÁLISIS DE DISCREPANCIAS"
   - Anotar campañas con diferencias significativas

2. DESPUÉS DEL DEPLOY:
   - Ejecutar script nuevamente
   - Guardar resultados: validation-results-AFTER.txt
   - Comparar ambos archivos

3. VALIDACIONES CRÍTICAS:

   a) Sincronización op_lead ↔ op_leads_rep:
      - "Leads en op_lead sin meta_lead_id" debe ser 0 o muy bajo
      - "Leads con meta_lead_id NULL" debe ser 0

   b) Campañas finalizadas:
      - Diferencias en ÚNICOS < 5% (idealmente 0%)
      - Diferencias en DUPLICADOS pueden ser mayores (método cambió)

   c) Transición pendiente → finalizada:
      - Crear campaña de prueba
      - Anotar conteos en pendientes
      - Cerrar campaña (asignar fecha_fin)
      - Validar que conteos en finalizadas sean IDÉNTICOS

4. INVESTIGAR SI:
   - Diferencia en únicos > 10 leads
   - Diferencia en duplicados > 50%
   - Leads con meta_lead_id NULL > 0

*/
