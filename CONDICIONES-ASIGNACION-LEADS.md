# 📋 CONDICIONES DE ASIGNACIÓN DE LEADS

## 🎯 Resumen Ejecutivo

Este documento explica **cuándo y cómo** se asignan los leads a las campañas en el sistema de cierre automático.

---

## 🔄 Flujo General de Asignación

```
┌─────────────────────────────────────────────────────────────┐
│  1. Cliente solicita cierre de campaña                      │
│     ↓                                                        │
│  2. Sistema verifica condiciones de asignación              │
│     ↓                                                        │
│  3. ¿Se cumplen las condiciones?                            │
│     ├─ SÍ → Asigna leads                                    │
│     └─ NO → Cierra campaña sin asignar (si es manual)       │
│     ↓                                                        │
│  4. ¿Se alcanzó la meta?                                    │
│     ├─ SÍ → Cierra campaña automáticamente                  │
│     └─ NO → Deja campaña abierta                            │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ CONDICIONES PARA ASIGNAR LEADS

### **Condición 1: Campaña debe estar "En proceso"**

```typescript
// CampaignProcessor.ts:162
pendingCampaigns = campaigns.filter(c => c.status === 'En proceso');
```

**Explicación:**
- Solo se procesan campañas con `estadoCampana = 'En proceso'`
- Campañas "Finalizada" son ignoradas

---

### **Condición 2: Campaña NO debe haber alcanzado su meta**

```typescript
// CampaignProcessor.ts:169
if (currentAssignedLeads >= campaign.targetLeads) {
  // NO asigna más leads, solo cierra la campaña
  console.log(`✅ Campaña ya completó su meta (${currentAssignedLeads}/${campaign.targetLeads})`);
  await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
  return { success: true, leadsAssigned: 0, campaignDetail };
}
```

**Explicación:**
- Si `currentAssignedLeads >= targetLeads` → **NO asigna leads**
- Solo ejecuta el cierre de la campaña
- Ejemplo: Red Finance #1 tenía 82/100 leads, por lo que SÍ puede recibir más

---

### **Condición 3: Deben existir leads disponibles**

```typescript
// CampaignProcessor.ts:157-161
const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
  campaign.clientName,
  campaign.brandName,
  campaign.zone
);

// CampaignProcessor.ts:205
if (availableLeadsCount === 0) {
  // Sin leads disponibles
  if (forceClose && currentAssignedLeads > 0) {
    // Cierre manual: cierra campaña sin asignar
    return closeCampaign(campaign.id);
  }
  return { success: false, error: 'No hay leads disponibles' };
}
```

**Explicación:**
- Cuenta leads **únicos** en `op_leads_rep` que NO están asignados
- Si `availableLeadsCount = 0`:
  - **Cierre manual (`forceClose=true`)**: Cierra campaña sin asignar
  - **Cierre automático**: Devuelve error

---

### **Condición 4: Leads deben cumplir filtros de la campaña**

#### **4.1 Filtros Básicos**

```typescript
// PostgresLeadRepository.ts:95-103
const uniqueLeads = await this.db
  .select()
  .from(opLeadsRep)
  .where(
    and(
      isNull(opLeadsRep.campaignId),  // 🔑 NO asignados
      ilike(opLeadsRep.marca, `%${normalizedBrand}%`),  // ✅ Marca coincide
      ilike(opLeadsRep.cliente, `%${normalizedClient}%`), // ✅ Cliente coincide
      ilike(opLeadsRep.localizacion, `%${normalizedZone}%`) // ✅ Zona coincide
    )
  )
