# GUÍA COMPLETA: PROCESO DE CIERRE DE CAMPAÑAS
## Documentación Técnica para IA - Sistema CRM MADI

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Flujo Principal de Cierre](#flujo-principal-de-cierre)
4. [Filtros de Leads](#filtros-de-leads)
5. [Multi-Marca: Automático vs Manual](#multi-marca-automático-vs-manual)
6. [Asignación de Leads](#asignación-de-leads)
7. [Endpoints API](#endpoints-api)
8. [Casos Especiales](#casos-especiales)
9. [Errores Comunes y Soluciones](#errores-comunes-y-soluciones)
10. [Referencias de Código](#referencias-de-código)

---

## RESUMEN EJECUTIVO

### ¿Qué hace este sistema?

El sistema de cierre de campañas **asigna leads** de la tabla `op_leads_rep` a campañas específicas en la tabla `op_lead`, actualizando el campo `campaign_id`. Cuando una campaña alcanza su meta o se cierra manualmente, se marca como finalizada estableciendo `fecha_fin`.

### Principios Fundamentales

1. **UNA campaña por cliente** - Solo procesa la campaña más antigua
2. **Orden cronológico puro** - Asigna los leads más antiguos primero
3. **SIN filtro de fechas** - NO usa `fechaCampana` ni `fechaFin` para filtrar
4. **Asignación atómica** - Transacciones para evitar duplicados
5. **Pool unificado multi-marca** - En modo automático, ignora porcentajes

### Datos Clave

- **Tabla de lectura**: `op_leads_rep` (vista materializada con leads únicos)
- **Tabla de escritura**: `op_lead` (leads individuales con duplicados)
- **Campo crítico**: `duplicate_ids` - Array de IDs de duplicados
- **Estado de campaña**: `fecha_fin IS NULL` = Abierta, `fecha_fin NOT NULL` = Cerrada

---

## ARQUITECTURA DEL SISTEMA

### Estructura de Directorios

```
server/campaign-closure/
├── presentation/
│   ├── controllers/           # Endpoints HTTP
│   │   ├── CampaignClosureController.ts
│   │   ├── MultiBrandCampaignClosureController.ts
│   │   ├── CampaignAvailabilityController.ts
│   │   └── CampaignReopenController.ts
│   └── routes/
│       └── campaign-closure-routes.ts
├── application/
│   ├── usecases/              # Lógica de casos de uso
│   │   ├── CampaignClosureUseCase.ts
│   │   └── MultiBrandCampaignClosureUseCase.ts
│   └── dto/
│       └── ClosureOptions.ts
├── domain/
│   ├── services/              # Lógica de negocio
│   │   ├── CampaignProcessor.ts    # ← ARCHIVO PRINCIPAL
│   │   └── LeadAssigner.ts
│   ├── entities/
│   │   ├── CampaignClosure.ts
│   │   └── ClosureResult.ts
│   └── interfaces/
│       ├── ICampaignRepository.ts
│       └── ILeadRepository.ts
└── infrastructure/
    ├── repositories/
    │   ├── PostgresCampaignRepository.ts
    │   └── PostgresLeadRepository.ts   # ← ASIGNACIÓN DE LEADS
    └── factories/
        └── ClosureFactory.ts

shared/utils/
└── multi-brand-utils.ts       # ← FILTROS CENTRALIZADOS
```

### Clean Architecture - Flujo de Responsabilidades

```
Controller → UseCase → CampaignProcessor → LeadRepository
   ↓           ↓              ↓                  ↓
  HTTP      Orquesta      Lógica de         Base de
  JSON      proceso       negocio            datos
```

---

## FLUJO PRINCIPAL DE CIERRE

### Archivo: `server/campaign-closure/domain/services/CampaignProcessor.ts`
### Función: `processSingleCampaign()` (líneas 235-571)

```
┌─────────────────────────────────────────────────────────────┐
│  INICIO: processSingleCampaign(campaign, campaignKey, forceClose)  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────────────┐
    │ PASO 1: Contar leads YA asignados                  │
    │ Línea 268: countAssignedLeadsForCampaign()         │
    │ Query: SELECT count(*) FROM op_lead                │
    │        WHERE campaign_id = {campaign.id}           │
    │ Resultado: currentAssignedLeads                    │
    └────────────────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────────────┐
    │ PASO 2: Contar leads DISPONIBLES                   │
    │ Línea 283: countUniqueLeadsForClient()             │
    │ Usa: buildCampaignLeadFilters()                    │
    │ ❌ SIN FILTRO DE FECHAS                            │
    │ Resultado: availableLeadsCount                     │
    └────────────────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────────────┐
    │ DECISIÓN: ¿Ya alcanzó meta?                        │
    │ Línea 296: if (currentAssignedLeads >= targetLeads)│
    └────────────────────────────────────────────────────┘
           │                          │
           │ SÍ                       │ NO
           ▼                          ▼
    ┌──────────────────┐     ┌─────────────────────────┐
    │ Cerrar campaña   │     │ DECISIÓN: ¿Hay leads    │
    │ automáticamente  │     │ disponibles?            │
    │ Línea 303-322    │     │ Línea 332               │
    └──────────────────┘     └─────────────────────────┘
           │                          │
           │                          │ NO + forceClose=true
           │                          ▼
           │              ┌─────────────────────────────┐
           │              │ Cerrar manualmente          │
           │              │ (cierre parcial permitido)  │
           │              │ Línea 335-368               │
           │              └─────────────────────────────┘
           │                          │
           │                          │ SÍ (hay leads)
           │                          ▼
           │              ┌─────────────────────────────┐
           │              │ PASO 3: Calcular leads      │
           │              │ Línea 386-405               │
           │              │ leadsNeeded = target - current│
           │              │ leadsToAssign = min(available, needed)│
           │              └─────────────────────────────┘
           │                          │
           │                          ▼
           │              ┌─────────────────────────────┐
           │              │ PASO 4: Asignar en lotes    │
           │              │ Línea 444-468               │
           │              │ • Lotes de 100 leads        │
           │              │ • Timeout dinámico          │
           │              │ • Progreso WebSocket        │
           │              └─────────────────────────────┘
           │                          │
           │                          ▼
           │              ┌─────────────────────────────┐
           │              │ PASO 5: Decidir cierre      │
           │              │ Línea 485-536               │
           │              │ metaAlcanzada OR forceClose? │
           │              └─────────────────────────────┘
           │                          │
           └──────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────────────┐
    │ Obtener fecha del último lead                       │
    │ Línea 506-508                                       │
    │ UPDATE campanas_comerciales SET fecha_fin = ...    │
    │ Línea 514                                           │
    └────────────────────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────────────┐
    │ Emitir progreso 100% vía WebSocket                 │
    │ Línea 518-522                                       │
    └────────────────────────────────────────────────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ FIN: Retornar │
                 │ success=true  │
                 └───────────────┘
```

### Código Verificado

```typescript
// PASO 1: Línea 268
const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(
  campaign.id,
  true
);

// PASO 2: Línea 283
const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
  campaign.clientName,
  campaign.brandName,
  campaign.zone,
  campaign // ✅ Pasar objeto completo para multi-marca
);

// DECISIÓN META: Línea 296
if (currentAssignedLeads >= campaign.targetLeads) {
  // Cerrar automáticamente
}

// PASO 3: Línea 386-387
const leadsNeeded = campaign.targetLeads - currentAssignedLeads;
const leadsToAssign = Math.min(availableLeadsCount, leadsNeeded);

// PASO 4: Línea 444-456 - Promise.race con timeout
assignedCount = await Promise.race([
  this.leadRepository.assignLeadsInBatches(
    leadsForAssignment,
    campaign.id,
    100, // Tamaño del lote
    progressCallback
  ),
  new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout: ${timeoutMs}ms`)), timeoutMs);
  })
]);

// PASO 5: Línea 485-486
const metaAlcanzada = totalLeads >= campaign.targetLeads;
const deberCerrar = metaAlcanzada || (forceClose && assignedCount > 0);
```

---

## FILTROS DE LEADS

### Archivo: `shared/utils/multi-brand-utils.ts`
### Función: `buildCampaignLeadFilters()` (líneas 231-277)

### ⚠️ ATENCIÓN: Esta es la ÚNICA función que define los filtros

**TODA** operación de leads usa esta función:
1. Conteo de duplicados (dashboard)
2. Conteo de disponibles (cierre)
3. Obtención para asignar (cierre)
4. Conteo de asignados (validación)

### Condiciones que SE APLICAN

#### 1. Multi-Marca (OR con ILIKE)

**Código**: Líneas 254-261
```typescript
const brands = extractBrandsFromCampaign(campaign, campaign.asignacionAutomatica);
const multiBrandCondition = createMultiBrandCondition(brands, campaignField);

// Genera SQL:
// (lower(campaign) LIKE '%peugeot%' OR lower(campaign) LIKE '%fiat%' OR ...)
```

**Lógica**:
- Si `asignacionAutomatica = true`: Incluye TODAS las marcas (marca, marca2, marca3, marca4, marca5)
- Si `asignacionAutomatica = false`: Solo marcas con `porcentaje > 0`

#### 2. Cliente (Igualdad Exacta)

**Código**: Línea 266
```typescript
eq(clienteField, normalizedClientName)
```

**Normalización**:
- Convierte a `snake_case`: "Red Finance" → "red_finance"
- Remueve marcas del nombre antes de normalizar
- Función: `shared/utils/client-normalization.ts`

#### 3. Localización (Mapeo de Zona)

**Código**: Líneas 251, 267
```typescript
const localizacionFiltro = mapZonaToLocalizacion(campaign.zona);
eq(localizacionField, localizacionFiltro)
```

**Mapeo**:
```typescript
{
  'NACIONAL': 'Pais',
  'AMBA': 'Amba',
  'Córdoba': 'Cordoba',
  'Santa Fe': 'Santa Fe',
  'Mendoza': 'Mendoza'
}
```

#### 4. Disponibilidad (Incluye Asignados a Esta Campaña)

**Código**: Línea 269
```typescript
sql`(${campaignIdField} IS NULL OR ${campaignIdField} = ${campaign.id})`
```

**Propósito**:
- Permite reasignar leads si se reabre una campaña
- Cuenta leads disponibles + ya asignados a esta campaña específica

### Condiciones que NO SE APLICAN

#### ❌ 5. FECHAS - NO EXISTE ESTE FILTRO

**Código**: Líneas 272-274
```typescript
// ❌ FECHAS REMOVIDAS: Ya no se filtran leads por fechaCampana o fechaFin
// La asignación se hace por orden cronológico (fecha_creacion ASC)
// simplemente tomando los N leads más antiguos disponibles
```

**Implicaciones**:
- `fechaCampana` es solo informativa
- `fechaFin` solo marca cierre, NO filtra leads
- Los leads se asignan en orden de `fecha_creacion ASC`
- Se toman los N leads MÁS ANTIGUOS disponibles

#### ❌ 6. SOURCE - NO EXISTE ESTE FILTRO

**Razón**:
- Todos los leads en `op_leads_rep` vienen de Google Sheets
- Filtrar por `source = 'google_sheets'` sería redundante

### Array Final de Condiciones

```typescript
return [
  multiBrandCondition,                    // ✅ Multi-marca
  eq(clienteField, normalizedClientName), // ✅ Cliente
  eq(localizacionField, localizacionFiltro), // ✅ Zona
  sql`(${campaignIdField} IS NULL OR ${campaignIdField} = ${campaign.id})` // ✅ Disponibilidad
  // ❌ NO hay filtro de fechas
  // ❌ NO hay filtro de source
];
```

---

## MULTI-MARCA: AUTOMÁTICO VS MANUAL

### Archivo: `shared/utils/multi-brand-utils.ts`
### Función: `extractBrandsFromCampaign()` (líneas 17-58)

### Diferencia Fundamental

```typescript
// Línea 25 (marca principal)
const incluir = automaticMode || porcentaje > 0;

// Línea 40 (marcas adicionales 2-5)
const incluir = marca && (automaticMode || porcentaje > 0);
```

### Modo AUTOMÁTICO (`asignacionAutomatica = true`)

**Comportamiento**:
```typescript
automaticMode = true
incluir = true || porcentaje > 0  // ← SIEMPRE true
```

**Resultado**:
- ✅ Incluye marca 1, marca 2, marca 3, marca 4, marca 5
- ✅ Aunque tengan porcentaje = 0
- ✅ Pool unificado de todas las marcas
- ✅ Orden cronológico estricto
- ❌ Porcentajes NO se respetan (son informativos)

**Ejemplo**:
```json
{
  "marca": "Peugeot",
  "porcentaje": 60,
  "marca2": "Fiat",
  "porcentaje2": 40,
  "marca3": "Toyota",
  "porcentaje3": 0,  // ← Se incluye de todos modos
  "asignacionAutomatica": true
}
```

**Resultado**: Incluye Peugeot, Fiat Y Toyota en el pool

### Modo MANUAL (`asignacionAutomatica = false`)

**Comportamiento**:
```typescript
automaticMode = false
incluir = false || porcentaje > 0  // ← Solo si porcentaje > 0
```

**Resultado**:
- ✅ Solo marcas con `porcentaje > 0`
- ✅ Porcentajes deben sumar 100%
- ✅ Distribución EXACTA por marca
- ❌ Falla si una marca no tiene leads suficientes
- ❌ Todo o nada (transaccional)

**Ejemplo**:
```json
{
  "marca": "Peugeot",
  "porcentaje": 60,
  "marca2": "Fiat",
  "porcentaje2": 40,
  "marca3": "Toyota",
  "porcentaje3": 0,  // ← NO se incluye
  "asignacionAutomatica": false
}
```

**Resultado**: Solo incluye Peugeot (60%) y Fiat (40%)

### Validación de Porcentajes

**Archivo**: `multi-brand-utils.ts:85-101`
```typescript
export function validateBrandPercentages(brands: BrandInfo[]): {
  valid: boolean;
  total: number;
  error?: string;
} {
  const total = brands.reduce((sum, brand) => sum + brand.porcentaje, 0);

  if (total !== 100) {
    return {
      valid: false,
      total,
      error: `Los porcentajes deben sumar 100%, actualmente suman ${total}%`
    };
  }

  return { valid: true, total };
}
```

**Aplicación**:
- Solo se valida en modo MANUAL
- Modo AUTOMÁTICO ignora validación de porcentajes

---

## ASIGNACIÓN DE LEADS

### Archivo: `server/campaign-closure/infrastructure/repositories/PostgresLeadRepository.ts`

### Función Principal: `getLeadsForAssignment()` (líneas 415-525)

#### Proceso Optimizado en 3 Pasos

```
PASO 1: Obtener leads únicos candidatos
┌─────────────────────────────────────────────────────────┐
│ SELECT * FROM op_leads_rep                              │
│ WHERE (multi-marca) AND (cliente) AND (zona) AND        │
│       (campaign_id IS NULL OR campaign_id = {id})       │
│ ORDER BY fecha_creacion ASC                             │
│ LIMIT {limit * 3}  ← Compensar duplicados asignados     │
└─────────────────────────────────────────────────────────┘
         │
         │ Resultado: uniqueLeads[]
         ▼
PASO 2: Verificar duplicados (UNA sola query)
┌─────────────────────────────────────────────────────────┐
│ // Extraer TODOS los duplicate_ids                      │
│ allDuplicateIds = uniqueLeads.flatMap(l => l.duplicateIds)│
│                                                          │
│ // Query única para TODOS los duplicados                │
│ SELECT id FROM op_lead                                  │
│ WHERE id IN (allDuplicateIds)                           │
│   AND campaign_id IS NOT NULL                           │
└─────────────────────────────────────────────────────────┘
         │
         │ Resultado: assignedSet (Set para O(1) lookup)
         ▼
PASO 3: Filtrar leads disponibles
┌─────────────────────────────────────────────────────────┐
│ for (const uniqueLead of uniqueLeads) {                 │
│   if (availableUniqueLeads.length >= limit) break;      │
│                                                          │
│   const duplicateIds = uniqueLead.duplicateIds || [id]; │
│   const hasAssigned = duplicateIds.some(id =>           │
│     assignedSet.has(id)  // ← O(1) lookup               │
│   );                                                     │
│                                                          │
│   if (!hasAssigned) {                                   │
│     availableUniqueLeads.push({                         │
│       ...uniqueLead,                                    │
│       duplicateIds  // ← IMPORTANTE: Incluir array      │
│     });                                                  │
│   }                                                      │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
```

#### Código Verificado

```typescript
// PASO 1: Líneas 454-459
const uniqueLeads = await this.db
  .select()
  .from(opLeadsRep)
  .where(and(...conditions))
  .orderBy(asc(opLeadsRep.fechaCreacion))
  .limit(limit * 3); // ← Traer más para compensar

// PASO 2: Líneas 470-486 - UNA SOLA QUERY
const allDuplicateIds = uniqueLeads.flatMap(lead => lead.duplicateIds || [lead.id]);

const assignedLeads = await this.db
  .select({ id: opLead.id })
  .from(opLead)
  .where(
    and(
      inArray(opLead.id, allDuplicateIds),
      sql`${opLead.campaignId} IS NOT NULL`
    )
  );

const assignedSet = new Set(assignedLeads.map(l => l.id));

// PASO 3: Líneas 496-510 - Filtrado O(1)
for (const uniqueLead of uniqueLeads) {
  if (availableUniqueLeads.length >= limit) break;

  const hasAssignedDuplicate = duplicateIds.some(id => assignedSet.has(id));

  if (!hasAssignedDuplicate) {
    availableUniqueLeads.push({
      ...this.mapOpLeadRepToAvailableLead(uniqueLead),
      duplicateIds: duplicateIds
    });
  }
}
```

### Función de Asignación: `assignLeadsInBatches()` (líneas 531-624)

#### Proceso

```
1. Extraer TODOS los duplicate_ids de los leads únicos
┌─────────────────────────────────────────────────────────┐
│ const allDuplicateIds: number[] = [];                   │
│ for (const lead of leads) {                             │
│   const duplicateIds = lead.duplicateIds || [lead.id];  │
│   allDuplicateIds.push(...duplicateIds);                │
│ }                                                        │
│                                                          │
│ // Ejemplo:                                             │
│ // Lead único 1: duplicateIds = [101, 102, 103]         │
│ // Lead único 2: duplicateIds = [201, 202]              │
│ // allDuplicateIds = [101, 102, 103, 201, 202]          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
2. Procesar en lotes de 100
┌─────────────────────────────────────────────────────────┐
│ for (let i = 0; i < allDuplicateIds.length; i += 100) { │
│   const batch = allDuplicateIds.slice(i, i + 100);      │
│                                                          │
│   UPDATE op_lead                                        │
│   SET campaign_id = {campaignId},                       │
│       updated_at = NOW()                                │
│   WHERE id IN (batch)                                   │
│     AND campaign_id IS NULL  ← Doble verificación       │
│                                                          │
│   // Reportar progreso vía WebSocket                    │
│   onProgress(totalAssigned, allDuplicateIds.length);    │
│ }                                                        │
└─────────────────────────────────────────────────────────┘
```

#### Código Verificado

```typescript
// Líneas 545-549: Extraer duplicate_ids
const allDuplicateIds: number[] = [];
for (const lead of leads) {
  const duplicateIds = lead.duplicateIds || [lead.id];
  allDuplicateIds.push(...duplicateIds);
}

// Líneas 557-577: Asignación en lotes
for (let i = 0; i < allDuplicateIds.length; i += batchSize) {
  const batch = allDuplicateIds.slice(i, i + batchSize);

  const result = await this.db
    .update(opLead)
    .set({
      campaignId: campaignId,
      updatedAt: new Date()
    })
    .where(
      and(
        inArray(opLead.id, batch),
        isNull(opLead.campaignId) // ← Doble verificación
      )
    )
    .returning({ id: opLead.id });

  totalAssigned += result.length;

  if (onProgress) {
    onProgress(totalAssigned, allDuplicateIds.length);
  }
}
```

### ⚠️ Punto Crítico: Duplicate IDs

**Estructura de `op_leads_rep`**:
```typescript
{
  id: 1000,                    // Lead único (representativo)
  nombre: "Juan Pérez",
  telefono: "123456789",
  duplicateIds: [1000, 1001, 1002] // ← TODOS los duplicados (incluido él mismo)
}
```

**Estructura de `op_lead`** (3 filas):
```typescript
{ id: 1000, nombre: "Juan Pérez", campaign_id: null }
{ id: 1001, nombre: "Juan Pérez", campaign_id: null }
{ id: 1002, nombre: "Juan Pérez", campaign_id: null }
```

**Asignación correcta**:
```typescript
// Si se asigna el lead único 1000:
// 1. Extraer duplicateIds = [1000, 1001, 1002]
// 2. Asignar TODOS: UPDATE op_lead SET campaign_id = X WHERE id IN (1000, 1001, 1002)
// 3. Resultado: 3 filas actualizadas en op_lead
```

---

## ENDPOINTS API

### Archivo: `server/campaign-closure/presentation/routes/campaign-closure-routes.ts`

### 1. POST `/api/campaign-closure/execute`

**Controller**: `CampaignClosureController.ts:26-167`

**Query Params**:
```typescript
{
  clients?: string,           // "red finance,toyota finance" (separados por coma)
  brands?: string,            // "peugeot,fiat" (separados por coma)
  dryRun?: 'true' | 'false', // Solo simular
  campaignNumber?: string,    // "1" para campaña específica
  campaignKey?: string        // "red_finance-1" para WebSocket tracking
}
```

**Request Example**:
```bash
POST /api/campaign-closure/execute?clients=red%20finance&campaignNumber=1
```

**Response**:
```json
{
  "success": true,
  "message": "Cierre completado exitosamente",
  "campaignsProcessed": 1,
  "campaignsClosed": 1,
  "leadsAssigned": 100,
  "timestamp": "2025-10-30T03:30:00.000Z",
  "duration": 5432,
  "durationFormatted": "5.43s",
  "details": {
    "closedCampaigns": [
      {
        "campaignId": 38,
        "clientName": "red finance",
        "brandName": "Peugeot",
        "leadsAssigned": 100,
        "targetLeads": 100,
        "closureDate": "2025-10-30T03:30:00.000Z",
        "finalLeadDate": "2025-10-15T12:00:00.000Z"
      }
    ],
    "clientsProcessed": ["red finance"]
  }
}
```

**Efectos Secundarios**:
```typescript
// Línea 86: Invalidar caché
routesModule.invalidateCampanasCache();

// Línea 92: Broadcast WebSocket
realtimeSync.broadcastDashboardRefresh();

// Líneas 95-101: Eventos por campaña
result.closedCampaigns.forEach(campaign => {
  realtimeSync.broadcastCampaignUpdate('updated', campaign.campaignId);
});
```

### 2. GET `/api/campaign-closure/availability/:id`

**Controller**: `CampaignAvailabilityController.ts:15-187`

**Propósito**: Verificar disponibilidad SIN ejecutar cierre

**Response**:
```json
{
  "success": true,
  "campaign": {
    "id": 38,
    "cliente": "red finance",
    "numero_campana": "1",
    "marca": "Peugeot",
    "zona": "NACIONAL",
    "meta": 100,
    "estado": "Abierta",
    "fechaFin": null
  },
  "leads": {
    "yaAsignados": 50,
    "disponiblesUnicos": 30,
    "disponiblesConDuplicados": 90,
    "faltantesParaMeta": 50,
    "puedenAsignarse": 30,
    "totalEnBaseDatos": 200,
    "asignadosOtrasCampañas": 120,
    "sinAsignar": 80
  },
  "analisis": {
    "cumplimientoActual": 50,
    "cumplimientoFinalEsperado": 80,
    "puedeCerrarseCompletamente": false,
    "tipoCierre": "parcial",
    "mensaje": "Cierre parcial: 80/100 leads (80%)"
  },
  "busqueda": {
    "clienteNormalizado": "red_finance",
    "zonaNormalizada": "Pais",
    "marca": "Peugeot"
  }
}
```

### 3. POST `/api/campaign-closure/reopen/:id`

**Controller**: `CampaignReopenController.ts:16-172`

**Proceso**:
```sql
-- 1. Verificar estado actual
SELECT id, fecha_fin FROM campanas_comerciales WHERE id = {id};

-- 2. Contar leads asignados
SELECT COUNT(*) FROM op_lead WHERE campaign_id = {id};

-- 3. Desasignar TODOS los leads
UPDATE op_lead SET campaign_id = NULL WHERE campaign_id = {id};

-- 4. Limpiar fecha de fin
UPDATE campanas_comerciales
SET fecha_fin = NULL, updated_at = NOW()
WHERE id = {id};

-- 5. Verificar
SELECT fecha_fin FROM campanas_comerciales WHERE id = {id};
-- Debe ser NULL
```

**Response**:
```json
{
  "success": true,
  "message": "Campaña 38 reabierta exitosamente",
  "campaign": {
    "id": 38,
    "isClosed": false,
    "leadsAsignados": 0,
    "fechaFin": null
  },
  "leadsUnassigned": 100,
  "previousState": {
    "fecha_fin": "2025-10-15T12:00:00.000Z"
  }
}
```

### 4. POST `/api/campaign-closure/multi-brand/execute/:id`

**Controller**: `MultiBrandCampaignClosureController.ts:23-61`

**Body**:
```json
{
  "clientName": "red finance"
}
```

**Validaciones**:
1. `asignacionAutomatica` debe ser `true`
2. Campaña debe tener múltiples marcas configuradas
3. Porcentajes deben sumar 100% (solo modo manual)

**Response**:
```json
{
  "success": true,
  "campaignId": 38,
  "clientName": "red finance",
  "totalRequested": 100,
  "totalAssigned": 100,
  "brandDetails": [
    {
      "marca": "Peugeot",
      "porcentaje": 60,
      "solicitados": 60,
      "asignados": 58,
      "exito": true
    },
    {
      "marca": "Fiat",
      "porcentaje": 40,
      "solicitados": 40,
      "asignados": 42,
      "exito": true
    }
  ],
  "mode": "automatica",
  "message": "Campaña cerrada exitosamente con 100 leads asignados (modo automático)",
  "timestamp": "2025-10-30T03:30:00.000Z"
}
```

**Nota**: En modo automático, `solicitados` vs `asignados` puede variar porque no respeta porcentajes exactos.

---

## CASOS ESPECIALES

### 1. Solo Procesa 1 Campaña por Cliente

**Archivo**: `CampaignProcessor.ts:141-229`

**Código**:
```typescript
// Línea 162: Filtrar pendientes
let pendingCampaigns = campaigns.filter(c => c.status === 'En proceso');

// Líneas 186-190: Ordenar por fecha (más antigua primero)
const sortedCampaigns = pendingCampaigns.sort((a, b) => {
  return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
});

// Línea 206: ¡CRÍTICO! Solo la primera
const campaignToProcess = sortedCampaigns[0];

// Línea 216: Procesar UNA campaña
const result = await this.processSingleCampaign(campaignToProcess, ...);

// Línea 225: Siempre retorna 1
return {
  clientName,
  campaignsProcessed: 1,  // ← SIEMPRE 1
  ...
};
```

**Razón**: Mantener orden cronológico y evitar conflictos

### 2. Cierre Manual vs Automático

**Archivo**: `CampaignProcessor.ts:485-486`

```typescript
const metaAlcanzada = totalLeads >= campaign.targetLeads;
const deberCerrar = metaAlcanzada || (forceClose && assignedCount > 0);
```

**Tipos de Cierre**:

| Tipo | Condición | Permite Parcial | Ejemplo |
|------|-----------|-----------------|---------|
| **Automático** | `totalLeads >= targetLeads` | NO | 100/100 leads |
| **Manual** | `forceClose=true AND assignedCount > 0` | SÍ | 98/100 leads |

**forceClose se activa cuando**:
- `specificCampaignNumber` está presente en la request
- Usuario hizo clic en botón "Cerrar" en el dashboard

### 3. Timeout Dinámico

**Archivo**: `CampaignProcessor.ts:425-426`

```typescript
const timeoutMs = Math.max(30000, leadsForAssignment.length * 50);
console.log(`⏱️ Timeout establecido: ${timeoutMs}ms (${timeoutMs/1000}s)`);
```

**Cálculo**:
- Base: 30 segundos (30000ms)
- Dinámico: 50ms por lead
- Fórmula: `max(30000, leads * 50)`

**Ejemplos**:
- 100 leads: `max(30000, 5000) = 30000ms` (30s)
- 1000 leads: `max(30000, 50000) = 50000ms` (50s)
- 5000 leads: `max(30000, 250000) = 250000ms` (250s = 4.2min)

### 4. Asignación Atómica con Transacción

**Archivo**: `PostgresLeadRepository.ts:851-1030`

**Proceso**:
```typescript
const result = await this.db.transaction(async (tx) => {
  // 1. Buscar leads únicos en op_leads_rep
  const uniqueLeads = await tx.select().from(opLeadsRep).where(...);

  // 2. Verificar disponibilidad de duplicados
  for (const uniqueLead of uniqueLeads) {
    const assignedCount = await tx.select().from(opLead)
      .where(inArray(opLead.id, duplicateIds));

    if (alreadyAssigned === 0) {
      availableUniqueLeads.push(uniqueLead);
    }
  }

  // 3. Seleccionar cantidad exacta
  const selectedUniqueLeads = availableUniqueLeads.slice(0, targetCount);

  // 4. Extraer todos los duplicate_ids
  const allDuplicateIds = selectedUniqueLeads.flatMap(l => l.duplicateIds);

  // 5. BLOQUEAR leads con FOR UPDATE
  const leadsToAssign = await tx.select().from(opLead)
    .where(inArray(opLead.id, allDuplicateIds))
    .for('update'); // ← BLOQUEO CRÍTICO

  // 6. Verificar que estén disponibles
  const unavailable = leadsToAssign.filter(l => l.campaignId !== null);
  if (unavailable.length > 0) {
    throw new Error('Race condition detectada');
  }

  // 7. Asignar atómicamente
  await tx.update(opLead)
    .set({ campaignId })
    .where(inArray(opLead.id, allDuplicateIds));

  // 8. Verificar conteo exacto
  const verification = await tx.select({ count: sql`count(*)` })
    .from(opLead)
    .where(eq(opLead.campaignId, campaignId));

  if (verification.count !== allDuplicateIds.length) {
    throw new Error('Error de conteo');
  }

  return { assigned: allDuplicateIds.length, ... };
});
```

**Garantías**:
- Todo o nada (rollback en error)
- Bloqueo de filas (previene race conditions)
- Verificación de conteo exacto

---

## ERRORES COMUNES Y SOLUCIONES

### Error 1: "No hay leads disponibles" pero el dashboard muestra duplicados

**Causa**: Confusión entre leads únicos y duplicados

**Explicación**:
- Dashboard muestra **duplicados totales** (op_leads_rep.duplicateIds.length)
- Cierre cuenta **leads únicos** disponibles
- Un lead único con 5 duplicados = 1 lead disponible (no 5)

**Solución**: Verificar que ningún `duplicate_id` esté ya asignado

### Error 2: Porcentajes multi-marca no se respetan

**Causa**: Campaña en modo AUTOMÁTICO

**Explicación**:
```typescript
// Si asignacionAutomatica = true:
// - Pool unificado cronológico
// - Porcentajes NO se respetan
// - Distribución puede ser 70/30 aunque esté configurado 60/40
```

**Solución**:
- Modo AUTOMÁTICO: Esperar distribución variable
- Modo MANUAL: Configurar `asignacionAutomatica = false`

### Error 3: Campaña no se cierra aunque alcanzó la meta

**Causa**: `forceClose = false` y hay error al obtener `finalLeadDate`

**Código**: `CampaignProcessor.ts:323-328`
```typescript
const finalLeadDate = await this.leadRepository.getLastLeadDateForCampaign(campaign.id);

if (finalLeadDate) {
  await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
} else {
  console.error(`❌ No se puede obtener fecha del último lead`);
  return { success: false, error: 'No se pudo obtener fecha del último lead' };
}
```

**Solución**: Verificar que haya leads asignados con fechas válidas

### Error 4: Timeout en asignación

**Causa**: Demasiados leads o base de datos lenta

**Timeout actual**: `max(30000, leads * 50)`

**Solución**:
1. Aumentar timeout base en línea 425
2. Reducir tamaño de lote en línea 448
3. Optimizar queries en base de datos

### Error 5: Leads se filtran por fecha aunque la doc dice que no

**Verificación**:
```typescript
// multi-brand-utils.ts:272-274
// ❌ FECHAS REMOVIDAS: Ya no se filtran leads por fechaCampana o fechaFin
```

**Si esto ocurre**: Revisar que se use `buildCampaignLeadFilters()` y NO una función legacy

### Error 6: Se procesan múltiples campañas por cliente

**Verificación**:
```typescript
// CampaignProcessor.ts:206
const campaignToProcess = sortedCampaigns[0]; // ← Debe ser [0], no un loop
```

**Si esto ocurre**: Alguien modificó la lógica de procesamiento

---

## REFERENCIAS DE CÓDIGO

### Archivos Principales

| Archivo | Líneas | Función | Descripción |
|---------|--------|---------|-------------|
| `CampaignProcessor.ts` | 235-571 | `processSingleCampaign()` | Flujo principal de cierre |
| `PostgresLeadRepository.ts` | 415-525 | `getLeadsForAssignment()` | Obtención optimizada de leads |
| `PostgresLeadRepository.ts` | 531-624 | `assignLeadsInBatches()` | Asignación en lotes |
| `multi-brand-utils.ts` | 231-277 | `buildCampaignLeadFilters()` | Filtros centralizados |
| `multi-brand-utils.ts` | 17-58 | `extractBrandsFromCampaign()` | Extracción de marcas |
| `CampaignClosureController.ts` | 26-167 | `execute()` | Endpoint principal |

### Constantes Críticas

```typescript
// Tamaño de lote para asignación
const BATCH_SIZE = 100; // CampaignProcessor.ts:448

// Timeout base
const BASE_TIMEOUT = 30000; // CampaignProcessor.ts:425

// Timeout por lead
const TIMEOUT_PER_LEAD = 50; // CampaignProcessor.ts:425

// Multiplicador para compensar duplicados
const DUPLICATE_MULTIPLIER = 3; // PostgresLeadRepository.ts:459
```

### Tablas de Base de Datos

| Tabla | Propósito | Campos Críticos |
|-------|-----------|-----------------|
| `op_leads_rep` | Leads únicos (lectura) | `id`, `duplicateIds[]`, `fechaCreacion`, `campaignId` |
| `op_lead` | Leads individuales (escritura) | `id`, `campaign_id`, `fechaCreacion` |
| `campanas_comerciales` | Campañas | `id`, `fecha_fin`, `asignacionAutomatica` |

### Queries SQL Clave

```sql
-- Contar leads asignados
SELECT count(*) FROM op_lead WHERE campaign_id = {id};

-- Obtener leads únicos disponibles
SELECT * FROM op_leads_rep
WHERE (campaign ILIKE '%marca1%' OR campaign ILIKE '%marca2%')
  AND cliente = {normalizedClient}
  AND localizacion = {mappedZone}
  AND (campaign_id IS NULL OR campaign_id = {id})
ORDER BY fecha_creacion ASC;

-- Verificar duplicados asignados (UNA query)
SELECT id FROM op_lead
WHERE id IN (allDuplicateIds)
  AND campaign_id IS NOT NULL;

-- Asignar leads en lote
UPDATE op_lead
SET campaign_id = {id}, updated_at = NOW()
WHERE id IN (batch) AND campaign_id IS NULL;

-- Cerrar campaña
UPDATE campanas_comerciales
SET fecha_fin = {lastLeadDate}, updated_at = NOW()
WHERE id = {id};
```

---

## GLOSARIO

| Término | Definición |
|---------|------------|
| **Lead único** | Fila en `op_leads_rep` que representa a N duplicados |
| **Duplicado** | Fila en `op_lead` con mismo telefono/email |
| **duplicate_ids** | Array de IDs de todos los duplicados de un lead único |
| **Campaña abierta** | `fecha_fin IS NULL` |
| **Campaña cerrada** | `fecha_fin NOT NULL` |
| **forceClose** | Parámetro que permite cierre manual parcial |
| **Pool unificado** | Conjunto de leads de múltiples marcas ordenado cronológicamente |
| **Modo automático** | `asignacionAutomatica = true`, ignora porcentajes |
| **Modo manual** | `asignacionAutomatica = false`, porcentajes exactos |
| **Meta** | `cantidadDatosSolicitados` de la campaña |

---

## CHECKLIST DE VERIFICACIÓN

Usar esta checklist para verificar que el proceso funciona correctamente:

### Antes de Ejecutar Cierre

- [ ] Campaña tiene `fecha_fin IS NULL`
- [ ] Campaña tiene `cantidadDatosSolicitados > 0`
- [ ] Cliente existe en la base de datos
- [ ] Marca está configurada en `marca` o `marca2-5`
- [ ] Zona está mapeada correctamente (NACIONAL→Pais, etc.)
- [ ] Si multi-marca: `asignacionAutomatica` está configurado
- [ ] Si multi-marca manual: Porcentajes suman 100%

### Durante Ejecución

- [ ] Logs muestran "PASO 1: Contando leads ya asignados"
- [ ] Logs muestran "PASO 2: Contando leads disponibles"
- [ ] `availableLeadsCount > 0`
- [ ] WebSocket emite progreso (si hay `campaignKey`)
- [ ] No hay errores de timeout
- [ ] Asignación completa sin race conditions

### Después de Cierre

- [ ] Campaña tiene `fecha_fin NOT NULL`
- [ ] Query `SELECT count(*) FROM op_lead WHERE campaign_id = {id}` retorna cantidad esperada
- [ ] Leads tienen `campaign_id` asignado
- [ ] Dashboard muestra campaña como "Finalizada"
- [ ] Caché invalidado (`/api/campanas-comerciales` muestra datos frescos)
- [ ] WebSocket emitió evento `campaign-updated`

---

## DIAGRAMA COMPLETO DEL SISTEMA

```
┌────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE (Frontend)                            │
│  • Dashboard de campañas pendientes                                    │
│  • Botón "Cerrar Campaña"                                              │
│  • WebSocket para progreso en tiempo real                              │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTP POST
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│               PRESENTATION LAYER (Controllers)                          │
│  CampaignClosureController.execute()                                   │
│  • Parsea query params                                                 │
│  • Crea DTO                                                             │
│  • Mapea a opciones                                                     │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│               APPLICATION LAYER (Use Cases)                             │
│  CampaignClosureUseCase.execute()                                      │
│  • Obtiene clientes a procesar                                         │
│  • Itera sobre cada cliente                                            │
│  • Orquesta el proceso                                                  │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  DOMAIN LAYER (Business Logic)                          │
│  CampaignProcessor.processClientCampaigns()                            │
│  • Obtiene campañas del cliente                                        │
│  • Filtra: status = 'En proceso'                                       │
│  • Ordena por fecha (más antigua primero)                              │
│  • Toma LA PRIMERA campaña                                             │
│  │                                                                      │
│  └─→ CampaignProcessor.processSingleCampaign()                         │
│      │                                                                  │
│      ├─→ PASO 1: countAssignedLeadsForCampaign()                       │
│      │   └─→ SELECT count(*) FROM op_lead WHERE campaign_id = {id}    │
│      │                                                                  │
│      ├─→ PASO 2: countUniqueLeadsForClient()                           │
│      │   └─→ buildCampaignLeadFilters() (SIN fechas)                   │
│      │   └─→ SELECT count(*) FROM op_leads_rep WHERE ...               │
│      │                                                                  │
│      ├─→ DECISIÓN: ¿Ya alcanzó meta?                                   │
│      │   SÍ → Cerrar automáticamente                                   │
│      │   NO → Continuar                                                │
│      │                                                                  │
│      ├─→ PASO 3: getLeadsForAssignment()                               │
│      │   ├─→ Query leads únicos (LIMIT x3)                             │
│      │   ├─→ Verificar duplicados (1 query)                            │
│      │   └─→ Filtrar disponibles (O(1))                                │
│      │                                                                  │
│      ├─→ PASO 4: assignLeadsInBatches()                                │
│      │   ├─→ Extraer duplicate_ids                                     │
│      │   ├─→ Lotes de 100                                              │
│      │   ├─→ UPDATE op_lead SET campaign_id                            │
│      │   └─→ Emitir progreso WebSocket                                 │
│      │                                                                  │
│      └─→ PASO 5: ¿Cerrar campaña?                                      │
│          ├─→ metaAlcanzada OR forceClose?                              │
│          ├─→ SÍ: closeCampaign()                                       │
│          └─→ UPDATE campanas_comerciales SET fecha_fin                 │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│            INFRASTRUCTURE LAYER (Repositories)                          │
│  PostgresLeadRepository                                                │
│  • Acceso directo a base de datos                                      │
│  • Queries SQL optimizadas                                             │
│  • Transacciones atómicas                                              │
│                                                                         │
│  PostgresCampaignRepository                                            │
│  • Gestión de campañas                                                 │
│  • Cierre y reapertura                                                  │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (PostgreSQL)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │  op_leads_rep   │  │    op_lead      │  │ campanas_comerciales   │ │
│  │  (READ)         │  │    (WRITE)      │  │                        │ │
│  │  • id           │  │    • id         │  │  • id                  │ │
│  │  • duplicateIds │  │    • campaign_id│  │  • fecha_fin           │ │
│  │  • fechaCreacion│  │    • fechaCreacion│  │  • asignacionAutomatica│ │
│  └─────────────────┘  └─────────────────┘  └────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    POST-PROCESSING (Side Effects)                       │
│  • Invalidar caché: invalidateCampanasCache()                          │
│  • Broadcast WebSocket: broadcastDashboardRefresh()                    │
│  • Eventos por campaña: broadcastCampaignUpdate('updated', id)         │
│  • Query invalidation: queryClient.invalidateQueries()                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## VERSIÓN DEL DOCUMENTO

- **Versión**: 1.0.0
- **Fecha**: 2025-10-30
- **Autor**: Sistema de Documentación Automática
- **Verificado contra código**: ✅ 100% alineado
- **Última actualización del código**: 2025-10-30

---

## NOTAS FINALES PARA IA

### ⚠️ Advertencias Críticas

1. **NO asumir filtro de fechas**: El código explícitamente NO filtra por fechas
2. **NO esperar múltiples campañas**: Solo procesa 1 campaña por cliente
3. **NO confundir leads únicos con duplicados**: Verificar `duplicateIds[]`
4. **NO ignorar modo automático**: En modo automático, porcentajes NO se respetan

### ✅ Garantías del Sistema

1. **Orden cronológico**: SIEMPRE asigna leads más antiguos primero
2. **Atomicidad**: Transacciones previenen race conditions
3. **Consistencia**: `buildCampaignLeadFilters()` usado en TODO el sistema
4. **Trazabilidad**: Logs exhaustivos con request IDs

### 🔍 Para Debugging

Si algo falla, verificar en este orden:
1. Logs de `processSingleCampaign()` - ¿En qué paso falló?
2. Valor de `availableLeadsCount` - ¿Hay leads disponibles?
3. Filtros aplicados - ¿Se usa `buildCampaignLeadFilters()`?
4. Modo multi-marca - ¿`asignacionAutomatica` configurado correctamente?
5. Duplicados - ¿Algún `duplicate_id` ya está asignado?

---

**FIN DE LA DOCUMENTACIÓN**
