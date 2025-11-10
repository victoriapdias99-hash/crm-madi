# 📊 QUERIES DE PRODUCCIÓN - Red Finance Campaña #1

## 🎯 Contexto

**Campaña:** Red Finance #1 (ID: 65)
- **Cliente:** Red Finance
- **Marca Principal:** Peugeot
- **Marca Secundaria:** Fiat
- **Zona:** Mendoza
- **Meta:** 100 leads
- **Fecha Inicio:** 2025-08-26
- **Fecha Fin:** NULL (en proceso)
- **Estado:** En proceso
- **Asignación Automática:** true (modo multi-marca)

---

## 📋 FLUJO COMPLETO DE QUERIES

### **PASO 1: Obtener datos de la campaña**

```sql
-- Query ejecutado por: getCampaignsByClient() y getCampaignDataForFiltering()
SELECT
  cc.*,
  c.nombre_comercial,
  c.id as cliente_id
FROM campanas_comerciales cc
LEFT JOIN clientes c ON cc.cliente_id = c.id
WHERE cc.id = 65
LIMIT 1;
```

**Resultado:**
```
id: 65
numero_campana: 1
cliente_id: 18
cliente: "Red Finance"
marca: "Peugeot"
marca2: "Fiat"
marca3: NULL
marca4: NULL
marca5: NULL
porcentaje: 50
porcentaje2: 50
porcentaje3: NULL
porcentaje4: NULL
porcentaje5: NULL
zona: "Mendoza"
cantidad_datos_solicitados: 100
estado_campana: "En proceso"
fecha_campana: "2025-08-26"
fecha_fin: NULL
asignacion_automatica: true
```

---

### **PASO 2: Contar leads YA asignados (con filtros genéricos)**

**Método:** `countAssignedLeadsForCampaign(65, true)`

```sql
-- Query con USE_GENERIC_CAMPAIGN_FILTERS = true
SELECT COUNT(*)::int as count
FROM op_lead
WHERE (
  -- Multi-marca: Peugeot OR Fiat
  lower(campaign) LIKE '%peugeot%'
  OR lower(campaign) LIKE '%fiat%'
)
AND cliente = 'red_finance'  -- Cliente normalizado
AND localizacion = 'Mendoza'  -- Zona normalizada
AND campaign_id = 65  -- Solo esta campaña
AND date(fecha_creacion) >= '2025-08-26'  -- Desde fecha de inicio
-- No hay fecha_fin porque la campaña está en proceso
;
```

**Resultado:**
```
count: 82
```

**Explicación:**
- ✅ Cuenta leads de Peugeot Y Fiat (multi-marca)
- ✅ Solo del cliente Red Finance
- ✅ Solo de zona Mendoza
- ✅ Solo con campaign_id = 65
- ✅ Solo con fecha >= 2025-08-26
- ❌ Excluye 2 leads con fecha > fechaFin (si existiera)

---

### **PASO 3: Verificar si alcanzó la meta**

```typescript
if (currentAssignedLeads >= targetLeads) {
  // 82 >= 100? NO
  // → Continuar con asignación
}
```

---

### **PASO 4: Contar leads DISPONIBLES**

**Método:** `countUniqueLeadsForClient("Red Finance", "Peugeot", "Mendoza")`

#### **Query 4.1: Obtener leads únicos candidatos**

```sql
SELECT
  id,
  duplicate_ids
FROM op_leads_rep
WHERE campaign_id IS NULL  -- Solo leads NO asignados
  AND marca ILIKE '%peugeot%'  -- Marca coincide (solo usa marca principal)
  AND cliente ILIKE '%red finance%'  -- Cliente coincide
  AND localizacion ILIKE '%mendoza%'  -- Zona coincide
ORDER BY fecha_creacion ASC;  -- Orden cronológico
```

**Resultado (ejemplo):**
```
Leads únicos candidatos: 25 registros

id: 12345, duplicate_ids: [12345, 12346, 12347]
id: 12348, duplicate_ids: [12348, 12349]
id: 12350, duplicate_ids: [12350]
...
(total 25 leads únicos)
```

#### **Query 4.2: Verificar duplicados asignados (UNA sola query optimizada)**

