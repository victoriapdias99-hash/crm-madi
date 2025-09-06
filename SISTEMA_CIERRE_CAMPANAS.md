# Sistema de Cierre de Campañas - Documentación Técnica

## Resumen Ejecutivo

Este documento describe el sistema de cierre automático de campañas implementado para la plataforma de gestión de leads Meta Ads. El sistema permite cerrar campañas asignando leads disponibles hasta alcanzar la meta establecida.

## Problema Original Resuelto

### Caso: TOYOTA MARIANO PICHETTI

**Síntoma:** No se podía cerrar la campaña de Toyota Mariano Pichetti
**Causa raíz:** Inconsistencia en la normalización de nombres entre filtrado inicial y búsqueda de leads
**Solución:** Implementación de normalización consistente usando solo el campo `nombre_comercial`

## Arquitectura del Sistema

### Componentes Principales

1. **CampaignClosureController** - API endpoint (`POST /api/campaign-closure/execute`)
2. **CampaignClosureUseCase** - Lógica de negocio principal
3. **CampaignProcessor** - Procesamiento de campañas por cliente
4. **PostgresLeadRepository** - Gestión de leads y asignaciones
5. **PostgresCampaignRepository** - Gestión de campañas

## Flujo Completo del Proceso

### PASO 1: Input del Usuario
```json
{
  "clients": "toyota mariano pichetti",
  "campaignKey": "TOYOTA 1-1", 
  "campaignNumber": "1",
  "dryRun": false
}
```

### PASO 2: Filtrado Inicial de Clientes

#### 2.1 Obtención de Clientes Pendientes
```sql
SELECT DISTINCT clientes.nombre_comercial 
FROM campanas_comerciales
LEFT JOIN clientes ON campanas_comerciales.cliente_id = clientes.id
WHERE campanas_comerciales.fecha_fin IS NULL
ORDER BY clientes.nombre_comercial;
```

#### 2.2 Extracción de Nombre Comercial
```javascript
// Función: extractCommercialName()
extractCommercialName("toyota mariano pichetti") 
// → "mariano pichetti" (remueve marca "toyota")
```

#### 2.3 Normalización y Matching
```javascript
// Cliente BD: "Mariano - Pichetti"
clientNormalized = normalizeClientName("Mariano - Pichetti") = "mariano_pichetti"

// Usuario: "toyota mariano pichetti" → "mariano pichetti" 
commercialNormalized = normalizeClientName("mariano pichetti") = "mariano_pichetti"

// Match: "mariano_pichetti" === "mariano_pichetti" ✅
```

### PASO 3: Búsqueda de Campañas

#### Query de Campañas
```sql
SELECT * FROM campanas_comerciales cc
LEFT JOIN clientes c ON cc.cliente_id = c.id
WHERE c.nombre_comercial ILIKE '%Mariano - Pichetti%'
AND cc.fecha_fin IS NULL
ORDER BY cc.fecha_campana, cc.numero_campana;
```

### PASO 4: Análisis de Leads

#### 4.1 Conteo de Leads Asignados
```sql
SELECT COUNT(*) FROM op_lead 
WHERE campaign_id = 36;
```

#### 4.2 Conteo de Leads Disponibles
```sql
SELECT COUNT(*) FROM op_lead 
WHERE LOWER(marca) LIKE '%toyota%'
AND LOWER(cliente) LIKE '%mariano_pichetti%'  -- Normalizado
AND LOWER(localizacion) LIKE '%amba%'
AND campaign_id IS NULL;
```

### PASO 5: Obtención de Leads para Asignación

#### Query Principal de Leads Únicos
```sql
SELECT * FROM op_leads_rep 
WHERE campaign_id IS NULL  -- CRÍTICO: Solo no asignados
AND LOWER(marca) LIKE '%toyota%'
AND LOWER(cliente) LIKE '%mariano_pichetti%'  -- Normalizado
AND LOWER(localizacion) LIKE '%amba%'
ORDER BY fecha_creacion ASC
LIMIT 200;  -- Traer más para compensar leads asignados
```

#### Verificación de Duplicados
```javascript
// Para cada lead único de op_leads_rep:
// 1. Extraer duplicate_ids: [123, 456, 789]
// 2. Verificar en op_lead si alguno ya está asignado
// 3. Si ninguno asignado → incluir en lista final
```

### PASO 6: Asignación en Lotes

