# 🔄 Reset de Campaign IDs - Herramienta para Pruebas

Esta herramienta permite limpiar los `campaign_id` de leads asignados a campañas Y reabrirlas (limpiar `fecha_fin`), permitiendo realizar pruebas de cierre desde cero sin afectar los datos sincronizados.

## 📋 Contenido

- [reset-campaign-leads.ts](reset-campaign-leads.ts) - Script para resetear una campaña específica (limpia leads + fecha_fin)
- [reset-all-finished-campaigns.ts](reset-all-finished-campaigns.ts) - Script para resetear TODAS las campañas finalizadas (limpia leads + fecha_fin)
- [reopen-finished-campaigns.ts](reopen-finished-campaigns.ts) - Script para solo limpiar fecha_fin (sin tocar leads)
- [reset-campaign-leads-helper.ts](reset-campaign-leads-helper.ts) - Helper para listar campañas con leads asignados

---

## 🎯 Casos de Uso

### 1. Probar cierre de campaña desde cero
- Limpiar los leads ya asignados
- Ejecutar el proceso de cierre completo
- Verificar que la distribución multimarca funcione correctamente

### 2. Corregir asignaciones incorrectas
- Liberar leads asignados por error
- Reasignar a la campaña correcta

### 3. Desarrollo y testing
- Probar cambios en la lógica de cierre
- Validar conteos y distribuciones

---

## 🚀 Uso

### Paso 1: Listar campañas con leads asignados

```bash
npx tsx server/reset-campaign-leads-helper.ts
```

**Salida:**
```
📋 CAMPAÑAS CON LEADS ASIGNADOS

┌────────────────────────────────────────────────────────────────────────────┐
│  ID │ Cliente               │ #  │ Marca      │ Zona    │ Asig │ Solic │
├────────────────────────────────────────────────────────────────────────────┤
│   65 │ Red Finance           │  1 │ Peugeot+Fia│ Mendoza │   82 │   100 │
│   43 │ Autos del Sol         │  1 │ Fiat       │ AMBA    │  506 │   500 │
│   ...
└────────────────────────────────────────────────────────────────────────────┘
```

### Paso 2: Preview con DRY RUN (recomendado)

```bash
# Por ID de campaña
npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=65

# Por nombre de cliente y número
npx tsx server/reset-campaign-leads.ts --dry-run --client="red finance" --campaign-number=1
```

**Salida:**
```
🔄 RESET DE CAMPAIGN IDS
⚠️  MODO DRY RUN - No se harán cambios reales

📋 INFORMACIÓN DE LA CAMPAÑA:
   ID: 65
   Cliente: Red Finance
   Número: 1
   Marca: Peugeot + Fiat
   Zona: Mendoza
   Solicitados: 100

📊 LEADS ASIGNADOS:
   op_lead: 82 registros
   op_leads_rep: 82 registros

📄 EJEMPLOS DE LEADS QUE SERÁN LIBERADOS (primeros 5):
   1. ID 274779 - PEUGEOT - red_finance - Mendoza
   2. ID 276158 - PEUGEOT - red_finance - Mendoza
   ...

✅ DRY RUN completado - No se realizaron cambios
```

### Paso 3: Ejecutar limpieza real

```bash
# Por ID de campaña
npx tsx server/reset-campaign-leads.ts --campaign-id=65

# Por nombre de cliente y número
npx tsx server/reset-campaign-leads.ts --client="red finance" --campaign-number=1
```

**Salida:**
```
🔄 RESET DE CAMPAIGN IDS
🚨 MODO EJECUCIÓN - Se limpiarán los campaign_ids

🚀 EJECUTANDO LIMPIEZA...
   ✅ op_lead: 82 registros limpiados
   ✅ op_leads_rep: 82 registros limpiados

🔍 VERIFICANDO LIMPIEZA...
   ✅ Limpieza exitosa - Todos los campaign_id fueron removidos

✅ PROCESO COMPLETADO
   82 leads fueron liberados de la campaña 65
   Ahora puedes realizar pruebas de cierre desde cero
```

---

## ⚙️ Opciones de Línea de Comandos

### Opciones principales