```sql
SELECT id, campaign_id
FROM op_lead
WHERE id IN (
  12345, 12346, 12347,  -- Duplicados del lead 12345
  12348, 12349,          -- Duplicados del lead 12348
  12350,                 -- Duplicados del lead 12350
  ...                    -- Todos los duplicate_ids de los 25 únicos
)
AND campaign_id IS NOT NULL;
```

**Resultado (ejemplo):**
```
Duplicados asignados: 8 registros

id: 12346, campaign_id: 38
id: 12349, campaign_id: 45
...
```

#### **Query 4.3: Filtrar en memoria**

```typescript
// Crear Set con IDs asignados
const assignedSet = new Set([12346, 12349, ...]);

// Filtrar leads únicos
for (const uniqueLead of uniqueLeads) {
  const duplicateIds = uniqueLead.duplicate_ids;
  const hasAssigned = duplicateIds.some(id => assignedSet.has(id));

  if (!hasAssigned) {
    availableUniqueLeads.push(uniqueLead);
  }
}
```

**Resultado:**
```
Leads únicos disponibles: 18 leads
(excluyendo 7 que tenían algún duplicado asignado)
```

---

### **PASO 5: Calcular leads a asignar**

```typescript
const leadsNeeded = 100 - 82;  // 18 leads necesarios
const availableLeadsCount = 18;  // 18 leads disponibles
const leadsToAssign = Math.min(18, 18);  // 18 leads
```

---

### **PASO 6: Obtener leads para asignación**

**Método:** `getLeadsForAssignment("Red Finance", "Peugeot", "Mendoza", 18)`

#### **Query 6.1: Obtener leads únicos para asignación**

```sql
SELECT
  id,
  meta_lead_id,
  nombre,
  telefono,
  email,
  ciudad,
  modelo,
  comentario_horario,
  origen,
  localizacion,
  cliente,
  marca,
  campaign,
  campaign_id,
  fecha_creacion,
  created_at,
  duplicate_ids  -- CRÍTICO: Incluye los IDs de duplicados
FROM op_leads_rep
WHERE campaign_id IS NULL
  AND marca ILIKE '%peugeot%'
  AND cliente ILIKE '%red finance%'
  AND localizacion ILIKE '%mendoza%'
ORDER BY fecha_creacion ASC
LIMIT 54;  -- limit * 3 para compensar duplicados asignados
```

**Resultado:**
```
54 leads únicos obtenidos (candidatos)
```

#### **Query 6.2: Verificar duplicados asignados (igual que Query 4.2)**

```sql
SELECT id, campaign_id
FROM op_lead
WHERE id IN (
  -- Todos los duplicate_ids de los 54 leads únicos
  ...
)
AND campaign_id IS NOT NULL;
```

#### **Query 6.3: Filtrar y limitar a 18**

```typescript
const availableUniqueLeads = [];

for (const uniqueLead of uniqueLeads) {
  if (availableUniqueLeads.length >= 18) break;  // Ya tenemos suficientes

  const duplicateIds = uniqueLead.duplicate_ids || [uniqueLead.id];
  const hasAssigned = duplicateIds.some(id => assignedSet.has(id));

  if (!hasAssigned) {
    availableUniqueLeads.push({
      ...uniqueLead,
      duplicateIds: duplicateIds  // IMPORTANTE: Incluir para asignación
    });
  }
}
```

**Resultado:**
```
18 leads únicos disponibles para asignar

Ejemplo:
[
  {
    id: 12345,
    nombre: "Juan Pérez",
    telefono: "+54911...",
    marca: "Peugeot",
    cliente: "red_finance",
    localizacion: "Mendoza",
    fecha_creacion: "2025-10-04",
    duplicateIds: [12345, 12346, 12347]  // 3 duplicados
  },
  {
    id: 12350,
    nombre: "María García",
    duplicateIds: [12350]  // 1 solo registro
  },
  ...
  (total 18 leads únicos)
]
```

---

### **PASO 7: Asignar leads en lotes**

**Método:** `assignLeadsInBatches(leadsForAssignment, 65, 100, progressCallback)`

#### **Preparación: Extraer TODOS los duplicate_ids**

```typescript
const allDuplicateIds = [];

for (const lead of leadsForAssignment) {
  const duplicateIds = lead.duplicateIds || [lead.id];
  allDuplicateIds.push(...duplicateIds);
}

// Ejemplo:
// Lead 1: [12345, 12346, 12347] → 3 IDs
// Lead 2: [12350] → 1 ID
// Lead 3: [12351, 12352] → 2 IDs
// ...
// Total: 35 duplicate IDs (de 18 leads únicos)
```

