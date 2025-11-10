# 🎯 IMPLEMENTACIÓN OPCIÓN 2: Sistema de Cierre con Filtros Genéricos

## Resumen Ejecutivo

**OBJETIVO:** Modificar el sistema de cierre de campañas para que use **filtros genéricos** (cliente/marca/zona) en lugar de `campaign_id`, logrando consistencia con el dashboard y soporte completo multi-marca.

**ESTADO ACTUAL:** ✅ **El sistema YA tiene soporte multi-marca completo**

---

## 📊 Estado Actual del Sistema Multi-Marca

### ✅ Componentes Multi-Marca Implementados

#### 1. **Extracción de Marcas** (`multi-brand-utils.ts:17-58`)

```typescript
extractBrandsFromCampaign(campana, automaticMode)
```

**Modos de operación:**

```typescript
// Modo Automático (automaticMode = true)
// Incluye TODAS las marcas configuradas, ignorando porcentajes
brands = [
  { marca: "Peugeot", porcentaje: 50 },
  { marca: "Fiat", porcentaje: 30 },
  { marca: "Ford", porcentaje: 0 }  // ✅ Incluida en modo automático
]

// Modo Manual (automaticMode = false)
// Solo incluye marcas con porcentaje > 0
brands = [
  { marca: "Peugeot", porcentaje: 50 },
  { marca: "Fiat", porcentaje: 30 }
  // ❌ Ford excluida (porcentaje = 0)
]
```

---

#### 2. **Condición SQL Multi-Marca** (`multi-brand-utils.ts:63-80`)

```typescript
createMultiBrandCondition(brands, campaignField)
```

**Genera SQL dinámico:**

```sql
-- Una sola marca:
lower(campaign) LIKE '%peugeot%'

-- Múltiples marcas:
(
  lower(campaign) LIKE '%peugeot%' OR
  lower(campaign) LIKE '%fiat%' OR
  lower(campaign) LIKE '%ford%'
)
```

**✅ USADO EN:**
- ✅ Dashboard (`routes.ts:205-206`)
- ✅ Conteo de leads (`routes.ts:514-523`)
- ✅ Repositorio de leads (`PostgresLeadRepository.ts:51`, `582`)

---

#### 3. **Distribución por Porcentajes** (`multi-brand-utils.ts:106-125`)

```typescript
calculateLeadDistribution(totalLeads, brands)
```

**Ejemplo:**
```typescript
totalLeads = 100
brands = [
  { marca: "Peugeot", porcentaje: 50 },
  { marca: "Fiat", porcentaje: 30 },
  { marca: "Ford", porcentaje: 20 }
]

// Resultado:
{
  "Peugeot": 50,  // 100 * 50% = 50
  "Fiat": 30,     // 100 * 30% = 30
  "Ford": 20      // 100 - 50 - 30 = 20 (evita redondeo)
}
```

---

#### 4. **Condiciones para Campañas Pendientes** (`multi-brand-utils.ts:180-226`)

```typescript
buildPendingCampaignConditions({
  campaign,
  normalizedClientName,
  campaignField,
  clienteField,
  localizacionField,
  sourceField,
  campaignIdField,
  fechaCreacionField
})
```

**SQL generado:**
```sql
WHERE (
  (lower(campaign) LIKE '%peugeot%' OR lower(campaign) LIKE '%fiat%')
  AND cliente = 'red finance'
  AND localizacion = 'Mendoza'
  AND source = 'google_sheets'
  AND (campaign_id IS NULL OR campaign_id = 65)
  AND date(fecha_creacion) >= '2025-08-26'
  AND date(fecha_creacion) <= '2025-10-15'  -- Solo si fechaFin existe
)
```

**✅ USADO EN:**
- ✅ Dashboard para contar leads pendientes
- ✅ Sistema de datos diarios

---

### ✅ Casos de Uso Multi-Marca

#### **MultiBrandCampaignClosureUseCase** (`MultiBrandCampaignClosureUseCase.ts`)

**Dos modos de asignación:**

