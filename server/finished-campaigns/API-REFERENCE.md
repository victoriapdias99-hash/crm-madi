# API Reference - Finished Campaigns

Documentación completa de todos los endpoints REST del módulo de Campañas Finalizadas.

---

## 🌐 Base URL

```
/api/finished-campaigns
```

---

## 📋 Endpoints Disponibles

### 1. Obtener Campañas Finalizadas

Obtiene una lista de campañas finalizadas con filtros opcionales y estadísticas agregadas.

#### Request

```http
GET /api/finished-campaigns
```

#### Query Parameters

| Parámetro | Tipo | Requerido | Descripción | Ejemplo |
|-----------|------|-----------|-------------|---------|
| `zona` | string | No | Filtrar por zona geográfica | `Buenos Aires` |
| `marca` | string | No | Filtrar por marca | `Fiat` |
| `cliente` | string | No | Filtrar por nombre de cliente (búsqueda parcial) | `Red Finance` |
| `clienteNombre` | string | No | Alias de `cliente` | `Red Finance` |
| `fechaInicio` | string | No | Fecha inicio de campaña (YYYY-MM-DD) | `2024-01-01` |
| `fechaFin` | string | No | Fecha fin de campaña (YYYY-MM-DD) | `2024-12-31` |
| `fechaCierreInicio` | string | No | Fecha inicio de cierre (YYYY-MM-DD) | `2024-06-01` |
| `fechaCierreFin` | string | No | Fecha fin de cierre (YYYY-MM-DD) | `2024-12-31` |
| `showDuplicatesOnly` | boolean | No | Solo campañas con duplicados | `true` |
| `sortBy` | string | No | Criterio de ordenamiento: `fecha`, `fechaCierre`, `cliente`, `marca` | `fechaCierre` |
| `sortOrder` | string | No | Orden: `asc`, `desc` | `desc` |
| `includeStats` | boolean | No | Incluir estadísticas agregadas | `true` |

#### Response

```typescript
{
  success: boolean;
  data: FinishedCampaign[];
  count: number;
  stats?: FinishedCampaignStats;
  timestamp: string;
}
```

#### Ejemplo de Uso

```bash
# Obtener todas las campañas finalizadas
curl -X GET http://localhost:5000/api/finished-campaigns

# Con filtros
curl -X GET "http://localhost:5000/api/finished-campaigns?zona=Buenos+Aires&marca=Fiat&includeStats=true"

# Solo campañas con duplicados
curl -X GET "http://localhost:5000/api/finished-campaigns?showDuplicatesOnly=true"

# Rango de fechas de cierre
curl -X GET "http://localhost:5000/api/finished-campaigns?fechaCierreInicio=2024-06-01&fechaCierreFin=2024-12-31"
```

#### Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": 38,
      "clienteId": 4,
      "clientName": "Red Finance",
      "clienteNombre": "Red Finance",
      "brandName": "Fiat",
      "marca": "Fiat",
      "campaignNumber": 1,
      "numeroCampana": 1,
      "zone": "Buenos Aires",
      "zona": "Buenos Aires",
      "startDate": "2024-01-15T00:00:00.000Z",
      "fechaCampana": "2024-01-15",
      "endDate": "2024-06-30T00:00:00.000Z",
      "fechaFin": "2024-06-30",
      "realEndDate": "2024-06-30T00:00:00.000Z",
      "fechaFinReal": "2024-06-30",
      "targetLeads": 1000,
      "cantidadDatosSolicitados": 1000,
      "currentLeads": 1050,
      "sentLeads": 1050,
      "enviados": 1050,
      "duplicates": 25,
      "duplicados": 25,
      "deliveredPerDay": 35,
      "entregadosPorDia": 35,
      "ordersPerDay": 30,
      "pedidosPorDia": 30,
      "totalOrders": 1000,
      "pedidosTotal": 1000,
      "percentageDeviation": 16.67,
      "porcentajeDesvio": 16.67,
      "percentageSent": 105.0,
      "porcentajeDatosEnviados": 105.0,
      "remaining": 0,
      "faltantesAEnviar": 0,
      "cpl": 2500,
      "salesPerCampaign": 85000,
      "ventaPorCampaign": 85000,
      "investment": 2677500,
      "inversionRealizada": 2677500,
      "pendingInvestment": 0,
      "inversionPendiente": 0,
      "processedDays": 30,
      "diasProcesados": 30,
      "status": "Finalizada",
      "estadoCampana": "Finalizada",
      "campaignId": 38,
      "esSuperior100": true
    }
  ],
  "count": 1,
  "stats": {
    "totalCampaigns": 15,
    "totalInvestment": 45678000,
    "totalLeadsAssigned": 18500,
    "averageProgress": 98.5,
    "totalDuplicates": 450,
    "averageCompletionDays": 45
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### Status Codes

| Código | Descripción |
|--------|-------------|
| `200` | Éxito - Campañas encontradas |
| `500` | Error del servidor |

---

### 2. Obtener Campaña por ID

Obtiene una campaña finalizada específica por su ID.

#### Request

```http
GET /api/finished-campaigns/:id
```

#### Path Parameters

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `id` | number | Sí | ID de la campaña |

#### Response

```typescript
{
  success: boolean;
  data: FinishedCampaign | null;
  timestamp: string;
}
```

#### Ejemplo de Uso

```bash
curl -X GET http://localhost:5000/api/finished-campaigns/38
```

#### Response Example

```json
{
  "success": true,
  "data": {
    "id": 38,
    "clienteId": 4,
    "clientName": "Red Finance",
    "marca": "Fiat",
    "zona": "Buenos Aires",
    // ... resto de campos
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### Status Codes

| Código | Descripción |
|--------|-------------|
| `200` | Éxito - Campaña encontrada |
| `404` | Campaña no encontrada o no está finalizada |
| `400` | ID inválido |
| `500` | Error del servidor |

---

### 3. Obtener Estadísticas

Obtiene estadísticas agregadas de campañas finalizadas con filtros opcionales.

#### Request

```http
GET /api/finished-campaigns/stats
```

#### Query Parameters

Mismos filtros que el endpoint principal:
- `zona`, `marca`, `cliente`, `fechaInicio`, `fechaFin`, etc.

#### Response

```typescript
{
  success: boolean;
  data: FinishedCampaignStats;
  timestamp: string;
}
```

#### Ejemplo de Uso

```bash
# Estadísticas globales
curl -X GET http://localhost:5000/api/finished-campaigns/stats

# Estadísticas filtradas
curl -X GET "http://localhost:5000/api/finished-campaigns/stats?zona=Buenos+Aires"
```

#### Response Example

```json
{
  "success": true,
  "data": {
    "totalCampaigns": 15,
    "totalInvestment": 45678000,
    "totalLeadsAssigned": 18500,
    "averageProgress": 98.5,
    "totalDuplicates": 450,
    "averageCompletionDays": 45
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### Status Codes

| Código | Descripción |
|--------|-------------|
| `200` | Éxito - Estadísticas calculadas |
| `500` | Error del servidor |

---

### 4. Obtener Opciones de Filtros

Obtiene las opciones disponibles para filtros (clientes, marcas, zonas con campañas finalizadas).

#### Request

```http
GET /api/finished-campaigns/filters/options
```

#### Response

```typescript
{
  success: boolean;
  data: {
    clientes: string[];
    marcas: string[];
    zonas: string[];
  };
  timestamp: string;
}
```

#### Ejemplo de Uso

```bash
curl -X GET http://localhost:5000/api/finished-campaigns/filters/options
```

#### Response Example

```json
{
  "success": true,
  "data": {
    "clientes": [
      "Red Finance",
      "Giorgi",
      "Borussia"
    ],
    "marcas": [
      "Fiat",
      "Peugeot",
      "Renault",
      "Volkswagen"
    ],
    "zonas": [
      "Buenos Aires",
      "Córdoba",
      "Mendoza",
      "Rosario"
    ]
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### Status Codes

| Código | Descripción |
|--------|-------------|
| `200` | Éxito - Opciones obtenidas |
| `500` | Error del servidor |

---

### 5. Verificar si Puede Reabrirse

Verifica si una campaña finalizada puede ser reabierta según las reglas de negocio.

#### Request

```http
GET /api/finished-campaigns/:id/can-reopen
```

#### Path Parameters

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `id` | number | Sí | ID de la campaña |

#### Response

```typescript
{
  success: boolean;
  data: {
    canReopen: boolean;
    reason: string;
  };
  timestamp: string;
}
```

#### Ejemplo de Uso

```bash
curl -X GET http://localhost:5000/api/finished-campaigns/38/can-reopen
```

#### Response Examples

**Puede reabrirse:**
```json
{
  "success": true,
  "data": {
    "canReopen": true,
    "reason": "La campaña puede ser reabierta"
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

**No puede reabrirse:**
```json
{
  "success": true,
  "data": {
    "canReopen": false,
    "reason": "Existe una campaña posterior finalizada para la marca Fiat. Solo puede reabrirse la última campaña de cada marca."
  },
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### Reglas de Validación

1. ✅ La campaña debe existir y tener `fechaFin` (estar finalizada)
2. ✅ Debe ser la **última campaña finalizada** para TODAS sus marcas
3. ✅ En campañas multimarca, todas las marcas deben cumplir con la regla #2

#### Status Codes

| Código | Descripción |
|--------|-------------|
| `200` | Éxito - Validación realizada |
| `400` | ID inválido |
| `500` | Error del servidor |

---

### 6. Reabrir Campaña

Reabre una campaña finalizada (elimina `fecha_fin`), permitiendo que vuelva a estar activa.

#### Request

```http
POST /api/finished-campaigns/:id/reopen
```

#### Path Parameters

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `id` | number | Sí | ID de la campaña a reabrir |

#### Request Body

```typescript
{
  campaignId: number;    // Opcional (se usa el ID de path)
  reason?: string;       // Opcional: razón de la reapertura
}
```

#### Response

```typescript
{
  success: boolean;
  message: string;
  campaignId: number;
  timestamp: string;
}
```

#### Ejemplo de Uso

```bash
curl -X POST http://localhost:5000/api/finished-campaigns/38/reopen \
  -H "Content-Type: application/json"
```

#### Response Examples

**Éxito:**
```json
{
  "success": true,
  "message": "Campaña Red Finance #1 reabierta exitosamente",
  "campaignId": 38,
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

**Error - No puede reabrirse:**
```json
{
  "success": false,
  "error": "Existe una campaña posterior finalizada para la marca Fiat. Solo puede reabrirse la última campaña de cada marca.",
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

#### Status Codes

| Código | Descripción |
|--------|-------------|
| `200` | Éxito - Campaña reabierta |
| `400` | No puede reabrirse (validación falló) o ID inválido |
| `404` | Campaña no encontrada |
| `500` | Error del servidor |

#### Efectos de la Reapertura

1. ✅ Se elimina `fecha_fin` de la campaña
2. ✅ La campaña vuelve a aparecer en campañas pendientes
3. ✅ Se envía evento WebSocket `campaign_update` para actualizar UIs
4. ✅ Leads asignados permanecen intactos
5. ✅ La campaña puede seguir recibiendo leads

---

## 📦 Data Models

### FinishedCampaign

Entidad principal que representa una campaña finalizada.

```typescript
interface FinishedCampaign {
  // Identificación
  id: number;                          // ID único de la campaña
  clienteId: number;                   // ID del cliente
  campaignId?: number;                 // Alias de id
  campaignNumber: number;              // Número de campaña
  numeroCampana: number;               // Alias en español

  // Datos del Cliente
  clientName: string;                  // Nombre del cliente
  clienteNombre: string;               // Alias en español

  // Marca
  brandName: string;                   // Marca principal
  marca: string;                       // Alias en español

  // Ubicación
  zone: string;                        // Zona geográfica
  zona: string;                        // Alias en español

  // Fechas
  startDate: Date;                     // Fecha de inicio (objeto Date)
  fechaCampana: string;                // Fecha de inicio (string YYYY-MM-DD)
  endDate: Date;                       // Fecha de fin esperada (objeto Date)
  fechaFin: string;                    // Fecha de fin esperada (string)
  realEndDate?: Date;                  // Fecha de fin real (objeto Date)
  fechaFinReal?: string;               // Fecha de fin real (string)

  // Métricas de Leads
  targetLeads: number;                 // Cantidad solicitada
  cantidadDatosSolicitados: number;    // Alias en español
  currentLeads: number;                // Leads actuales
  sentLeads: number;                   // Leads enviados
  enviados: number | string;           // Alias en español (puede ser "-")
  duplicates: number;                  // Duplicados
  duplicados: number | string;         // Alias en español

  // Métricas de Progreso
  deliveredPerDay: number | string;    // Promedio por día
  entregadosPorDia: number | string;   // Alias en español
  ordersPerDay: number;                // Pedidos por día configurados
  pedidosPorDia: number;               // Alias en español
  totalOrders: number;                 // Total de pedidos
  pedidosTotal: number;                // Alias en español
  processedDays: number;               // Días procesados
  diasProcesados: number;              // Alias en español

  // Porcentajes y Desvíos
  percentageDeviation: number;         // Desvío porcentual
  porcentajeDesvio: number;            // Alias en español
  percentageSent: number;              // Porcentaje enviado
  porcentajeDatosEnviados: number;     // Alias en español

  // Faltantes
  remaining: number;                   // Leads faltantes
  faltantesAEnviar: number;            // Alias en español
  faltantes?: number | string;         // Alias adicional

  // Inversión y CPL
  cpl: number;                         // Costo Por Lead
  salesPerCampaign: number;            // Venta por campaña
  ventaPorCampaign: number;            // Alias en español
  investment: number;                  // Inversión realizada
  inversionRealizada: number | string; // Alias en español
  pendingInvestment: number;           // Inversión pendiente (siempre 0)
  inversionPendiente: number | string; // Alias en español

  // Estado
  status: 'Finalizada';                // Estado fijo
  estadoCampana: string;               // Alias en español
  esSuperior100?: boolean;             // Si progreso > 100%
}
```

### FinishedCampaignStats

Estadísticas agregadas de campañas finalizadas.

```typescript
interface FinishedCampaignStats {
  totalCampaigns: number;           // Total de campañas finalizadas
  totalInvestment: number;          // Inversión total acumulada
  totalLeadsAssigned: number;       // Total de leads asignados
  averageProgress: number;          // Progreso promedio (%)
  totalDuplicates: number;          // Total de duplicados
  averageCompletionDays: number;    // Promedio de días de duración
}
```

### FinishedCampaignFilters

Filtros disponibles para búsqueda.

```typescript
interface FinishedCampaignFilters {
  zona?: string;                    // Filtro por zona
  marca?: string;                   // Filtro por marca
  cliente?: string;                 // Filtro por cliente (parcial)
  clienteNombre?: string;           // Alias de cliente
  fechaInicio?: string;             // Fecha inicio campaña (YYYY-MM-DD)
  fechaFin?: string;                // Fecha fin campaña (YYYY-MM-DD)
  fechaCierreInicio?: string;       // Fecha inicio cierre (YYYY-MM-DD)
  fechaCierreFin?: string;          // Fecha fin cierre (YYYY-MM-DD)
  showDuplicatesOnly?: boolean;     // Solo campañas con duplicados
  sortBy?: 'fecha' | 'fechaCierre' | 'cliente' | 'marca';
  sortOrder?: 'asc' | 'desc';       // Orden ascendente/descendente
}
```

### ReopenFinishedCampaignResult

Resultado de la operación de reapertura.

```typescript
interface ReopenFinishedCampaignResult {
  success: boolean;                 // Éxito de la operación
  campaign?: FinishedCampaign;      // Campaña reabierta (opcional)
  message: string;                  // Mensaje descriptivo
  errors?: string[];                // Errores (si aplica)
}
```

---

## 🔍 Filtros y Búsquedas

### Filtro por Fecha de Inicio de Campaña

```bash
# Campañas iniciadas en 2024
GET /api/finished-campaigns?fechaInicio=2024-01-01&fechaFin=2024-12-31
```

### Filtro por Fecha de Cierre

```bash
# Campañas cerradas en junio 2024
GET /api/finished-campaigns?fechaCierreInicio=2024-06-01&fechaCierreFin=2024-06-30
```

### Filtro Combinado

```bash
# Campañas de Red Finance en Buenos Aires con duplicados
GET /api/finished-campaigns?cliente=Red+Finance&zona=Buenos+Aires&showDuplicatesOnly=true
```

### Ordenamiento

```bash
# Ordenar por fecha de cierre, más recientes primero
GET /api/finished-campaigns?sortBy=fechaCierre&sortOrder=desc

# Ordenar por cliente alfabéticamente
GET /api/finished-campaigns?sortBy=cliente&sortOrder=asc
```

---

## 🎯 Ejemplos de Integración

### JavaScript / TypeScript

```typescript
// Fetch con async/await
async function getFinishedCampaigns(filters: FinishedCampaignFilters) {
  const params = new URLSearchParams();

  if (filters.zona) params.append('zona', filters.zona);
  if (filters.marca) params.append('marca', filters.marca);
  if (filters.includeStats) params.append('includeStats', 'true');

  const response = await fetch(
    `/api/finished-campaigns?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch campaigns');
  }

  return await response.json();
}

// Reabrir campaña
async function reopenCampaign(campaignId: number) {
  const response = await fetch(
    `/api/finished-campaigns/${campaignId}/reopen`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reopen campaign');
  }

  return await response.json();
}
```

### React Query (Recomendado)

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Hook para obtener campañas
function useFinishedCampaigns(filters?: FinishedCampaignFilters) {
  return useQuery({
    queryKey: ['/api/finished-campaigns', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters as any);
      const res = await fetch(`/api/finished-campaigns?${params}`);
      return res.json();
    },
    refetchInterval: 30000,  // Auto-refresh cada 30s
  });
}

// Hook para reabrir campaña
function useReopenCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await fetch(
        `/api/finished-campaigns/${campaignId}/reopen`,
        { method: 'POST' }
      );
      return res.json();
    },
    onSuccess: () => {
      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries(['/api/finished-campaigns']);
      queryClient.invalidateQueries(['/api/dashboard/campanas-pendientes']);
    }
  });
}
```

---

## 🚨 Manejo de Errores

Todos los endpoints retornan errores en el siguiente formato:

```json
{
  "success": false,
  "error": "Mensaje de error descriptivo",
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

### Códigos de Error Comunes

| Código | Escenario | Mensaje |
|--------|-----------|---------|
| `400` | ID inválido | "ID de campaña inválido" |
| `400` | No puede reabrirse | "Existe una campaña posterior finalizada..." |
| `404` | Campaña no encontrada | "Campaña no encontrada" |
| `500` | Error de servidor | "Error al obtener campañas finalizadas: ..." |
| `500` | Error de BD | "Error al consultar campañas finalizadas: ..." |

---

## 📊 Rate Limiting

Actualmente no hay rate limiting implementado. Recomendaciones:

- ✅ Usar auto-refresh de 30s o más
- ✅ Implementar debounce en filtros
- ✅ Cachear resultados en cliente con React Query

---

## 🔐 Autenticación

**Estado Actual**: No requiere autenticación

**Próximamente**: Se agregará autenticación basada en tokens JWT

---

## 📝 Notas Adicionales

### Performance

- ✅ Queries optimizadas con índices en BD
- ✅ Enriquecimiento en paralelo (Promise.all)
- ✅ Caching en cliente recomendado (React Query)

### Consistencia de Datos

- ✅ Datos calculados desde `op_leads_rep` (fuente única de verdad)
- ✅ Misma lógica que campañas pendientes
- ✅ Transición pendiente→finalizada mantiene números exactos

### WebSocket Events

Al reabrir una campaña, se envía evento WebSocket:

```json
{
  "type": "campaign_update",
  "action": "reopen",
  "campaignId": 38,
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

Escuchar en cliente para actualizar UI en tiempo real.

---

## 🔗 Ver También

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitectura del módulo
- [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md) - Reglas de negocio
- [REOPEN-CAMPAIGN.md](./REOPEN-CAMPAIGN.md) - Reapertura de campañas