| Opción | Descripción | Ejemplo |
|--------|-------------|---------|
| `--dry-run` | Modo preview sin hacer cambios | `--dry-run` |
| `--campaign-id=N` | ID de la campaña a resetear | `--campaign-id=65` |
| `--client="Nombre"` | Nombre del cliente | `--client="red finance"` |
| `--campaign-number=N` | Número de campaña | `--campaign-number=1` |

### Combinaciones válidas

```bash
# Opción 1: Por ID directo
npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=65

# Opción 2: Por cliente + número
npx tsx server/reset-campaign-leads.ts --dry-run --client="red finance" --campaign-number=1

# ❌ Inválido: Falta información
npx tsx server/reset-campaign-leads.ts --dry-run --client="red finance"
```

---

## 🔒 Características de Seguridad

### 1. Modo Dry Run obligatorio
- Siempre recomendado ejecutar primero con `--dry-run`
- Muestra qué se va a limpiar sin hacer cambios
- Previene borrados accidentales

### 2. Validaciones integradas
- ✅ Verifica que la campaña exista
- ✅ Muestra información completa antes de actuar
- ✅ Confirma la limpieza después de ejecutar

### 3. Logs detallados
- Muestra ejemplos de leads afectados
- Contadores precisos por tabla
- Verificación post-limpieza

---

## 📊 Qué hace el script

### Operaciones realizadas

El script realiza **dos operaciones principales**:

1. **Limpia `campaign_id`** en la tabla `op_lead` (la vista `op_leads_rep` se actualiza automáticamente)
2. **Limpia `fecha_fin`** en la tabla `campanas_comerciales` para "reabrir" la campaña

### SQL ejecutado

```sql
-- 1. Limpiar leads asignados
UPDATE op_lead
SET campaign_id = NULL
WHERE campaign_id = [ID_CAMPANA];

-- 2. Reabrir campaña (limpiar fecha_fin)
UPDATE campanas_comerciales
SET fecha_fin = NULL
WHERE id = [ID_CAMPANA];

-- Nota: op_leads_rep es una VISTA que se actualiza automáticamente
-- No requiere UPDATE directo
```

### Verificación

Después de limpiar, verifica que:
```sql
-- Verificar leads limpiados
SELECT COUNT(*) FROM op_lead WHERE campaign_id = [ID_CAMPANA];
-- Resultado esperado: 0

-- Verificar campaña reabierta
SELECT fecha_fin FROM campanas_comerciales WHERE id = [ID_CAMPANA];
-- Resultado esperado: NULL
```

---

## 🧪 Ejemplo Completo: Reset Red Finance #1

### 1. Verificar estado actual

```bash
npx tsx server/reset-campaign-leads-helper.ts
```

Buscar "Red Finance" en la lista.

### 2. Preview del reset

```bash
npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=65
```

Revisar la salida:
- ¿Es la campaña correcta?
- ¿Cuántos leads se van a liberar?
- ¿Los ejemplos mostrados son correctos?

### 3. Ejecutar reset

```bash
npx tsx server/reset-campaign-leads.ts --campaign-id=65
```

### 4. Verificar limpieza

Ejecutar query manual:
```sql
SELECT COUNT(*) FROM op_lead WHERE campaign_id = 65;
-- Debe retornar 0

SELECT COUNT(*) FROM op_leads_rep WHERE campaign_id = 65;
-- Debe retornar 0
```

### 5. Verificar en dashboard

- Ir a "Datos Diarios"
- Buscar "Red Finance #1"
- El contador debería mostrar solo leads disponibles

### 6. Probar cierre de campaña

```bash
curl -X POST "http://localhost:5000/api/campaign-closure/multi-brand/execute/65" \
     -H "Content-Type: application/json" \
     -d '{"clientName": "Red Finance"}'
```

---

## ⚠️ Advertencias

### ❌ NO usar en producción sin confirmar

Este script es principalmente para **desarrollo y testing**. En producción:
1. Siempre usar `--dry-run` primero
2. Verificar que sea la campaña correcta
3. Documentar el cambio
4. Tener backup de base de datos

### ❌ NO resetea otros datos

El script solo limpia `campaign_id`. **NO afecta**:
- Los datos de la campaña en `campanas_comerciales`
- Los campos de fecha (`fecha_fin`)
- Los datos diarios (columnas `dia1-dia31`)
- Los leads en sí (solo la asignación)