##### **Modo Automático** (Recomendado)
```typescript
{
  asignacionAutomatica: true,
  marca: "Peugeot",
  marca2: "Fiat",
  marca3: "Ford",
  porcentaje: 0,    // ❌ Ignorado
  porcentaje2: 0,   // ❌ Ignorado
  porcentaje3: 0    // ❌ Ignorado
}
```

**Comportamiento:**
- ✅ Pool unificado de leads de TODAS las marcas
- ✅ Ordenamiento cronológico estricto
- ✅ No importan los porcentajes
- ✅ Distribución natural según disponibilidad

##### **Modo Manual** (Porcentajes Exactos)
```typescript
{
  asignacionAutomatica: false,
  marca: "Peugeot",
  marca2: "Fiat",
  marca3: "Ford",
  porcentaje: 50,
  porcentaje2: 30,
  porcentaje3: 20
}
```

**Comportamiento:**
- ✅ Asignación estricta por porcentajes
- ✅ Falla si no hay leads suficientes de alguna marca
- ✅ Distribución exacta (50 Peugeot + 30 Fiat + 20 Ford)

---

## 🔄 Propuesta: Opción 2 - Filtros Genéricos

### Objetivo

**Cambiar el sistema de cierre para que use filtros genéricos en lugar de `campaign_id`**

**Ventajas:**
1. ✅ Consistencia total con el dashboard
2. ✅ Soporte multi-marca automático
3. ✅ Menos dependencia de asignación previa
4. ✅ Más flexible para campañas complejas

**Desventajas:**
1. ⚠️ Potencial ambigüedad si hay campañas solapadas del mismo cliente/marca/zona
2. ⚠️ Posible asignación de leads de otras campañas
3. ⚠️ Más lento (query más complejo)

---

### Cambios Necesarios

#### **Cambio 1: Modificar `countAssignedLeadsForCampaign`**

**UBICACIÓN:** `PostgresLeadRepository.ts:259-276`

**ACTUAL:**
```typescript
async countAssignedLeadsForCampaign(campaignId: number): Promise<number> {
  const result = await this.db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(eq(opLead.campaignId, campaignId));

  return result[0]?.count || 0;
}
```

**PROPUESTA:**
```typescript
async countAssignedLeadsForCampaign(
  campaignId: number,
  useGenericFilters: boolean = false
): Promise<number> {

  if (!useGenericFilters) {
    // Modo legacy: usar campaign_id
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(eq(opLead.campaignId, campaignId));

    return result[0]?.count || 0;
  }

  // MODO NUEVO: Usar filtros genéricos

  // 1. Obtener datos de la campaña
  const campaign = await this.getCampaignDataForFiltering(campaignId);
  if (!campaign) {
    throw new Error(`Campaña ${campaignId} no encontrada`);
  }

  // 2. Extraer marcas configuradas
  const brands = extractBrandsFromCampaign(
    campaign,
    campaign.asignacionAutomatica || false
  );

  // 3. Construir condición multi-marca
  const multiBrandCondition = createMultiBrandCondition(brands, opLead.campaign);

  // 4. Normalizar nombres
  const normalizedClient = normalizeClientName(campaign.clientName);
  const normalizedZone = this.normalizeZoneName(campaign.zone);

  // 5. Construir condiciones completas
  const conditions = [
    multiBrandCondition,
    eq(opLead.cliente, normalizedClient),
    eq(opLead.localizacion, normalizedZone),
    eq(opLead.source, 'google_sheets'),
    gte(sql`date(${opLead.fechaCreacion})`, campaign.fechaCampana)
  ];

  // 6. Agregar fecha fin si existe
  if (campaign.fechaFin) {
    conditions.push(
      lte(sql`date(${opLead.fechaCreacion})`, campaign.fechaFin)
    );
  }

  // 7. Ejecutar query
  const result = await this.db
    .select({ count: sql<number>`count(*)::int` })
    .from(opLead)
    .where(and(...conditions));

  const count = result[0]?.count || 0;

  console.log(`📊 Conteo con filtros genéricos: ${count} leads`);
  console.log(`   Cliente: ${normalizedClient}`);
  console.log(`   Marcas: ${brands.map(b => b.marca).join(', ')}`);
  console.log(`   Zona: ${normalizedZone}`);

  return count;
}
```