**Total de duplicate_ids a asignar:** 35 registros

#### **Query 7.1: Asignación en lotes (Lote 1 - IDs 1-100)**

```sql
-- Lote 1: Los primeros 35 IDs (todos caben en un solo lote)
UPDATE op_lead
SET
  campaign_id = 65,
  updated_at = NOW()
WHERE id IN (
  12345, 12346, 12347,  -- Duplicados del lead 1
  12350,                 -- Lead 2
  12351, 12352,          -- Duplicados del lead 3
  ...                    -- Todos los 35 duplicate_ids
)
AND campaign_id IS NULL  -- Doble verificación de seguridad
RETURNING id;
```

**Resultado:**
```
35 registros actualizados
```

**Explicación:**
- ✅ Se asignan los **35 duplicados** de los **18 leads únicos**
- ✅ Cada lead único puede tener múltiples duplicados
- ✅ Todos los duplicados se asignan a la vez
- ✅ Doble verificación: solo asigna si `campaign_id IS NULL`

---

### **PASO 8: Verificar asignación exacta**

```sql
SELECT COUNT(*)::int as count
FROM op_lead
WHERE campaign_id = 65
  AND id IN (
    12345, 12346, 12347,
    12350,
    12351, 12352,
    ...
  );
```

**Resultado:**
```
count: 35  -- Todos los duplicados asignados correctamente
```

---

### **PASO 9: Verificar si se alcanzó la meta**

```typescript
const totalLeads = 82 + 35;  // 117 leads
const targetLeads = 100;

if (totalLeads >= targetLeads) {
  // 117 >= 100? SÍ
  // → CERRAR CAMPAÑA
}
```

---

### **PASO 10: Obtener fecha del último lead**

```sql
SELECT fecha_creacion
FROM op_lead
WHERE campaign_id = 65
ORDER BY fecha_creacion DESC
LIMIT 1;
```

**Resultado:**
```
fecha_creacion: 2025-10-04
```

---

### **PASO 11: Cerrar campaña**

```sql
UPDATE campanas_comerciales
SET
  fecha_fin = '2025-10-04',
  estado_campana = 'Finalizada',
  updated_at = NOW()
WHERE id = 65;
```

**Resultado:**
```
1 registro actualizado

Campaña 65 CERRADA:
- fecha_fin: 2025-10-04
- estado_campana: Finalizada
- leads asignados: 117/100 (117%)
```

---

## 🔍 QUERIES EN MODO LEGACY vs GENÉRICO

### **Modo LEGACY (USE_GENERIC_CAMPAIGN_FILTERS = false)**

#### Contar asignados:
```sql
SELECT COUNT(*)::int
FROM op_lead
WHERE campaign_id = 65;
```

**Diferencia con genérico:**
- ❌ No valida cliente
- ❌ No valida marca
- ❌ No valida zona
- ❌ No valida fechas
- ✅ Solo verifica campaign_id

---

### **Modo GENÉRICO (USE_GENERIC_CAMPAIGN_FILTERS = true)**

#### Contar asignados:
```sql
SELECT COUNT(*)::int
FROM op_lead
WHERE (
  lower(campaign) LIKE '%peugeot%' OR
  lower(campaign) LIKE '%fiat%'
)
AND cliente = 'red_finance'
AND localizacion = 'Mendoza'
AND campaign_id = 65
AND date(fecha_creacion) >= '2025-08-26';
```

**Ventajas:**
- ✅ Valida cliente
- ✅ Valida marca (multi-marca)
- ✅ Valida zona
- ✅ Valida rango de fechas
- ✅ Detecta inconsistencias

**Ejemplo de inconsistencia detectada:**
```
Lead ID 318565 (Yoel):
- campaign_id = 65 ✅
- cliente = 'red_finance' ✅
- marca = 'Peugeot' ✅
- localizacion = 'Mendoza' ✅
- fecha_creacion = '2025-10-03' ❌ (después de fecha_fin)

→ Legacy: CUENTA este lead (82)
→ Generic: EXCLUYE este lead (80)
```

---

## 📊 EJEMPLO COMPLETO DE ASIGNACIÓN

