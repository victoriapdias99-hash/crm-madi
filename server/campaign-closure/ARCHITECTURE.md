# Arquitectura del Sistema de Cierre de Campañas

## 📐 Visión General

El módulo de Campaign Closure implementa **Clean Architecture** (también conocida como Arquitectura Hexagonal o Ports & Adapters), un patrón arquitectónico que promueve la separación de responsabilidades y la independencia de frameworks, UI y bases de datos.

## 🏛️ Capas de la Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                         │
│                  (Controllers & Routes)                      │
│  • Maneja HTTP requests/responses                           │
│  • Transforma DTOs                                           │
│  • Emite eventos WebSocket                                   │
└─────────────────────────────────────────────────────────────┘
                          │ ▼ Calls
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│                     (Use Cases & DTOs)                       │
│  • Orquesta el flujo de la aplicación                       │
│  • Coordina múltiples servicios de dominio                  │
│  • Define casos de uso del negocio                          │
└─────────────────────────────────────────────────────────────┘
                          │ ▼ Uses
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                             │
│             (Services, Entities & Interfaces)                │
│  • Lógica de negocio pura                                   │
│  • Reglas de dominio                                         │
│  • Independiente de infraestructura                         │
└─────────────────────────────────────────────────────────────┘
                          │ ▼ Depends on
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
│                (Repositories & Factories)                    │
│  • Acceso a base de datos                                   │
│  • Servicios externos                                        │
│  • Implementación de interfaces de dominio                  │
└─────────────────────────────────────────────────────────────┘
```

## 📂 Detalles de Cada Capa

### 1. Presentation Layer

**Responsabilidad**: Interfaz con el mundo exterior (HTTP, WebSocket)

**Archivos**:
```
presentation/
├── controllers/
│   ├── CampaignClosureController.ts
│   ├── MultiBrandCampaignClosureController.ts
│   ├── CampaignAvailabilityController.ts
│   └── CampaignReopenController.ts
└── routes/
    └── campaign-closure-routes.ts