```

**Los leads DEBEN cumplir:**
1. ✅ **`campaign_id IS NULL`** - No estar asignados a ninguna campaña
2. ✅ **Marca coincide** - `campaign` LIKE '%peugeot%' (ej.)
3. ✅ **Cliente coincide** - `cliente` = 'red_finance'
4. ✅ **Zona coincide** - `localizacion` = 'Mendoza'

---

#### **4.2 Filtros de Duplicados**

```typescript
// PostgresLeadRepository.ts:116-133
// ✅ Query única para obtener todos los leads asignados
const assignedLeads = await this.db
  .select({
    id: opLead.id,
    campaignId: opLead.campaignId
  })
  .from(opLead)
  .where(
    and(
      inArray(opLead.id, allDuplicateIds),
      sql`${opLead.campaignId} IS NOT NULL`
    )
  );

// Crear Set para lookup O(1) y filtrar leads disponibles
const assignedSet = new Set(assignedLeads.map(l => l.id));

for (const uniqueLead of uniqueLeads) {
  const duplicateIds = uniqueLead.duplicateIds || [uniqueLead.id];

  // Verificar si alguno de los duplicados está asignado
  const hasAssignedDuplicate = duplicateIds.some(id => assignedSet.has(id));

  if (!hasAssignedDuplicate) {
    // ✅ Ningún duplicado asignado, incluir
    availableUniqueLeads.push(lead);
  }
}
```

**Explicación:**
- Lead único en `op_leads_rep` tiene un array `duplicateIds`
- Si **ALGÚN** duplicado ya está asignado → Lead NO disponible
- Solo se asignan leads donde **NINGUNO** de sus duplicados esté asignado

**Ejemplo:**
```
Lead único ID 12345 con duplicateIds = [12345, 12346, 12347]

Verificación:
- ¿12345 asignado? NO
- ¿12346 asignado? NO
- ¿12347 asignado? NO
→ ✅ Lead 12345 DISPONIBLE

Si 12346 estuviera asignado:
- ¿12345 asignado? NO
- ¿12346 asignado? SÍ ← ❌
→ ❌ Lead 12345 NO DISPONIBLE
```

---

#### **4.3 Filtro de Fecha de Creación (Orden Cronológico)**

```typescript
// PostgresLeadRepository.ts:105
.orderBy(asc(opLeadsRep.fechaCreacion))
```

**Explicación:**
- Los leads se seleccionan en **orden cronológico** (más antiguos primero)
- Garantiza que se asignen los leads que llegaron primero

---

### **Condición 5: Cantidad de leads a asignar**

```typescript
// CampaignProcessor.ts:256-260
const leadsNeeded = campaign.targetLeads - currentAssignedLeads;
const leadsToAssign = Math.min(availableLeadsCount, leadsNeeded);

console.log(`🎯 Leads necesarios: ${leadsNeeded}, disponibles: ${availableLeadsCount}, asignaremos: ${leadsToAssign}`);
```

**Explicación:**
- Se calcula cuántos leads faltan para completar la meta
- Se asigna el **mínimo** entre:
  - Leads necesarios para completar meta
  - Leads disponibles que cumplen filtros

**Ejemplo Red Finance #1:**
```
Meta: 100 leads
Ya asignados: 82 leads
Leads necesarios: 100 - 82 = 18 leads

Disponibles: 25 leads
→ Se asignarán: min(18, 25) = 18 leads
```

---

## 🔄 PROCESO DE ASIGNACIÓN

### **Paso 1: Contar leads ya asignados**

```typescript
// CampaignProcessor.ts:151
const currentAssignedLeads = await this.leadRepository
  .countAssignedLeadsForCampaign(campaign.id, true);
```

**Con filtros genéricos habilitados:**
```sql
SELECT COUNT(*) FROM op_lead
WHERE (
  lower(campaign) LIKE '%peugeot%' OR
  lower(campaign) LIKE '%fiat%'
)
AND cliente = 'red_finance'
AND localizacion = 'Mendoza'
AND campaign_id = 65
AND date(fecha_creacion) >= '2025-08-26'
AND date(fecha_creacion) <= '2025-10-02'  -- Si fechaFin existe
```

---

### **Paso 2: Contar leads disponibles**

```typescript
// CampaignProcessor.ts:157-161
const availableLeadsCount = await this.leadRepository
  .countUniqueLeadsForClient(
    campaign.clientName,
    campaign.brandName,
    campaign.zone
  );
