# API Reference - Campaign Closure

## 📚 Descripción General

Este documento describe todos los endpoints HTTP disponibles en el módulo de Campaign Closure. Todos los endpoints están montados bajo el prefijo `/api/campaign-closure`.

## 🔑 Autenticación

Todos los endpoints requieren autenticación (manejada por middleware a nivel de aplicación).

## 📋 Índice de Endpoints

### Endpoints de Cierre
- [POST /execute](#post-execute) - Ejecutar cierre de campañas
- [POST /validate](#post-validate) - Validar cierre sin ejecutar
- [POST /multi-brand/execute/:id](#post-multi-brandexecuteid) - Cierre multi-marca

### Endpoints de Información
- [GET /status](#get-status) - Estado del sistema
- [GET /pending-campaigns](#get-pending-campaigns) - Campañas pendientes
- [GET /clients](#get-clients) - Clientes con campañas pendientes
- [GET /processing-status](#get-processing-status) - Campañas en proceso
- [GET /availability/:id](#get-availabilityid) - Disponibilidad de leads

### Endpoints de Reapertura
- [POST /reopen/:id](#post-reopenid) - Reabrir campaña cerrada
- [GET /can-reopen/:id](#get-can-reopenid) - Verificar si puede reabrirse

### Endpoints de Validación
- [GET /multi-brand/validate/:id](#get-multi-brandvalidateid) - Validar cierre multi-marca

### Endpoint de Debug
- [GET /debug/:id](#get-debugid) - Información de debug

---

## Endpoints de Cierre

### POST /execute

Ejecuta el proceso de cierre de campañas.

**URL**: `/api/campaign-closure/execute`

**Método**: `POST`

**Controller**: `CampaignClosureController.executeClosure()` (líneas 26-167)

#### Request

**Query Parameters**:

| Parámetro | Tipo | Requerido | Descripción | Ejemplo |
|-----------|------|-----------|-------------|---------|
| `clients` | string | No | Lista de clientes separados por coma | `red finance,toyota finance` |
| `brands` | string | No | Lista de marcas separadas por coma | `peugeot,fiat` |
| `campaignNumber` | string | No | Número de campaña específica | `1` |
| `campaignKey` | string | No | Key para tracking WebSocket | `red_finance-1` |
| `dryRun` | string | No | Solo simular (true/false) | `false` |

**Body** (alternativo a query params):
```json
{
  "clientName": "red finance",
  "campaignNumber": "1",
  "campaignKey": "red_finance-1"
}
```

**Nota**: Body tiene prioridad sobre query params si ambos están presentes.

#### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "message": "Cierre completado exitosamente",
  "campaignsProcessed": 1,
  "campaignsClosed": 1,
  "leadsAssigned": 100,
  "timestamp": "2025-01-15T12:00:00.000Z",
  "duration": 5432,
  "durationFormatted": "5s",
  "details": {
    "closedCampaigns": [
      {
        "campaignId": 38,
        "clientName": "red finance",
        "brandName": "Peugeot",
        "campaignNumber": "1",
        "leadsAssigned": 100,
        "targetLeads": 100,
        "closureDate": "2025-01-15T12:00:00.000Z",
        "finalLeadDate": "2025-01-10T08:30:00.000Z",
        "zone": "NACIONAL",
        "startDate": "2024-12-01T00:00:00.000Z"
      }
    ],
    "clientsProcessed": ["red finance"]
  }
}
```

**Error (500 Internal Server Error)**:
```json
{
  "success": false,
  "message": "Error en el procesamiento: Timeout exceeded",
  "campaignsProcessed": 0,
  "campaignsClosed": 0,
  "leadsAssigned": 0,
  "timestamp": "2025-01-15T12:00:00.000Z",
  "duration": 30500,
  "durationFormatted": "31s",
  "error": "Timeout exceeded: assignLeadsInBatches took more than 30000ms"
}
```

#### Side Effects

1. **Leads Asignados**: Campo `campaign_id` actualizado en tabla `op_lead`
2. **Campaña Cerrada**: Campo `fecha_fin` actualizado en `campanas_comerciales`
3. **Cache Invalidado**: `invalidateCampanasCache()` ejecutado
4. **WebSocket Events**:
   - `broadcastDashboardRefresh()` - Refresco general
   - `broadcastCampaignUpdate('updated', campaignId)` - Por cada campaña cerrada

#### Ejemplos

**Cerrar campaña específica**:
```bash
curl -X POST "http://localhost:5000/api/campaign-closure/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "red finance",
    "campaignNumber": "1"
  }'
```

**Cerrar todas las campañas de un cliente**:
```bash
curl -X POST "http://localhost:5000/api/campaign-closure/execute?clients=red%20finance"
```

**Dry run (simular sin ejecutar)**:
```bash
curl -X POST "http://localhost:5000/api/campaign-closure/execute?clients=red%20finance&dryRun=true"
```

**Con tracking WebSocket**:
```bash
curl -X POST "http://localhost:5000/api/campaign-closure/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "red finance",
    "campaignNumber": "1",
    "campaignKey": "red_finance-1"
  }'
```

---

### POST /validate

Valida el proceso de cierre sin ejecutar cambios reales.

**URL**: `/api/campaign-closure/validate`

**Método**: `POST`

**Controller**: `CampaignClosureController.validateClosure()` (líneas 278-304)

#### Request

Idéntico a [POST /execute](#post-execute), pero automáticamente establece `validateOnly=true`.

#### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "message": "Validación completada: 1 campaña puede cerrarse",
  "campaignsProcessed": 1,
  "campaignsClosed": 1,
  "leadsAssigned": 0,
  "timestamp": "2025-01-15T12:00:00.000Z",
  "duration": 234,
  "durationFormatted": "0s",
  "details": {
    "closedCampaigns": [],
    "validationErrors": [],
    "warnings": [
      "Campaña 38 (Red Finance) puede cerrarse con 100 leads disponibles"
    ]
  }
}
```

**Con errores de validación**:
```json
{
  "success": false,
  "message": "Validación encontró errores",
  "details": {
    "validationErrors": [
      "Campaña 38: Solo 50 leads disponibles de 100 requeridos"
    ]
  }
}
```

#### Ejemplo

```bash
curl -X POST "http://localhost:5000/api/campaign-closure/validate?clients=red%20finance"
```

---

### POST /multi-brand/execute/:id

Ejecuta el cierre de una campaña específica con distribución multi-marca.

**URL**: `/api/campaign-closure/multi-brand/execute/:id`

**Método**: `POST`

**Controller**: `MultiBrandCampaignClosureController.executeMultiBrandClosure()` (líneas 23-61)

#### Request

**URL Parameters**:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la campaña |

**Body**:
```json
{
  "clientName": "red finance"
}
```

#### Response

**Success (200 OK)** - Modo Automático:
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
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

**Partial Success (207 Multi-Status)** - Modo Manual:
```json
{
  "success": false,
  "campaignId": 38,
  "clientName": "red finance",
  "totalRequested": 100,
  "totalAssigned": 58,
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
      "asignados": 0,
      "exito": false,
      "error": "Solo 0 leads disponibles de 40 requeridos"
    }
  ],
  "mode": "manual",
  "message": "Error: No se pudieron asignar leads para todas las marcas",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

**Error (400 Bad Request)**:
```json
{
  "success": false,
  "error": "ID de campaña inválido"
}
```

**Error (500 Internal Server Error)**:
```json
{
  "success": false,
  "error": "Error interno: Database connection failed",
  "campaignId": 38,
  "clientName": "red finance",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### Validaciones

- ✅ Campaña debe existir
- ✅ `asignacionAutomatica` debe ser `true`
- ✅ Debe tener múltiples marcas configuradas
- ✅ En modo manual: Porcentajes deben sumar 100%

#### Ejemplo

```bash
curl -X POST "http://localhost:5000/api/campaign-closure/multi-brand/execute/38" \
  -H "Content-Type: application/json" \
  -d '{"clientName": "red finance"}'
```

---

## Endpoints de Información

### GET /status

Obtiene el estado del sistema de cierre.

**URL**: `/api/campaign-closure/status`

**Método**: `GET`

**Controller**: `CampaignClosureController.getClosureStatus()` (líneas 173-193)

#### Response

**Success (200 OK)**:
```json
{
  "systemStatus": "active",
  "factoryInitialized": {
    "campaignRepositoryInitialized": true,
    "leadRepositoryInitialized": true,
    "useCaseInitialized": true
  },
  "timestamp": "2025-01-15T12:00:00.000Z",
  "version": "1.0.0"
}
```

**Error (500 Internal Server Error)**:
```json
{
  "systemStatus": "error",
  "error": "Factory initialization failed",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/status"
```

---

### GET /pending-campaigns

Obtiene todas las campañas pendientes de cierre.

**URL**: `/api/campaign-closure/pending-campaigns`

**Método**: `GET`

**Controller**: `CampaignClosureController.getPendingCampaigns()` (líneas 224-245)

#### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "count": 3,
  "campaigns": [
    {
      "id": 38,
      "clientName": "red finance",
      "brandName": "Peugeot",
      "campaignNumber": "1",
      "targetLeads": 100,
      "zone": "NACIONAL",
      "status": "En proceso",
      "startDate": "2024-12-01T00:00:00.000Z",
      "closureDate": null
    },
    {
      "id": 39,
      "clientName": "toyota finance",
      "brandName": "Toyota",
      "campaignNumber": "2",
      "targetLeads": 50,
      "zone": "AMBA",
      "status": "En proceso",
      "startDate": "2024-12-05T00:00:00.000Z",
      "closureDate": null
    }
  ],
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/pending-campaigns"
```

---

### GET /clients

Obtiene los clientes que tienen campañas pendientes.

**URL**: `/api/campaign-closure/clients`

**Método**: `GET`

**Controller**: `CampaignClosureController.getClientsWithPendingCampaigns()` (líneas 251-272)

#### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "count": 2,
  "clients": [
    "red finance",
    "toyota finance"
  ],
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/clients"
```

---

### GET /processing-status

Obtiene las campañas que están siendo procesadas actualmente.

**URL**: `/api/campaign-closure/processing-status`

**Método**: `GET`

**Controller**: `CampaignClosureController.getProcessingStatus()` (líneas 199-218)

#### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "processingCampaigns": {
    "red_finance-1": {
      "campaignId": 38,
      "clientName": "red finance",
      "campaignNumber": "1",
      "progress": 75,
      "message": "Asignando leads: 75/100",
      "startTime": "2025-01-15T12:00:00.000Z"
    }
  },
  "timestamp": "2025-01-15T12:00:30.000Z"
}
```

**Sin campañas en proceso**:
```json
{
  "success": true,
  "processingCampaigns": {},
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/processing-status"
```

---

### GET /availability/:id

Verifica la disponibilidad de leads para una campaña sin cerrarla.

**URL**: `/api/campaign-closure/availability/:id`

**Método**: `GET`

**Controller**: `CampaignAvailabilityController.checkAvailability()` (líneas 15-187)

#### Request

**URL Parameters**:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la campaña |

#### Response

**Success (200 OK)**:
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
    "cumplimientoActual": 50.0,
    "cumplimientoFinalEsperado": 80.0,
    "puedeCerrarseCompletamente": false,
    "tipoCierre": "parcial",
    "mensaje": "⚠️ Solo hay 30 leads disponibles de 50 faltantes. Cierre parcial al 80.0%"
  },
  "busqueda": {
    "clienteNormalizado": "red_finance",
    "zonaNormalizada": "Pais",
    "marca": "Peugeot"
  },
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

**Campaign Not Found (404 Not Found)**:
```json
{
  "success": false,
  "error": "Campaña no encontrada"
}
```

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/availability/38"
```

---

## Endpoints de Reapertura

### POST /reopen/:id

Reabre una campaña cerrada y desasigna todos sus leads.

**URL**: `/api/campaign-closure/reopen/:id`

**Método**: `POST`

**Controller**: `CampaignReopenController.reopenCampaign()` (líneas 16-172)

#### Request

**URL Parameters**:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la campaña a reabrir |

#### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "message": "Campaña reabierta exitosamente",
  "campaign": {
    "id": 38,
    "cliente": "red finance",
    "numero_campana": "1",
    "marca": "Peugeot",
    "zona": "NACIONAL",
    "cantidad_datos_solicitados": 100,
    "estado": "Abierta"
  },
  "leadsUnassigned": 100,
  "previousState": {
    "fecha_fin": "2025-01-10T08:30:00.000Z"
  }
}
```

**Already Open (200 OK)**:
```json
{
  "success": true,
  "message": "Campaña ya estaba abierta",
  "alreadyOpen": true,
  "campaign": {
    "id": 38,
    "cliente": "red finance",
    "numero_campana": "1",
    "marca": "Peugeot",
    "zona": "NACIONAL",
    "estado": "Abierta"
  }
}
```

**Campaign Not Found (404 Not Found)**:
```json
{
  "success": false,
  "error": "Campaña no encontrada"
}
```

#### Proceso

1. Verificar estado actual de la campaña
2. Contar leads asignados
3. Desasignar TODOS los leads: `UPDATE op_lead SET campaign_id = NULL`
4. Limpiar fecha de cierre: `UPDATE campanas_comerciales SET fecha_fin = NULL`
5. Verificar que `fecha_fin IS NULL`

#### Ejemplo

```bash
curl -X POST "http://localhost:5000/api/campaign-closure/reopen/38"
```

---

### GET /can-reopen/:id

Verifica si una campaña puede ser reabierta.

**URL**: `/api/campaign-closure/can-reopen/:id`

**Método**: `GET`

**Controller**: `CampaignReopenController.canReopen()` (líneas 178-239)

#### Request

**URL Parameters**:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la campaña |

#### Response

**Can Reopen (200 OK)**:
```json
{
  "canReopen": true,
  "reason": "Campaña cerrada con 100 leads asignados. Puede reabrirse.",
  "campaign": {
    "id": 38,
    "isClosed": true,
    "leadsAsignados": 100,
    "fechaFin": "2025-01-10T08:30:00.000Z"
  }
}
```

**Cannot Reopen (200 OK)**:
```json
{
  "canReopen": false,
  "reason": "Campaña ya está abierta",
  "campaign": {
    "id": 38,
    "isClosed": false,
    "leadsAsignados": 50,
    "fechaFin": null
  }
}
```

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/can-reopen/38"
```

---

## Endpoints de Validación

### GET /multi-brand/validate/:id

Valida si una campaña puede cerrarse con múltiples marcas.

**URL**: `/api/campaign-closure/multi-brand/validate/:id`

**Método**: `GET`

**Controller**: `MultiBrandCampaignClosureController.validateMultiBrandClosure()` (líneas 67-94)

#### Request

**URL Parameters**:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la campaña |

#### Response

**Valid (200 OK)**:
```json
{
  "valid": true,
  "campaignId": 38,
  "mode": "automatica",
  "brands": [
    {
      "marca": "Peugeot",
      "porcentaje": 60,
      "disponibles": 80
    },
    {
      "marca": "Fiat",
      "porcentaje": 40,
      "disponibles": 50
    }
  ],
  "totalAvailable": 130,
  "totalRequired": 100,
  "canCloseFully": true,
  "message": "Campaña puede cerrarse completamente en modo automático"
}
```

**Invalid (200 OK)**:
```json
{
  "valid": false,
  "campaignId": 38,
  "mode": "manual",
  "errors": [
    "Marca Fiat: Solo 20 leads disponibles de 40 requeridos",
    "Los porcentajes deben sumar 100%, actualmente suman 90%"
  ],
  "warnings": [
    "Cierre parcial: Solo se podrán asignar 80 leads de 100 solicitados"
  ]
}
```

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/multi-brand/validate/38"
```

---

## Endpoint de Debug

### GET /debug/:id

Obtiene información detallada de debug para una campaña.

**URL**: `/api/campaign-closure/debug/:id`

**Método**: `GET`

**Handler**: `debugCampaignData()` (definido en `server/debug-campaign-data.ts`)

#### Request

**URL Parameters**:
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de la campaña |

#### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "campaign": {
    "id": 38,
    "cliente": "red finance",
    "numero_campana": "1",
    "marca": "Peugeot",
    "cantidad_datos_solicitados": 100,
    "fecha_campana": "2024-12-01",
    "fecha_fin": null,
    "asignacion_automatica": true
  },
  "leadsAsignados": 50,
  "datosDiariosCount": 45,
  "datosDiarios": [
    {
      "id": 1,
      "fecha": "2024-12-01",
      "cantidad": 10,
      "tiene_campana_asignada": true
    }
  ],
  "queries": {
    "campaignQuery": "SELECT * FROM campanas_comerciales WHERE id = 38",
    "leadsQuery": "SELECT count(*) FROM op_lead WHERE campaign_id = 38",
    "datosQuery": "SELECT * FROM datos_diarios WHERE campana_id = 38"
  }
}
```

⚠️ **Nota**: Este endpoint es temporal y solo debe usarse para debugging. No usar en producción.

#### Ejemplo

```bash
curl "http://localhost:5000/api/campaign-closure/debug/38"
```

---

## 🔄 WebSocket Events

Además de la API HTTP, el sistema emite eventos WebSocket para tracking en tiempo real.

### Eventos de Progreso

**Event**: `campaign-progress`

```typescript
{
  type: 'campaign-progress',
  campaignKey: 'red_finance-1',
  progress: 75,                    // 0-100
  message: 'Asignando leads: 75/100',
  timestamp: '2025-01-15T12:00:00.000Z'
}
```

**Fases de progreso**:
- 0-20%: Iniciando
- 20-40%: Obteniendo leads
- 40-60%: Asignando leads (lote 1)
- 60-80%: Asignando leads (lote 2)
- 80-100%: Finalizando y cerrando campaña
- 100%: Completado

### Eventos de Error

**Event**: `campaign-error`

```typescript
{
  type: 'campaign-error',
  campaignKey: 'red_finance-1',
  error: 'Timeout: Asignación tardó más de 30 segundos',
  timestamp: '2025-01-15T12:00:00.000Z'
}
```

### Conectarse al WebSocket

```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  // Registrarse para recibir eventos de una campaña específica
  ws.send(JSON.stringify({
    type: 'register_campaign_progress',
    campaignKey: 'red_finance-1'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'campaign-progress') {
    console.log(`Progreso: ${data.progress}% - ${data.message}`);
  }

  if (data.type === 'campaign-error') {
    console.error(`Error: ${data.error}`);
  }
};
```

---

## 📊 Códigos de Estado HTTP

| Código | Significado | Casos de Uso |
|--------|-------------|--------------|
| 200 OK | Éxito | Cierre exitoso, validación OK |
| 207 Multi-Status | Éxito parcial | Cierre multi-marca con algunas marcas fallidas |
| 400 Bad Request | Request inválido | ID inválido, parámetros faltantes |
| 404 Not Found | No encontrado | Campaña no existe |
| 500 Internal Server Error | Error del servidor | Timeout, error de BD, error inesperado |

---

## 🛡️ Manejo de Errores

Todos los endpoints siguen el mismo formato de error:

```json
{
  "success": false,
  "error": "Descripción del error",
  "message": "Mensaje detallado (opcional)",
  "timestamp": "2025-01-15T12:00:00.000Z"
}
```

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `ID de campaña inválido` | ID no es número | Verificar que el ID sea numérico |
| `Campaña no encontrada` | No existe en BD | Verificar que la campaña exista |
| `Timeout exceeded` | Proceso tardó mucho | Aumentar timeout o reducir batch size |
| `No hay leads disponibles` | No hay leads para asignar | Verificar con `/availability/:id` |
| `Database connection failed` | Error de conexión a BD | Verificar estado de PostgreSQL |
| `Los porcentajes deben sumar 100%` | Porcentajes incorrectos | Corregir porcentajes en campaña |

---

## 🧪 Testing con cURL

### Flujo Completo de Test

```bash
# 1. Verificar estado del sistema
curl "http://localhost:5000/api/campaign-closure/status"

# 2. Ver campañas pendientes
curl "http://localhost:5000/api/campaign-closure/pending-campaigns"

# 3. Verificar disponibilidad de campaña 38
curl "http://localhost:5000/api/campaign-closure/availability/38"

# 4. Validar cierre (dry run)
curl -X POST "http://localhost:5000/api/campaign-closure/validate" \
  -H "Content-Type: application/json" \
  -d '{"clientName": "red finance", "campaignNumber": "1"}'

# 5. Ejecutar cierre
curl -X POST "http://localhost:5000/api/campaign-closure/execute" \
  -H "Content-Type: application/json" \
  -d '{"clientName": "red finance", "campaignNumber": "1"}'

# 6. Verificar que se cerró
curl "http://localhost:5000/api/campaign-closure/pending-campaigns"

# 7. (Opcional) Reabrir para testing
curl -X POST "http://localhost:5000/api/campaign-closure/reopen/38"
```

---

## 📝 Notas Importantes

### Idempotencia

- ❌ `POST /execute` NO es idempotente (ejecutar 2 veces puede asignar más leads)
- ✅ `POST /validate` SÍ es idempotente (solo lectura)
- ✅ `GET` endpoints son idempotentes por definición

### Rate Limiting

No hay rate limiting implementado actualmente. Considerar agregar para:
- `/execute`: Max 1 request por segundo
- Otros endpoints: Max 10 requests por segundo

### Paginación

Los endpoints que retornan listas (`/pending-campaigns`, `/clients`) NO tienen paginación actualmente. Para grandes volúmenes, considerar agregar:
```
?page=1&limit=50
```

---

**Versión**: 1.0.0
**Fecha**: 2025-01-15
**Mantenido por**: Equipo CRM MADI
