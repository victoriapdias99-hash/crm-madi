# Sistema de Cierre de Campañas - CRM MADI

## 📋 Descripción General

El módulo de **Campaign Closure** es el sistema automatizado responsable de asignar leads a campañas comerciales y cerrarlas cuando alcanzan su meta. Implementa Clean Architecture con separación clara de responsabilidades y soporte para configuraciones multi-marca.

## 🎯 Características Principales

- ✅ **Asignación automática de leads** por orden cronológico
- ✅ **Cierre manual y automático** de campañas
- ✅ **Soporte multi-marca** con dos modos: automático y manual
- ✅ **Tracking en tiempo real** vía WebSocket
- ✅ **Transacciones atómicas** para prevenir race conditions
- ✅ **Procesamiento por lotes** optimizado
- ✅ **Validación y preview** sin ejecutar cambios

## 🏗️ Arquitectura

El módulo sigue **Clean Architecture** con 4 capas bien definidas:

```
campaign-closure/
├── presentation/      # Controllers y Routes (HTTP/WebSocket)
├── application/       # Use Cases y DTOs (lógica de aplicación)
├── domain/           # Entities, Services e Interfaces (lógica de negocio)
└── infrastructure/   # Repositories y Factories (acceso a datos)
```

### Flujo de Datos

```
HTTP Request → Controller → Use Case → Domain Service → Repository → Database
                                          ↓
                                    WebSocket Events
```

## 📁 Estructura de Archivos

```
server/campaign-closure/
│
├── presentation/
│   ├── controllers/
│   │   ├── CampaignClosureController.ts           # Endpoint principal de cierre
│   │   ├── MultiBrandCampaignClosureController.ts # Cierre con múltiples marcas
│   │   ├── CampaignAvailabilityController.ts      # Verificación de disponibilidad
│   │   └── CampaignReopenController.ts            # Reapertura de campañas
│   └── routes/
│       └── campaign-closure-routes.ts             # Configuración de rutas
│
├── application/
│   ├── usecases/
│   │   ├── CampaignClosureUseCase.ts              # Caso de uso principal
│   │   └── MultiBrandCampaignClosureUseCase.ts    # Caso de uso multi-marca
│   └── dto/
│       └── ClosureOptions.ts                      # DTOs y mappers
│
├── domain/
│   ├── services/
│   │   ├── CampaignProcessor.ts                   # ⭐ Servicio principal
│   │   └── LeadAssigner.ts                        # Asignación de leads
│   ├── entities/
│   │   ├── CampaignClosure.ts                     # Entidad campaña
│   │   └── ClosureResult.ts                       # Resultado de cierre
│   └── interfaces/
│       ├── ICampaignRepository.ts                 # Interface campaña
│       └── ILeadRepository.ts                     # Interface leads
│
├── infrastructure/
│   ├── repositories/
│   │   ├── PostgresCampaignRepository.ts          # Acceso a campañas
│   │   └── PostgresLeadRepository.ts              # ⭐ Acceso a leads
│   └── factories/
│       └── ClosureFactory.ts                      # Dependency injection
│
├── CIERRE_CAMPANAS_GUIA_COMPLETA.md              # ⭐ Documentación técnica completa
├── README.md                                      # ⭐ Este archivo
└── ARCHITECTURE.md                                # Guía de arquitectura
```

## 🚀 Inicio Rápido

### Ejecutar Cierre de Campaña

```bash
# Cerrar campaña específica del cliente "Red Finance", campaña #1
curl -X POST "http://localhost:5000/api/campaign-closure/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "red finance",
    "campaignNumber": "1"
  }'
```

### Verificar Disponibilidad (sin cerrar)

```bash
# Ver cuántos leads hay disponibles para la campaña ID 38
curl "http://localhost:5000/api/campaign-closure/availability/38"
```

### Reabrir Campaña

```bash
# Reabrir campaña ID 38 (útil para testing)
curl -X POST "http://localhost:5000/api/campaign-closure/reopen/38"
```

## 📚 Documentación

### Documentos Principales

| Documento | Descripción |
|-----------|-------------|
| **[CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md)** | 📖 Guía técnica completa con diagramas de flujo, queries SQL y troubleshooting |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 🏛️ Arquitectura del sistema, patrones y decisiones de diseño |
| **[API.md](./API.md)** | 🔌 Referencia completa de todos los endpoints |
| **[FRONTEND.md](./FRONTEND.md)** | 🎨 Componentes React y hooks para integración frontend |

