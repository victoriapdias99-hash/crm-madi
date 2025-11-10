# Flujo de Datos - Finished Campaigns

Documentación completa del flujo de datos, enriquecimiento y optimizaciones.

---

## 🔄 Flujo General de Datos

```
┌────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST                            │
│  GET /api/finished-campaigns?zona=Buenos+Aires&includeStats=true│
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 1. FinishedCampaignController.getFinishedCampaigns()   │    │
│  │    - Parsear query params → filters                    │    │
│  │    - Validar entrada                                   │    │
│  └────────────────┬───────────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 2. GetFinishedCampaignsUseCase.execute(filters)        │    │
│  │    - Coordinar flujo de datos                          │    │
│  │    - Aplicar lógica de negocio                         │    │
│  └────────────────┬───────────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 3. PostgresFinishedCampaignRepository.findAllFinished() │    │
│  │                                                         │    │
│  │  A) Construir Query SQL Dinámica                       │    │
│  │     SELECT cc.*, cl.nombre_cliente                     │    │
│  │     FROM campanas_comerciales cc                       │    │
│  │     LEFT JOIN clientes cl ON ...                       │    │
│  │     WHERE cc.fecha_fin IS NOT NULL                     │    │
│  │     AND cc.zona = $1                                   │    │
│  │     ORDER BY cc.fecha_fin DESC                         │    │
│  │                                                         │    │
│  │  B) Ejecutar Query                                     │    │
│  │     result = await db.execute(sql.raw(...))           │    │
│  │                                                         │    │
│  │  C) Mapear Rows → FinishedCampaign[]                  │    │
│  │     campaigns = result.rows.map(mapRowToFinishedCampaign)│  │
│  └────────────────┬───────────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────┐
        │       PostgreSQL Database     │
        │                               │
        │  Tables:                     │
        │  - campanas_comerciales      │
        │  - clientes                  │
        └──────────────────────────────┘
                    │
                    │ Campaigns (base data)
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                    ENRICHMENT PHASE                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 4. FinishedCampaignEnrichmentService.enrichCampaigns()  │    │
│  │                                                         │    │
│  │  A) Obtener Contexto                                   │    │
│  │     - Obtener todos los clientes necesarios           │    │
│  │     - Obtener todas las campañas comerciales          │    │
│  │                                                         │    │
│  │  B) Enriquecer en Paralelo (Promise.all)              │    │
│  │     Para cada campaña:                                │    │
│  │       - enrichCampaign(campaign, cliente, campañas)   │    │
│  └────────────────┬───────────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                 ENRICHMENT PER CAMPAIGN                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 5. enrichCampaign(campaign, cliente, campanasComerciales)│  │
│  │                                                         │    │
│  │  A) Calcular Métricas de Leads                        │    │
│  │     ┌───────────────────────────────────────────────┐ │    │
│  │     │ calculateLeadsMetrics()                       │ │    │
│  │     │                                               │ │    │
│  │     │ Usa: contarLeadsYDuplicadosUnificado()       │ │    │
│  │     │ (lógica centralizada compartida)             │ │    │
│  │     │                                               │ │    │
│  │     │ Query 1: Contar enviados                     │ │    │
│  │     │   SELECT COUNT(*)                            │ │    │
│  │     │   FROM op_leads_rep                          │ │    │
│  │     │   WHERE assigned = true                      │ │    │
│  │     │   AND campaign_id = ?                        │ │    │
│  │     │                                               │ │    │
│  │     │ Query 2: Sumar duplicados                    │ │    │
│  │     │   SELECT SUM(array_length(duplicate_ids, 1)) │ │    │
│  │     │   FROM op_leads_rep                          │ │    │
│  │     │   WHERE assigned = true                      │ │    │
│  │     │   AND campaign_id = ?                        │ │    │
│  │     │                                               │ │    │
│  │     │ Query 3: Días procesados                     │ │    │
│  │     │   SELECT COUNT(DISTINCT date(fecha_creacion))│ │    │
│  │     │   FROM op_lead                               │ │    │
│  │     │   WHERE campaign_id = ?                      │ │    │
│  │     └───────────────────────────────────────────────┘ │    │
│  │                                                         │    │
│  │  B) Calcular Métricas Derivadas                       │    │
│  │     - entregadosPorDia = enviados / diasProcesados    │    │
│  │     - porcentajeDatosEnviados = (enviados / target) * 100│ │
│  │     - faltantes = max(0, target - enviados)           │    │
│  │     - inversionRealizada = enviados * cpl * 1.02      │    │
│  │     - inversionPendiente = 0 (siempre para finalizadas)│   │
│  │     - porcentajeDesvio = ((entregados - pedidos) / pedidos) * 100│
│  │                                                         │    │
│  │  C) Retornar Campaña Enriquecida                      │    │
│  │     return enrichedCampaign                            │    │
│  └────────────────┬───────────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────┐
        │      op_leads_rep Table       │
        │  (Consolidated Analysis Data) │
        │                               │
        │  - assigned (boolean)        │
        │  - campaign_id               │
        │  - duplicate_ids[] (array)   │
        └──────────────────────────────┘
                    │
                    │ Enriched Campaigns
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                      RESPONSE FORMATTING                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 6. Controller formatea respuesta                       │    │
│  │                                                         │    │
│  │  A) Crear DTO                                          │    │
│  │     {                                                   │    │
│  │       success: true,                                   │    │
│  │       data: enrichedCampaigns,                         │    │
│  │       count: enrichedCampaigns.length,                 │    │
│  │       stats: aggregatedStats,                          │    │
│  │       timestamp: new Date().toISOString()              │    │
│  │     }                                                   │    │
│  │                                                         │    │
│  │  B) Enviar Respuesta HTTP                              │    │
│  │     res.json(dto)                                      │    │
│  └────────────────┬───────────────────────────────────────┘    │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│                         HTTP RESPONSE                           │
│  {                                                              │
│    "success": true,                                            │
│    "data": [...enriched campaigns...],                         │
│    "count": 15,                                                │
│    "stats": {...},                                             │
│    "timestamp": "2025-01-09T10:30:00.000Z"                     │
│  }                                                              │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 Fase de Enriquecimiento Detallada

### Paso 1: Obtener Datos Base

```typescript
// Repository retorna campañas CON datos base solamente
const campaigns = await repository.findAllFinished(filters);

