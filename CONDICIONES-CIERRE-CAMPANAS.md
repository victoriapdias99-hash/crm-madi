# 📋 CONDICIONES DE CIERRE DE CAMPAÑAS

## Índice
1. [Flujo General de Cierre](#flujo-general-de-cierre)
2. [Condiciones de Conteo](#condiciones-de-conteo)
3. [Tipos de Cierre](#tipos-de-cierre)
4. [Casos de Uso y Escenarios](#casos-de-uso-y-escenarios)
5. [Problemas Identificados](#problemas-identificados)

---

## 1. Flujo General de Cierre

### Diagrama del Proceso

```
Usuario solicita cierre
         ↓
[1] Obtener campaña por ID
         ↓
[2] Contar leads YA asignados (currentAssignedLeads)
         ↓
[3] Contar leads DISPONIBLES (availableLeadsCount)
         ↓
[4] ¿Ya alcanzó la meta?
    ├─ SÍ (currentAssignedLeads >= targetLeads)
    │   └→ CERRAR INMEDIATAMENTE
    │      └→ SET fecha_fin = última fecha de lead
    │
    └─ NO (currentAssignedLeads < targetLeads)
        ↓
    [5] ¿Hay leads disponibles?
        ├─ NO (availableLeadsCount = 0)
        │   ├─ ¿Es cierre forzado (forceClose=true)?
        │   │   ├─ SÍ → CERRAR con leads actuales
        │   │   └─ NO → ERROR: No hay leads disponibles
        │   │
        │   └→ Retornar sin cerrar
        │
        └─ SÍ (availableLeadsCount > 0)
            ↓
        [6] Calcular leads a asignar
            leadsNeeded = targetLeads - currentAssignedLeads
            leadsToAssign = min(availableLeadsCount, leadsNeeded)
            ↓
        [7] Obtener leads para asignación
            ↓
        [8] Asignar leads en lotes
            ↓
        [9] ¿Alcanzó la meta ahora?
            ├─ SÍ → CERRAR campaña
            └─ NO → Retornar leads asignados (sin cerrar)
```

---

## 2. Condiciones de Conteo

### 2.1 Conteo de Leads Asignados

**Ubicación:** `CampaignProcessor.ts:264`

```typescript
const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(campaign.id);
```

**Query real:**
```sql
SELECT COUNT(*)::int
FROM op_lead
WHERE campaign_id = {campaignId}
```

**⚠️ IMPORTANTE:** Cuenta **TODOS los registros** en `op_lead`, incluyendo duplicados.

**Ejemplo:**
```
Campaign ID: 65
op_lead tiene:
  - Lead 1 (duplicado A)
  - Lead 1 (duplicado B)
  - Lead 1 (duplicado C)
  - Lead 2 (duplicado A)
  - Lead 2 (duplicado B)

COUNT(*) = 5 registros totales
```

---

### 2.2 Conteo de Leads Disponibles

**Ubicación:** `CampaignProcessor.ts:270`

```typescript
const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
  campaign.clientName,
  campaign.brandName,
  campaign.zone
);
```

**Query real (en dos pasos):**

**Paso 1: Obtener leads únicos candidatos**
```sql
SELECT id, duplicate_ids
FROM op_leads_rep
WHERE campaign_id IS NULL
  AND marca ILIKE '%{brand}%'
  AND cliente ILIKE '%{client}%'
  AND localizacion ILIKE '%{zone}%'
```

**Paso 2: Verificar duplicados asignados**
```sql
-- Para cada lead único, verificar sus duplicados
SELECT id
FROM op_lead
WHERE id = ANY(duplicate_ids)
  AND campaign_id IS NOT NULL
```

**Paso 3: Contar solo leads sin duplicados asignados**
```typescript
let count = 0;
for (const uniqueLead of uniqueLeads) {
  const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];
  const hasAssignedDuplicate = duplicateIds.some(id => assignedSet.has(id));

  if (!hasAssignedDuplicate) {
    count++; // ✅ Solo contar si NINGÚN duplicado está asignado
  }
}
```

**📊 Ejemplo:**

```
op_leads_rep:
  UniqueID 100 → duplicateIds: [1001, 1002, 1003]
  UniqueID 200 → duplicateIds: [2001, 2002]
  UniqueID 300 → duplicateIds: [3001, 3002, 3003, 3004]

op_lead (asignados):
  1002 → campaign_id = 50 (ASIGNADO)
  2001 → campaign_id = NULL (DISPONIBLE)
  2002 → campaign_id = NULL (DISPONIBLE)

Resultado:
  UniqueID 100 → ❌ NO contar (duplicado 1002 ya asignado)
  UniqueID 200 → ✅ CONTAR (ningún duplicado asignado)
  UniqueID 300 → ✅ CONTAR (ningún duplicado asignado)

availableLeadsCount = 2
```

---

### 2.3 Condición de Meta Alcanzada

**Ubicación:** `CampaignProcessor.ts:282`

```typescript
if (currentAssignedLeads >= campaign.targetLeads) {
  // CIERRE AUTOMÁTICO
  await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
}
```

**Condición simple:**
```
currentAssignedLeads >= targetLeads
```

**⚠️ CRÍTICO:** Usa el conteo de **TODOS los duplicados**, NO el conteo de leads únicos.

**Ejemplo:**
```
targetLeads = 100

Escenario 1:
  op_lead tiene 100 registros (puede ser 50 únicos con 50 duplicados)
  → currentAssignedLeads = 100
  → ✅ CIERRA (100 >= 100)

Escenario 2:
  op_lead tiene 99 registros
  → currentAssignedLeads = 99
  → ❌ NO CIERRA (99 < 100)
```

---

### 2.4 Cálculo de Leads a Asignar

**Ubicación:** `CampaignProcessor.ts:370`

```typescript
const leadsNeeded = campaign.targetLeads - currentAssignedLeads;
const leadsToAssign = Math.min(availableLeadsCount, leadsNeeded);
```

**Fórmula:**
```
leadsNeeded = targetLeads - currentAssignedLeads
leadsToAssign = MIN(availableLeadsCount, leadsNeeded)
```

**⚠️ INCONSISTENCIA CRÍTICA:**
- `leadsNeeded` se calcula con duplicados (currentAssignedLeads cuenta duplicados)
- `availableLeadsCount` cuenta solo leads únicos
- `leadsToAssign` usa el menor de ambos

**Ejemplo problemático:**

```
Situación:
  targetLeads = 100
  currentAssignedLeads = 80 duplicados (representan 50 únicos)
  availableLeadsCount = 30 únicos (representan 60 duplicados)

Cálculo:
  leadsNeeded = 100 - 80 = 20
  leadsToAssign = MIN(30, 20) = 20

Se asignarán 20 leads ÚNICOS, pero cada uno puede tener duplicados:
  Si cada lead único tiene 2 duplicados → 20 × 2 = 40 duplicados
  Total después: 80 + 40 = 120 duplicados
  → ✅ CIERRA (120 >= 100) pero se pasó de la meta
```

---

### 2.5 Asignación de Duplicados

**Ubicación:** `PostgresLeadRepository.ts:376-384`

```typescript
const leadsForAssignment = await this.leadRepository.getLeadsForAssignment(
  campaign.clientName,
  campaign.brandName,
  campaign.zone,
  leadsToAssign  // ← Número de leads ÚNICOS
);
```

**Proceso:**
1. Obtiene `leadsToAssign` leads únicos de `op_leads_rep`
2. Cada lead único tiene su array `duplicateIds`
3. Extrae TODOS los `duplicateIds` de esos leads únicos
4. Asigna TODOS los duplicados en `op_lead`

**Query de asignación:**
```sql
UPDATE op_lead
SET campaign_id = {campaignId}, updated_at = NOW()
WHERE id = ANY(allDuplicateIds)
```

**Ejemplo:**
```
leadsToAssign = 3 leads únicos

Lead único 1 → duplicateIds: [101, 102, 103] (3 duplicados)
Lead único 2 → duplicateIds: [201, 202] (2 duplicados)
Lead único 3 → duplicateIds: [301, 302, 303, 304] (4 duplicados)

Total a asignar: 3 + 2 + 4 = 9 duplicados

UPDATE op_lead
SET campaign_id = 65
WHERE id IN (101, 102, 103, 201, 202, 301, 302, 303, 304)
```

---

### 2.6 Verificación Post-Asignación

**Ubicación:** `CampaignProcessor.ts:443`

```typescript
const totalLeads = currentAssignedLeads + assignedCount;
if (totalLeads >= campaign.targetLeads) {
  // CERRAR campaña
  await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
}
```

**Condición:**
```
(currentAssignedLeads + assignedCount) >= targetLeads
```

**Variables:**
- `currentAssignedLeads`: Conteo ANTES de asignar (incluye duplicados)
- `assignedCount`: DUPLICADOS recién asignados (no leads únicos)
- `targetLeads`: Meta de la campaña

---

## 3. Tipos de Cierre

### 3.1 Cierre Automático (Meta Alcanzada)

**Condición:**
```typescript
if (currentAssignedLeads >= targetLeads) {
  // Cierre automático
}
```

**Características:**
- ✅ Se ejecuta automáticamente si ya hay suficientes leads
- ✅ No requiere intervención del usuario
- ✅ Se ejecuta ANTES de intentar asignar más leads

---

### 3.2 Cierre por Asignación (Alcanza Meta)

**Condición:**
```typescript
const totalLeads = currentAssignedLeads + assignedCount;
if (totalLeads >= targetLeads) {
  // Cierre después de asignar
}
```

**Características:**
- ✅ Se ejecuta DESPUÉS de asignar nuevos leads
- ✅ Verifica si la asignación hizo que se alcance la meta
- ✅ Es el flujo normal de cierre

---

### 3.3 Cierre Forzado Manual

**Condición:**
```typescript
if (forceClose && currentAssignedLeads > 0) {
  // Cierre forzado aunque no llegue a meta
  await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
}
```

**Características:**
- ⚠️ Se activa con `forceClose = true`
- ⚠️ Cierra aunque NO alcance la meta
- ⚠️ Requiere que haya al menos 1 lead asignado
- ⚠️ Solo funciona cuando NO hay leads disponibles

**Cuándo se usa:**
```typescript
if (availableLeadsCount === 0 && forceClose && currentAssignedLeads > 0) {
  // Cerrar con lo que hay
}
```

---

## 4. Casos de Uso y Escenarios

### Escenario 1: Campaña con Suficientes Leads

```
Estado inicial:
  targetLeads = 100
  currentAssignedLeads = 60
  availableLeadsCount = 25 únicos (50 duplicados)

Ejecución:
  [1] ¿Ya alcanzó meta? NO (60 < 100)
  [2] ¿Hay disponibles? SÍ (25 > 0)
  [3] leadsNeeded = 100 - 60 = 40
  [4] leadsToAssign = MIN(25, 40) = 25
  [5] Asignar 25 únicos → 50 duplicados
  [6] totalLeads = 60 + 50 = 110
  [7] ¿Alcanzó meta? SÍ (110 >= 100)
  [8] ✅ CERRAR campaña

Resultado: ✅ Campaña cerrada con 110 leads (10% más de la meta)
```

---

### Escenario 2: Campaña Sin Leads Disponibles (Cierre Manual)

```
Estado inicial:
  targetLeads = 100
  currentAssignedLeads = 82
  availableLeadsCount = 0
  forceClose = true (cierre manual)

Ejecución:
  [1] ¿Ya alcanzó meta? NO (82 < 100)
  [2] ¿Hay disponibles? NO (0 = 0)
  [3] ¿Es cierre forzado? SÍ (forceClose = true)
  [4] ¿Hay leads asignados? SÍ (82 > 0)
  [5] ✅ CERRAR campaña con 82 leads

Resultado: ✅ Campaña cerrada con 82 leads (82% de la meta)
```

---

### Escenario 3: Campaña Sin Leads Disponibles (Cierre Automático)

```
Estado inicial:
  targetLeads = 100
  currentAssignedLeads = 82
  availableLeadsCount = 0
  forceClose = false (cierre automático)

Ejecución:
  [1] ¿Ya alcanzó meta? NO (82 < 100)
  [2] ¿Hay disponibles? NO (0 = 0)
  [3] ¿Es cierre forzado? NO (forceClose = false)
  [4] ❌ ERROR: No hay leads disponibles

Resultado: ❌ Error, campaña NO cerrada
```

---

### Escenario 4: Campaña que Ya Alcanzó la Meta

```
Estado inicial:
  targetLeads = 100
  currentAssignedLeads = 105
  availableLeadsCount = 10

Ejecución:
  [1] ¿Ya alcanzó meta? SÍ (105 >= 100)
  [2] ✅ CERRAR INMEDIATAMENTE

Resultado: ✅ Campaña cerrada sin asignar más leads
```

---

## 5. Problemas Identificados

### 🔴 Problema 1: Inconsistencia de Conteo

**Descripción:**
El sistema mezcla dos tipos de conteo:
- `currentAssignedLeads`: cuenta duplicados
- `availableLeadsCount`: cuenta únicos
- `leadsToAssign`: usa ambos para calcular

**Impacto:**
```
Ejemplo:
  targetLeads = 100
  currentAssignedLeads = 80 duplicados (50 únicos reales)
  availableLeadsCount = 30 únicos

  leadsNeeded = 100 - 80 = 20
  leadsToAssign = MIN(30, 20) = 20 únicos

  Si cada único tiene 2 duplicados:
    20 únicos × 2 = 40 duplicados
    Total: 80 + 40 = 120 ❌ Se pasó de la meta en 20%
```

**Solución propuesta:**
Calcular `leadsNeeded` en términos de leads únicos, no duplicados.

---

### 🔴 Problema 2: Dashboard vs Sistema de Cierre

**Descripción:**
El dashboard muestra un conteo diferente al sistema de cierre:
- Dashboard: cuenta todos los duplicados asociados al cliente/marca/zona
- Sistema: cuenta solo duplicados asignados a la campaña específica

**Ejemplo Red Finance #1:**
```
Dashboard muestra:
  enviados: 212
  duplicados: 214

Sistema de cierre cuenta:
  currentAssignedLeads: 82

Diferencia: 130 leads de discrepancia
```

**Impacto:**
El usuario ve 212% de progreso en el dashboard, pero el sistema solo reconoce 82%.

---

### 🟡 Problema 3: Cierre Forzado Inconsistente

**Descripción:**
El cierre forzado solo funciona cuando:
```typescript
if (forceClose && currentAssignedLeads > 0 && availableLeadsCount === 0)
```

**Limitaciones:**
- ❌ No permite cerrar si HAY leads disponibles
- ❌ No permite cerrar con 0 leads asignados
- ❌ No permite cerrar en cualquier momento que el usuario quiera

**Caso de uso bloqueado:**
```
Usuario quiere cerrar campaña manualmente con 50/100 leads
porque cambió la estrategia de marketing.

Sistema dice: "No puedes cerrar, aún hay leads disponibles"
```

---

### 🟡 Problema 4: No Hay Límite en Duplicados

**Descripción:**
El sistema no limita cuántos duplicados puede tener un lead único.

**Impacto:**
```
Si un lead único tiene 100 duplicados:
  leadsToAssign = 1 único
  assignedCount = 100 duplicados

  Puede superar la meta dramáticamente
```

**Ejemplo extremo:**
```
targetLeads = 100
currentAssignedLeads = 99
availableLeadsCount = 1 único (con 500 duplicados)

leadsNeeded = 1
leadsToAssign = 1
assignedCount = 500

Total: 99 + 500 = 599 ❌ 499% de la meta
```

---

## 📋 Resumen de Condiciones

### Tabla de Condiciones

| Condición | Ubicación | Tipo de Conteo | Descripción |
|-----------|-----------|----------------|-------------|
| `currentAssignedLeads >= targetLeads` | CampaignProcessor:282 | Duplicados | Cierre automático inmediato |
| `availableLeadsCount === 0` | CampaignProcessor:318 | Únicos | No hay leads para asignar |
| `forceClose && currentAssignedLeads > 0` | CampaignProcessor:321 | Duplicados | Cierre forzado manual |
| `totalLeads >= targetLeads` | CampaignProcessor:444 | Duplicados | Cierre post-asignación |
| `leadsNeeded = targetLeads - currentAssignedLeads` | CampaignProcessor:370 | Duplicados | Cálculo de necesidad |
| `leadsToAssign = MIN(availableLeadsCount, leadsNeeded)` | CampaignProcessor:371 | Mixto | Cantidad a procesar |

---

## ✅ Recomendaciones

### 1. Unificar Sistema de Conteo
Decidir si el sistema debe trabajar con:
- **Opción A:** Solo leads únicos (recomendado)
- **Opción B:** Solo duplicados totales
- **Opción C:** Ambos, pero con conversión explícita

### 2. Ajustar Cálculo de leadsNeeded
```typescript
// En lugar de:
const leadsNeeded = targetLeads - currentAssignedLeads;

// Usar:
const currentUniqueLeads = await countUniqueAssignedLeads(campaignId);
const leadsNeeded = targetLeads - currentUniqueLeads;
```

### 3. Mejorar Cierre Forzado
```typescript
// Permitir cierre manual en cualquier momento:
if (forceClose) {
  if (currentAssignedLeads > 0) {
    // Cerrar con lo que hay
  } else {
    // Advertencia: campaña sin leads
  }
}
```

### 4. Agregar Límite de Duplicados
```typescript
const MAX_DUPLICATES_PER_UNIQUE = 10;
const clampedDuplicates = Math.min(
  duplicateIds.length,
  MAX_DUPLICATES_PER_UNIQUE
);
```

---

## 🎯 Conclusión

El sistema de cierre tiene **condiciones mixtas** que pueden causar inconsistencias:

✅ **Funciona bien cuando:**
- Los leads únicos tienen pocos duplicados (1-3)
- Las metas son alcanzables con los leads disponibles
- Se usa cierre automático sin intervención manual

⚠️ **Tiene problemas cuando:**
- Hay muchos duplicados por lead único
- El dashboard muestra datos diferentes al sistema
- Se intenta cerrar manualmente con leads disponibles
- Los cálculos mezclan únicos y duplicados

**Próximo paso:** Decidir qué ajustes hacer a estas condiciones.
