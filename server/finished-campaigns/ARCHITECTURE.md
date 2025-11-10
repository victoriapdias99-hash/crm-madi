# Arquitectura del Módulo Finished Campaigns

## 📐 Arquitectura Hexagonal (Ports & Adapters)

El módulo de Campañas Finalizadas implementa **Arquitectura Hexagonal**, también conocida como **Ports & Adapters Pattern**. Esta arquitectura garantiza:

- ✅ **Separación de responsabilidades** entre capas
- ✅ **Testabilidad** completa de lógica de negocio
- ✅ **Independencia** de frameworks y librerías externas
- ✅ **Flexibilidad** para cambiar implementaciones

---

## 🏗️ Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│  ┌──────────────────────┐       ┌──────────────────────┐       │
│  │FinishedCampaignRoutes│◄──────┤FinishedCampaignCtrl  │       │
│  └──────────┬───────────┘       └──────────┬───────────┘       │
└─────────────┼──────────────────────────────┼───────────────────┘
              │                              │
              │          HTTP/REST           │
              │                              │
┌─────────────▼──────────────────────────────▼───────────────────┐
│                      APPLICATION LAYER                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Use Cases (Casos de Uso)                  │    │
│  │  ┌─────────────────────────────────────────────────┐  │    │
│  │  │ GetFinishedCampaignsUseCase                     │  │    │
│  │  │ GetFinishedCampaignByIdUseCase                  │  │    │
│  │  │ GetFinishedCampaignStatsUseCase                 │  │    │
│  │  │ ReopenFinishedCampaignUseCase                   │  │    │
│  │  └─────────────────────────────────────────────────┘  │    │
│  └────────────────┬───────────────────────────────────────┘    │
│                   │                                             │
│  ┌────────────────▼───────────────────────────────────────┐    │
│  │                     DTOs                               │    │
│  │  FinishedCampaignsResponseDto                          │    │
│  │  SingleFinishedCampaignResponseDto                     │    │
│  │  FinishedCampaignStatsResponseDto                      │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────┬───────────────────────────────────────────────────┘
              │
              │        Domain Interface (Port)
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                        DOMAIN LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Domain Entities                             │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ FinishedCampaign (entidad principal)            │    │   │
│  │  │ FinishedCampaignStats (estadísticas agregadas)  │    │   │
│  │  │ FinishedCampaignFilters (filtros de búsqueda)   │    │   │
│  │  │ ReopenFinishedCampaignResult (resultado)        │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Domain Services                             │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ FinishedCampaignService                         │    │   │
│  │  │   - canReopen() validación de reapertura        │    │   │
│  │  │   - isLastFinishedCampaignForAllBrands()        │    │   │
│  │  │   - hasNewerFinishedCampaignForBrand()          │    │   │
│  │  │   - getRecentlyFinished()                       │    │   │
│  │  │   - getCampaignsWithDuplicates()                │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ FinishedCampaignEnrichmentService               │    │   │
│  │  │   - enrichCampaign() enriquecer una campaña     │    │   │
│  │  │   - enrichCampaigns() enriquecer múltiples      │    │   │
│  │  │   - calculateLeadsMetrics() métricas de leads   │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Repository Interface (Port)                 │   │
│  │  IFinishedCampaignRepository                             │   │
│  │    - findAllFinished()                                   │   │
│  │    - findById()                                          │   │
│  │    - findByClient()                                      │   │
│  │    - findByBrand()                                       │   │
│  │    - findByZone()                                        │   │
│  │    - findByCloseDateRange()                              │   │
│  │    - getStatistics()                                     │   │
│  │    - reopen()                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────┬───────────────────────────────────────────────────┘
              │
              │        Implementation
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Repository Implementation                   │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ PostgresFinishedCampaignRepository (Adapter)    │    │   │
│  │  │   - Implementa IFinishedCampaignRepository      │    │   │
│  │  │   - Usa Drizzle ORM para PostgreSQL             │    │   │
│  │  │   - Queries SQL optimizadas                     │    │   │
│  │  │   - Mapeo de datos BD -> Entidades              │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Factory Pattern                       │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ FinishedCampaignFactory (Singleton)             │    │   │
│  │  │   - getRepository()                             │    │   │
│  │  │   - getService()                                │    │   │
│  │  │   - getEnrichmentService()                      │    │   │
│  │  │   - createGetFinishedCampaignsUseCase()         │    │   │
│  │  │   - createGetFinishedCampaignByIdUseCase()      │    │   │
│  │  │   - createGetFinishedCampaignStatsUseCase()     │    │   │
│  │  │   - createReopenFinishedCampaignUseCase()       │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
                    ┌──────────────────┐
                    │   PostgreSQL DB  │
                    │  ┌────────────┐  │
                    │  │ campanas_  │  │
                    │  │comerciales │  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │ clientes   │  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │op_leads_rep│  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │  op_lead   │  │
                    │  └────────────┘  │
                    └──────────────────┘
