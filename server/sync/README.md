# 📡 Sistema de Sincronización Refactorizado

## 🎯 Visión General

El sistema de sincronización ha sido completamente refactorizado siguiendo principios de **Clean Architecture** y **Domain-Driven Design**, extrayendo toda la lógica de sincronización desde el código disperso hacia una arquitectura modular, mantenible y extensible.

### 🎪 Propósito Principal
Sincronizar datos de leads automotrices desde **Google Sheets** hacia **PostgreSQL**, con procesamiento inteligente de duplicados, matching de clientes y validación de datos, manteniendo total compatibilidad con el sistema existente.

---

## 🏗️ Arquitectura por Capas

```
server/sync/
├── domain/           # 🧠 Lógica de negocio pura
├── application/      # 🎯 Casos de uso y orquestación  
├── infrastructure/   # 🔧 Acceso a datos y servicios externos
└── presentation/     # 🌐 API y controladores
```

### 📐 Principios Arquitectónicos

- **Inversión de Dependencias**: Las capas internas no conocen las externas
- **Separación de Responsabilidades**: Cada capa tiene un propósito específico  
- **Inyección de Dependencias**: Usando Factory Pattern para flexibilidad
- **Compatibilidad Total**: Adaptadores para código existente
- **Testabilidad**: Cada componente aislado y mockeable

---

## 📁 Estructura Detallada

### 🧠 Domain Layer (`domain/`)

La capa de dominio contiene la lógica de negocio pura, sin dependencias externas.

```
domain/
├── entities/          # Modelos de negocio
│   ├── SyncLead.ts   # Entidad principal de lead
│   └── SyncResult.ts # Resultado de sincronización
├── services/          # Servicios de dominio
│   ├── ClientMatcher.ts      # Sistema de matching de clientes
│   ├── LeadProcessor.ts      # Procesamiento de leads
│   └── DuplicateDetector.ts  # Detección de duplicados
└── interfaces/        # Contratos del dominio
    ├── ISyncRepository.ts    # Interface para acceso a datos
    └── ISheetsGateway.ts     # Interface para Google Sheets
```

#### 🔗 Entidades Principales

**`SyncLead`** - Entidad central de lead para sincronización:
```typescript
interface SyncLead {
  metaLeadId: string;    // ID único para duplicados
  nombre: string;
  telefono: string;
  email: string;
  ciudad: string;
  marca: string;         // Toyota, VW, Fiat, etc.
  origen: string;        // WhatsApp, Instagram, etc.
  localizacion: string;  // Ubicación geográfica
  cliente: string;       // Cliente específico
  fechaCreacion: string;
  source: 'google_sheets' | 'meta_ads' | 'manual';
  campaign: string;
}
```

**`SyncResult`** - Resultado de operaciones de sync:
```typescript
interface SyncResult {
  success: boolean;
  leadsProcessed: number;
  timestamp: string;
  duration: number;
  error?: string;
  details?: SyncDetails;
}
```

#### ⚙️ Servicios de Dominio

**`ClientMatcher`** - Sistema inteligente de matching:
- Reglas configurables para asociar leads con clientes
- Soporte para matching exacto, por contención, custom
- Mantiene reglas específicas (NOVO GROUP, ITALY AUTOS, etc.)

**`LeadProcessor`** - Procesamiento y validación:
- Convierte datos raw de Sheets a entidades de dominio
- Normalización de teléfonos, emails, nombres
- Validaciones de negocio (teléfono válido, email opcional)
- Generación de MetaLeadId único

**`DuplicateDetector`** - Detección avanzada de duplicados:
- Comparación por teléfono normalizado
- Comparación por MetaLeadId
- Score de similitud por múltiples campos
- Detección en lotes para performance

---

### 🎯 Application Layer (`application/`)

Contiene los casos de uso que orquestan la lógica de negocio.