#### Update de Asignación
```sql
UPDATE op_lead 
SET campaign_id = 36, updated_at = NOW()
WHERE id IN (123, 456, 789, ...)  -- Lote de duplicate_ids
AND campaign_id IS NULL;  -- Doble verificación
```

### PASO 7: Cierre de Campaña

#### 7.1 Obtener Fecha del Último Lead
```sql
SELECT fecha_creacion FROM op_lead 
WHERE campaign_id = 36 
ORDER BY fecha_creacion DESC 
LIMIT 1;
```

#### 7.2 Cerrar Campaña
```sql
UPDATE campanas_comerciales 
SET fecha_fin = '2025-07-19T10:25:12.000Z', updated_at = NOW()
WHERE id = 36;
```

## Aspectos Técnicos Críticos

### 1. Normalización de Nombres

**Función `normalizeClientName()`:**
```javascript
function normalizeClientName(clientName) {
  return String(clientName || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remover caracteres especiales
    .replace(/\s+/g, '_');   // Reemplazar espacios con _
}

// Ejemplos:
// "Mariano - Pichetti" → "mariano_pichetti"
// "toyota mariano pichetti" → "toyota_mariano_pichetti"
```

### 2. Extracción de Nombre Comercial

**Función `extractCommercialName()`:**
```javascript
function extractCommercialName(userInput) {
  const knownBrands = ['toyota', 'fiat', 'peugeot', 'chevrolet', 
                       'ford', 'renault', 'citroen', 'jeep', 'vw'];
  
  let commercialName = userInput.toLowerCase().trim();
  
  // Remover marcas conocidas del inicio
  for (const brand of knownBrands) {
    if (commercialName.startsWith(brand + ' ')) {
      commercialName = commercialName.substring(brand.length + 1).trim();
      break;
    }
  }
  
  return commercialName;
}
```

### 3. Estructura de Datos

#### Base de Datos Principal
- **op_lead**: Tabla de leads individuales (writes)
- **op_leads_rep**: Vista optimizada de leads únicos (reads)
- **campanas_comerciales**: Campañas comerciales
- **clientes**: Información de clientes

#### Campos Clave
- `clientes.nombre_comercial`: Campo usado para matching
- `op_lead.campaign_id`: NULL = disponible, NOT NULL = asignado
- `op_leads_rep.duplicate_ids`: Array de IDs duplicados

## Optimizaciones Implementadas

### 1. Vista op_leads_rep
- Deduplica leads automáticamente
- Incluye array de `duplicate_ids`
- Mejora performance de consultas

### 2. Asignación en Lotes
- Procesa leads en lotes de 100
- Reduce tiempo de transacción
- Mantiene consistencia de datos

### 3. Verificación de Disponibilidad
- Doble verificación: op_leads_rep + op_lead
- Previene race conditions
- Garantiza integridad de datos

## Logs de Ejemplo Exitoso

```
✅ Match encontrado: "Mariano - Pichetti" (mariano_pichetti) ↔ "toyota mariano pichetti" → comercial: "mariano pichetti" (mariano_pichetti)
📋 Campañas para cliente "Mariano - Pichetti": 1
📊 Leads disponibles (no asignados): 101 para Mariano - Pichetti (Toyota, AMBA)
🎯 Meta de leads: 100
✅ [OPTIMIZADO] 100 leads únicos disponibles de 100 verificados
🎯 [BATCH] Asignación completada: 100 únicos → 100 duplicados en 108ms (926 leads/seg)
✅ [DB] Campaña 36 cerrada exitosamente con fecha: 2025-07-19T10:25:12.000Z
```

## Métricas de Performance

- **Tiempo total proceso**: ~11 segundos
- **Velocidad asignación**: ~900 leads/segundo  
- **Timeout configurado**: 300 segundos
- **Lote óptimo**: 100 leads

## Casos de Uso Soportados

1. **Cierre específico por cliente**: `clients: 'toyota mariano pichetti'`
2. **Cierre por campaña específica**: `campaignNumber: '1'`
3. **Modo dry run**: `dryRun: true` (simulación)
4. **Tracking en tiempo real**: WebSocket con `campaignKey`

## Estado del Sistema

✅ **Completamente operativo** - Todas las correcciones implementadas y probadas
✅ **Toyota Mariano Pichetti** - Caso específico resuelto
✅ **Normalización consistente** - Usa campo `nombre_comercial` exclusivamente
✅ **Performance optimizada** - Queries eficientes y lotes optimizados

---
*Documentación generada: 2025-09-06*
*Estado: Sistema operativo y estable*