```

---

## 📦 Capas y Responsabilidades

### 1️⃣ Domain Layer (Capa de Dominio)

**Responsabilidad**: Contiene la lógica de negocio pura, independiente de frameworks.

#### Entities (Entidades)

**Ubicación**: `domain/entities/FinishedCampaign.ts`

```typescript
export interface FinishedCampaign {
  // Identificación
  id: number;
  clienteId: number;
  campaignNumber: number;

  // Datos básicos
  clientName: string;
  brandName: string;
  zone: string;

  // Fechas
  startDate: Date;
  endDate: Date;
  realEndDate?: Date;

  // Métricas
  targetLeads: number;
  sentLeads: number;
  duplicates: number;
  currentLeads: number;

  // Inversión
  cpl: number;
  investment: number;
  pendingInvestment: number;

  // Estado
  status: 'Finalizada';
  // ... más campos
}
```

**Características**:
- ✅ Sin dependencias externas
- ✅ Modelado basado en dominio del negocio
- ✅ TypeScript interfaces para type-safety
- ✅ Nomenclatura bilingüe (español/inglés) para compatibilidad

#### Domain Services (Servicios de Dominio)

**Ubicación**: `domain/services/`

##### FinishedCampaignService

```typescript
class FinishedCampaignService {
  // Validación de reapertura
  async canReopen(campaignId: number): Promise<{
    canReopen: boolean;
    reason?: string;
  }>

  // Validación multimarca
  private async isLastFinishedCampaignForAllBrands(
    campaign: any
  ): Promise<{ isLast: boolean; reason?: string }>

  // Consultas especializadas
  async getRecentlyFinished(): Promise<FinishedCampaign[]>
  async getCampaignsWithDuplicates(): Promise<FinishedCampaign[]>
}
```

**Lógica de Negocio**:
- ✅ Validación de reapertura (solo última campaña por marca)
- ✅ Soporte para campañas multimarca
- ✅ Consultas de negocio específicas

##### FinishedCampaignEnrichmentService

```typescript
class FinishedCampaignEnrichmentService {
  // Enriquecimiento individual
  async enrichCampaign(
    campaign: FinishedCampaign,
    cliente: any,
    campanasComerciales: any[]
  ): Promise<FinishedCampaign>

  // Enriquecimiento en lote
  async enrichCampaigns(
    campaigns: FinishedCampaign[],
    clientes: Map<number, any>,
    campanasComerciales: any[]
  ): Promise<FinishedCampaign[]>

  // Cálculo de métricas
  private async calculateLeadsMetrics(
    campaign: FinishedCampaign,
    cliente: any,
    campanasComerciales: any[]
  ): Promise<{
    enviados: number;
    duplicados: number;
    diasProcesados: number;
  }>
}
```

**Funcionalidad**:
- ✅ Enriquecimiento de datos desde `op_leads_rep`
- ✅ Usa lógica centralizada (`campaign-counting-utils.ts`)
- ✅ Consistencia con campañas pendientes
- ✅ Cálculo de inversiones y desvíos

#### Repository Interface (Puerto)

**Ubicación**: `domain/interfaces/IFinishedCampaignRepository.ts`

```typescript
export interface IFinishedCampaignRepository {
  // Consultas
  findAllFinished(filters?: FinishedCampaignFilters): Promise<FinishedCampaign[]>;
  findById(id: number): Promise<FinishedCampaign | null>;
  findByClient(clientName: string): Promise<FinishedCampaign[]>;
  findByBrand(brandName: string): Promise<FinishedCampaign[]>;
  findByZone(zone: string): Promise<FinishedCampaign[]>;
  findByCloseDateRange(startDate: string, endDate: string): Promise<FinishedCampaign[]>;

  // Estadísticas
  getStatistics(filters?: FinishedCampaignFilters): Promise<FinishedCampaignStats>;
  count(filters?: FinishedCampaignFilters): Promise<number>;
  exists(id: number): Promise<boolean>;