```
application/
├── usecases/          # Casos de uso principales
│   ├── SyncFullUseCase.ts        # Sincronización completa
│   ├── SyncIncrementalUseCase.ts # Sincronización incremental  
│   └── SyncSpecificSheetsUseCase.ts # Sheets específicos
└── dto/               # Objetos de transferencia
    ├── SyncOptions.ts    # Opciones de configuración
    └── SyncResultDto.ts  # DTOs para respuestas API
```

#### 📝 Casos de Uso

**`SyncFullUseCase`** - Sincronización completa:
1. Obtiene todos los leads de Google Sheets
2. Procesa y valida cada lead
3. Detecta duplicados contra base existente
4. Guarda leads únicos válidos
5. Actualiza estado de sincronización

**`SyncIncrementalUseCase`** - Sincronización incremental:
1. Determina timestamp de corte (última sync)
2. Filtra solo leads nuevos desde fecha
3. Procesa con detección optimizada de duplicados
4. Guarda solo datos realmente nuevos

**`SyncSpecificSheetsUseCase`** - Sheets específicos:
1. Valida existencia de sheets solicitados
2. Procesa cada sheet individualmente
3. Consolida resultados manteniendo trazabilidad
4. Maneja errores por sheet sin afectar otros

#### 🔄 Flujo de Sincronización

```mermaid
graph TD
    A[Inicio Sync] --> B[Actualizar Estado]
    B --> C[Obtener Datos Sheets]
    C --> D[Procesar Leads]
    D --> E[Detectar Duplicados]
    E --> F[Validar Datos]
    F --> G[Guardar en BD]
    G --> H[Actualizar Estado Final]
    H --> I[Retornar Resultado]
```

---

### 🔧 Infrastructure Layer (`infrastructure/`)

Implementa las interfaces definidas en el dominio para acceso a datos externos.

```
infrastructure/
├── repositories/      # Acceso a base de datos
│   └── PostgresSyncRepository.ts
├── gateways/         # Acceso a APIs externas
│   └── GoogleSheetsGateway.ts
├── adapters/         # Adaptadores de compatibilidad
│   └── LegacySyncAdapter.ts
└── config/           # Configuración y factory
    ├── SyncFactory.ts
    └── sync-config.ts
```

#### 💾 Repositories

**`PostgresSyncRepository`** - Acceso a PostgreSQL:
- Implementa `ISyncRepository`
- Adaptador sobre el storage existente
- Operaciones CRUD para leads
- Búsqueda de duplicados optimizada
- Gestión de estado de sincronización

#### 🌐 Gateways

**`GoogleSheetsGateway`** - Acceso a Google Sheets:
- Implementa `ISheetsGateway`
- Extrae datos de múltiples sheets
- Auto-detección de sheets disponibles
- Manejo de errores por sheet individual
- Mapeo a entidades de dominio

#### 🔄 Adaptadores

**`LegacySyncAdapter`** - Compatibilidad total:
- Mantiene interfaces del sistema anterior
- `handleSheetSync()` - Para routes.ts existente
- `syncAllBrandSheetsToDatabase()` - Para google-sheets.ts
- `getClientMatchingSystem()` - Para matching existente
- Permite migración gradual sin romper código

#### 🏭 Factory

**`SyncFactory`** - Inyección de dependencias:
- Crea instancias configuradas de todos los componentes
- Gestiona singletons para performance
- Configuración centralizada de dependencias
- Método de reset para testing

---

### 🌐 Presentation Layer (`presentation/`)

Expone la funcionalidad a través de APIs REST.

```
presentation/
├── controllers/       # Controladores HTTP
│   └── SyncController.ts
└── routes/           # Definición de rutas
    └── sync-routes.ts
```

#### 🎛️ Controladores

**`SyncController`** - API REST para sincronización:

