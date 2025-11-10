# 🔍 Análisis Técnico Detallado: Campaign Reset Module

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Análisis por Capa](#análisis-por-capa)
4. [Flujos de Ejecución](#flujos-de-ejecución)
5. [Operaciones de Base de Datos](#operaciones-de-base-de-datos)
6. [Modelos de Datos](#modelos-de-datos)
7. [Manejo de Errores](#manejo-de-errores)
8. [Consideraciones de Rendimiento](#consideraciones-de-rendimiento)
9. [Seguridad](#seguridad)
10. [Áreas de Mejora](#áreas-de-mejora)

---

## 1. Resumen Ejecutivo

### Propósito del Módulo
El módulo `campaign-reset` proporciona funcionalidad para **resetear campañas comerciales**, lo que implica:
- Liberar leads asignados (limpiar `campaign_id`)
- Limpiar fechas de finalización (limpiar `fecha_fin`)
- Reabrir campañas para reutilizarlas

### Características Principales
- ✅ Reset individual de campañas por ID
- ✅ Reset masivo (batch) con filtros de fecha
- ✅ Modo "dry-run" para preview sin ejecutar
- ✅ Arquitectura Clean Architecture
- ✅ API REST estándar
- ✅ Manejo de errores robusto

### Tecnologías
- **Framework**: Express.js
- **ORM**: Drizzle ORM
- **Base de datos**: PostgreSQL
- **Lenguaje**: TypeScript
- **Arquitectura**: Clean Architecture (4 capas)

---

## 2. Arquitectura del Sistema

### 2.1 Patrón Arquitectónico: Clean Architecture

```
┌──────────────────────────────────────────────────────┐
│                  PRESENTATION LAYER                   │
│  ┌────────────────┐  ┌─────────────────┐            │
│  │   Controllers  │  │     Routes      │            │
│  │  - Reset       │  │  - POST /:id    │            │
│  │  - Batch       │  │  - POST /batch  │            │
│  └────────────────┘  └─────────────────┘            │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                    │
│  ┌────────────────────────────────────────┐          │
│  │           Use Cases                    │          │
│  │  - ResetCampaignUseCase               │          │
│  │  - BatchResetUseCase                  │          │
│  └────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────┐          │
│  │           DTOs                         │          │
│  │  - ResetCampaignOptions               │          │
│  │  - BatchResetOptions                  │          │
│  │  - ReopenOptions (sin usar)           │          │
│  └────────────────────────────────────────┘          │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                       │
│  ┌────────────────────────────────────────┐          │
│  │         Interfaces                     │          │
│  │  - ICampaignResetRepository           │          │
│  └────────────────────────────────────────┘          │
│  ┌────────────────────────────────────────┐          │
│  │         Entities                       │          │
│  │  - ResetResult                        │          │
│  │  - BatchResetResult                   │          │
│  └────────────────────────────────────────┘          │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                   │
│  ┌────────────────────────────────────────┐          │
│  │       Repositories                     │          │
│  │  - PostgresCampaignResetRepository    │          │
│  │    (Implementa ICampaignResetRepository)│         │
│  └────────────────────────────────────────┘          │
│                       │                              │
│                       ▼                              │
│              ┌─────────────────┐                     │
│              │  Drizzle ORM    │                     │
│              └─────────────────┘                     │
│                       │                              │
│                       ▼                              │
│              ┌─────────────────┐                     │
│              │   PostgreSQL    │                     │
│              └─────────────────┘                     │
└──────────────────────────────────────────────────────┘
```

### 2.2 Dependencias Entre Capas

```
Presentation → Application → Domain ← Infrastructure
                                ↑
                                │
                         (Implementa)
```

**Principios aplicados:**
- ✅ **Dependency Inversion**: Infrastructure depende de Domain (interfaces)
- ✅ **Single Responsibility**: Cada clase tiene una única responsabilidad
- ✅ **Open/Closed**: Extensible sin modificar código existente
- ✅ **Interface Segregation**: Interfaces pequeñas y específicas

---

## 3. Análisis por Capa

### 3.1 Domain Layer (Capa de Dominio)

#### 📄 `domain/entities/ResetResult.ts`

**Ubicación**: `server/campaign-reset/domain/entities/ResetResult.ts`

**Propósito**: Define las entidades que representan el resultado de operaciones de reset.

##### Interface: `ResetResult`
```typescript
export interface ResetResult {
  campaignId: number;         // ID de la campaña procesada
  campaignName: string;       // Nombre del cliente
  campaignNumber: number;     // Número de campaña
  leadsReset: number;         // Cantidad de leads liberados
  fechaFinCleared: boolean;   // Si se limpió fecha_fin
  success: boolean;           // Si la operación fue exitosa
  error?: string;             // Mensaje de error (opcional)
}
```

**Análisis:**
- Entidad de transferencia de datos (DTO del dominio)
- Inmutable (interface, no class)
- Campos opcionales solo para casos de error
- Representa el resultado de UN reset individual

##### Interface: `BatchResetResult`
```typescript
export interface BatchResetResult {
  totalCampaigns: number;       // Total de campañas procesadas
  successfulResets: number;     // Cantidad exitosa
  failedResets: number;         // Cantidad fallida
  totalLeadsReset: number;      // Total de leads liberados
  campaignsReopened: number;    // Cantidad con fecha_fin limpiada
  results: ResetResult[];       // Array de resultados individuales
  errors: Array<{               // Array de errores
    campaignId: number;
    error: string;
  }>;
}
```

**Análisis:**
- Agrega resultados de múltiples operaciones
- Contiene estadísticas agregadas
- Mantiene historial detallado en `results`
- Separa errores para análisis posterior

---

#### 📄 `domain/interfaces/ICampaignResetRepository.ts`

**Ubicación**: `server/campaign-reset/domain/interfaces/ICampaignResetRepository.ts`

**Propósito**: Define el contrato que debe cumplir cualquier implementación de repositorio.

##### Métodos de la Interface

**1. `clearCampaignLeads(campaignId: number): Promise<number>`**
```typescript
/**
 * Limpia los campaign_id de todos los leads asignados a una campaña
 * @param campaignId - ID de la campaña
 * @returns Cantidad de leads actualizados
 */
```

**Comportamiento esperado:**
- Buscar todos los leads con `campaign_id = campaignId`
- Actualizar `campaign_id` a `NULL`
- Retornar el conteo de leads actualizados
- La vista `op_leads_rep` se actualiza automáticamente

**2. `clearCampaignEndDate(campaignId: number): Promise<void>`**
```typescript
/**
 * Limpia la fecha_fin de una campaña para "reabrirla"
 * @param campaignId - ID de la campaña
 */
```

**Comportamiento esperado:**
- Actualizar `fecha_fin` a `NULL` en `campanas_comerciales`
- No retorna valor (void)
- Idempotente: puede ejecutarse múltiples veces sin efectos secundarios

**3. `getAssignedLeadsCount(campaignId: number): Promise<number>`**
```typescript
/**
 * Obtiene el conteo de leads asignados a una campaña
 * @param campaignId - ID de la campaña
 * @returns Cantidad de leads asignados
 */
```

**Comportamiento esperado:**
- Contar leads donde `campaign_id = campaignId`
- Retornar 0 si no hay leads asignados
- Usado para preview y validación

**4. `getFinishedCampaigns(...): Promise<Array<{...}>>`**
```typescript
/**
 * Obtiene todas las campañas con fecha_fin
 * @param beforeDate - Filtro: fecha_fin <= beforeDate (opcional)
 * @param afterDate - Filtro: fecha_fin >= afterDate (opcional)
 * @returns Array de campañas finalizadas
 */
```

**Comportamiento esperado:**
- Buscar campañas donde `fecha_fin IS NOT NULL`
- Aplicar filtros de fecha si se especifican
- JOIN con tabla `clientes` para obtener nombre
- Retornar array con información completa

**5. `isCampaignFinished(campaignId: number): Promise<boolean>`**
```typescript
/**
 * Verifica si una campaña tiene fecha_fin
 * @param campaignId - ID de la campaña
 * @returns true si tiene fecha_fin, false si no
 */
```

**Comportamiento esperado:**
- Verificar si `fecha_fin !== NULL`
- Retornar booleano
- Usado para lógica condicional en use cases

---

### 3.2 Application Layer (Capa de Aplicación)

#### 📄 `application/dto/ResetOptions.ts`

**Ubicación**: `server/campaign-reset/application/dto/ResetOptions.ts`

##### Interface: `ResetCampaignOptions`
```typescript
export interface ResetCampaignOptions {
  campaignId?: number;     // ID de la campaña (requerido en práctica)
  clientName?: string;     // Nombre del cliente (sin usar actualmente)
  campaignNumber?: number; // Número de campaña (sin usar actualmente)
  dryRun?: boolean;        // true = preview, false = ejecutar
}
```

**Análisis:**
- `campaignId` es requerido aunque sea opcional en el tipo
- `clientName` y `campaignNumber` no se usan en la implementación actual
- `dryRun` controla el modo de ejecución
- Campos opcionales para flexibilidad futura

##### Interface: `BatchResetOptions`
```typescript
export interface BatchResetOptions {
  beforeDate?: string;   // Filtro: procesar campañas finalizadas antes de esta fecha
  afterDate?: string;    // Filtro: procesar campañas finalizadas después de esta fecha
  onlyFinished?: boolean; // true = solo con fecha_fin (default: true)
  dryRun?: boolean;      // true = preview, false = ejecutar
}
```

**Análisis:**
- Fechas en formato string (ISO 8601)
- `onlyFinished` por defecto es `true`
- Permite rangos de fechas con `beforeDate` y `afterDate`

##### Interface: `ReopenOptions`
```typescript
export interface ReopenOptions {
  campaignIds?: number[]; // Array de IDs de campañas
  allFinished?: boolean;  // Reabrir todas las finalizadas
  dryRun?: boolean;       // Preview mode
}
```

**⚠️ NOTA:** Esta interface está definida pero **NO tiene use case ni controller implementado**.

---

#### 📄 `application/usecases/ResetCampaignUseCase.ts`

**Ubicación**: `server/campaign-reset/application/usecases/ResetCampaignUseCase.ts:5`

##### Clase: `ResetCampaignUseCase`

**Constructor:**
```typescript
constructor(
  private readonly campaignResetRepository: ICampaignResetRepository
) {}
```

**Inyección de dependencias:**
- Recibe `ICampaignResetRepository` (interface)
- No depende de implementación concreta
- Permite testing con mocks

##### Método: `execute(options: ResetCampaignOptions): Promise<ResetResult>`

**Ubicación**: `server/campaign-reset/application/usecases/ResetCampaignUseCase.ts:10`

**Flujo de ejecución:**

```typescript
1. Validación
   ├─ if (!campaignId) → throw Error

2. Obtener información
   ├─ getAssignedLeadsCount(campaignId)
   └─ isCampaignFinished(campaignId)

3. Si dryRun === true
   └─ return { preview data }

4. Si dryRun === false
   ├─ clearCampaignLeads(campaignId)
   ├─ if (isFinished)
   │  └─ clearCampaignEndDate(campaignId)
   └─ return { result data }

5. Manejo de errores
   └─ catch → return { success: false, error }
```

**Análisis línea por línea:**

**Líneas 11-15: Validación**
```typescript
const { campaignId, dryRun = false } = options;

if (!campaignId) {
  throw new Error('Campaign ID is required');
}
```
- Destructuring de opciones
- Default value para `dryRun` = `false`
- Validación explícita de `campaignId`

**Líneas 18-22: Obtención de datos**
```typescript
const leadsCount = await this.campaignResetRepository.getAssignedLeadsCount(campaignId);
const isFinished = await this.campaignResetRepository.isCampaignFinished(campaignId);
```
- **2 queries** secuenciales a BD
- Información necesaria para preview y lógica condicional

**Líneas 24-34: Modo Dry-Run**
```typescript
if (dryRun) {
  return {
    campaignId,
    campaignName: '', // Se llenará en el controller
    campaignNumber: 0,
    leadsReset: leadsCount,
    fechaFinCleared: isFinished,
    success: true,
  };
}
```
- **No ejecuta cambios** en BD
- Retorna información de preview
- `campaignName` y `campaignNumber` se completan después (controller)

**Líneas 36-44: Ejecución real**
```typescript
const leadsReset = await this.campaignResetRepository.clearCampaignLeads(campaignId);

let fechaFinCleared = false;
if (isFinished) {
  await this.campaignResetRepository.clearCampaignEndDate(campaignId);
  fechaFinCleared = true;
}
```
- **UPDATE 1:** Limpia leads asignados
- **UPDATE 2:** Limpia fecha_fin (condicional)
- Orden de operaciones: primero leads, luego fecha

**Líneas 55-65: Manejo de errores**
```typescript
catch (error: any) {
  return {
    campaignId,
    campaignName: '',
    campaignNumber: 0,
    leadsReset: 0,
    fechaFinCleared: false,
    success: false,
    error: error.message,
  };
}
```
- No lanza error, retorna resultado con `success: false`
- Incluye mensaje de error
- Permite continuar procesamiento en batch

---

#### 📄 `application/usecases/BatchResetUseCase.ts`

**Ubicación**: `server/campaign-reset/application/usecases/BatchResetUseCase.ts:5`

##### Clase: `BatchResetUseCase`

**Constructor:**
```typescript
constructor(
  private readonly campaignResetRepository: ICampaignResetRepository
) {}
```

##### Método: `execute(options: BatchResetOptions): Promise<BatchResetResult>`

**Ubicación**: `server/campaign-reset/application/usecases/BatchResetUseCase.ts:10`

**Flujo de ejecución:**

```typescript
1. Obtener campañas finalizadas
   ├─ getFinishedCampaigns(beforeDate?, afterDate?)
   └─ if (length === 0) → return empty result

2. Obtener conteo de leads para cada campaña
   ├─ Promise.all([...getAssignedLeadsCount])
   └─ Filtrar solo con leads (excepto dry-run)

3. Si dryRun === true
   └─ return { preview data }

4. Si dryRun === false
   ├─ for each campaign
   │  ├─ clearCampaignLeads(id)
   │  ├─ clearCampaignEndDate(id)
   │  └─ Acumular resultados
   └─ return { batch result }

5. Manejo de errores
   └─ catch → throw Error
```

**Análisis detallado:**

**Líneas 14-30: Obtención de campañas**
```typescript
let campaigns = await this.campaignResetRepository.getFinishedCampaigns(
  beforeDate ? new Date(beforeDate) : undefined,
  afterDate ? new Date(afterDate) : undefined
);

if (campaigns.length === 0) {
  return {
    totalCampaigns: 0,
    successfulResets: 0,
    failedResets: 0,
    totalLeadsReset: 0,
    campaignsReopened: 0,
    results: [],
    errors: [],
  };
}
```
- **1 query inicial** para obtener campañas
- Conversión de strings a Date objects
- Early return si no hay campañas

**Líneas 32-44: Procesamiento paralelo de conteos**
```typescript
const campaignsWithLeads = await Promise.all(
  campaigns.map(async (campaign) => {
    const leadsCount = await this.campaignResetRepository.getAssignedLeadsCount(campaign.id);
    return {
      ...campaign,
      leadsCount,
    };
  })
);

const campaignsToProcess = campaignsWithLeads.filter(c => c.leadsCount > 0 || dryRun);
```
- **N queries paralelas** (una por campaña)
- `Promise.all` para ejecutar en paralelo
- Filtra campañas sin leads (excepto en dry-run)

**⚡ Consideración de rendimiento:**
- Si hay 100 campañas → 100 queries simultáneas
- Puede causar sobrecarga en BD
- Alternativa: query única con GROUP BY

**Líneas 46-66: Modo Dry-Run**
```typescript
if (dryRun) {
  const results: ResetResult[] = campaignsToProcess.map(campaign => ({
    campaignId: campaign.id,
    campaignName: campaign.clienteNombre || '',
    campaignNumber: campaign.numeroCampana,
    leadsReset: campaign.leadsCount,
    fechaFinCleared: true,
    success: true,
  }));

  return {
    totalCampaigns: campaignsToProcess.length,
    successfulResets: 0,
    failedResets: 0,
    totalLeadsReset: campaignsToProcess.reduce((sum, c) => sum + c.leadsCount, 0),
    campaignsReopened: 0,
    results,
    errors: [],
  };
}
```
- No ejecuta cambios en BD
- Calcula totales con `reduce()`
- `successfulResets` y `failedResets` son 0 (preview)

**Líneas 68-116: Ejecución real**
```typescript
const results: ResetResult[] = [];
const errors: Array<{ campaignId: number; error: string }> = [];
let totalLeadsReset = 0;
let successfulResets = 0;
let failedResets = 0;
let campaignsReopened = 0;

for (const campaign of campaignsToProcess) {
  try {
    // Limpiar leads
    const leadsReset = await this.campaignResetRepository.clearCampaignLeads(campaign.id);

    // Limpiar fecha_fin
    await this.campaignResetRepository.clearCampaignEndDate(campaign.id);

    totalLeadsReset += leadsReset;
    successfulResets++;
    if (campaign.fechaFin) {
      campaignsReopened++;
    }

    results.push({...});

  } catch (error: any) {
    failedResets++;
    errors.push({...});
    results.push({success: false, ...});
  }
}
```

**⚠️ Análisis crítico:**

1. **Procesamiento secuencial (no paralelo)**
   - Usa `for...of` en lugar de `Promise.all`
   - Cada campaña se procesa una por una
   - Si hay 100 campañas con 10ms cada una → 1000ms total

2. **Sin transacciones**
   - Si falla `clearCampaignEndDate`, los leads ya están limpios
   - Estado inconsistente posible
   - No hay rollback automático

3. **Manejo de errores individual**
   - Un error no detiene el proceso completo
   - Buenos para batch: continúa con las demás
   - Errores se acumulan en el array `errors`

**Líneas 128-130: Manejo de errores global**
```typescript
catch (error: any) {
  throw new Error(`Batch reset failed: ${error.message}`);
}
```
- Captura errores de setup (ej: conexión a BD)
- Lanza error con contexto
- Diferente al manejo de errores individuales

---

### 3.3 Infrastructure Layer (Capa de Infraestructura)

#### 📄 `infrastructure/repositories/PostgresCampaignResetRepository.ts`

**Ubicación**: `server/campaign-reset/infrastructure/repositories/PostgresCampaignResetRepository.ts:6`

##### Clase: `PostgresCampaignResetRepository implements ICampaignResetRepository`

**Imports:**
```typescript
import { db } from '../../../db';
import { opLead, campanasComerciales, clientes } from '../../../../shared/schema';
import { eq, sql, isNotNull, and, gte, lte } from 'drizzle-orm';
```

**Tecnología:**
- **ORM**: Drizzle ORM
- **Query Builder**: Type-safe
- **Schema**: Definido en `shared/schema`

---

##### Método: `clearCampaignLeads(campaignId: number): Promise<number>`

**Ubicación**: `server/campaign-reset/infrastructure/repositories/PostgresCampaignResetRepository.ts:8`

**Implementación:**
```typescript
async clearCampaignLeads(campaignId: number): Promise<number> {
  // 1. Contar antes de limpiar
  const [countBefore] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(eq(opLead.campaignId, campaignId));

  const leadsCount = countBefore?.count || 0;

  if (leadsCount === 0) {
    return 0;
  }

  // 2. Limpiar campaign_id
  await db
    .update(opLead)
    .set({ campaignId: null })
    .where(eq(opLead.campaignId, campaignId));

  return leadsCount;
}
```

**SQL generado:**

**Query 1: Contar leads**
```sql
SELECT count(*)::int AS count
FROM op_lead
WHERE campaign_id = $1
```

**Query 2: Limpiar campaign_id**
```sql
UPDATE op_lead
SET campaign_id = NULL
WHERE campaign_id = $1
```

**Análisis:**
- **2 queries**: COUNT + UPDATE
- Early return si no hay leads
- `count(*)::int` para conversión de tipo
- Operación segura: no afecta otras columnas

**⚡ Optimización potencial:**
```typescript
// Alternativa: COUNT en el UPDATE mismo
const result = await db
  .update(opLead)
  .set({ campaignId: null })
  .where(eq(opLead.campaignId, campaignId))
  .returning({ id: opLead.id });

return result.length; // Solo 1 query
```

---

##### Método: `clearCampaignEndDate(campaignId: number): Promise<void>`

**Ubicación**: `server/campaign-reset/infrastructure/repositories/PostgresCampaignResetRepository.ts:30`

**Implementación:**
```typescript
async clearCampaignEndDate(campaignId: number): Promise<void> {
  await db
    .update(campanasComerciales)
    .set({ fechaFin: null })
    .where(eq(campanasComerciales.id, campaignId));
}
```

**SQL generado:**
```sql
UPDATE campanas_comerciales
SET fecha_fin = NULL
WHERE id = $1
```

**Análisis:**
- Simple y directo
- Idempotente: puede ejecutarse múltiples veces
- No verifica si la campaña existe (falla silenciosamente)

---

##### Método: `getAssignedLeadsCount(campaignId: number): Promise<number>`

**Ubicación**: `server/campaign-reset/infrastructure/repositories/PostgresCampaignResetRepository.ts:37`

**Implementación:**
```typescript
async getAssignedLeadsCount(campaignId: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(eq(opLead.campaignId, campaignId));

  return result?.count || 0;
}
```

**SQL generado:**
```sql
SELECT count(*)::int AS count
FROM op_lead
WHERE campaign_id = $1
```

**Análisis:**
- Retorna 0 si no hay resultado
- Mismo patrón que en `clearCampaignLeads`
- Duplicación de código (DRY violation)

---

##### Método: `getFinishedCampaigns(beforeDate?, afterDate?)`

**Ubicación**: `server/campaign-reset/infrastructure/repositories/PostgresCampaignResetRepository.ts:46`

**Implementación:**
```typescript
async getFinishedCampaigns(beforeDate?: Date, afterDate?: Date) {
  // 1. Query base
  let query = db
    .select({
      id: campanasComerciales.id,
      numeroCampana: campanasComerciales.numeroCampana,
      clienteNombre: clientes.nombreComercial,
      marca: campanasComerciales.marca,
      zona: campanasComerciales.zona,
      fechaFin: campanasComerciales.fechaFin,
    })
    .from(campanasComerciales)
    .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
    .where(isNotNull(campanasComerciales.fechaFin));

  const campaigns = await query;

  // 2. Filtrado en memoria
  let filtered = campaigns
    .filter(c => c.fechaFin !== null)
    .map(c => ({
      id: c.id,
      numeroCampana: typeof c.numeroCampana === 'string'
        ? parseInt(c.numeroCampana)
        : c.numeroCampana,
      clienteNombre: c.clienteNombre || '',
      marca: c.marca,
      zona: c.zona,
      fechaFin: new Date(c.fechaFin!)
    }));

  // 3. Filtros de fecha
  if (beforeDate) {
    filtered = filtered.filter(c => new Date(c.fechaFin) <= beforeDate);
  }

  if (afterDate) {
    filtered = filtered.filter(c => new Date(c.fechaFin) >= afterDate);
  }

  return filtered;
}
```

**SQL generado:**
```sql
SELECT
  c.id,
  c.numero_campana,
  cl.nombre_comercial AS cliente_nombre,
  c.marca,
  c.zona,
  c.fecha_fin
FROM campanas_comerciales c
LEFT JOIN clientes cl ON c.cliente_id = cl.id
WHERE c.fecha_fin IS NOT NULL
```

**⚠️ Problema de rendimiento:**

**Líneas 74-80: Filtrado en memoria**
```typescript
if (beforeDate) {
  filtered = filtered.filter(c => new Date(c.fechaFin) <= beforeDate);
}

if (afterDate) {
  filtered = filtered.filter(c => new Date(c.fechaFin) >= afterDate);
}
```

**Análisis crítico:**
1. **Trae TODAS las campañas finalizadas de la BD**
2. **Filtra por fechas EN MEMORIA**
3. Si hay 10,000 campañas finalizadas pero solo 10 en el rango → transfiere 10,000 filas

**✅ Solución optimizada:**
```typescript
const conditions = [isNotNull(campanasComerciales.fechaFin)];

if (beforeDate) {
  conditions.push(lte(campanasComerciales.fechaFin, beforeDate));
}

if (afterDate) {
  conditions.push(gte(campanasComerciales.fechaFin, afterDate));
}

const campaigns = await db
  .select({...})
  .from(campanasComerciales)
  .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
  .where(and(...conditions));
```

**SQL optimizado:**
```sql
SELECT ...
FROM campanas_comerciales c
LEFT JOIN clientes cl ON c.cliente_id = cl.id
WHERE c.fecha_fin IS NOT NULL
  AND c.fecha_fin <= $1
  AND c.fecha_fin >= $2
```

---

##### Método: `isCampaignFinished(campaignId: number): Promise<boolean>`

**Ubicación**: `server/campaign-reset/infrastructure/repositories/PostgresCampaignResetRepository.ts:85`

**Implementación:**
```typescript
async isCampaignFinished(campaignId: number): Promise<boolean> {
  const [campaign] = await db
    .select({ fechaFin: campanasComerciales.fechaFin })
    .from(campanasComerciales)
    .where(eq(campanasComerciales.id, campaignId));

  return campaign?.fechaFin !== null;
}
```

**SQL generado:**
```sql
SELECT fecha_fin
FROM campanas_comerciales
WHERE id = $1
```

**Análisis:**
- Query selectivo: solo trae `fecha_fin`
- Retorna `false` si campaña no existe
- Lógica simple y clara

---

### 3.4 Presentation Layer (Capa de Presentación)

#### 📄 `presentation/controllers/ResetCampaignController.ts`

**Ubicación**: `server/campaign-reset/presentation/controllers/ResetCampaignController.ts:4`

##### Clase: `ResetCampaignController`

**Constructor:**
```typescript
constructor(
  private readonly resetCampaignUseCase: ResetCampaignUseCase
) {}
```

##### Método: `execute(req: Request, res: Response): Promise<void>`

**Ubicación**: `server/campaign-reset/presentation/controllers/ResetCampaignController.ts:9`

**Implementación:**
```typescript
async execute(req: Request, res: Response): Promise<void> {
  try {
    // 1. Extraer parámetros
    const { campaignId } = req.params;
    const { dryRun } = req.query;

    // 2. Validación
    if (!campaignId) {
      res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
      });
      return;
    }

    // 3. Ejecutar use case
    const result = await this.resetCampaignUseCase.execute({
      campaignId: parseInt(campaignId),
      dryRun: dryRun === 'true',
    });

    // 4. Manejar resultado fallido
    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    // 5. Respuesta exitosa
    res.status(200).json({
      success: true,
      data: result,
      message: dryRun === 'true'
        ? `Dry run: Would reset ${result.leadsReset} leads and ${result.fechaFinCleared ? 'clear' : 'not clear'} fecha_fin`
        : `Successfully reset ${result.leadsReset} leads and ${result.fechaFinCleared ? 'cleared' : 'did not clear'} fecha_fin`,
    });

  } catch (error: any) {
    console.error('Error in ResetCampaignController:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

**Análisis:**

**Líneas 11-12: Extracción de parámetros**
```typescript
const { campaignId } = req.params;  // De URL: /api/campaign-reset/65
const { dryRun } = req.query;       // De query: ?dryRun=true
```

**Líneas 14-20: Validación de entrada**
```typescript
if (!campaignId) {
  res.status(400).json({...});
  return;
}
```
- Status 400 (Bad Request)
- Early return
- Respuesta JSON estructurada

**Líneas 22-25: Conversión de tipos**
```typescript
const result = await this.resetCampaignUseCase.execute({
  campaignId: parseInt(campaignId),     // string → number
  dryRun: dryRun === 'true',            // string → boolean
});
```
- Express params/query son siempre strings
- Conversión explícita de tipos
- `dryRun === 'true'` maneja correctamente undefined

**Líneas 27-33: Manejo de errores del use case**
```typescript
if (!result.success) {
  res.status(500).json({...});
  return;
}
```
- Use case no lanza error, retorna `success: false`
- Status 500 (Internal Server Error)
- Propaga mensaje de error

**Líneas 35-42: Respuesta exitosa**
```typescript
res.status(200).json({
  success: true,
  data: result,
  message: dryRun === 'true' ? '...' : '...',
});
```
- Status 200 (OK)
- Mensaje contextual según modo
- Incluye resultado completo

---

#### 📄 `presentation/controllers/BatchResetController.ts`

**Ubicación**: `server/campaign-reset/presentation/controllers/BatchResetController.ts:4`

##### Clase: `BatchResetController`

**Implementación:**
```typescript
async execute(req: Request, res: Response): Promise<void> {
  try {
    const { beforeDate, afterDate, onlyFinished, dryRun } = req.query;

    const result = await this.batchResetUseCase.execute({
      beforeDate: beforeDate as string | undefined,
      afterDate: afterDate as string | undefined,
      onlyFinished: onlyFinished !== 'false',  // default true
      dryRun: dryRun === 'true',
    });

    const message = dryRun === 'true'
      ? `Dry run: Would reset ${result.totalCampaigns} campaigns with ${result.totalLeadsReset} total leads`
      : `Successfully reset ${result.successfulResets} campaigns with ${result.totalLeadsReset} total leads`;

    res.status(200).json({
      success: true,
      data: result,
      message,
    });

  } catch (error: any) {
    console.error('Error in BatchResetController:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
```

**Análisis:**

**Línea 11: Extracción de query params**
```typescript
const { beforeDate, afterDate, onlyFinished, dryRun } = req.query;
```
- Todos los parámetros vienen de query string
- No hay params en URL

**Línea 16: Lógica de onlyFinished**
```typescript
onlyFinished: onlyFinished !== 'false',
```
- Default es `true`
- Solo es `false` si explícitamente se pasa `?onlyFinished=false`
- `undefined` → `true`
- `'true'` → `true`
- `'false'` → `false`

**⚠️ Nota:** `onlyFinished` no se usa en el use case actual. El método `getFinishedCampaigns` siempre filtra por `fecha_fin IS NOT NULL`.

**Líneas 19-21: Mensaje dinámico**
```typescript
const message = dryRun === 'true'
  ? `Dry run: Would reset ${result.totalCampaigns} campaigns...`
  : `Successfully reset ${result.successfulResets} campaigns...`;
```
- Usa `totalCampaigns` en dry-run
- Usa `successfulResets` en ejecución real
- Diferentes métricas para contextos diferentes

---

#### 📄 `presentation/routes/campaign-reset-routes.ts`

**Ubicación**: `server/campaign-reset/presentation/routes/campaign-reset-routes.ts:12`

##### Function: `createCampaignResetRoutes(): Router`

**Implementación:**
```typescript
export function createCampaignResetRoutes(): Router {
  const router = Router();

  console.log('🔄 Configurando rutas de reset de campañas...');

  // 1. Instanciar repositorios
  const campaignResetRepository = new PostgresCampaignResetRepository();

  // 2. Instanciar use cases
  const resetCampaignUseCase = new ResetCampaignUseCase(campaignResetRepository);
  const batchResetUseCase = new BatchResetUseCase(campaignResetRepository);

  // 3. Instanciar controllers
  const resetCampaignController = new ResetCampaignController(resetCampaignUseCase);
  const batchResetController = new BatchResetController(batchResetUseCase);

  // 4. Definir rutas
  router.post('/batch', (req, res) => {
    batchResetController.execute(req, res);
  });

  router.post('/:campaignId', (req, res) => {
    resetCampaignController.execute(req, res);
  });

  console.log('   POST /batch');
  console.log('   POST /:campaignId');

  return router;
}
```

**Análisis:**

**⚠️ IMPORTANTE - Orden de las rutas:**
```typescript
router.post('/batch', ...);          // Debe ir PRIMERO
router.post('/:campaignId', ...);    // Debe ir DESPUÉS
```

**Razón:**
- Express evalúa rutas en orden de registro
- Si `/:campaignId` va primero, captura `'batch'` como campaignId
- Orden correcto evita colisiones

**Patrón Factory:**
```typescript
export function createCampaignResetRoutes(): Router
```
- Factory function en lugar de exportar router directamente
- Permite crear múltiples instancias si es necesario
- Encapsula toda la configuración

**Inyección de dependencias manual:**
```typescript
const repository = new PostgresCampaignResetRepository();
const useCase = new ResetCampaignUseCase(repository);
const controller = new ResetCampaignController(useCase);
```
- Sin contenedor de DI
- Instanciación manual
- Controlado y simple

---

## 4. Flujos de Ejecución

### 4.1 Flujo: Reset Campaña Individual

```
┌─────────────────────────────────────────────────────────┐
│ 1. HTTP REQUEST                                         │
│    POST /api/campaign-reset/65?dryRun=true             │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. PRESENTATION LAYER                                   │
│    ResetCampaignController.execute()                    │
│    ├─ Extraer: campaignId = 65                         │
│    ├─ Extraer: dryRun = true                           │
│    └─ Validar: campaignId requerido                    │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. APPLICATION LAYER                                    │
│    ResetCampaignUseCase.execute()                       │
│    ├─ Query 1: getAssignedLeadsCount(65)               │
│    │   └─ SELECT count(*) FROM op_lead WHERE...        │
│    │   └─ Result: 82 leads                             │
│    ├─ Query 2: isCampaignFinished(65)                  │
│    │   └─ SELECT fecha_fin FROM campanas WHERE...      │
│    │   └─ Result: true                                 │
│    └─ if (dryRun) return preview                       │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. RESPONSE (Dry-Run)                                   │
│    Status: 200 OK                                       │
│    {                                                    │
│      "success": true,                                   │
│      "data": {                                          │
│        "campaignId": 65,                                │
│        "leadsReset": 82,                                │
│        "fechaFinCleared": true,                         │
│        "success": true                                  │
│      },                                                 │
│      "message": "Dry run: Would reset 82 leads..."     │
│    }                                                    │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Flujo: Reset Batch

```
┌─────────────────────────────────────────────────────────┐
│ 1. HTTP REQUEST                                         │
│    POST /api/campaign-reset/batch?                     │
│         beforeDate=2025-09-01&dryRun=false             │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. PRESENTATION LAYER                                   │
│    BatchResetController.execute()                       │
│    ├─ Extraer query params                             │
│    └─ Convertir tipos                                  │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. APPLICATION LAYER                                    │
│    BatchResetUseCase.execute()                          │
│                                                         │
│    ┌───────────────────────────────────────┐           │
│    │ FASE 1: Obtener campañas             │           │
│    ├───────────────────────────────────────┤           │
│    │ Query: getFinishedCampaigns(...)     │           │
│    │ Result: [40 campañas]                │           │
│    └───────────────────────────────────────┘           │
│                    │                                    │
│                    ▼                                    │
│    ┌───────────────────────────────────────┐           │
│    │ FASE 2: Contar leads (paralelo)     │           │
│    ├───────────────────────────────────────┤           │
│    │ Promise.all([                        │           │
│    │   getAssignedLeadsCount(65),         │           │
│    │   getAssignedLeadsCount(73),         │           │
│    │   ...                                │           │
│    │ ])                                   │           │
│    │ Result: [82, 1009, ...]              │           │
│    └───────────────────────────────────────┘           │
│                    │                                    │
│                    ▼                                    │
│    ┌───────────────────────────────────────┐           │
│    │ FASE 3: Procesar (secuencial)       │           │
│    ├───────────────────────────────────────┤           │
│    │ for (campaña 65) {                   │           │
│    │   clearCampaignLeads(65)             │           │
│    │   clearCampaignEndDate(65)           │           │
│    │ }                                    │           │
│    │ for (campaña 73) {                   │           │
│    │   clearCampaignLeads(73)             │           │
│    │   clearCampaignEndDate(73)           │           │
│    │ }                                    │           │
│    │ ...                                  │           │
│    └───────────────────────────────────────┘           │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. RESPONSE                                             │
│    Status: 200 OK                                       │
│    {                                                    │
│      "success": true,                                   │
│      "data": {                                          │
│        "totalCampaigns": 40,                            │
│        "successfulResets": 40,                          │
│        "failedResets": 0,                               │
│        "totalLeadsReset": 7676,                         │
│        "campaignsReopened": 40,                         │
│        "results": [...],                                │
│        "errors": []                                     │
│      },                                                 │
│      "message": "Successfully reset 40 campaigns..."    │
│    }                                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Operaciones de Base de Datos

### 5.1 Tablas Involucradas

#### Tabla: `op_lead`
```sql
CREATE TABLE op_lead (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campanas_comerciales(id),
  -- otros campos...
);

CREATE INDEX idx_op_lead_campaign_id ON op_lead(campaign_id);
```

**Columnas relevantes:**
- `id`: Primary key
- `campaign_id`: Foreign key a `campanas_comerciales`

**Operaciones:**
- ✅ UPDATE SET campaign_id = NULL
- ✅ SELECT COUNT(*) WHERE campaign_id = ?

---

#### Tabla: `campanas_comerciales`
```sql
CREATE TABLE campanas_comerciales (
  id SERIAL PRIMARY KEY,
  numero_campana INTEGER,
  cliente_id INTEGER REFERENCES clientes(id),
  marca VARCHAR,
  zona VARCHAR,
  fecha_fin TIMESTAMP,
  -- otros campos...
);

CREATE INDEX idx_campanas_fecha_fin ON campanas_comerciales(fecha_fin);
```

**Columnas relevantes:**
- `id`: Primary key
- `numero_campana`: Número de campaña
- `cliente_id`: Foreign key a `clientes`
- `fecha_fin`: Fecha de finalización (NULL = activa)

**Operaciones:**
- ✅ UPDATE SET fecha_fin = NULL
- ✅ SELECT WHERE fecha_fin IS NOT NULL

---

#### Tabla: `clientes`
```sql
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nombre_comercial VARCHAR,
  -- otros campos...
);
```

**Operaciones:**
- ✅ JOIN para obtener nombre comercial

---

### 5.2 Queries SQL Detalladas

#### Query: Contar leads asignados
```sql
SELECT count(*)::int AS count
FROM op_lead
WHERE campaign_id = $1
```

**Performance:**
- Usa índice: `idx_op_lead_campaign_id`
- O(log n) con índice
- Rápida incluso con millones de leads

---

#### Query: Limpiar leads
```sql
UPDATE op_lead
SET campaign_id = NULL
WHERE campaign_id = $1
```

**Performance:**
- Usa índice para WHERE
- O(n) donde n = leads con esa campaña
- Puede ser lenta si hay miles de leads

**Impacto:**
- Locks: Row-level locks
- Actualiza índices automáticamente
- Puede generar dead tuples (requiere VACUUM)

---

#### Query: Limpiar fecha_fin
```sql
UPDATE campanas_comerciales
SET fecha_fin = NULL
WHERE id = $1
```

**Performance:**
- O(1) por primary key
- Muy rápida

---

#### Query: Obtener campañas finalizadas
```sql
SELECT
  c.id,
  c.numero_campana,
  cl.nombre_comercial AS cliente_nombre,
  c.marca,
  c.zona,
  c.fecha_fin
FROM campanas_comerciales c
LEFT JOIN clientes cl ON c.cliente_id = cl.id
WHERE c.fecha_fin IS NOT NULL
```

**Performance:**
- Usa índice: `idx_campanas_fecha_fin`
- JOIN con clientes (pequeña tabla)
- Puede retornar muchas filas

**⚠️ Problema:**
```typescript
// Filtra en memoria DESPUÉS de traer todas las filas
if (beforeDate) {
  filtered = filtered.filter(c => new Date(c.fechaFin) <= beforeDate);
}
```

**✅ Optimización:**
```sql
-- Filtrar en la query
WHERE c.fecha_fin IS NOT NULL
  AND c.fecha_fin <= $1
  AND c.fecha_fin >= $2
```

---

#### Query: Verificar si está finalizada
```sql
SELECT fecha_fin
FROM campanas_comerciales
WHERE id = $1
```

**Performance:**
- O(1) por primary key
- Muy rápida

---

### 5.3 Volumen de Queries por Operación

#### Reset Individual (sin dry-run):
```
1. getAssignedLeadsCount()        → 1 SELECT
2. isCampaignFinished()           → 1 SELECT
3. clearCampaignLeads()           → 1 SELECT + 1 UPDATE
4. clearCampaignEndDate()         → 1 UPDATE

TOTAL: 3 SELECT + 2 UPDATE = 5 queries
```

#### Reset Batch de N campañas (sin dry-run):
```
1. getFinishedCampaigns()         → 1 SELECT
2. getAssignedLeadsCount() x N    → N SELECT (paralelo)
3. Para cada campaña (secuencial):
   - clearCampaignLeads()         → 1 SELECT + 1 UPDATE
   - clearCampaignEndDate()       → 1 UPDATE

TOTAL: (1 + N + 2N) SELECT + 2N UPDATE
     = (1 + 3N) SELECT + 2N UPDATE
     = 5N + 1 queries

Ejemplo N=40: 201 queries
```

**⚡ Consideraciones:**
- 201 queries para 40 campañas es mucho
- Potencial de optimización con bulk operations
- Queries paralelas ayudan, pero no son la solución óptima

---

## 6. Modelos de Datos

### 6.1 Diagrama de Entidades

```
┌──────────────────────┐
│    ResetResult       │
├──────────────────────┤
│ campaignId: number   │
│ campaignName: string │
│ campaignNumber: int  │
│ leadsReset: number   │
│ fechaFinCleared: bool│
│ success: boolean     │
│ error?: string       │
└──────────────────────┘
          ▲
          │ (array of)
          │
┌──────────────────────────────┐
│    BatchResetResult          │
├──────────────────────────────┤
│ totalCampaigns: number       │
│ successfulResets: number     │
│ failedResets: number         │
│ totalLeadsReset: number      │
│ campaignsReopened: number    │
│ results: ResetResult[]       │
│ errors: Array<{...}>         │
└──────────────────────────────┘
```

### 6.2 Relaciones de Base de Datos

```
┌─────────────┐         ┌─────────────────────┐
│   clientes  │◄───┐    │  campanas_          │
│             │    │    │  comerciales        │
│ - id (PK)   │    └────│ - id (PK)           │
│ - nombre    │         │ - cliente_id (FK)   │
└─────────────┘         │ - numero_campana    │
                        │ - fecha_fin         │
                        └─────────────────────┘
                                 ▲
                                 │
                                 │ (FK)
                                 │
                        ┌─────────────────────┐
                        │      op_lead        │
                        │                     │
                        │ - id (PK)           │
                        │ - campaign_id (FK)  │
                        │ - ...               │
                        └─────────────────────┘
```

**Integridad referencial:**
- `op_lead.campaign_id` → `campanas_comerciales.id`
- `campanas_comerciales.cliente_id` → `clientes.id`

**Comportamiento ON DELETE:**
- ⚠️ No especificado en el código analizado
- Recomendación: `ON DELETE SET NULL` para `op_lead.campaign_id`

---

## 7. Manejo de Errores

### 7.1 Estrategias por Capa

#### Presentation Layer
```typescript
try {
  // validación
  // ejecución
  // respuesta
} catch (error: any) {
  console.error('Error in Controller:', error);
  res.status(500).json({
    success: false,
    error: error.message,
  });
}
```

**Estrategia:**
- Captura todos los errores no controlados
- Log en consola
- Respuesta HTTP 500
- No expone stack trace al cliente

---

#### Application Layer (Use Case Individual)
```typescript
try {
  // lógica
} catch (error: any) {
  return {
    campaignId,
    success: false,
    error: error.message,
  };
}
```

**Estrategia:**
- **No lanza error**, retorna resultado con `success: false`
- Permite al controller decidir status code
- Útil para procesamiento batch (no detiene el flujo)

---

#### Application Layer (Use Case Batch)
```typescript
for (const campaign of campaigns) {
  try {
    // procesar campaña
  } catch (error: any) {
    // Acumular error, continuar con siguiente
    errors.push({ campaignId, error: error.message });
  }
}
```

**Estrategia:**
- Error individual no detiene batch
- Acumula errores para reporte
- Robustez: procesa todas las campañas posibles

---

#### Infrastructure Layer
```typescript
// No manejo explícito de errores
// Drizzle ORM lanza errores automáticamente
```

**Errores posibles:**
- `ConnectionError`: No puede conectar a BD
- `QueryError`: Query SQL inválida
- `ConstraintError`: Violación de constraints
- `TimeoutError`: Query excede timeout

**Propagación:**
- Errores suben a Application Layer
- Application Layer decide qué hacer

---

### 7.2 Tipos de Errores

| Error | Capa | Handling | HTTP Status |
|-------|------|----------|-------------|
| `Campaign ID is required` | Presentation | Return 400 | 400 Bad Request |
| `ConnectionError` | Infrastructure | Propagate → Controller | 500 Internal Server Error |
| `QueryError` (SQL syntax) | Infrastructure | Propagate → Use Case | 500 Internal Server Error |
| `Campaign not found` | *No se maneja* | *Falla silenciosa* | 200 OK (con leadsReset=0) |
| `ConstraintError` | Infrastructure | Propagate → Use Case | 500 Internal Server Error |

**⚠️ Problemas identificados:**

1. **No valida existencia de campaña**
   - Si `campaignId=999999` no existe
   - Query retorna 0 leads
   - Responde "exitoso" con leadsReset=0

2. **Fallos silenciosos en UPDATE**
   - `clearCampaignEndDate(999999)` no falla
   - UPDATE afecta 0 filas pero no reporta error

---

## 8. Consideraciones de Rendimiento

### 8.1 Análisis de Performance

#### Reset Individual

**Escenario 1: Campaña pequeña (100 leads)**
```
Tiempo estimado:
- getAssignedLeadsCount: ~5ms
- isCampaignFinished: ~2ms
- clearCampaignLeads: ~20ms
- clearCampaignEndDate: ~2ms

TOTAL: ~29ms
```

**Escenario 2: Campaña grande (10,000 leads)**
```
Tiempo estimado:
- getAssignedLeadsCount: ~10ms
- isCampaignFinished: ~2ms
- clearCampaignLeads: ~500ms
- clearCampaignEndDate: ~2ms

TOTAL: ~514ms
```

**Bottleneck:** UPDATE de muchos leads

---

#### Reset Batch

**Escenario: 40 campañas con avg 200 leads cada una**
```
Fase 1: getFinishedCampaigns
  - 1 query
  - ~50ms

Fase 2: getAssignedLeadsCount x 40 (paralelo)
  - 40 queries en paralelo
  - ~100ms total

Fase 3: clearCampaignLeads + clearCampaignEndDate x 40 (secuencial)
  - 40 x (SELECT + UPDATE + UPDATE)
  - ~40ms por campaña
  - ~1600ms total

TOTAL: ~1750ms (1.75 segundos)
```

**Bottleneck:** Procesamiento secuencial de campañas

---

### 8.2 Optimizaciones Propuestas

#### Optimización 1: Bulk UPDATE para leads
```sql
-- En lugar de 1 UPDATE por campaña
UPDATE op_lead
SET campaign_id = NULL
WHERE campaign_id = $1

-- Hacer 1 UPDATE para todas
UPDATE op_lead
SET campaign_id = NULL
WHERE campaign_id IN ($1, $2, $3, ...)
```

**Beneficio:**
- Reduce de N UPDATEs a 1 UPDATE
- PostgreSQL optimiza bulk operations
- Reducción de ~80% en tiempo

---

#### Optimización 2: Queries con RETURNING
```typescript
// En lugar de COUNT + UPDATE
const [count] = await db
  .select({ count: sql`count(*)` })
  .from(opLead)
  .where(...);

const updated = await db.update(opLead)...;

// Hacer UPDATE con RETURNING
const result = await db
  .update(opLead)
  .set({ campaignId: null })
  .where(eq(opLead.campaignId, campaignId))
  .returning({ id: opLead.id });

const count = result.length;
```

**Beneficio:**
- Reduce de 2 queries a 1
- Menos round-trips a BD
- Más atómico

---

#### Optimización 3: Procesamiento paralelo en batch
```typescript
// En lugar de for...of (secuencial)
for (const campaign of campaigns) {
  await clearCampaignLeads(campaign.id);
  await clearCampaignEndDate(campaign.id);
}

// Hacer procesamiento paralelo
await Promise.all(
  campaigns.map(async (campaign) => {
    await clearCampaignLeads(campaign.id);
    await clearCampaignEndDate(campaign.id);
  })
);
```

**Beneficio:**
- Paraleliza operaciones
- Reduce tiempo total significativamente
- Cuidado con sobrecarga de conexiones

---

#### Optimización 4: Filtros SQL en lugar de memoria
```typescript
// ANTES: Filtrar en memoria
const campaigns = await getFinishedCampaigns();
const filtered = campaigns.filter(c => c.fechaFin <= beforeDate);

// DESPUÉS: Filtrar en SQL
const campaigns = await db
  .select({...})
  .from(campanasComerciales)
  .where(
    and(
      isNotNull(campanasComerciales.fechaFin),
      lte(campanasComerciales.fechaFin, beforeDate)
    )
  );
```

**Beneficio:**
- Reduce transferencia de datos
- Índices de BD se aprovechan
- Más eficiente en volumen

---

### 8.3 Índices Recomendados

```sql
-- Índice existente (asumido)
CREATE INDEX idx_op_lead_campaign_id ON op_lead(campaign_id);

-- Índice recomendado para campañas finalizadas
CREATE INDEX idx_campanas_fecha_fin ON campanas_comerciales(fecha_fin)
WHERE fecha_fin IS NOT NULL;

-- Índice compuesto para filtros de rango
CREATE INDEX idx_campanas_fecha_fin_range
ON campanas_comerciales(fecha_fin DESC, id);
```

---

## 9. Seguridad

### 9.1 Vulnerabilidades Actuales

#### ❌ Falta de Autenticación
```typescript
// Cualquiera puede ejecutar
POST /api/campaign-reset/65
```

**Riesgo:**
- Acceso no autorizado
- Modificación de datos sin auditoría
- Sin trazabilidad de quién ejecutó

**Mitigación:**
```typescript
router.post('/:campaignId', authMiddleware, (req, res) => {
  resetCampaignController.execute(req, res);
});
```

---

#### ❌ Falta de Autorización
```typescript
// No verifica permisos del usuario
```

**Riesgo:**
- Usuario sin permisos puede resetear campañas
- No hay control de acceso basado en roles

**Mitigación:**
```typescript
router.post('/:campaignId',
  authMiddleware,
  hasRole('admin'),
  (req, res) => {
    resetCampaignController.execute(req, res);
  }
);
```

---

#### ❌ Sin Rate Limiting
```typescript
// Sin límite de requests
```

**Riesgo:**
- Abuso de API
- Sobrecarga de base de datos
- DoS accidental o intencional

**Mitigación:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // 10 requests por IP
});

router.post('/batch', limiter, ...);
```

---

#### ⚠️ SQL Injection (Mitigado por ORM)
```typescript
// Drizzle ORM previene SQL injection automáticamente
await db
  .update(opLead)
  .set({ campaignId: null })
  .where(eq(opLead.campaignId, campaignId));
```

**Estado:** ✅ Protegido por ORM
**Riesgo:** Bajo (requiere bypass del ORM)

---

#### ❌ Sin Auditoría
```typescript
// No registra quién ejecutó el reset
```

**Riesgo:**
- Sin trazabilidad
- No se puede auditar acciones
- Dificulta investigación de incidentes

**Mitigación:**
```typescript
// Agregar tabla de auditoría
CREATE TABLE campaign_reset_audit (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER,
  user_id INTEGER,
  leads_reset INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

---

### 9.2 Mejores Prácticas de Seguridad

#### ✅ Validación de Input
```typescript
// Validar que campaignId sea número positivo
if (isNaN(campaignId) || campaignId <= 0) {
  return res.status(400).json({
    success: false,
    error: 'Invalid campaign ID',
  });
}
```

---

#### ✅ Sanitización de Errores
```typescript
// No exponer detalles internos
catch (error: any) {
  console.error('Internal error:', error); // Log completo

  res.status(500).json({
    success: false,
    error: 'An error occurred', // Mensaje genérico
  });
}
```

---

#### ✅ Logging Estructurado
```typescript
logger.info('Campaign reset initiated', {
  campaignId,
  userId: req.user.id,
  dryRun,
  timestamp: new Date().toISOString(),
});
```

---

## 10. Áreas de Mejora

### 10.1 Funcionalidad Faltante

#### 1. Uso de ReopenOptions
```typescript
// Definido pero no implementado
export interface ReopenOptions {
  campaignIds?: number[];
  allFinished?: boolean;
  dryRun?: boolean;
}
```

**Propuesta:**
- Crear `ReopenCampaignUseCase`
- Solo limpia `fecha_fin`, NO toca leads
- Útil para reabrir sin liberar leads

---

#### 2. Transacciones
```typescript
// Implementar operaciones atómicas
await db.transaction(async (tx) => {
  await tx.update(opLead)...;
  await tx.update(campanasComerciales)...;
});
```

**Beneficio:**
- Atomicidad: todo o nada
- Consistencia garantizada
- Rollback automático en error

---

#### 3. Validación de Existencia
```typescript
// Verificar que campaña existe antes de procesar
const campaign = await db
  .select()
  .from(campanasComerciales)
  .where(eq(campanasComerciales.id, campaignId));

if (!campaign) {
  throw new Error('Campaign not found');
}
```

---

#### 4. Webhooks/Eventos
```typescript
// Emitir evento después de reset exitoso
eventBus.emit('campaign.reset', {
  campaignId,
  leadsReset,
  timestamp: new Date(),
});
```

**Casos de uso:**
- Notificar a otros servicios
- Actualizar caché
- Trigger workflows

---

### 10.2 Mejoras de Código

#### 1. Eliminar Duplicación
```typescript
// DRY violation en getAssignedLeadsCount
// Se repite lógica de COUNT

// Refactor:
private async countLeads(condition: SQL): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(condition);

  return result?.count || 0;
}
```

---

#### 2. Tipos más Estrictos
```typescript
// En lugar de
campaignId?: number;

// Usar discriminated union
type ResetByID = { type: 'id'; campaignId: number };
type ResetByName = { type: 'name'; clientName: string; campaignNumber: number };

type ResetOptions = ResetByID | ResetByName;
```

---

#### 3. Separar Concerns
```typescript
// Extraer lógica de filtrado de fechas
class DateFilterService {
  applyFilters(campaigns, beforeDate?, afterDate?) {
    // lógica de filtrado
  }
}
```

---

### 10.3 Testing

#### 1. Unit Tests
```typescript
describe('ResetCampaignUseCase', () => {
  it('should return preview in dry-run mode', async () => {
    const mockRepo = {
      getAssignedLeadsCount: jest.fn().mockResolvedValue(82),
      isCampaignFinished: jest.fn().mockResolvedValue(true),
    };

    const useCase = new ResetCampaignUseCase(mockRepo);
    const result = await useCase.execute({
      campaignId: 65,
      dryRun: true,
    });

    expect(result.leadsReset).toBe(82);
    expect(mockRepo.clearCampaignLeads).not.toHaveBeenCalled();
  });
});
```

---

#### 2. Integration Tests
```typescript
describe('Campaign Reset API', () => {
  it('should reset campaign and return success', async () => {
    const response = await request(app)
      .post('/api/campaign-reset/65')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.leadsReset).toBeGreaterThan(0);
  });
});
```

---

#### 3. E2E Tests
```typescript
describe('Campaign Reset E2E', () => {
  it('should reset campaign and verify DB state', async () => {
    // Setup: Crear campaña con leads
    const campaign = await createTestCampaign();
    await assignLeadsToCampaign(campaign.id, 10);

    // Execute: Reset
    await request(app)
      .post(`/api/campaign-reset/${campaign.id}`)
      .expect(200);

    // Verify: Verificar estado en BD
    const leads = await getLeadsByCampaign(campaign.id);
    expect(leads.length).toBe(0);

    const campaignData = await getCampaign(campaign.id);
    expect(campaignData.fechaFin).toBeNull();
  });
});
```

---

### 10.4 Documentación

#### 1. JSDoc Completo
```typescript
/**
 * Resetea una campaña comercial
 *
 * Este método limpia todos los leads asignados a una campaña
 * y opcionalmente limpia su fecha de finalización.
 *
 * @param options - Opciones de reset
 * @param options.campaignId - ID de la campaña a resetear
 * @param options.dryRun - Si es true, solo simula sin ejecutar
 *
 * @returns Resultado del reset con estadísticas
 *
 * @throws {Error} Si campaignId no es válido
 *
 * @example
 * ```typescript
 * const result = await useCase.execute({ campaignId: 65, dryRun: true });
 * console.log(`Would reset ${result.leadsReset} leads`);
 * ```
 */
async execute(options: ResetCampaignOptions): Promise<ResetResult>
```

---

#### 2. OpenAPI/Swagger
```yaml
/api/campaign-reset/{campaignId}:
  post:
    summary: Reset de campaña individual
    parameters:
      - name: campaignId
        in: path
        required: true
        schema:
          type: integer
      - name: dryRun
        in: query
        schema:
          type: boolean
    responses:
      200:
        description: Reset exitoso
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ResetResult'
```

---

#### 3. Diagramas Actualizados
- Diagrama de secuencia completo
- Diagrama de clases actualizado
- Diagrama de base de datos
- Diagramas de flujo de decisiones

---

## 11. Conclusiones

### Fortalezas del Módulo

✅ **Arquitectura sólida**
- Clean Architecture bien implementada
- Separación clara de responsabilidades
- Fácil de testear y extender

✅ **Código legible**
- Nombres descriptivos
- Estructura lógica
- Comentarios útiles

✅ **Funcionalidad completa**
- Reset individual y batch
- Modo dry-run
- Manejo de errores robusto

---

### Debilidades Principales

❌ **Rendimiento**
- Queries no optimizadas
- Filtrado en memoria
- Procesamiento secuencial en batch

❌ **Seguridad**
- Sin autenticación
- Sin autorización
- Sin auditoría

❌ **Testing**
- Sin tests unitarios
- Sin tests de integración
- Sin validación de edge cases

---

### Prioridades de Mejora

**Alta prioridad:**
1. Agregar autenticación/autorización
2. Optimizar queries SQL
3. Implementar transacciones
4. Agregar auditoría

**Media prioridad:**
5. Eliminar duplicación de código
6. Agregar tests
7. Implementar rate limiting
8. Mejorar manejo de errores

**Baja prioridad:**
9. Completar documentación
10. Agregar webhooks
11. Implementar ReopenOptions
12. Mejorar logging

---

## 12. Referencias

### Código Relacionado
- [campaign-closure](../campaign-closure/): Módulo similar con arquitectura paralela
- [shared/schema](../../shared/schema.ts): Definiciones de tablas
- [db](../../db.ts): Configuración de Drizzle ORM

### Patrones y Principios
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

### Herramientas
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Documento generado:** 2025-11-09
**Versión del módulo:** 1.0.0
**Autor del análisis:** Claude Code