```

**Query ejecutado:**
```sql
-- Obtener leads únicos candidatos
SELECT * FROM op_leads_rep
WHERE campaign_id IS NULL
  AND marca ILIKE '%peugeot%'
  AND cliente ILIKE '%red finance%'
  AND localizacion ILIKE '%mendoza%'

-- Luego filtrar por duplicados no asignados
-- (verificación en memoria con Set)
```

---

### **Paso 3: Obtener leads para asignación**

```typescript
// CampaignProcessor.ts:265-270
const leadsForAssignment = await this.leadRepository
  .getLeadsForAssignment(
    campaign.clientName,
    campaign.brandName,
    campaign.zone,
    leadsToAssign  // Solo los necesarios
  );
```

**Retorna:**
- Array de leads únicos disponibles
- Con sus `duplicateIds` incluidos
- Ordenados cronológicamente

---

### **Paso 4: Asignar leads en lotes**

```typescript
// CampaignProcessor.ts:301-314
assignedCount = await Promise.race([
  this.leadRepository.assignLeadsInBatches(
    leadsForAssignment,
    campaign.id,
    100,  // Tamaño del lote
    progressCallback
  ),
  timeoutPromise
]);
```

**Proceso de asignación en lotes:**

```typescript
// PostgresLeadRepository.ts:191-197
// Extraer TODOS los duplicate IDs de los leads únicos
const allDuplicateIds: number[] = [];
for (const lead of leads) {
  const duplicateIds = lead.duplicateIds || [lead.id];
  allDuplicateIds.push(...duplicateIds);
}

// Asignar en lotes de 100
for (let i = 0; i < allDuplicateIds.length; i += batchSize) {
  const batch = allDuplicateIds.slice(i, i + batchSize);

  await this.db
    .update(opLead)
    .set({
      campaignId: campaignId,
      updatedAt: new Date()
    })
    .where(
      and(
        inArray(opLead.id, batch),
        isNull(opLead.campaignId)  // Doble verificación
      )
    );
}
```

**Ejemplo:**
```
Lead único ID 12345 con duplicateIds = [12345, 12346, 12347]

UPDATE op_lead
SET campaign_id = 65, updated_at = NOW()
WHERE id IN (12345, 12346, 12347)
  AND campaign_id IS NULL;

→ Se actualizan 3 registros (todos los duplicados)
```

---

## 🎯 CONDICIONES DE CIERRE

### **Cierre Automático (Meta Alcanzada)**

```typescript
// CampaignProcessor.ts:169-203
if (currentAssignedLeads >= campaign.targetLeads) {
  const finalLeadDate = await this.leadRepository
    .getLastLeadDateForCampaign(campaign.id);

  await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
}
```

**Condiciones:**
1. ✅ `currentAssignedLeads >= targetLeads`
2. ✅ Existe `finalLeadDate` (fecha del último lead asignado)

**Resultado:**
- `fechaFin = finalLeadDate`
- `estadoCampana = 'Finalizada'` (actualizado en base de datos)

---

### **Cierre Manual (Forzado)**

```typescript
// CampaignProcessor.ts:205-242
if (availableLeadsCount === 0 && forceClose && currentAssignedLeads > 0) {
  const finalLeadDate = await this.leadRepository
    .getLastLeadDateForCampaign(campaign.id);

  await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
}
```

**Condiciones:**
1. ✅ `availableLeadsCount = 0` (no hay más leads)
2. ✅ `forceClose = true` (usuario solicitó cierre manual)
3. ✅ `currentAssignedLeads > 0` (tiene al menos un lead asignado)

**Resultado:**
- Cierra campaña aunque NO haya alcanzado meta
- `fechaFin = finalLeadDate`
- `estadoCampana = 'Finalizada'`

**Ejemplo Red Finance #1:**
```
currentAssignedLeads = 82
targetLeads = 100
availableLeadsCount = 0
forceClose = true

