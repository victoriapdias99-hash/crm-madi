# Cambios en Endpoint de Listado de Leads

## 📅 Fecha
Enero 2025

## 🎯 Objetivo
Hacer que el endpoint de **listado de leads** use la **misma lógica** que el **conteo de leads** (`contarLeadsPorCampana`) para garantizar consistencia.

---

## ✅ Cambios Implementados

### 1. Módulo Compartido de Filtros
**Archivo creado**: `server/shared/campaign-filters.ts`

**Funciones extraídas**:
- `normalizeClientName()` - Normalización de nombres de clientes
- `extractBrandsFromCampaign()` - Extracción de múltiples marcas
- `createMultiBrandCondition()` - Creación de condiciones SQL con OR
- `mapZonaToLocalizacion()` - Mapeo de zonas a localizaciones
- `getMultiBrandDebugInfo()` - Información de debug
- `MAPEO_ZONAS` - Constante de mapeo de zonas

**Beneficio**: Código reutilizable entre conteo y listado

---

### 2. Repositorio de Leads Actualizado
**Archivo modificado**: `server/leads/infrastructure/repositories/PostgresLeadsQueryRepository.ts`

#### Cambios Principales:

#### ✅ **Tabla Fuente**
- **Antes**: `op_lead` (incluye duplicados)
- **Ahora**: `op_leads_rep` (deduplicado por meta_lead_id)

#### ✅ **Lógica Diferenciada**

**Para Campañas FINALIZADAS** (fecha_fin != NULL):
```sql
SELECT * FROM op_leads_rep
WHERE campaign_id = :campaignId
ORDER BY fecha_creacion
```

**Para Campañas PENDIENTES** (fecha_fin = NULL):
```sql
SELECT * FROM op_leads_rep
WHERE
  -- Múltiples marcas (OR entre todas las configuradas)
  (campaign LIKE '%MARCA1%' OR campaign LIKE '%MARCA2%' ...)

  -- Cliente normalizado
  AND cliente = 'nombre_comercial_normalizado'

  -- Zona mapeada
  AND localizacion IN ('Pais', 'Amba', 'Cordoba', 'Santa Fe', 'Mendoza')

  -- Fuente
  AND source = 'google_sheets'

  -- ⭐ INCLUYE LEADS ASIGNADOS + DISPONIBLES (Opción B)
  AND (campaign_id IS NULL OR campaign_id = :campaignId)

  -- Rango de fechas
  AND date(fecha_creacion) >= fecha_campana
  AND date(fecha_creacion) <= fecha_fin  -- si existe

ORDER BY fecha_creacion
```

#### ✅ **Leads Incluidos**
- **Antes**: Solo leads con `campaign_id = X` (asignados)
- **Ahora**: Leads con `campaign_id = X` O `campaign_id IS NULL` (asignados + disponibles)

Esto coincide con la **Opción B** del conteo, que incluye leads disponibles que cumplen los filtros.

---

## 📊 Comparación: Antes vs Ahora

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **Tabla** | `op_lead` | `op_leads_rep` ✅ |
| **Duplicados** | Incluidos | Excluidos ✅ |
| **Filtros Finalizadas** | `campaign_id = X` | `campaign_id = X` ✅ |
| **Filtros Pendientes** | Solo `campaign_id = X` | Cliente + Marca + Zona + Fechas ✅ |
| **Leads Disponibles** | No incluidos | Incluidos (IS NULL) ✅ |
| **Consistencia con Conteo** | ❌ Diferente | ✅ Idéntica |

---

## 🧪 Cómo Probar

### Opción 1: Script de Prueba Automático
```bash
# Con el servidor corriendo
npx tsx test-leads-endpoint.ts
```

Este script:
1. Obtiene una campaña pendiente
2. Consulta el conteo desde `/api/datos-diarios`
3. Consulta el listado desde `/api/leads/sent-by-campaign/:id`
4. Compara que `enviados` = `totalSent`
5. Muestra muestra de leads

### Opción 2: Prueba Manual

```bash
# 1. Obtener campaña pendiente
curl http://localhost:5000/api/pending-campaigns | jq '.campaigns[0]'

# 2. Obtener conteo (reemplaza ID)
curl http://localhost:5000/api/datos-diarios | jq '.[] | select(.id == CAMPAIGN_ID) | .enviados'

# 3. Obtener listado (reemplaza ID)
curl http://localhost:5000/api/leads/sent-by-campaign/CAMPAIGN_ID | jq '.totalSent'

# 4. Comparar que sean iguales
```

---

## 📝 Notas Importantes

### ⚠️ Comportamiento Esperado

**Campañas Pendientes**:
- El `totalSent` puede ser **mayor** que el número de leads actualmente asignados
- Esto es correcto: incluye leads disponibles que cumplen los filtros
- Representa la "capacidad" de la campaña, no solo lo asignado

**Campañas Finalizadas**:
- El `totalSent` es exactamente el número de leads asignados
- Solo cuenta `campaign_id = X`

### 🔍 Logs de Debug

El repositorio ahora incluye logs detallados:
```
📊 [REPOSITORY] Consultando leads para campaña X
📋 [REPOSITORY] Campaña: MARCA #1
📋 [REPOSITORY] Estado: EN PROCESO
✅ [REPOSITORY] Cliente: Nombre (nombre_comercial)
🔄 [REPOSITORY] Campaña EN PROCESO - Usando filtros
📝 [REPOSITORY] Cliente normalizado: "nombre"
🗺️ [REPOSITORY] Zona mapeada: NACIONAL → Pais
🏷️ [REPOSITORY] [Marca1, Marca2] (2 marcas)
✅ [REPOSITORY] 150 leads (asignados + disponibles) encontrados
```

---

## 🚀 Próximos Pasos Recomendados

1. ✅ **Ejecutar el script de prueba** cuando el servidor esté disponible
2. ⬜ **Actualizar `routes.ts`** para usar las funciones del módulo compartido (opcional)
3. ⬜ **Agregar tests unitarios** para las funciones de `campaign-filters.ts`
4. ⬜ **Documentar en API docs** el comportamiento de leads disponibles vs asignados

---

## 🐛 Troubleshooting

### Problema: El totalSent no coincide con enviados
**Causa**: Posiblemente la normalización de cliente o mapeo de zona es diferente
**Solución**: Revisar los logs para ver qué filtros se están aplicando

### Problema: El listado está vacío
**Causa**: La campaña puede no tener `nombreComercial` configurado
**Solución**: Verificar que el cliente tenga `nombre_comercial` en la BD

### Problema: Error "op_leads_rep not found"
**Causa**: La vista no existe en la base de datos
**Solución**: Ejecutar el script de creación de vistas

---

## 📚 Referencias

- **Lógica Original**: `server/routes.ts` función `contarLeadsPorCampana()` (línea ~483)
- **Endpoint Actualizado**: `GET /api/leads/sent-by-campaign/:campaignId`
- **Módulo Compartido**: `server/shared/campaign-filters.ts`
- **Repositorio**: `server/leads/infrastructure/repositories/PostgresLeadsQueryRepository.ts`