**Endpoints Disponibles:**
```
POST /api/sync/full              # Sincronización completa
POST /api/sync/incremental       # Sincronización incremental  
POST /api/sync/sheets/:names     # Sheets específicos (Fiat,Peugeot)
GET  /api/sync/sheets/available  # Lista sheets disponibles
POST /api/sync/sheets/validate   # Valida sheets existentes
GET  /api/sync/status           # Estado actual de sync
```

**Ejemplo de Request:**
```json
{
  "forceFullSync": "true",
  "includeDashboard": "true",
  "sheets": "Fiat,Peugeot,Toyota",
  "validateData": "true"
}
```

**Ejemplo de Response:**
```json
{
  "success": true,
  "message": "Sincronización completada: 45 nuevos, 12 duplicados omitidos",
  "leadsProcessed": 57,
  "timestamp": "2025-08-29T20:15:30.000Z",
  "duration": 8500,
  "durationFormatted": "8s",
  "details": {
    "newLeads": 45,
    "duplicatesFound": 12,
    "sheetsProcessed": ["Fiat", "Peugeot"],
    "clientsMatched": {
      "novo_group": 15,
      "italy_autos": 8
    }
  }
}
```

---

## 🚀 Cómo Usar el Sistema

### 📦 Inicialización

```typescript
import { initializeSyncSystem } from './sync';

// Inicializar todo el sistema
const { controller, routes, legacyAdapter } = initializeSyncSystem();

// Usar en Express
app.use('/api/sync', routes);
```

### 🎯 Uso de Casos de Uso Directos

```typescript
import { getSyncUseCases } from './sync';

const { full, incremental, specific } = getSyncUseCases();

// Sincronización completa
const result = await full.execute({
  includeDashboardUpdate: true,
  validateData: true
});

// Sincronización incremental
const incrementalResult = await incremental.execute({
  since: new Date('2025-08-29T00:00:00Z')
});

// Sheets específicos
const specificResult = await specific.execute(['Fiat', 'Peugeot'], {
  forceFullSync: true
});
```

### 🔄 Uso del Adaptador Legacy

```typescript
import { legacySyncAdapter } from './sync';

// Mantiene compatibilidad total con código existente
const result = await legacySyncAdapter.handleSheetSync('Fiat', {
  forceFullSync: true,
  includeDashboard: true
});

// Funciona exactamente como el sistema anterior
const allResult = await legacySyncAdapter.syncAllBrandSheetsToDatabase({
  specificSheets: ['Toyota', 'VW']
});
```

---

## ⚙️ Configuración

### 🎛️ Variables de Configuración

```typescript
// server/sync/infrastructure/config/sync-config.ts
export const SYNC_CONFIG = {
  DEFAULT_BATCH_SIZE: 100,
  MAX_CONCURRENT_REQUESTS: 3,
  SYNC_TIMEOUT_MS: 10 * 60 * 1000,
  ENABLE_DUPLICATE_DETECTION: true,
  AUTO_SYNC_ENABLED: process.env.NODE_ENV === 'production',
  AUTO_SYNC_INTERVAL_MINUTES: 15,
  AVAILABLE_SHEETS: ['Fiat', 'Peugeot', 'Citroen', 'Toyota', /* ... */],
};
```

### 🌍 Configuración por Entorno

- **Development**: Debug logging, auto-sync deshabilitado, batches pequeños
- **Production**: Logging optimizado, auto-sync habilitado, batches grandes  
- **Test**: Timeouts cortos, procesamiento secuencial, logging completo

---

## 🔧 Mantenimiento y Extensibilidad

### ➕ Agregar Nuevo Sheet

1. **Configuración**: Agregar a `AVAILABLE_SHEETS` en config
2. **Automático**: El sistema detecta y procesa automáticamente
3. **Sin código**: No requiere cambios en lógica de negocio

### 🔄 Nueva Regla de Matching

```typescript
const clientMatcher = SyncFactory.getClientMatcher();

clientMatcher.addRule({
  clienteNombre: ['nuevo cliente sa'],
  googleSheetsNames: ['nuevo cliente - campana'],
  matchType: 'contains'
});
```

