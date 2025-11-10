# 🔍 Queries SQL - Campaña 84 (Borussia - Fiat)

## ✅ PROBLEMA IDENTIFICADO

La diferencia de 396 vs 54 se debe a que:
- **Dashboard** usa 4 marcas (Fiat, VW, Chevrolet, Peugeot)
- **Endpoint** usa solo 1 marca (Fiat)

Esto hace que el dashboard encuentre muchos más leads porque busca en 4 marcas diferentes.

## Datos de Debug Capturados

### Dashboard (contarLeadsPorCampana):
```
Cliente normalizado: "borussia"
Localización: "Pais"
Marcas: [
  {"marca":"Fiat","porcentaje":100},
  {"marca":"VW","porcentaje":0},
  {"marca":"Chevrolet","porcentaje":0},
  {"marca":"Peugeot":"porcentaje":0}
]
FechaInicio: 2025-09-22
Número de condiciones: 6
```

### Endpoint (getSentLeadsByCampaign):
```
Cliente normalizado: "borussia"
Localización: "Pais"
Marcas: [{"marca":"Fiat","porcentaje":100}]
FechaInicio: 2025-09-22
Número de condiciones: 6
```

## Diferencia Detectada

### 🎯 **Marcas Configuradas**

**Dashboard**:
- Fiat: 100%
- VW: 0%
- Chevrolet: 0%
- Peugeot: 0%

**Endpoint**:
- Fiat: 100%

### Explicación

La campaña 84 tiene configuradas **4 marcas** en `asignacionAutomatica`:
1. Fiat (100%)
2. VW (0%)
3. Chevrolet (0%)
4. Peugeot (0%)

**Dashboard** está usando la configuración completa de asignación automática (4 marcas)
**Endpoint** está extrayendo solo la marca principal del campo `marca` de la campaña (1 marca)

## Queries SQL Construidas

### Dashboard (con 4 marcas) - Retorna 396:
```sql
SELECT COUNT(*)
FROM op_leads_rep
WHERE (
  campaign = 'Fiat' OR
  campaign = 'VW' OR
  campaign = 'Chevrolet' OR
  campaign = 'Peugeot'
)
  AND cliente = 'borussia'
  AND localizacion = 'Pais'
  AND source = 'google_sheets'
  AND (campaign_id IS NULL OR campaign_id = 84)
  AND date(fecha_creacion) >= '2025-09-22'
```

**Resultado**: 396 leads (busca en 4 marcas diferentes)

### Endpoint (con 1 marca) - Retorna 54:
```sql
SELECT *
FROM op_leads_rep
WHERE campaign = 'Fiat'  -- Solo busca en Fiat
  AND cliente = 'borussia'
  AND localizacion = 'Pais'
  AND source = 'google_sheets'
  AND (campaign_id IS NULL OR campaign_id = 84)
  AND date(fecha_creacion) >= '2025-09-22'
ORDER BY fecha_creacion
```

**Resultado**: 54 leads (busca solo en Fiat)

### Diferencia:
- 396 - 54 = **342 leads** que son de VW, Chevrolet o Peugeot

## 💡 Solución

El problema está en cómo se pasa `asignacionAutomatica` al helper:

- **Dashboard**: Pasa `campana.asignacionAutomatica` (objeto completo con 4 marcas)
- **Endpoint**: La campaña no tiene `asignacionAutomatica` completo, solo usa el campo `marca`

### Verificar en PostgresLeadsQueryRepository.ts

El repositorio obtiene la campaña así:

```typescript
const campaign = await db
  .select({
    id: campanasComerciales.id,
    numeroCampana: campanasComerciales.numeroCampana,
    clienteId: campanasComerciales.clienteId,
    marca: campanasComerciales.marca,
    zona: campanasComerciales.zona,
    fechaCampana: campanasComerciales.fechaCampana,
    fechaFin: campanasComerciales.fechaFin,
    asignacionAutomatica: campanasComerciales.asignacionAutomatica, // ¿Incluido?
  })
```

**Si `asignacionAutomatica` NO está incluido en el select**, entonces `extractBrandsFromCampaign()` solo retorna la marca principal.

## 🎯 Acción Requerida

Verificar que el repositorio incluya `asignacionAutomatica` en el select de la campaña.