```

**Principios**:
- ✅ NO contiene lógica de negocio
- ✅ Transforma requests HTTP a DTOs
- ✅ Transforma resultados de dominio a responses HTTP
- ✅ Maneja errores HTTP (500, 400, etc.)

**Ejemplo**:
```typescript
// CampaignClosureController.ts:26-167
public async executeClosure(req: Request, res: Response): Promise<void> {
  try {
    // 1. Parsear request a DTO
    const requestDto: ClosureRequestDto = { ...req.query, ...req.body };

    // 2. Mapear a opciones de dominio
    const options = mapClosureRequestToOptions(requestDto);

    // 3. Ejecutar use case
    const useCase = this.closureFactory.getCampaignClosureUseCase();
    const result = await useCase.execute(options);

    // 4. Mapear resultado a response DTO
    const response: ClosureResponseDto = mapClosureResultToResponse(result);

    // 5. Emitir eventos (side effects)
    if (result.success) {
      realtimeSync.broadcastDashboardRefresh();
    }

    // 6. Responder HTTP
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### 2. Application Layer

**Responsabilidad**: Orquestación de casos de uso

**Archivos**:
```
application/
├── usecases/
│   ├── CampaignClosureUseCase.ts         # Caso de uso principal
│   └── MultiBrandCampaignClosureUseCase.ts
└── dto/
    └── ClosureOptions.ts                  # DTOs y mappers
```

**Principios**:
- ✅ Coordina servicios de dominio
- ✅ Define el flujo de la aplicación
- ✅ Maneja transacciones si es necesario
- ✅ NO contiene lógica de negocio compleja

**Ejemplo**:
```typescript
// CampaignClosureUseCase.ts:30-108
async execute(options: ClosureOptions): Promise<ClosureResult> {
  // 1. Validar opciones
  if (options.validateOnly) {
    return await this.validateOnly(timestamp, startTime);
  }

  // 2. Obtener clientes a procesar
  const clientsToProcess = await this.getClientsToProcess(options);

  // 3. Procesar cada cliente
  for (const clientName of clientsToProcess) {
    const clientResult = await this.processClient(clientName, options);
    totalLeadsAssigned += clientResult.leadsAssigned;
    allClosedCampaigns.push(...clientResult.campaignsClosed);
  }

  // 4. Construir resultado
  return this.createResult(
    true,
    totalCampaignsProcessed,
    campaignsClosed,
    totalLeadsAssigned,
    allClosedCampaigns,
    clientsToProcess,
    timestamp,
    startTime
  );
}
```

### 3. Domain Layer

**Responsabilidad**: Lógica de negocio pura

**Archivos**:
```
domain/
├── services/
│   ├── CampaignProcessor.ts    # ⭐ Servicio principal
│   └── LeadAssigner.ts         # Asignación de leads
├── entities/
│   ├── CampaignClosure.ts      # Entidad campaña
│   └── ClosureResult.ts        # Resultado
└── interfaces/
    ├── ICampaignRepository.ts  # Interface para campañas
    └── ILeadRepository.ts      # Interface para leads
```

**Principios**:
- ✅ **100% independiente** de frameworks y bibliotecas externas
- ✅ Contiene TODA la lógica de negocio
- ✅ Define interfaces para repositorios (Dependency Inversion)
- ✅ Testeable sin base de datos ni HTTP

**Ejemplo - CampaignProcessor.ts**:
```typescript
// domain/services/CampaignProcessor.ts:235-571
async processSingleCampaign(
  campaign: CampaignClosure,
  campaignKey?: string,
  forceClose: boolean = false
): Promise<{ success: boolean; leadsAssigned: number; ... }> {

  // PASO 1: Contar leads ya asignados
  const currentAssignedLeads = await this.leadRepository.countAssignedLeadsForCampaign(
    campaign.id,
    true
  );

  // PASO 2: Contar leads disponibles
  const availableLeadsCount = await this.leadRepository.countUniqueLeadsForClient(
    campaign.clientName,
    campaign.brandName,
    campaign.zone,
    campaign
  );

  // PASO 3: Decidir si cerrar
  if (currentAssignedLeads >= campaign.targetLeads) {
    // Cerrar automáticamente
    const finalLeadDate = await this.leadRepository.getLastLeadDateForCampaign(campaign.id);
    await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
    return { success: true, leadsAssigned: 0, campaignDetail };
  }

  // PASO 4: Asignar leads
  const leadsNeeded = campaign.targetLeads - currentAssignedLeads;
  const leadsToAssign = Math.min(availableLeadsCount, leadsNeeded);

  const leadsForAssignment = await this.leadRepository.getLeadsForAssignment(
    campaign.clientName,
    campaign.brandName,
    campaign.zone,
    leadsToAssign,
    campaign
  );

  // PASO 5: Asignar en lotes
  const assignedCount = await this.leadRepository.assignLeadsInBatches(
    leadsForAssignment,
    campaign.id,
    100, // Batch size
    progressCallback
  );

  // PASO 6: Decidir si cerrar
  const totalLeads = currentAssignedLeads + assignedCount;
  const shouldClose = totalLeads >= campaign.targetLeads || (forceClose && assignedCount > 0);

  if (shouldClose) {
    await this.campaignRepository.closeCampaign(campaign.id, finalLeadDate);
  }

  return { success: true, leadsAssigned: assignedCount };
}
```

**Interfaces de Repositorio** (Dependency Inversion Principle):
```typescript
// domain/interfaces/ILeadRepository.ts
export interface ILeadRepository {
  countUniqueLeadsForClient(clientName: string, brandName: string, zone: string): Promise<number>;
  getLeadsForAssignment(clientName: string, brandName: string, zone: string, limit: number): Promise<AvailableLead[]>;
  assignLeadsInBatches(leads: AvailableLead[], campaignId: number, batchSize?: number): Promise<number>;
  // ... más métodos
}
```

### 4. Infrastructure Layer

**Responsabilidad**: Implementación técnica (base de datos, APIs externas)

**Archivos**:
```
infrastructure/
├── repositories/
│   ├── PostgresCampaignRepository.ts  # Implementa ICampaignRepository
│   └── PostgresLeadRepository.ts      # Implementa ILeadRepository
└── factories/
    └── ClosureFactory.ts              # Dependency Injection
```

**Principios**:
- ✅ Implementa interfaces de dominio
- ✅ Acceso directo a base de datos
- ✅ Maneja queries SQL optimizadas
- ✅ Puede cambiar sin afectar al dominio

**Ejemplo - PostgresLeadRepository.ts**:
```typescript
// infrastructure/repositories/PostgresLeadRepository.ts
export class PostgresLeadRepository implements ILeadRepository {
  private db: any;

  // Implementación de interfaz
  async countUniqueLeadsForClient(
    clientName: string,
    brandName: string,
    zone: string,
    campaign?: any
  ): Promise<number> {
    // Query SQL específico de PostgreSQL
    const conditions = buildCampaignLeadFilters({
      campaign,
      normalizedClientName,
      campaignField: opLeadsRep.campaign,
      clienteField: opLeadsRep.cliente,
      localizacionField: opLeadsRep.localizacion,
      campaignIdField: opLeadsRep.campaignId,
      fechaCreacionField: opLeadsRep.fechaCreacion
    });

    const uniqueLeads = await this.db
      .select({ id: opLeadsRep.id })
      .from(opLeadsRep)
      .where(and(...conditions));

    return uniqueLeads.length;
  }
}
```

**Factory para Dependency Injection**:
```typescript
// infrastructure/factories/ClosureFactory.ts
export class ClosureFactory {
  private static instance: ClosureFactory;

  getCampaignClosureUseCase(): CampaignClosureUseCase {
    const campaignRepo = this.getCampaignRepository();
    const leadRepo = this.getLeadRepository();

    return new CampaignClosureUseCase(campaignRepo, leadRepo);
  }
}
```

## 🔄 Flujo de Datos Completo

```
1. HTTP Request
   POST /api/campaign-closure/execute
   {
     "clientName": "red finance",
     "campaignNumber": "1"
   }
        │
        ▼
2. CampaignClosureController (Presentation)
   • Parsea request
   • Crea DTO
   • Valida parámetros básicos
        │
        ▼
3. CampaignClosureUseCase (Application)
   • Mapea DTO a opciones de dominio
   • Obtiene clientes a procesar
   • Itera sobre cada cliente
        │
        ▼
4. CampaignProcessor (Domain)
   • Obtiene campañas del cliente
   • Filtra pendientes
   • Ordena por fecha
   • Procesa LA PRIMERA campaña
        │
        ├─→ PostgresCampaignRepository (Infrastructure)
        │   SELECT * FROM campanas_comerciales
        │   WHERE cliente_id = X AND fecha_fin IS NULL
        │
        └─→ PostgresLeadRepository (Infrastructure)
            ├─ SELECT count(*) FROM op_lead WHERE campaign_id = X
            ├─ SELECT * FROM op_leads_rep WHERE ...
            └─ UPDATE op_lead SET campaign_id = X WHERE id IN (...)
        │
        ▼
5. Result (Domain → Application → Presentation)
   ClosureResult {
     success: true,
     campaignsProcessed: 1,
     campaignsClosed: 1,
     leadsAssigned: 100
   }
        │
        ▼
6. Side Effects (Presentation)
   • Invalidar caché
   • Emitir eventos WebSocket
   • Broadcast dashboard refresh
        │
        ▼
7. HTTP Response
   200 OK
   {
     "success": true,
     "message": "Cierre completado",
     "leadsAssigned": 100
   }
```

## 🧩 Patrones de Diseño Utilizados

### 1. Repository Pattern

**Ubicación**: `domain/interfaces/` + `infrastructure/repositories/`

**Propósito**: Abstrae el acceso a datos

```typescript
// Interface en Domain
interface ICampaignRepository {
  getPendingCampaigns(): Promise<CampaignClosure[]>;
  closeCampaign(id: number, date: Date): Promise<void>;
}

// Implementación en Infrastructure
class PostgresCampaignRepository implements ICampaignRepository {
  async getPendingCampaigns(): Promise<CampaignClosure[]> {
    return await this.db.select().from(campanasComerciales)...
  }
}
```

### 2. Factory Pattern

**Ubicación**: `infrastructure/factories/ClosureFactory.ts`

**Propósito**: Dependency Injection y creación de objetos

```typescript
class ClosureFactory {
  private static instance: ClosureFactory;

  static getInstance(): ClosureFactory {
    if (!ClosureFactory.instance) {
      ClosureFactory.instance = new ClosureFactory();
    }
    return ClosureFactory.instance;
  }

  getCampaignClosureUseCase(): CampaignClosureUseCase {
    return new CampaignClosureUseCase(
      this.getCampaignRepository(),
      this.getLeadRepository()
    );
  }
}
```

### 3. Strategy Pattern

**Ubicación**: `domain/services/LeadAssigner.ts`

**Propósito**: Diferentes estrategias de asignación (Automático vs Manual)

```typescript
class LeadAssigner {
  async assignLeadsWithMultiBrands(...) {
    const isAutomatic = campaignData.asignacionAutomatica === true;

    if (isAutomatic) {
      return await this.assignLeadsAutomatically(...);
    } else {
      return await this.assignLeadsManually(...);
    }
  }

  private async assignLeadsAutomatically(...) {
    // Pool unificado, porcentajes NO respetados
  }

  private async assignLeadsManually(...) {
    // Distribución exacta por marca
  }
}
```

### 4. Observer Pattern (WebSocket)

**Ubicación**: `domain/services/CampaignProcessor.ts:24-107`

**Propósito**: Notificar progreso en tiempo real

```typescript
class ProgressEventManager {
  private connections: Map<string, WebSocket> = new Map();

  addConnection(campaignKey: string, ws: WebSocket) {
    this.connections.set(campaignKey, ws);
  }

  emitProgress(campaignKey: string, progress: number, message: string) {
    const connection = this.connections.get(campaignKey);
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({
        type: 'campaign-progress',
        campaignKey,
        progress,
        message
      }));
    }
  }
}
```

### 5. DTO Pattern

**Ubicación**: `application/dto/ClosureOptions.ts`

**Propósito**: Transferencia de datos entre capas

```typescript
// Request DTO (HTTP → Domain)
interface ClosureRequestDto {
  clients?: string;
  campaignNumber?: string;
  dryRun?: string;
}

// Domain Options
interface ClosureOptions {
  specificClients?: string[];
  specificCampaignNumber?: string;
  dryRun?: boolean;
}

// Mapper
function mapClosureRequestToOptions(request: ClosureRequestDto): ClosureOptions {
  return {
    specificClients: request.clients?.split(',').map(c => c.trim()),
    specificCampaignNumber: request.campaignNumber,
    dryRun: request.dryRun === 'true'
  };
}
```

## 🎯 Principios SOLID Aplicados

### Single Responsibility Principle (SRP)
Cada clase tiene UNA responsabilidad:
- `CampaignClosureController`: Maneja HTTP
- `CampaignClosureUseCase`: Orquesta el flujo
- `CampaignProcessor`: Lógica de procesamiento
- `PostgresLeadRepository`: Acceso a leads en DB

### Open/Closed Principle (OCP)
Abierto a extensión, cerrado a modificación:
- Se puede agregar un nuevo repositorio (MySQL, MongoDB) sin cambiar dominio
- Se puede agregar una nueva estrategia de asignación sin modificar LeadAssigner

### Liskov Substitution Principle (LSP)
Las implementaciones pueden sustituir interfaces:
```typescript
// Cualquier implementación de ILeadRepository funciona
const leadRepo: ILeadRepository = new PostgresLeadRepository();
// O podría ser:
const leadRepo: ILeadRepository = new MongoLeadRepository();
```

### Interface Segregation Principle (ISP)
Interfaces específicas y pequeñas:
- `ICampaignRepository`: Solo operaciones de campañas
- `ILeadRepository`: Solo operaciones de leads

### Dependency Inversion Principle (DIP)
Las capas superiores dependen de abstracciones:
```typescript
// Domain NO depende de Infrastructure
class CampaignProcessor {
  constructor(
    private campaignRepository: ICampaignRepository,  // ← Interface, NO implementación
    private leadRepository: ILeadRepository           // ← Interface, NO implementación
  ) {}
}
```

## 📊 Beneficios de esta Arquitectura

### 1. Testabilidad
```typescript
// Test de CampaignProcessor SIN base de datos
describe('CampaignProcessor', () => {
  it('should close campaign when target is reached', async () => {
    // Mock de repositorios
    const mockCampaignRepo: ICampaignRepository = {
      closeCampaign: jest.fn(),
      // ... más mocks
    };

    const mockLeadRepo: ILeadRepository = {
      countAssignedLeadsForCampaign: jest.fn().mockResolvedValue(100),
      // ... más mocks
    };

    const processor = new CampaignProcessor(mockCampaignRepo, mockLeadRepo);

    const result = await processor.processSingleCampaign(campaign);

    expect(result.success).toBe(true);
    expect(mockCampaignRepo.closeCampaign).toHaveBeenCalled();
  });
});
```

### 2. Mantenibilidad
- Cambios en UI no afectan lógica de negocio
- Cambios en base de datos no afectan dominio
- Cada capa es independiente

### 3. Escalabilidad
- Fácil agregar nuevos casos de uso
- Fácil cambiar de base de datos
- Fácil agregar nuevas estrategias de asignación

### 4. Comprensibilidad
- Estructura clara y predecible
- Separación de responsabilidades obvia
- Flujo de datos unidireccional

## 🔍 Decisiones de Diseño Importantes

### ¿Por qué Clean Architecture?

**Alternativa NO elegida**: Arquitectura MVC monolítica
- ❌ Lógica de negocio mezclada con controllers
- ❌ Difícil testear sin levantar servidor
- ❌ Acoplamiento alto con frameworks

**Alternativa elegida**: Clean Architecture
- ✅ Lógica de negocio completamente aislada
- ✅ Testeable sin infraestructura
- ✅ Independiente de frameworks

### ¿Por qué usar Interfaces?

**Dependency Inversion Principle**:
```typescript
// ❌ MAL: Dependencia directa
class CampaignProcessor {
  constructor(private repo: PostgresLeadRepository) {} // Acoplado a PostgreSQL
}

// ✅ BIEN: Dependencia de abstracción
class CampaignProcessor {
  constructor(private repo: ILeadRepository) {} // Puede ser cualquier implementación
}
```

### ¿Por qué Factory Pattern?

**Centraliza la creación de objetos**:
```typescript
// ❌ MAL: Crear instancias manualmente
const campaignRepo = new PostgresCampaignRepository();
const leadRepo = new PostgresLeadRepository();
const useCase = new CampaignClosureUseCase(campaignRepo, leadRepo);

// ✅ BIEN: Factory se encarga
const factory = ClosureFactory.getInstance();
const useCase = factory.getCampaignClosureUseCase();
```

## 🚀 Cómo Extender el Sistema

### Agregar un Nuevo Caso de Uso

1. Crear archivo en `application/usecases/`:
```typescript
// application/usecases/BulkCampaignClosureUseCase.ts
export class BulkCampaignClosureUseCase {
  constructor(
    private campaignRepository: ICampaignRepository,
    private leadRepository: ILeadRepository
  ) {}

  async execute(clientNames: string[]): Promise<BulkClosureResult> {
    // Implementación
  }
}
```

2. Agregar método en Factory:
```typescript
// infrastructure/factories/ClosureFactory.ts
getBulkCampaignClosureUseCase(): BulkCampaignClosureUseCase {
  return new BulkCampaignClosureUseCase(
    this.getCampaignRepository(),
    this.getLeadRepository()
  );
}
```

3. Crear controller:
```typescript
// presentation/controllers/BulkCampaignClosureController.ts
export class BulkCampaignClosureController {
  async executeBulkClosure(req: Request, res: Response): Promise<void> {
    const useCase = this.factory.getBulkCampaignClosureUseCase();
    const result = await useCase.execute(req.body.clientNames);
    res.json(result);
  }
}
```

### Cambiar de Base de Datos (PostgreSQL → MongoDB)

1. Crear nueva implementación:
```typescript
// infrastructure/repositories/MongoLeadRepository.ts
export class MongoLeadRepository implements ILeadRepository {
  async countUniqueLeadsForClient(...): Promise<number> {
    // Implementación con MongoDB
    return await this.mongoClient.collection('leads').countDocuments({...});
  }
}
```

2. Actualizar Factory:
```typescript
// infrastructure/factories/ClosureFactory.ts
getLeadRepository(): ILeadRepository {
  if (process.env.DB_TYPE === 'mongo') {
    return new MongoLeadRepository();
  }
  return new PostgresLeadRepository();
}
```

3. ✅ **Domain y Application NO cambian** (Dependency Inversion)

## 📚 Referencias

- **Clean Architecture** (Robert C. Martin): https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- **SOLID Principles**: https://en.wikipedia.org/wiki/SOLID
- **Hexagonal Architecture**: https://alistair.cockburn.us/hexagonal-architecture/
- **Domain-Driven Design** (Eric Evans)

## ✅ Checklist de Arquitectura

Al agregar nuevo código, verificar:

- [ ] **SRP**: ¿Cada clase tiene una sola responsabilidad?
- [ ] **Separation of Concerns**: ¿Controllers solo manejan HTTP?
- [ ] **Dependency Inversion**: ¿Domain depende de interfaces, NO implementaciones?
- [ ] **Testabilidad**: ¿Se puede testear sin base de datos?
- [ ] **Naming**: ¿Los nombres reflejan la capa? (Controller, UseCase, Repository, Service)
- [ ] **Layering**: ¿El flujo es Presentation → Application → Domain → Infrastructure?

---

**Versión**: 1.0.0
**Fecha**: 2025-01-15
**Autor**: Sistema de Documentación CRM MADI