// Ejemplo de campaña sin enriquecer:
{
  id: 38,
  clienteId: 4,
  clientName: "Red Finance",
  marca: "Fiat",
  zona: "Buenos Aires",
  cantidadDatosSolicitados: 1000,
  pedidosPorDia: 30,
  cpl: 2500,
  fechaCampana: "2024-01-15",
  fechaFin: "2024-06-30",
  // Métricas calculadas aún en 0:
  enviados: 0,
  duplicados: 0,
  diasProcesados: 0,
  entregadosPorDia: 0,
  inversionRealizada: 0,
  // ...
}
```

### Paso 2: Obtener Contexto para Enriquecimiento

```typescript
// Obtener clientes necesarios
const clienteIds = [...new Set(campaigns.map(c => c.clienteId))];
const clientesMap = new Map();

for (const clienteId of clienteIds) {
  const cliente = await storage.getCliente(clienteId);
  if (cliente) {
    clientesMap.set(clienteId, cliente);
  }
}

// Obtener todas las campañas comerciales
const campanasComerciales = await storage.getAllCampanasComerciales();
```

### Paso 3: Enriquecer en Paralelo

```typescript
const enrichedCampaigns = await Promise.all(
  campaigns.map(async (campaign) => {
    const cliente = clientesMap.get(campaign.clienteId);
    if (!cliente) return campaign; // Sin cambios si no hay cliente

    return enrichmentService.enrichCampaign(
      campaign,
      cliente,
      campanasComerciales
    );
  })
);
```

**Optimización**:
- ✅ `Promise.all` ejecuta enriquecimientos en paralelo
- ✅ Evita bucles secuenciales (N queries → N queries en paralelo)
- ✅ Reduce tiempo de respuesta significativamente

### Paso 4: Calcular Métricas (Por Campaña)

```typescript
async enrichCampaign(campaign, cliente, campanasComerciales) {
  // 1. Calcular leads y duplicados
  const { enviados, duplicados, diasProcesados } =
    await this.calculateLeadsMetrics(campaign, cliente, campanasComerciales);

  // 2. Derivar métricas secundarias
  const entregadosPorDia = diasProcesados > 0
    ? enviados / diasProcesados
    : 0;

  const porcentajeDatosEnviados = campaign.cantidadDatosSolicitados > 0
    ? (enviados / campaign.cantidadDatosSolicitados) * 100
    : 0;

  const faltantes = Math.max(0, campaign.cantidadDatosSolicitados - enviados);

  const inversionRealizada = enviados * campaign.cpl * 1.02;
  const inversionPendiente = 0; // Siempre 0 para finalizadas

  const porcentajeDesvio = campaign.pedidosPorDia > 0
    ? ((entregadosPorDia - campaign.pedidosPorDia) / campaign.pedidosPorDia) * 100
    : 0;

  // 3. Retornar campaña enriquecida
  return {
    ...campaign,
    enviados,
    sentLeads: enviados,
    duplicados,
    duplicates: duplicados,
    diasProcesados,
    processedDays: diasProcesados,
    entregadosPorDia,
    deliveredPerDay: entregadosPorDia,
    porcentajeDatosEnviados,
    percentageSent: porcentajeDatosEnviados,
    faltantesAEnviar: faltantes,
    remaining: faltantes,
    inversionRealizada,
    investment: inversionRealizada,
    inversionPendiente,
    pendingInvestment: inversionPendiente,
    porcentajeDesvio,
    percentageDeviation: porcentajeDesvio,
    esSuperior100: porcentajeDatosEnviados > 100,
    currentLeads: enviados
  };
}
```

---

## 🎯 Uso de Lógica Centralizada

### contarLeadsYDuplicadosUnificado()

**Ubicación**: `shared/utils/campaign-counting-utils.ts`

**Propósito**: Lógica compartida entre campañas pendientes y finalizadas.

```typescript
import { contarLeadsYDuplicadosUnificado } from '@shared/utils/campaign-counting-utils';