### ✅ Es reversible

Si ejecutas el reset por error:
- Puedes volver a cerrar la campaña
- Los leads siguen existiendo en las tablas
- Solo se limpia la relación `campaign_id`

---

## 🔥 Reset TODAS las Campañas Finalizadas

### Uso Rápido

```bash
# Preview (recomendado)
npx tsx server/reset-all-finished-campaigns.ts --dry-run

# Ejecutar reset de TODAS las campañas finalizadas
npx tsx server/reset-all-finished-campaigns.ts --execute
```

### Opciones Avanzadas

```bash
# Filtrar por fecha - Solo campañas finalizadas antes de una fecha
npx tsx server/reset-all-finished-campaigns.ts --dry-run --before="2025-09-01"

# Filtrar por fecha - Solo campañas finalizadas después de una fecha
npx tsx server/reset-all-finished-campaigns.ts --dry-run --after="2025-08-01"

# Combinación de filtros
npx tsx server/reset-all-finished-campaigns.ts --dry-run --after="2025-07-01" --before="2025-09-30"
```

### Salida Esperada

```
🔄 RESET DE CAMPAÑAS FINALIZADAS

⚠️  MODO DRY RUN - No se harán cambios reales

📋 BUSCANDO CAMPAÑAS FINALIZADAS...
   Se encontraron 41 campañas finalizadas

📊 ANALIZANDO LEADS ASIGNADOS...

┌────────────────────────────────────────────────────────────────────────────┐
│ CAMPAÑAS FINALIZADAS CON LEADS ASIGNADOS                                   │
├────────────────────────────────────────────────────────────────────────────┤
│  ID │ Cliente               │ #  │ Marca      │ Fecha Fin  │ Leads │
├────────────────────────────────────────────────────────────────────────────┤
│   53 │ ALBENS                │  2 │ Peugeot    │ 2025-06-22 │   201 │
│   54 │ ALBENS                │  3 │ Peugeot    │ 2025-06-26 │   204 │
│   ...
└────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════
📊 RESUMEN DE OPERACIÓN:

   Campañas a resetear: 40
   Total de leads a liberar: 7676
═══════════════════════════════════════════════════════════
```

### ⚠️ ADVERTENCIA

Este script resetea **TODAS** las campañas finalizadas de una vez:
- ✅ Útil para limpiar el ambiente de testing completamente
- ✅ Libera todos los leads asignados para pruebas
- ⚠️ **Siempre usar --dry-run primero**
- ⚠️ **No usar en producción sin backup**

---

## 🔧 Troubleshooting

### Error: "Campaña no encontrada"

**Problema:** El ID o nombre de campaña no existe.

**Solución:**
```bash
# Listar todas las campañas disponibles
npx tsx server/reset-campaign-leads-helper.ts
```

### Error: "No hay leads asignados"

**Problema:** La campaña ya está limpia.

**Solución:** No hay nada que hacer. La campaña ya está lista para pruebas.

### Error: "Se encontraron N campañas que coinciden"

**Problema:** Hay múltiples campañas con el mismo cliente y número.

**Solución:**
```bash
# Usar --campaign-id específico en lugar de nombre
npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=65
```

---

## 📚 Recursos Relacionados

- [Análisis de Conteo Multimarca](../ANALISIS-RED-FINANCE-TEST.md)
- [Utilidades Multimarca](../shared/utils/multi-brand-utils.ts)
- [Normalización de Clientes](../shared/utils/client-normalization.ts)
- [Cierre de Campañas](./campaign-closure/)

---

## 💡 Tips

### Ver estado de una campaña específica
```bash
npx tsx server/test-conteo-con-fechas.ts
```

### Verificar leads disponibles
```bash
npx tsx server/debug-red-finance-leads.ts
```

### Listar todas las campañas
```bash
npx tsx server/reset-campaign-leads-helper.ts | grep "Red Finance"
```

---

## 📝 Changelog

### v1.0.0 (2025-10-06)
- ✅ Script principal de reset
- ✅ Helper para listar campañas
- ✅ Modo dry-run
- ✅ Validaciones de seguridad
- ✅ Logs detallados
- ✅ Documentación completa