  // Modificación
  reopen(id: number): Promise<void>;

  // Utilidades
  getClientsWithFinishedCampaigns(): Promise<string[]>;
  getBrandsWithFinishedCampaigns(): Promise<string[]>;
  getZonesWithFinishedCampaigns(): Promise<string[]>;
}
```

**Ventajas del Port**:
- ✅ Contrato definido por dominio
- ✅ Fácil de mockear para testing
- ✅ Permite múltiples implementaciones (PostgreSQL, MongoDB, etc.)

---

### 2️⃣ Application Layer (Capa de Aplicación)

**Responsabilidad**: Orquesta el flujo de datos entre presentación y dominio.

#### Use Cases (Casos de Uso)

**Ubicación**: `application/usecases/`

Cada caso de uso representa una **acción específica** que el usuario puede realizar:

##### GetFinishedCampaignsUseCase

```typescript
class GetFinishedCampaignsUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(
    filters?: FinishedCampaignFilters,
    includeStats: boolean = false
  ): Promise<{
    campaigns: FinishedCampaign[];
    stats?: FinishedCampaignStats;
  }>
}
```

**Propósito**: Obtener lista de campañas finalizadas con filtros opcionales.

##### GetFinishedCampaignByIdUseCase

```typescript
class GetFinishedCampaignByIdUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(id: number): Promise<FinishedCampaign | null>
}
```

**Propósito**: Obtener una campaña específica por ID.

##### GetFinishedCampaignStatsUseCase

```typescript
class GetFinishedCampaignStatsUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(
    filters?: FinishedCampaignFilters
  ): Promise<FinishedCampaignStats>
}
```

**Propósito**: Calcular estadísticas agregadas.

##### ReopenFinishedCampaignUseCase

```typescript
class ReopenFinishedCampaignUseCase {
  constructor(private repository: IFinishedCampaignRepository) {}

  async execute(id: number): Promise<ReopenFinishedCampaignResult>
}
```

**Propósito**: Reabrir una campaña finalizada.

#### DTOs (Data Transfer Objects)

**Ubicación**: `application/dto/FinishedCampaignDto.ts`

```typescript
export interface FinishedCampaignsResponseDto {
  success: boolean;
  data: FinishedCampaign[];
  count: number;
  stats?: FinishedCampaignStats;
  timestamp: string;
}

export interface SingleFinishedCampaignResponseDto {
  success: boolean;
  data: FinishedCampaign | null;
  timestamp: string;
}

export interface ReopenFinishedCampaignRequestDto {
  campaignId: number;
  reason?: string;
}

export interface ReopenFinishedCampaignResponseDto {
  success: boolean;
  message: string;
  campaignId: number;
  timestamp: string;
}
```

**Propósito**:
- ✅ Contratos de comunicación entre capas
- ✅ Validación de datos de entrada/salida
- ✅ Transformación de formato para API REST

---

### 3️⃣ Infrastructure Layer (Capa de Infraestructura)

**Responsabilidad**: Implementaciones concretas de interfaces y conexión con sistemas externos.

#### Repository Implementation (Adaptador)

**Ubicación**: `infrastructure/repositories/PostgresFinishedCampaignRepository.ts`

```typescript
export class PostgresFinishedCampaignRepository
  implements IFinishedCampaignRepository {

  private db: any;

  // Implementación de métodos del puerto
  async findAllFinished(
    filters?: FinishedCampaignFilters
  ): Promise<FinishedCampaign[]> {
    // Query SQL con filtros dinámicos
    let query = `
      SELECT cc.*, cl.nombre_cliente
      FROM campanas_comerciales cc
      LEFT JOIN clientes cl ON cl.id = cc.cliente_id
      WHERE cc.fecha_fin IS NOT NULL
    `;

    // Aplicar filtros...
    // Ejecutar query...
    // Mapear resultados...
  }

  async reopen(id: number): Promise<void> {
    await this.db.update(campanasComerciales)
      .set({ fechaFin: null })
      .where(eq(campanasComerciales.id, id));
  }

  // Mapeo BD -> Entidad
  private mapRowToFinishedCampaign(row: any): FinishedCampaign {
    return {
      id: row.id,
      clienteId: row.cliente_id,
      clientName: row.nombre_cliente,
      // ... mapeo completo
    };
  }
}
```

**Características**:
- ✅ Usa Drizzle ORM para type-safety
- ✅ Queries SQL optimizadas
- ✅ Inicialización lazy de DB
- ✅ Logging detallado con emojis

#### Factory Pattern

**Ubicación**: `infrastructure/factories/FinishedCampaignFactory.ts`

```typescript
export class FinishedCampaignFactory {
  private static repository: PostgresFinishedCampaignRepository | null = null;
  private static service: FinishedCampaignService | null = null;
  private static enrichmentService: FinishedCampaignEnrichmentService | null = null;