---

#### **Cambio 2: Agregar método auxiliar**

```typescript
/**
 * Obtiene datos de campaña necesarios para filtrado genérico
 */
private async getCampaignDataForFiltering(campaignId: number): Promise<any> {
  const { db } = await import('../../db');
  const { campanasComerciales, clientes } = await import('../../../shared/schema');

  const campaigns = await db
    .select()
    .from(campanasComerciales)
    .leftJoin(clientes, eq(campanasComerciales.clienteId, clientes.id))
    .where(eq(campanasComerciales.id, campaignId))
    .limit(1);

  if (campaigns.length === 0) {
    return null;
  }

  const campaign = campaigns[0];

  return {
    id: campaign.campanas_comerciales.id,
    clientName: campaign.clientes?.nombreComercial || '',
    marca: campaign.campanas_comerciales.marca,
    marca2: campaign.campanas_comerciales.marca2,
    marca3: campaign.campanas_comerciales.marca3,
    marca4: campaign.campanas_comerciales.marca4,
    marca5: campaign.campanas_comerciales.marca5,
    porcentaje: campaign.campanas_comerciales.porcentaje,
    porcentaje2: campaign.campanas_comerciales.porcentaje2,
    porcentaje3: campaign.campanas_comerciales.porcentaje3,
    porcentaje4: campaign.campanas_comerciales.porcentaje4,
    porcentaje5: campaign.campanas_comerciales.porcentaje5,
    zone: campaign.campanas_comerciales.zona,
    fechaCampana: campaign.campanas_comerciales.fechaCampana,
    fechaFin: campaign.campanas_comerciales.fechaFin,
    asignacionAutomatica: campaign.campanas_comerciales.asignacionAutomatica
  };
}
```

---

#### **Cambio 3: Modificar `CampaignProcessor.ts`**

**UBICACIÓN:** `CampaignProcessor.ts:264`

**ACTUAL:**
```typescript
const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(campaign.id);
```

**PROPUESTA:**
```typescript
const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(
  campaign.id,
  true  // ✅ Usar filtros genéricos
);
```

---

#### **Cambio 4: Modificar `getLeadsForAssignment`**

**Ya usa filtros genéricos**, solo necesita ajuste para multi-marca:

**ACTUAL:** `PostgresLeadRepository.ts:352-364`
```typescript
const uniqueLeads = await this.db
  .select()
  .from(opLeadsRep)
  .where(
    and(
      isNull(opLeadsRep.campaignId),
      ilike(opLeadsRep.marca, `%${normalizedBrand}%`),  // ❌ Solo una marca
      ilike(opLeadsRep.cliente, `%${normalizedClient}%`),
      ilike(opLeadsRep.localizacion, `%${normalizedZone}%`)
    )
  )
```

**PROPUESTA:**
```typescript
// Obtener marcas de la campaña
const campaignData = await this.getCampaignDataForFiltering(campaignId);
const brands = extractBrandsFromCampaign(campaignData, campaignData.asignacionAutomatica);
const multiBrandCondition = createMultiBrandCondition(brands, opLeadsRep.campaign);

const uniqueLeads = await this.db
  .select()
  .from(opLeadsRep)
  .where(
    and(
      isNull(opLeadsRep.campaignId),
      multiBrandCondition,  // ✅ Multi-marca
      eq(opLeadsRep.cliente, normalizedClient),
      eq(opLeadsRep.localizacion, normalizedZone),
      eq(opLeadsRep.source, 'google_sheets'),
      gte(sql`date(${opLeadsRep.fechaCreacion})`, campaignData.fechaCampana)
    )
  )
```

---

### Mitigación de Riesgos

#### **Riesgo 1: Campañas Solapadas**

**Problema:**
```
Cliente: Red Finance
Marca: Peugeot
Zona: Mendoza

Campaña #1: 2025-08-26 → 2025-10-15 (100 leads)
Campaña #2: 2025-10-01 → 2025-11-30 (200 leads)  // Solapa con #1
```