### Documentos de Referencia Rápida

- **Principios fundamentales**: Ver sección "Resumen Ejecutivo" en [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#resumen-ejecutivo)
- **Flujo principal**: Ver diagrama en [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#flujo-principal-de-cierre)
- **Errores comunes**: Ver [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#errores-comunes-y-soluciones)

## 🔑 Conceptos Clave

### 1. Leads Únicos vs Duplicados

```typescript
// op_leads_rep (Vista materializada - LECTURA)
{
  id: 1000,                        // Lead único (representativo)
  nombre: "Juan Pérez",
  telefono: "123456789",
  duplicateIds: [1000, 1001, 1002] // Todos los duplicados
}

// op_lead (Tabla principal - ESCRITURA)
[
  { id: 1000, nombre: "Juan Pérez", campaign_id: null },
  { id: 1001, nombre: "Juan Pérez", campaign_id: null },
  { id: 1002, nombre: "Juan Pérez", campaign_id: null }
]
```

**Clave**: Al asignar 1 lead único, se asignan TODOS sus duplicados.

### 2. Asignación Cronológica Pura

❌ **NO** se filtran leads por `fechaCampana` o `fechaFin`
✅ **SÍ** se asignan por `fecha_creacion ASC` (más antiguos primero)

```sql
-- Siempre se ordenan así:
ORDER BY fecha_creacion ASC
```

### 3. Una Campaña por Cliente

El sistema **SOLO procesa la campaña más antigua** de cada cliente:

```typescript
// Obtener campañas del cliente
const campaigns = await getCampaignsByClient(clientName);

// Filtrar pendientes
const pending = campaigns.filter(c => c.status === 'En proceso');

// Ordenar por fecha (más antigua primero)
const sorted = pending.sort((a, b) => a.startDate - b.startDate);

// ⚠️ SOLO procesar la primera
const toProcess = sorted[0];
```

### 4. Modo Automático vs Manual (Multi-Marca)

| Aspecto | Automático (`asignacionAutomatica=true`) | Manual (`asignacionAutomatica=false`) |
|---------|------------------------------------------|---------------------------------------|
| **Marcas incluidas** | TODAS (marca, marca2, ..., marca5) | Solo con `porcentaje > 0` |
| **Porcentajes** | ❌ NO se respetan (informativos) | ✅ SÍ se respetan (exactos) |
| **Orden** | Cronológico puro | Por marca individual |
| **Distribución** | Variable (puede ser 70/30 en vez de 60/40) | Exacta (60/40 o falla) |
| **Fallo** | Parcial OK | Todo o nada |

## 🔄 Flujo de Cierre (Simplificado)

```
1. Usuario hace clic en "Cerrar Campaña"
           ↓
2. POST /api/campaign-closure/execute
           ↓
3. CampaignProcessor.processSingleCampaign()
   │
   ├─→ Contar leads ya asignados (SELECT count(*))
   ├─→ Contar leads disponibles (con filtros)
   ├─→ ¿Ya alcanzó meta? → SÍ: Cerrar automáticamente
   │                      → NO: Continuar
   ├─→ Obtener leads para asignar (optimizado)
   ├─→ Asignar en lotes de 100 (UPDATE)
   └─→ ¿Meta alcanzada? → SÍ: Cerrar campaña
                        → NO: Dejar abierta
           ↓
4. Emitir eventos WebSocket
           ↓
5. Invalidar caché del dashboard
           ↓
6. Respuesta HTTP 200 OK
```

## 📊 Tablas de Base de Datos

| Tabla | Propósito | Operación |
|-------|-----------|-----------|
| `op_leads_rep` | Vista materializada con leads únicos | **Lectura** (SELECT) |
| `op_lead` | Tabla principal con todos los leads | **Escritura** (UPDATE) |
| `campanas_comerciales` | Campañas comerciales | **Lectura/Escritura** |

## 🔐 Garantías del Sistema

1. **Atomicidad**: Uso de transacciones para prevenir race conditions
2. **Consistencia**: Mismo filtro (`buildCampaignLeadFilters`) en todo el sistema
3. **Orden cronológico**: Siempre asigna leads más antiguos primero
4. **Trazabilidad**: Logs exhaustivos con request IDs únicos
5. **Progreso en tiempo real**: WebSocket para tracking de progreso

## ⚙️ Configuración

### Variables de Entorno

```bash
# Feature flag para filtros genéricos
USE_GENERIC_CAMPAIGN_FILTERS=true

# Base de datos (configurada en server/db/index.ts)
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_madi
```

### Constantes Configurables

```typescript
// server/campaign-closure/domain/services/CampaignProcessor.ts

const BATCH_SIZE = 100;              // Tamaño del lote (línea 448)
const BASE_TIMEOUT = 30000;          // Timeout base en ms (línea 425)
const TIMEOUT_PER_LEAD = 50;         // Timeout por lead (línea 425)
const DUPLICATE_MULTIPLIER = 3;      // Multiplicador para compensar duplicados (línea 459)
```

## 🧪 Testing

### Ejecutar Tests E2E

```bash
# Desde la raíz del proyecto
npx playwright test e2e/campaign-closure-ux.spec.ts
```

### Casos de Test Principales

1. **Cierre exitoso**: Campaña con leads suficientes
2. **Cierre parcial**: Menos leads que la meta
3. **Cierre multi-marca automático**: Pool unificado
4. **Cierre multi-marca manual**: Porcentajes exactos
5. **Reapertura**: Desasignar leads y reabrir

## 🐛 Troubleshooting

### Problema: "No hay leads disponibles" pero dashboard muestra duplicados

**Causa**: Confusión entre leads únicos y duplicados totales

**Solución**:
```bash
# Verificar leads ÚNICOS disponibles (no duplicados)
curl "http://localhost:5000/api/campaign-closure/availability/38" | jq '.leads.disponiblesUnicos'
```

### Problema: Porcentajes multi-marca no se respetan

**Causa**: Campaña en modo `asignacionAutomatica = true`

**Solución**: En modo automático, los porcentajes SON informativos. Para porcentajes exactos, configurar `asignacionAutomatica = false`

### Problema: Timeout en asignación

**Causa**: Demasiados leads o base de datos lenta

**Solución**:
1. Aumentar `BASE_TIMEOUT` en línea 425 de CampaignProcessor.ts
2. Reducir `BATCH_SIZE` en línea 448
3. Optimizar índices en base de datos

### Más Problemas

Ver sección completa: [Errores Comunes y Soluciones](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#errores-comunes-y-soluciones)

## 📈 Monitoreo y Observabilidad

### Logs Estructurados

Todos los logs incluyen:
- **Request ID único**: `REQ-{timestamp}-{random}`
- **Tracking ID de campaña**: `CAMP-{id}-{timestamp}`
- **Timing**: Duración de cada paso en ms

```typescript
console.log(`🚀 [${requestId}] INICIO - Campaign closure request iniciada`);
console.log(`⏱️ [${requestId}] PASO 4 - Ejecutando use case (tiempo: ${Date.now() - startTime}ms)`);
```

### WebSocket Events

```typescript
// Progreso
{
  type: 'campaign-progress',
  campaignKey: 'red_finance-1',
  progress: 75,
  message: 'Procesados 75/100 leads...',
  timestamp: '2025-01-15T12:00:00.000Z'
}

// Error
{
  type: 'campaign-error',
  campaignKey: 'red_finance-1',
  error: 'Timeout: Asignación tardó más de 30 segundos',
  timestamp: '2025-01-15T12:00:00.000Z'
}
```

## 🔗 Enlaces Útiles

- **Documentación de Supabase**: Tablas y esquemas
- **GitHub Issues**: Reportar bugs o sugerencias
- **Slack Channel**: #crm-support

## 📝 Changelog

### v1.0.0 (2025-01-15)
- ✅ Implementación inicial de cierre de campañas
- ✅ Soporte multi-marca con modos automático/manual
- ✅ WebSocket para tracking en tiempo real
- ✅ Optimización de queries con leads únicos
- ✅ Transacciones atómicas para prevenir race conditions

## 👥 Contribuir

Para contribuir al módulo:

1. Leer la documentación completa en [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md)
2. Entender Clean Architecture y la separación de capas
3. Seguir los patrones existentes en el código
4. Actualizar tests y documentación

## 📄 Licencia

Propietario: CRM MADI
Confidencial - Todos los derechos reservados