→ ✅ Se cierra con 82/100 leads (82%)
```

---

## 📊 CASO PRÁCTICO: Red Finance #1

### **Datos iniciales:**
```
Campaña ID: 65
Cliente: Red Finance
Marca: Peugeot (principal), Fiat (secundaria)
Zona: Mendoza
Meta: 100 leads
Estado: En proceso
Fecha inicio: 2025-08-26
Fecha fin: NULL (en proceso)
```

### **Ejecución del cierre:**

#### **Paso 1: Contar asignados**
```
Query con filtros genéricos:
- Cliente = red_finance ✅
- Marca = Peugeot OR Fiat ✅
- Zona = Mendoza ✅
- campaign_id = 65 ✅
- fecha >= 2025-08-26 ✅
- fecha <= NULL (sin límite) ✅

Resultado: 82 leads
```

#### **Paso 2: Verificar meta**
```
82 >= 100? NO
→ Campaña NO alcanzó meta, verificar disponibles
```

#### **Paso 3: Contar disponibles**
```
Leads únicos en op_leads_rep:
- Cliente = red_finance ✅
- Marca = Peugeot OR Fiat ✅
- Zona = Mendoza ✅
- campaign_id IS NULL ✅
- Sin duplicados asignados ✅

Resultado: 0 leads disponibles
```

#### **Paso 4: Aplicar lógica de cierre**
```
availableLeadsCount = 0
forceClose = true (cierre manual solicitado)
currentAssignedLeads = 82 > 0

→ ✅ CIERRE MANUAL
```

#### **Paso 5: Cerrar campaña**
```
finalLeadDate = 2025-10-02 (fecha del último lead)

UPDATE campanas_comerciales
SET fecha_fin = '2025-10-02',
    estado_campana = 'Finalizada'
WHERE id = 65;
```

---

## 🔍 VALIDACIONES ADICIONALES (Filtros Genéricos)

Cuando `USE_GENERIC_CAMPAIGN_FILTERS = true`, se aplican validaciones extras:

### **Validación de Fecha**

Los 2 leads con `fecha_creacion > fechaFin` son **excluidos**:

```
Lead ID 318565 (Yoel): fecha = 2025-10-03
Lead ID 318571 (Carla): fecha = 2025-10-03

fechaFin de campaña = 2025-10-02

→ ❌ Excluidos del conteo (fuera de rango)
```

**Resultado:**
- **Legacy:** 82 leads (incluye los 2 fuera de rango)
- **Generic:** 80 leads (excluye los 2 fuera de rango)

Esto es **CORRECTO** - los filtros genéricos detectaron datos inconsistentes.

---

## 📝 RESUMEN DE CONDICIONES

### ✅ **Para ASIGNAR leads:**

1. Campaña en estado "En proceso"
2. Meta NO alcanzada (`currentAssignedLeads < targetLeads`)
3. Existen leads disponibles (`availableLeadsCount > 0`)
4. Leads cumplen filtros:
   - Cliente coincide
   - Marca coincide (multi-marca soportada)
   - Zona coincide
   - NO asignados (`campaign_id IS NULL`)
   - Ningún duplicado asignado
5. Se asignan en orden cronológico
6. Cantidad: `min(leadsNeeded, availableLeadsCount)`

### ✅ **Para CERRAR campaña:**

**Automático:**
- `currentAssignedLeads >= targetLeads`

**Manual:**
- `availableLeadsCount = 0`
- `forceClose = true`
- `currentAssignedLeads > 0`

---

**Fecha:** 2025-10-09
**Sistema:** CRM MADI - Campaign Closure Module
**Versión:** 2.0 (con filtros genéricos)