Si usamos filtros genéricos, podríamos contar leads de ambas campañas.

**Solución:**
```typescript
// Agregar filtro de fechas más estricto
const conditions = [
  multiBrandCondition,
  eq(opLead.cliente, normalizedClient),
  eq(opLead.localizacion, normalizedZone),
  gte(sql`date(${opLead.fechaCreacion})`, campaign.fechaCampana),

  // ✅ Agregar filtro superior también
  campaign.fechaFin
    ? lte(sql`date(${opLead.fechaCreacion})`, campaign.fechaFin)
    : sql`1=1`  // Sin límite si no tiene fecha fin
];
```

---

#### **Riesgo 2: Performance**

**Impacto:** Query más complejo = más lento

**Mitigación:**
1. ✅ Usar índices compuestos
```sql
CREATE INDEX idx_op_lead_filtering
ON op_lead(cliente, localizacion, source, fecha_creacion, campaign_id);
```

2. ✅ Cachear resultados de conteo
```typescript
const cacheKey = `count-${campaignId}-${Date.now()}`;
```

---

### Plan de Implementación

#### **Fase 1: Implementación con Flag**

```typescript
// Agregar feature flag en config
const USE_GENERIC_FILTERS = process.env.USE_GENERIC_CAMPAIGN_FILTERS === 'true';

// Modificar countAssignedLeadsForCampaign
const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(
  campaign.id,
  USE_GENERIC_FILTERS
);
```

**Ventaja:** Podemos probar sin romper el sistema actual

---

#### **Fase 2: Testing Comparativo**

```typescript
// Script de validación
async function validateCountingMethods(campaignId: number) {
  // Método 1: campaign_id
  const countByCampaignId = await countByCampaignIdMethod(campaignId);

  // Método 2: Filtros genéricos
  const countByFilters = await countByGenericFilters(campaignId);

  console.log(`Campaña ${campaignId}:`);
  console.log(`  Por campaign_id: ${countByCampaignId}`);
  console.log(`  Por filtros: ${countByFilters}`);
  console.log(`  Diferencia: ${Math.abs(countByCampaignId - countByFilters)}`);

  if (countByCampaignId !== countByFilters) {
    console.warn(`⚠️  DISCREPANCIA DETECTADA`);
    // Investigar causas
  }
}
```

---

#### **Fase 3: Migración Gradual**

1. **Semana 1:** Implementar con flag `USE_GENERIC_FILTERS=false`
2. **Semana 2:** Testing en campañas de prueba
3. **Semana 3:** Habilitar flag `USE_GENERIC_FILTERS=true`
4. **Semana 4:** Monitorear y ajustar
5. **Semana 5:** Eliminar código legacy

---

### Código Completo de Ejemplo