  // Singleton instances
  static getRepository(): PostgresFinishedCampaignRepository {
    if (!this.repository) {
      this.repository = new PostgresFinishedCampaignRepository();
    }
    return this.repository;
  }

  static getService(): FinishedCampaignService {
    if (!this.service) {
      this.service = new FinishedCampaignService(this.getRepository());
    }
    return this.service;
  }

  static getEnrichmentService(): FinishedCampaignEnrichmentService {
    if (!this.enrichmentService) {
      this.enrichmentService = new FinishedCampaignEnrichmentService();
    }
    return this.enrichmentService;
  }

  // Use case factories
  static createGetFinishedCampaignsUseCase(): GetFinishedCampaignsUseCase {
    return new GetFinishedCampaignsUseCase(this.getRepository());
  }

  // ... más factories

  // Para testing
  static reset(): void {
    this.repository = null;
    this.service = null;
    this.enrichmentService = null;
  }
}
```

**Ventajas del Factory**:
- ✅ Centralización de creación de objetos
- ✅ Singleton para servicios stateless
- ✅ Fácil reset para testing
- ✅ Control de dependencias

---

### 4️⃣ Presentation Layer (Capa de Presentación)

**Responsabilidad**: Exponer funcionalidad vía API REST.

#### Controller

**Ubicación**: `presentation/controllers/FinishedCampaignController.ts`

```typescript
export class FinishedCampaignController {
  // GET /api/finished-campaigns
  async getFinishedCampaigns(req: Request, res: Response): Promise<void> {
    // 1. Parsear filtros de query params
    const filters: FinishedCampaignFilters = {
      zona: req.query.zona,
      marca: req.query.marca,
      // ...
    };

    // 2. Ejecutar caso de uso
    const useCase = FinishedCampaignFactory.createGetFinishedCampaignsUseCase();
    const result = await useCase.execute(filters, includeStats);

    // 3. Enriquecer datos
    const enrichmentService = FinishedCampaignFactory.getEnrichmentService();
    const enrichedCampaigns = await enrichmentService.enrichCampaigns(
      result.campaigns,
      clientesMap,
      campanasComerciales
    );

    // 4. Responder
    res.json({
      success: true,
      data: enrichedCampaigns,
      count: enrichedCampaigns.length,
      stats: result.stats,
      timestamp: new Date().toISOString()
    });
  }

  // POST /api/finished-campaigns/:id/reopen
  async reopenCampaign(req: Request, res: Response): Promise<void> {
    const id = parseInt(req.params.id);

    // Validar si puede reabrirse
    const service = FinishedCampaignFactory.getService();
    const validation = await service.canReopen(id);

    if (!validation.canReopen) {
      return res.status(400).json({
        success: false,
        error: validation.reason
      });
    }

    // Ejecutar reapertura
    const useCase = FinishedCampaignFactory.createReopenFinishedCampaignUseCase();
    const result = await useCase.execute(id);

    res.json({
      success: result.success,
      message: result.message,
      campaignId: id,
      timestamp: new Date().toISOString()
    });
  }
}
```

**Características**:
- ✅ Manejo de errores robusto
- ✅ Validación de entrada
- ✅ Logging detallado
- ✅ Respuestas consistentes

#### Routes

**Ubicación**: `presentation/routes/finished-campaign-routes.ts`

```typescript
export function createFinishedCampaignRoutes(): Router {
  const router = Router();
  const controller = new FinishedCampaignController();

  // Endpoints
  router.get('/', controller.getFinishedCampaigns);
  router.get('/stats', controller.getStatistics);
  router.get('/filters/options', controller.getFilterOptions);
  router.get('/:id', controller.getCampaignById);
  router.get('/:id/can-reopen', controller.canReopenCampaign);
  router.post('/:id/reopen', controller.reopenCampaign);

  return router;
}
```

**Características**:
- ✅ Rutas RESTful
- ✅ Documentación inline
- ✅ Logging middleware disponible

---

## 🔄 Flujo de Datos Completo

### Ejemplo: GET /api/finished-campaigns?zona=Buenos+Aires

```
1. HTTP Request
   ↓