### 📊 Nuevo Caso de Uso

1. Crear en `application/usecases/`
2. Implementar usando servicios de dominio existentes
3. Registrar en `SyncFactory`
4. Exponer en `SyncController` si necesario

---

## 🧪 Testing

### ✅ Testeo de Componentes

```typescript
import { LeadProcessor, DuplicateDetector } from './sync';

describe('LeadProcessor', () => {
  const processor = new LeadProcessor();
  
  test('should normalize phone numbers', () => {
    const lead = processor.processLead({
      telefono: '+54 11 1234-5678',
      // ... otros campos
    });
    
    expect(lead.normalizedPhone).toBe('+5411112345678');
  });
});
```

### 🏭 Reset de Factory para Testing

```typescript
import { SyncFactory } from './sync';

beforeEach(() => {
  SyncFactory.resetInstances();
});
```

---

## 🔄 Migración Gradual

### 📅 Plan de Migración

1. **Fase 1** ✅: Arquitectura creada, adaptadores funcionando
2. **Fase 2**: Migrar endpoints uno por uno
3. **Fase 3**: Eliminar adaptadores cuando todo esté migrado
4. **Fase 4**: Optimizaciones específicas del nuevo sistema

### 🛡️ Compatibilidad Actual

- **100% Compatible**: Todo el código existente funciona sin cambios
- **Migración Opcional**: Puedes usar la nueva arquitectura cuando quieras
- **Coexistencia**: Ambos sistemas funcionan simultáneamente

---

## 📊 Monitoreo y Logging

### 📝 Sistema de Logs

```typescript
import { syncLogger } from './sync';

syncLogger.info('Iniciando sincronización');
syncLogger.success('45 leads procesados exitosamente');
syncLogger.warn('Sheet Toyota no disponible');
syncLogger.error('Error conectando a Google Sheets');
```

### 📈 Métricas Disponibles

- Leads procesados por sincronización
- Tiempo de duración de sync
- Rate de duplicados detectados
- Clientes matched por campaña
- Errores por sheet individual

---

## 🚨 Manejo de Errores

### 🛡️ Estrategias de Resilencia

- **Retry automático** con backoff exponencial
- **Tolerancia a fallos** por sheet individual
- **Rollback automático** en errores críticos
- **Estado de sync** persistente para recuperación

### ⚠️ Tipos de Error

- **ValidationError**: Datos inválidos en lead
- **DuplicateError**: Lead duplicado detectado  
- **SheetAccessError**: Error accediendo Google Sheets
- **DatabaseError**: Error de base de datos

---

## 📚 Referencias Técnicas

### 🔗 Interfaces Principales

- `ISyncRepository` - Contrato para acceso a datos
- `ISheetsGateway` - Contrato para Google Sheets  
- `SyncOptions` - Configuración de sincronización
- `SyncResult` - Resultado estándar de operaciones

### 📦 Dependencias

- **PostgreSQL**: Base de datos principal
- **Google Sheets API**: Fuente de datos
- **Drizzle ORM**: Acceso a datos existente
- **Express**: Framework web

### 🎯 Patrones Utilizados

- **Clean Architecture**: Separación por capas
- **Repository Pattern**: Acceso abstracto a datos  
- **Gateway Pattern**: Acceso a servicios externos
- **Factory Pattern**: Inyección de dependencias
- **Adapter Pattern**: Compatibilidad con sistema existente

---

## 🎉 Conclusión

El sistema de sincronización refactorizado proporciona:

✅ **Arquitectura limpia y mantenible**  
✅ **Compatibilidad total con código existente**  
✅ **Extensibilidad para futuras funcionalidades**  
✅ **Testabilidad completa de componentes**  
✅ **Performance optimizada con procesamiento por lotes**  
✅ **Manejo robusto de errores y recuperación**

**¿Listo para sincronizar al futuro? 🚀**