const resultado = await contarLeadsYDuplicadosUnificado(
  campaign,
  cliente,
  db,
  opLeadsRep,
  opLead,
  count,
  campanasComerciales
);

const enviados = resultado.enviados;
const duplicados = resultado.duplicados;
```

**Ventajas**:
- ✅ **Una sola fuente de verdad** para conteos
- ✅ **Consistencia** entre pendientes y finalizadas
- ✅ **Transición suave**: Números idénticos al finalizar campaña
- ✅ **Fácil mantenimiento**: Cambios en un solo lugar
- ✅ **Testing centralizado**: Tests cubren ambos módulos

### Estructura de contarLeadsYDuplicadosUnificado()

```typescript
export async function contarLeadsYDuplicadosUnificado(
  campaign: any,
  cliente: any,
  db: any,
  opLeadsRep: any,
  opLead: any,
  count: any,
  campanasComerciales: any[]
): Promise<{ enviados: number; duplicados: number }> {

  // 1. Contar leads asignados desde op_leads_rep
  const enviadosResult = await db
    .select({ count: count() })
    .from(opLeadsRep)
    .where(
      and(
        eq(opLeadsRep.assigned, true),
        eq(opLeadsRep.campaignId, campaign.id)
      )
    );

  const enviados = enviadosResult[0]?.count || 0;

  // 2. Sumar duplicados desde duplicate_ids[] en op_leads_rep
  const duplicadosResult = await db
    .select({
      totalDuplicates: sql<number>`
        CAST(
          COALESCE(
            SUM(
              COALESCE(array_length(duplicate_ids, 1), 0)
            ),
            0
          ) AS INTEGER
        )`
    })
    .from(opLeadsRep)
    .where(
      and(
        eq(opLeadsRep.assigned, true),
        eq(opLeadsRep.campaignId, campaign.id)
      )
    );

  const duplicados = duplicadosResult[0]?.totalDuplicates || 0;

  return { enviados, duplicados };
}
```

---

## 🚀 Optimizaciones de Performance

### 1. Caching de Clientes

```typescript
// ❌ ANTES: Query por cada campaña
for (const campaign of campaigns) {
  const cliente = await storage.getCliente(campaign.clienteId); // N queries
  // ...
}