2. Express Router (finished-campaign-routes.ts)
   ↓
3. Controller.getFinishedCampaigns() (FinishedCampaignController.ts)
   ├─ Parsear query params → filters
   ↓
4. GetFinishedCampaignsUseCase.execute(filters)
   ↓
5. Repository.findAllFinished(filters) (PostgresFinishedCampaignRepository)
   ├─ Construir query SQL con filtros
   ├─ Ejecutar query en PostgreSQL
   ├─ Mapear rows → FinishedCampaign[]
   ↓
6. EnrichmentService.enrichCampaigns()
   ├─ Para cada campaña:
   │  ├─ calculateLeadsMetrics() usando campaign-counting-utils
   │  ├─ Consultar op_leads_rep para enviados/duplicados
   │  ├─ Calcular métricas derivadas (desvío, inversión, etc.)
   │  └─ Retornar campaña enriquecida
   ↓
7. Controller formatea respuesta (DTO)
   ↓
8. HTTP Response JSON
```

---

## 🎯 Patrones de Diseño Implementados

### 1. Hexagonal Architecture (Ports & Adapters)

**Ventajas**:
- Dominio desacoplado de infraestructura
- Fácil testing con mocks
- Flexibilidad para cambiar implementaciones

### 2. Repository Pattern

**Ventajas**:
- Abstracción de acceso a datos
- Queries centralizadas
- Facilita cambio de ORM/BD

### 3. Factory Pattern (Singleton)

**Ventajas**:
- Creación centralizada de objetos
- Control de instancias únicas
- Facilita testing (reset method)

### 4. Use Case Pattern

**Ventajas**:
- Una clase = una acción
- Fácil de entender y mantener
- Testeable unitariamente

### 5. DTO Pattern

**Ventajas**:
- Contratos claros entre capas
- Validación de datos
- Transformación de formatos

---

## 🧪 Testabilidad

### Unit Testing

```typescript
describe('FinishedCampaignService', () => {
  let service: FinishedCampaignService;
  let mockRepository: jest.Mocked<IFinishedCampaignRepository>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      // ... mock methods
    };
    service = new FinishedCampaignService(mockRepository);
  });

  it('should validate reopen correctly', async () => {
    mockRepository.findById.mockResolvedValue(mockCampaign);
    const result = await service.canReopen(1);
    expect(result.canReopen).toBe(true);
  });
});
```

### Integration Testing

```typescript
describe('PostgresFinishedCampaignRepository', () => {
  let repository: PostgresFinishedCampaignRepository;

  beforeAll(async () => {
    // Setup test database
    repository = new PostgresFinishedCampaignRepository();
  });

  it('should find finished campaigns', async () => {
    const campaigns = await repository.findAllFinished();
    expect(campaigns).toBeInstanceOf(Array);
  });
});
```

---

## 📊 Métricas de Arquitectura

- **Acoplamiento**: ⭐⭐⭐⭐⭐ Bajo (capas independientes)
- **Cohesión**: ⭐⭐⭐⭐⭐ Alta (responsabilidades claras)
- **Testabilidad**: ⭐⭐⭐⭐⭐ Alta (mocking fácil)
- **Mantenibilidad**: ⭐⭐⭐⭐⭐ Alta (estructura clara)
- **Escalabilidad**: ⭐⭐⭐⭐⭐ Alta (fácil agregar features)

---

## 🚀 Extensibilidad

### Agregar Nuevo Repositorio (ej: MongoDB)

1. Crear `MongoFinishedCampaignRepository` implementando `IFinishedCampaignRepository`
2. Actualizar Factory para usar nuevo repositorio
3. ¡Listo! Domain y Application no cambian

### Agregar Nuevo Caso de Uso

1. Crear `NewUseCase.ts` en `application/usecases/`
2. Agregar método factory en `FinishedCampaignFactory`
3. Crear endpoint en controller y routes
4. ¡Listo!

---

## 📝 Best Practices Implementadas

✅ **Single Responsibility**: Cada clase tiene una única responsabilidad
✅ **Dependency Inversion**: Dependencias hacia abstracciones (interfaces)
✅ **Open/Closed**: Abierto para extensión, cerrado para modificación
✅ **Interface Segregation**: Interfaces específicas (no fat interfaces)
✅ **Liskov Substitution**: Implementaciones intercambiables

---

## 🔗 Referencias

- [Hexagonal Architecture by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