### **Datos iniciales:**
```
Campaign ID: 65
Cliente: Red Finance
Marca: Peugeot, Fiat
Zona: Mendoza
Meta: 100 leads
Asignados: 82 leads
Disponibles: 18 leads únicos
```

### **Proceso:**

1. **Obtener 18 leads únicos** de op_leads_rep
2. **Extraer duplicate_ids:**
   ```
   Lead único 1: [12345, 12346, 12347] → 3 duplicados
   Lead único 2: [12350] → 1 duplicado
   Lead único 3: [12351, 12352] → 2 duplicados
   ...
   Total: 35 duplicate_ids
   ```

3. **Asignar los 35 duplicados:**
   ```sql
   UPDATE op_lead
   SET campaign_id = 65
   WHERE id IN (12345, 12346, 12347, 12350, 12351, 12352, ...)
     AND campaign_id IS NULL;
   ```

4. **Resultado:**
   ```
   Leads únicos asignados: 18
   Duplicados actualizados: 35
   Total en campaña: 82 + 35 = 117 leads
   Meta alcanzada: 117 >= 100 ✅
   ```

---

## 🎯 QUERIES CRÍTICOS PARA PRODUCCIÓN

### **1. Contar asignados (con validación completa):**

```sql
SELECT COUNT(*)::int as leads_asignados
FROM op_lead
WHERE (
  lower(campaign) LIKE '%peugeot%' OR
  lower(campaign) LIKE '%fiat%'
)
AND cliente = 'red_finance'
AND localizacion = 'Mendoza'
AND campaign_id = 65
AND date(fecha_creacion) >= '2025-08-26'
AND (fecha_fin IS NULL OR date(fecha_creacion) <= fecha_fin);
```

---

### **2. Obtener leads disponibles (únicos con duplicados):**

```sql
-- Paso 1: Leads únicos candidatos
SELECT
  id,
  nombre,
  telefono,
  email,
  duplicate_ids,
  fecha_creacion
FROM op_leads_rep
WHERE campaign_id IS NULL
  AND marca ILIKE '%peugeot%'
  AND cliente ILIKE '%red finance%'
  AND localizacion ILIKE '%mendoza%'
ORDER BY fecha_creacion ASC
LIMIT 54;  -- 3x la cantidad necesaria

-- Paso 2: Verificar duplicados asignados
SELECT id
FROM op_lead
WHERE id = ANY($1::int[])  -- Array con todos los duplicate_ids
  AND campaign_id IS NOT NULL;

-- Paso 3: Filtrar en aplicación (no SQL)
```

---

### **3. Asignar leads en lote:**

```sql
UPDATE op_lead
SET
  campaign_id = $1,  -- 65
  updated_at = NOW()
WHERE id = ANY($2::int[])  -- Array con duplicate_ids a asignar
  AND campaign_id IS NULL  -- Seguridad: solo si no asignado
RETURNING id;
```

---

### **4. Cerrar campaña:**

```sql
-- Obtener fecha del último lead
SELECT fecha_creacion
FROM op_lead
WHERE campaign_id = 65
ORDER BY fecha_creacion DESC
LIMIT 1;

-- Actualizar campaña
UPDATE campanas_comerciales
SET
  fecha_fin = $1,  -- Fecha del último lead
  estado_campana = 'Finalizada',
  updated_at = NOW()
WHERE id = 65
  AND estado_campana = 'En proceso';
```

---

## ✅ RESUMEN

**Total de queries en un ciclo completo:**
1. ✅ 1 query para obtener datos de campaña
2. ✅ 1 query para contar asignados (con filtros genéricos)
3. ✅ 1 query para obtener leads únicos candidatos
4. ✅ 1 query para verificar duplicados asignados
5. ✅ N queries para asignar en lotes (1 por cada 100 IDs)
6. ✅ 1 query para obtener fecha del último lead
7. ✅ 1 query para cerrar la campaña

**Total:** ~7 queries (+ lotes según volumen)

**Optimizaciones aplicadas:**
- ✅ Una sola query para verificar todos los duplicados
- ✅ Asignación en lotes de 100
- ✅ Uso de índices en campaign_id, cliente, marca, localizacion
- ✅ LIMIT para reducir datos transferidos
- ✅ Set en memoria para filtrado O(1)

---

**Fecha:** 2025-10-09
**Campaña:** Red Finance #1 (ID: 65)
**Sistema:** CRM MADI - Campaign Closure v2.0