// ✅ DESPUÉS: Query una vez, cachear
const clienteIds = [...new Set(campaigns.map(c => c.clienteId))];
const clientesMap = new Map();

for (const clienteId of clienteIds) {
  const cliente = await storage.getCliente(clienteId); // Solo IDs únicos
  clientesMap.set(clienteId, cliente);
}

// Uso:
const cliente = clientesMap.get(campaign.clienteId); // O(1) lookup
```

**Mejora**: N queries → M queries (M = clientes únicos, M << N)

### 2. Enriquecimiento Paralelo

```typescript
// ❌ ANTES: Secuencial
const enrichedCampaigns = [];
for (const campaign of campaigns) {
  const enriched = await enrichmentService.enrichCampaign(campaign);
  enrichedCampaigns.push(enriched);
}

// ✅ DESPUÉS: Paralelo
const enrichedCampaigns = await Promise.all(
  campaigns.map(campaign =>
    enrichmentService.enrichCampaign(campaign, cliente, campanasComerciales)
  )
);
```

**Mejora**: T(total) = N * T(single) → T(total) ≈ T(single) + overhead

### 3. Single Query para Datos Base

```typescript
// ❌ ANTES: Query por cada campaña
for (const campaignId of campaignIds) {
  const campaign = await db.select()
    .from(campanasComerciales)
    .where(eq(campanasComerciales.id, campaignId));
}

// ✅ DESPUÉS: Single query con JOINs
const campaigns = await db
  .select({
    cc: campanasComerciales,
    cl: clientes
  })
  .from(campanasComerciales)
  .leftJoin(clientes, eq(clientes.id, campanasComerciales.clienteId))
  .where(isNotNull(campanasComerciales.fechaFin));
```

**Mejora**: N queries → 1 query

### 4. Lazy Initialization de DB

```typescript
class PostgresFinishedCampaignRepository {
  private db: any;

  // No inicializar en constructor
  constructor() {
    this.initializeDb();
  }

  private async initializeDb() {
    if (!this.db) {
      const { db } = await import('../../../db');
      this.db = db;
    }
  }

  private async ensureDbInitialized() {
    if (!this.db) {
      await this.initializeDb();
    }
  }

  async findAllFinished() {
    await this.ensureDbInitialized();
    // ...
  }
}
```

**Ventaja**: Evita errores de inicialización en imports

### 5. Memoización de Cálculos

```typescript
// En el frontend
const calculateInversions = useMemo(() => memoize((data, cpl) => {
  const inversionRealizada = data.enviados * cpl * 1.02;
  const faltantes = Math.max(0, data.pedidosTotal - data.enviados);
  const inversionPendiente = data.porcentajeDatosEnviados >= 100
    ? 0
    : faltantes * cpl * 1.02;

  return { inversionRealizada, inversionPendiente, faltantes };
}), []);
```

**Ventaja**: Evita recálculos en cada render

---

## 📈 Métricas de Performance

### Tiempo de Respuesta Típico

```
Sin Enriquecimiento:
- 10 campañas: ~50ms
- 100 campañas: ~200ms

Con Enriquecimiento (Optimizado):
- 10 campañas: ~150ms
- 100 campañas: ~800ms

Con Enriquecimiento (Sin Optimizar):
- 10 campañas: ~500ms
- 100 campañas: ~4000ms
```

### Número de Queries

```
Sin Optimizaciones:
- Base data: 1 query
- Clientes: N queries (1 por campaña)
- Leads por campaña: N queries
- Duplicados por campaña: N queries
- Días procesados: N queries
Total: 1 + 4N queries

Con Optimizaciones:
- Base data: 1 query
- Clientes: M queries (M = clientes únicos)
- Enriquecimiento: 3N queries (paralelo)
Total: 1 + M + 3N queries (ejecutados en paralelo)
```

---

## 🔄 Actualización en Tiempo Real

### WebSocket Integration

```typescript
// Cliente se conecta a WebSocket
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'register_dashboard_listener'
  }));
};