```typescript
// PostgresLeadRepository.ts - Método modificado

async countAssignedLeadsForCampaign(
  campaignId: number,
  useGenericFilters: boolean = false
): Promise<number> {

  console.log(`📊 Contando leads para campaña ${campaignId}`);
  console.log(`   Método: ${useGenericFilters ? 'Filtros genéricos' : 'campaign_id'}`);

  if (!useGenericFilters) {
    // MODO LEGACY: campaign_id
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(eq(opLead.campaignId, campaignId));

    const count = result[0]?.count || 0;
    console.log(`   ✅ Resultado (legacy): ${count} leads`);
    return count;
  }

  // MODO NUEVO: Filtros genéricos con multi-marca
  try {
    // 1. Obtener configuración de campaña
    const campaign = await this.getCampaignDataForFiltering(campaignId);
    if (!campaign) {
      throw new Error(`Campaña ${campaignId} no encontrada`);
    }

    console.log(`   📋 Campaña: ${campaign.clientName} - ${campaign.marca}`);
    console.log(`   📅 Fecha inicio: ${campaign.fechaCampana}`);
    console.log(`   📅 Fecha fin: ${campaign.fechaFin || 'null (en proceso)'}`);

    // 2. Extraer todas las marcas configuradas
    const brands = extractBrandsFromCampaign(
      campaign,
      campaign.asignacionAutomatica || false
    );

    console.log(`   🏷️  Marcas: ${brands.map(b => `${b.marca} (${b.porcentaje}%)`).join(', ')}`);

    // 3. Construir condición SQL multi-marca
    const multiBrandCondition = createMultiBrandCondition(brands, opLead.campaign);

    // 4. Normalizar nombres
    const normalizedClient = normalizeClientName(campaign.clientName);
    const normalizedZone = this.normalizeZoneName(campaign.zone);

    // 5. Construir todas las condiciones
    const conditions = [
      multiBrandCondition,
      eq(opLead.cliente, normalizedClient),
      eq(opLead.localizacion, normalizedZone),
      eq(opLead.source, 'google_sheets'),
      gte(sql`date(${opLead.fechaCreacion})`, campaign.fechaCampana)
    ];

    // 6. Agregar fecha fin si existe (evita contar leads de campañas futuras)
    if (campaign.fechaFin) {
      conditions.push(
        lte(sql`date(${opLead.fechaCreacion})`, campaign.fechaFin)
      );
    }

    // 7. Ejecutar query con todas las condiciones
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(opLead)
      .where(and(...conditions));

    const count = result[0]?.count || 0;

    console.log(`   ✅ Resultado (filtros): ${count} leads`);
    console.log(`   📊 Desglose:`);
    console.log(`      - Cliente: ${normalizedClient}`);
    console.log(`      - Zona: ${normalizedZone}`);
    console.log(`      - Fuente: google_sheets`);
    console.log(`      - Desde: ${campaign.fechaCampana}`);
    console.log(`      - Hasta: ${campaign.fechaFin || 'hoy'}`);

    return count;

  } catch (error: any) {
    console.error(`❌ Error contando con filtros genéricos:`, error);
    console.log(`   Fallback a método legacy...`);

    // Fallback a método legacy si falla
    return await this.countAssignedLeadsForCampaign(campaignId, false);
  }
}
```

---

## ✅ Verificación Multi-Marca

### Test Case: Red Finance con Multi-Marca

```typescript
// Supongamos que Red Finance #1 tiene configuración multi-marca
{
  id: 65,
  clienteId: 18,
  marca: "Peugeot",
  porcentaje: 60,
  marca2: "Fiat",
  porcentaje2: 40,
  asignacionAutomatica: true,
  zona: "Mendoza",
  fechaCampana: "2025-08-26",
  cantidadDatosSolicitados: 100
}

// Conteo con filtros genéricos:
SELECT COUNT(*) FROM op_lead
WHERE (
  lower(campaign) LIKE '%peugeot%' OR lower(campaign) LIKE '%fiat%'
)
AND cliente = 'red finance'
AND localizacion = 'Mendoza'
AND source = 'google_sheets'
AND date(fecha_creacion) >= '2025-08-26'
```

**Resultado esperado:**
- ✅ Cuenta leads de Peugeot
- ✅ Cuenta leads de Fiat
- ✅ Respeta zona (Mendoza)
- ✅ Respeta fecha inicio
- ✅ Compatible con dashboard

---

## 📋 Resumen y Recomendaciones

### ✅ Estado Actual
- **Multi-marca:** ✅ Completamente implementado
- **Dashboard:** ✅ Usa filtros genéricos con multi-marca
- **Sistema de cierre:** ❌ Usa `campaign_id` (no multi-marca completo)

### 🎯 Opción 2 Recomendada

**Implementar con:**
1. ✅ Feature flag para testing gradual
2. ✅ Fallback a método legacy si falla
3. ✅ Logging exhaustivo para debugging
4. ✅ Testing comparativo antes de desplegar
5. ✅ Índices de base de datos optimizados

### ⏱️ Timeline Estimado

- **Desarrollo:** 2-3 días
- **Testing:** 3-4 días
- **Despliegue gradual:** 1 semana
- **Monitoreo:** 2 semanas
- **Total:** ~1 mes

### 🚀 Próximo Paso

¿Quieres que implemente la **Fase 1** con feature flag?