// Servidor envía actualizaciones
ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'campaign_update' || data.type === 'dashboard_refresh') {
    // Invalidar queries en segundo plano
    await queryClient.invalidateQueries({
      queryKey: ['/api/finished-campaigns'],
      refetchType: 'active'  // Solo queries activas
    });
  }
};
```

**Optimizaciones**:
- ✅ `refetchType: 'active'` → Solo actualiza queries montadas
- ✅ Invalidación en lugar de eliminación de caché
- ✅ Datos viejos visibles hasta que lleguen nuevos
- ✅ Sin "flashes" de loading

### React Query Configuration

```typescript
const { data, isLoading, isFetching, refetch } = useQuery({
  queryKey: ['/api/finished-campaigns'],
  refetchInterval: 30 * 1000,      // Auto-refresh cada 30s
  staleTime: 0,                     // Siempre considerar stale
  gcTime: 5 * 60 * 1000,           // Mantener en caché 5 min
  retry: 2,                         // 2 reintentos en error
  retryDelay: 1000,                 // 1s entre reintentos
  placeholderData: (prev) => prev,  // Mostrar datos previos mientras carga
  refetchOnWindowFocus: true,       // Refetch al volver a la tab
  refetchOnReconnect: true,         // Refetch al reconectar
});
```

**Ventajas**:
- ✅ Datos siempre frescos
- ✅ UX suave (sin flashes)
- ✅ Resiliente a errores
- ✅ Optimistic updates

---

## 🎨 Pipeline de Transformación de Datos

```
PostgreSQL Row (snake_case) → FinishedCampaign (camelCase) → Enriched Campaign → DTO → JSON Response

1. PostgreSQL Row:
{
  id: 38,
  cliente_id: 4,
  nombre_cliente: "Red Finance",
  marca: "Fiat",
  zona: "Buenos Aires",
  fecha_campana: "2024-01-15",
  fecha_fin: "2024-06-30",
  cantidad_datos_solicitados: 1000,
  pedidos_por_dia: 30,
  // ...
}

2. FinishedCampaign (Base):
{
  id: 38,
  clienteId: 4,
  clientName: "Red Finance",
  clienteNombre: "Red Finance",
  marca: "Fiat",
  zone: "Buenos Aires",
  zona: "Buenos Aires",
  startDate: Date("2024-01-15"),
  fechaCampana: "2024-01-15",
  endDate: Date("2024-06-30"),
  fechaFin: "2024-06-30",
  targetLeads: 1000,
  cantidadDatosSolicitados: 1000,
  ordersPerDay: 30,
  pedidosPorDia: 30,
  // Métricas aún en 0
  enviados: 0,
  duplicados: 0,
  // ...
}

3. Enriched Campaign:
{
  ...base,
  // Métricas calculadas
  enviados: 1050,
  sentLeads: 1050,
  duplicados: 25,
  duplicates: 25,
  diasProcesados: 30,
  processedDays: 30,
  entregadosPorDia: 35,
  deliveredPerDay: 35,
  porcentajeDatosEnviados: 105,
  percentageSent: 105,
  inversionRealizada: 2677500,
  investment: 2677500,
  inversionPendiente: 0,
  pendingInvestment: 0,
  porcentajeDesvio: 16.67,
  percentageDeviation: 16.67,
  faltantesAEnviar: 0,
  remaining: 0,
  esSuperior100: true,
  currentLeads: 1050
}

4. DTO (JSON Response):
{
  "success": true,
  "data": [
    {
      "id": 38,
      "clienteNombre": "Red Finance",
      "marca": "Fiat",
      "zona": "Buenos Aires",
      "enviados": 1050,
      "duplicados": 25,
      "porcentajeDatosEnviados": 105,
      // ... resto de campos
    }
  ],
  "count": 1,
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

---

## 🔗 Ver También

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Estructura de capas
- [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md) - Cálculo de métricas
- [API-REFERENCE.md](./API-REFERENCE.md) - Endpoints y formatos
