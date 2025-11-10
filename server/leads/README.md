# Módulo de Leads - Documentación Completa

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Estructura de Directorios](#estructura-de-directorios)
4. [Componentes Principales](#componentes-principales)
5. [Flujo de Datos](#flujo-de-datos)
6. [Lógica de Negocio](#lógica-de-negocio)
7. [Modelos de Datos](#modelos-de-datos)
8. [Endpoints API](#endpoints-api)
9. [Dependencias](#dependencias)
10. [Ejemplos de Uso](#ejemplos-de-uso)
11. [Consideraciones Técnicas](#consideraciones-técnicas)

---

## Visión General

### Propósito
El módulo de **Leads** es responsable de proporcionar acceso de solo lectura al listado de leads enviados para campañas específicas. Este módulo permite a los clientes del sistema consultar todos los leads que han sido asignados o son elegibles para una campaña comercial determinada.

### Responsabilidad Principal
- **Consulta de leads enviados por campaña**: Proporciona el listado completo de leads con metadata de la campaña
- **Solo lectura**: Este módulo NO modifica datos, solo consulta
- **Consistencia con conteo**: Usa la misma lógica de filtrado que el sistema de conteo de leads

### Casos de Uso
1. Visualizar todos los leads enviados para una campaña específica
2. Obtener información detallada de contactos (nombre, teléfono, email, ciudad, modelo)
3. Auditar leads asignados vs disponibles en campañas en proceso
4. Verificar la correcta asignación de leads según filtros de campaña

---

## Arquitectura

### Patrón Arquitectónico: Clean Architecture / Hexagonal

El módulo sigue una arquitectura en capas que separa claramente las responsabilidades:

```
┌─────────────────────────────────────────────────┐
│           PRESENTATION LAYER                    │
│  - LeadsController (HTTP handlers)              │
│  - leads-routes (Express routing)               │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│          APPLICATION LAYER                      │
│  - GetSentLeadsByCampaignUseCase                │
│  - DTOs (SentLeadDTO, Response)                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│         INFRASTRUCTURE LAYER                    │
│  - PostgresLeadsQueryRepository                 │
│  - Database queries (Drizzle ORM)               │
└─────────────────────────────────────────────────┘
```

### Principios SOLID Aplicados

1. **Single Responsibility Principle (SRP)**
   - Controller: Solo maneja HTTP (validación, respuestas)
   - Use Case: Solo orquesta lógica de negocio
   - Repository: Solo acceso a datos

2. **Open/Closed Principle (OCP)**
   - Repositorio es extensible sin modificar código existente
   - Nuevas queries pueden agregarse sin afectar funcionalidad actual

3. **Dependency Inversion Principle (DIP)**
   - Use Case depende de abstracción (repository), no de implementación concreta
   - Permite cambiar DB sin afectar lógica de negocio

---

## Estructura de Directorios

```
server/leads/
├── README.md                          # Este archivo
│
├── presentation/                      # Capa de presentación (HTTP)
│   ├── controllers/
│   │   └── LeadsController.ts         # Controlador HTTP
│   └── routes/
│       └── leads-routes.ts            # Rutas Express
│
├── application/                       # Capa de aplicación (casos de uso)
│   └── use-cases/
│       └── GetSentLeadsByCampaignUseCase.ts
│
└── infrastructure/                    # Capa de infraestructura (BD)
    └── repositories/
        └── PostgresLeadsQueryRepository.ts
```

### Descripción de Capas

#### 1. Presentation Layer (`presentation/`)
- **Responsabilidad**: Comunicación con el mundo externo (HTTP)
- **Componentes**:
  - `LeadsController`: Maneja requests/responses HTTP
  - `leads-routes`: Define rutas y mapea a controladores
- **No contiene**: Lógica de negocio ni acceso a BD

#### 2. Application Layer (`application/`)
- **Responsabilidad**: Orquestación de lógica de negocio
- **Componentes**:
  - `GetSentLeadsByCampaignUseCase`: Coordina obtención de leads
  - DTOs: Estructuras de datos para transferencia
- **No contiene**: Detalles de HTTP ni queries SQL

#### 3. Infrastructure Layer (`infrastructure/`)
- **Responsabilidad**: Acceso a datos y servicios externos
- **Componentes**:
  - `PostgresLeadsQueryRepository`: Implementación de queries
- **No contiene**: Lógica de negocio

---

## Componentes Principales

### 1. LeadsController (`presentation/controllers/LeadsController.ts`)

**Responsabilidad**: Handler HTTP para endpoint de leads enviados

**Métodos**:
```typescript
async getSentLeadsByCampaign(req: Request, res: Response): Promise<void>
```

**Flujo**:
1. Extrae `campaignId` de `req.params`
2. Valida que sea un número válido (400 si no lo es)
3. Delega al Use Case la obtención de datos
4. Retorna respuesta JSON (200 OK o 500 error)

**Validaciones**:
- `campaignId` debe ser numérico válido

**Respuestas HTTP**:
- `200 OK`: Datos obtenidos exitosamente
- `400 Bad Request`: campaignId inválido
- `500 Internal Server Error`: Error en BD o lógica

**Ubicación en código**: `server/leads/presentation/controllers/LeadsController.ts:89`

---

### 2. leads-routes (`presentation/routes/leads-routes.ts`)

**Responsabilidad**: Define rutas HTTP para operaciones de leads

**Endpoints**:
```typescript
GET /api/leads/sent-by-campaign/:campaignId
```

**Montaje en servidor principal**:
```typescript
// En server/index.ts
import { leadsRoutes } from './leads/presentation/routes/leads-routes';
app.use('/api/leads', leadsRoutes);
```

**Ubicación en código**: `server/leads/presentation/routes/leads-routes.ts:86`

---

### 3. GetSentLeadsByCampaignUseCase (`application/use-cases/GetSentLeadsByCampaignUseCase.ts`)

**Responsabilidad**: Caso de uso para obtener leads enviados

**Interfaz**:
```typescript
async execute(campaignId: number): Promise<SentLeadsByCampaignResponse>
```

**Flujo**:
1. Recibe `campaignId` del controlador
2. Delega la consulta al repositorio
3. Retorna respuesta estructurada con DTOs

**DTOs Definidos**:

#### SentLeadDTO
```typescript
interface SentLeadDTO {
  id: number;                    // ID único en BD
  metaLeadId: string;            // ID compuesto (ej: FORD_20250815_54932882)
  nombre: string;                // Nombre del contacto
  telefono: string;              // Teléfono normalizado
  email: string | null;          // Email (opcional)
  ciudad: string | null;         // Ciudad (opcional)
  modelo: string | null;         // Modelo vehículo (opcional)
  marca: string;                 // Marca del vehículo
  campaign: string;              // Campaña de origen
  origen: string | null;         // Origen del lead
  localizacion: string | null;   // Localización (Pais, Amba, etc.)
  cliente: string | null;        // Cliente normalizado
  fechaCreacion: Date;           // Fecha de creación
  sentAt: Date;                  // Fecha de envío (updatedAt o fechaCreacion)
}
```

#### SentLeadsByCampaignResponse
```typescript
interface SentLeadsByCampaignResponse {
  campaignId: number;            // ID de la campaña
  campaignName: string | null;   // Nombre (ej: "Campaña #1")
  clientName: string | null;     // Nombre del cliente
  marca: string | null;          // Marca principal
  marca2: string | null;         // Segunda marca (multimarca)
  marca3: string | null;         // Tercera marca
  marca4: string | null;         // Cuarta marca
  marca5: string | null;         // Quinta marca
  zona: string | null;           // Zona (Santa Fe, AMBA, etc.)
  totalSent: number;             // Total de leads en listado
  leads: SentLeadDTO[];          // Array de leads
}
```

**Ubicación en código**: `server/leads/application/use-cases/GetSentLeadsByCampaignUseCase.ts:94`

---

### 4. PostgresLeadsQueryRepository (`infrastructure/repositories/PostgresLeadsQueryRepository.ts`)

**Responsabilidad**: Implementación de consultas a PostgreSQL

**Método Principal**:
```typescript
async getSentLeadsByCampaign(campaignId: number): Promise<SentLeadsByCampaignResponse>
```

**Flujo Detallado**:
1. Consulta información de la campaña (marcas, zona, fechas)
2. Consulta información del cliente (nombreComercial)
3. Determina si campaña está FINALIZADA o EN PROCESO
4. Aplica lógica de filtrado correspondiente
5. Mapea resultados a DTOs
6. Retorna respuesta completa

**Tecnologías**:
- **ORM**: Drizzle ORM
- **Base de datos**: PostgreSQL
- **Esquemas**: `opLeadsRep`, `campanasComerciales`, `clientes`

**Ubicación en código**: `server/leads/infrastructure/repositories/PostgresLeadsQueryRepository.ts:71`

---

## Flujo de Datos

### Diagrama de Secuencia Completo

```
Cliente HTTP                                                                Base de Datos
    │                                                                              │
    │  GET /api/leads/sent-by-campaign/38                                          │
    ├──────────────────────────────────────►                                       │
    │                                     Express Router                           │
    │                                            │                                 │
    │                                            │                                 │
    │                                            ▼                                 │
    │                                   LeadsController                            │
    │                                            │                                 │
    │                              1. Validar campaignId                           │
    │                                            │                                 │
    │                                            ▼                                 │
    │                             GetSentLeadsByCampaignUseCase                    │
    │                                            │                                 │
    │                              2. Ejecutar caso de uso                         │
    │                                            │                                 │
    │                                            ▼                                 │
    │                          PostgresLeadsQueryRepository                        │
    │                                            │                                 │
    │                              3. Buscar campaña                               │
    │                                            ├────────────────────────────────►│
    │                                            │     SELECT FROM campanas        │
    │                                            │◄────────────────────────────────┤
    │                                            │                                 │
    │                              4. Buscar cliente                               │
    │                                            ├────────────────────────────────►│
    │                                            │     SELECT FROM clientes        │
    │                                            │◄────────────────────────────────┤
    │                                            │                                 │
    │                              5. Buscar leads (con filtros)                   │
    │                                            ├────────────────────────────────►│
    │                                            │     SELECT FROM op_leads_rep    │
    │                                            │◄────────────────────────────────┤
    │                                            │                                 │
    │                              6. Mapear a DTOs                                │
    │                                            │                                 │
    │                                            ▼                                 │
    │                             GetSentLeadsByCampaignUseCase                    │
    │                                            │                                 │
    │                              7. Retornar resultado                           │
    │                                            │                                 │
    │                                            ▼                                 │
    │                                   LeadsController                            │
    │                                            │                                 │
    │                              8. Formatear respuesta HTTP                     │
    │                                            │                                 │
    │  200 OK + JSON                             │                                 │
    │◄──────────────────────────────────────────┤                                 │
    │  { campaignId: 38, totalSent: 44, ...}    │                                 │
    │                                                                              │
```

### Flujo Paso a Paso

1. **Cliente HTTP → Express Router**
   - Request: `GET http://localhost:5000/api/leads/sent-by-campaign/38`
   - Router mapea a `LeadsController.getSentLeadsByCampaign()`

2. **Express Router → LeadsController**
   - Extrae `campaignId = 38` de `req.params`
   - Valida que sea número válido

3. **LeadsController → GetSentLeadsByCampaignUseCase**
   - Llama a `useCase.execute(38)`
   - Delega lógica de negocio

4. **GetSentLeadsByCampaignUseCase → PostgresLeadsQueryRepository**
   - Llama a `repository.getSentLeadsByCampaign(38)`

5. **PostgresLeadsQueryRepository → Base de Datos**
   - **Query 1**: Busca campaña en `campanas_comerciales`
   - **Query 2**: Busca cliente en `clientes`
   - **Query 3**: Busca leads en `op_leads_rep` con filtros

6. **Base de Datos → PostgresLeadsQueryRepository**
   - Retorna registros raw de PostgreSQL
   - Repository mapea a DTOs estructurados

7. **PostgresLeadsQueryRepository → GetSentLeadsByCampaignUseCase**
   - Retorna `SentLeadsByCampaignResponse`

8. **GetSentLeadsByCampaignUseCase → LeadsController**
   - Retorna resultado al controller

9. **LeadsController → Cliente HTTP**
   - Formatea respuesta HTTP
   - Retorna `200 OK` + JSON

---

## Lógica de Negocio

### Dos Escenarios Principales

El repositorio aplica **diferentes estrategias de filtrado** según el estado de la campaña:

#### 1. Campañas FINALIZADAS (con `fecha_fin`)

**Características**:
- Tienen fecha de cierre definida
- Los leads ya fueron asignados definitivamente
- No cambian con el tiempo

**Lógica de Query**:
```sql
SELECT * FROM op_leads_rep
WHERE campaign_id = 38
ORDER BY marca, fecha_creacion
```

**Criterio Simple**:
- Solo incluye leads que tienen `campaign_id = X`
- Son los leads que fueron efectivamente asignados
- **No aplica filtros genéricos** (marca, zona, cliente)

**Justificación**:
- La campaña está cerrada, los leads asignados son definitivos
- No hay necesidad de recalcular con filtros
- Performance optimizada (índice en `campaign_id`)

**Ubicación en código**: `server/leads/infrastructure/repositories/PostgresLeadsQueryRepository.ts:136-146`

---

#### 2. Campañas EN PROCESO (sin `fecha_fin`)

**Características**:
- Campaña activa, aún asignando leads
- Los leads pueden cambiar dinámicamente
- Pueden haber leads disponibles aún sin asignar

**Lógica de Query**:
```sql
SELECT * FROM op_leads_rep
WHERE (
  -- Multi-marca (OR con ILIKE)
  (lower(campaign) LIKE '%ford%' OR lower(campaign) LIKE '%toyota%' OR ...)
  AND
  -- Cliente normalizado
  cliente = 'giorgi_automotores'
  AND
  -- Zona mapeada
  localizacion = 'Santa Fe'
  AND
  -- Disponibilidad: asignados a esta campaña + disponibles
  (campaign_id IS NULL OR campaign_id = 38)
)
ORDER BY marca, fecha_creacion
```

**Criterios Múltiples**:

##### A) Multi-Marca (OR con ILIKE)
- Lee hasta 5 marcas: `marca`, `marca2`, `marca3`, `marca4`, `marca5`
- Crea condición OR: `(campaign LIKE '%marca1%' OR campaign LIKE '%marca2%' ...)`
- **Case-insensitive**: `lower(campaign)` y `marca.toLowerCase()`
- Respeta porcentajes si `asignacionAutomatica = false`
- Ignora porcentajes si `asignacionAutomatica = true` (pool unificado)

**Ejemplo**:
```typescript
// Campaña con marca="FORD" y marca2="TOYOTA"
// Query generada:
(lower(campaign) LIKE '%ford%' OR lower(campaign) LIKE '%toyota%')
```

##### B) Cliente Normalizado
- Usa nombre comercial del cliente
- Normalización centralizada: `normalizeClientName()`
- Convierte a snake_case: `"Giorgi automotores"` → `"giorgi_automotores"`
- Elimina caracteres especiales (guiones, puntos)
- **Comparación exacta**: `cliente = 'giorgi_automotores'`

**Ejemplos de normalización**:
```typescript
normalizeClientName("Mariano - Pichetti")  → "mariano_pichetti"
normalizeClientName("Toyota China Motors") → "toyota_china_motors"
normalizeClientName(null)                  → "s_d"
```

##### C) Localización (Mapeo de Zona)
- Mapea zona de campaña a localización en BD
- Función: `mapZonaToLocalizacion(zona)`

**Mapeo**:
```typescript
'NACIONAL'  → 'Pais'
'AMBA'      → 'Amba'
'Córdoba'   → 'Cordoba'
'Santa Fe'  → 'Santa Fe'
'Mendoza'   → 'Mendoza'
// Default  → zona original o 'Pais'
```

##### D) Disponibilidad (Incluye Asignados)
- **Condición**: `(campaign_id IS NULL OR campaign_id = {campaignId})`
- Incluye leads SIN asignar (`campaign_id IS NULL`)
- Incluye leads YA asignados a esta campaña (`campaign_id = 38`)
- **Justificación**: Permite ver todos los leads elegibles, incluso si ya fueron asignados

**Por qué es importante**:
- Si se reabre una campaña, los leads asignados siguen siendo visibles
- Permite auditar qué leads están disponibles vs asignados
- Consistencia con lógica de conteo en dashboard

##### E) Orden
- `ORDER BY marca, fecha_creacion`
- Agrupa por marca
- Dentro de cada marca: cronológico (más antiguos primero)

**Ubicación en código**: `server/leads/infrastructure/repositories/PostgresLeadsQueryRepository.ts:148-197`

---

### Función Centralizada de Filtrado

**Nombre**: `buildCampaignLeadFilters()`
**Ubicación**: `shared/utils/multi-brand-utils.ts:231`

**Propósito**:
- **Única función** que construye condiciones de filtrado
- Usada en TODO el sistema para garantizar consistencia:
  1. Conteo de duplicados (dashboard)
  2. Conteo de leads disponibles
  3. Obtención de leads para asignar
  4. **Este módulo**: Listado de leads enviados

**Garantías**:
- MISMO filtrado en conteo vs asignación
- MISMO filtrado en duplicados vs disponibles
- NO hay discrepancias entre "lo que se ve" y "lo que se asigna"

**Condiciones Aplicadas**:
1. Multi-marca: `extractBrandsFromCampaign()` + `createMultiBrandCondition()`
2. Cliente: `eq(clienteField, normalizedClientName)`
3. Localización: `eq(localizacionField, mappedZone)`
4. Disponibilidad: `sql (campaign_id IS NULL OR campaign_id = {id})`

**NO Incluye**:
- ❌ Filtro por fechas (fechaCampana, fechaFin)
- ❌ Filtro por source (todos son 'google_sheets' actualmente)

**Ejemplo de uso**:
```typescript
const conditions = buildCampaignLeadFilters({
  campaign: campana,
  normalizedClientName: 'giorgi_automotores',
  campaignField: opLeadsRep.campaign,
  clienteField: opLeadsRep.cliente,
  localizacionField: opLeadsRep.localizacion,
  campaignIdField: opLeadsRep.campaignId,
  fechaCreacionField: opLeadsRep.fechaCreacion
});

const leads = await db.select()
  .from(opLeadsRep)
  .where(and(...conditions));
```

---

## Modelos de Datos

### Esquemas de Base de Datos

#### 1. `op_leads_rep` (Tabla principal de leads)
```sql
CREATE TABLE op_leads_rep (
  id SERIAL PRIMARY KEY,
  meta_lead_id VARCHAR UNIQUE,       -- ID compuesto (ej: FORD_20250815_54932882)
  nombre VARCHAR NOT NULL,            -- Nombre del contacto
  telefono VARCHAR NOT NULL,          -- Teléfono normalizado
  email VARCHAR,                      -- Email (opcional)
  ciudad VARCHAR,                     -- Ciudad (opcional)
  modelo VARCHAR,                     -- Modelo de vehículo (opcional)
  marca VARCHAR NOT NULL,             -- Marca del vehículo
  campaign VARCHAR NOT NULL,          -- Campaña de origen (ej: "Ford")
  origen VARCHAR,                     -- Origen del lead
  localizacion VARCHAR,               -- Localización (Pais, Amba, etc.)
  cliente VARCHAR,                    -- Cliente normalizado (ej: "giorgi_automotores")
  fecha_creacion TIMESTAMP NOT NULL,  -- Fecha de creación
  updated_at TIMESTAMP,               -- Última actualización
  campaign_id INTEGER,                -- FK a campanas_comerciales (NULL = disponible)

  FOREIGN KEY (campaign_id) REFERENCES campanas_comerciales(id)
);

-- Índices para performance
CREATE INDEX idx_op_leads_campaign_id ON op_leads_rep(campaign_id);
CREATE INDEX idx_op_leads_cliente ON op_leads_rep(cliente);
CREATE INDEX idx_op_leads_marca ON op_leads_rep(marca);
CREATE INDEX idx_op_leads_localizacion ON op_leads_rep(localizacion);
CREATE INDEX idx_op_leads_fecha_creacion ON op_leads_rep(fecha_creacion);
```

#### 2. `campanas_comerciales` (Tabla de campañas)
```sql
CREATE TABLE campanas_comerciales (
  id SERIAL PRIMARY KEY,
  numero_campana INTEGER NOT NULL,    -- Número de campaña (incremental)
  cliente_id INTEGER NOT NULL,        -- FK a clientes
  marca VARCHAR NOT NULL,             -- Marca principal
  marca2 VARCHAR,                     -- Segunda marca (multimarca)
  marca3 VARCHAR,                     -- Tercera marca
  marca4 VARCHAR,                     -- Cuarta marca
  marca5 VARCHAR,                     -- Quinta marca
  porcentaje INTEGER DEFAULT 100,     -- Porcentaje marca principal
  porcentaje2 INTEGER DEFAULT 0,      -- Porcentaje marca 2
  porcentaje3 INTEGER DEFAULT 0,      -- Porcentaje marca 3
  porcentaje4 INTEGER DEFAULT 0,      -- Porcentaje marca 4
  porcentaje5 INTEGER DEFAULT 0,      -- Porcentaje marca 5
  zona VARCHAR NOT NULL,              -- Zona (NACIONAL, AMBA, Córdoba, etc.)
  fecha_campana TIMESTAMP NOT NULL,   -- Fecha de inicio
  fecha_fin TIMESTAMP,                -- Fecha de cierre (NULL = en proceso)
  asignacion_automatica BOOLEAN,      -- Asignación automática (pool unificado)

  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);
```

#### 3. `clientes` (Tabla de clientes)
```sql
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nombre_cliente VARCHAR NOT NULL,    -- Nombre formal (ej: "Giorgi Automotores S.A.")
  nombre_comercial VARCHAR NOT NULL,  -- Nombre comercial (ej: "Giorgi automotores")
  activo BOOLEAN DEFAULT true
);
```

---

## Endpoints API

### GET `/api/leads/sent-by-campaign/:campaignId`

**Descripción**: Obtiene el listado completo de leads enviados para una campaña específica.

**URL**: `http://localhost:5000/api/leads/sent-by-campaign/:campaignId`

**Método HTTP**: `GET`

**Parámetros**:
- `campaignId` (path parameter, requerido): ID numérico de la campaña

**Headers**: No requiere autenticación (por ahora)

**Ejemplo de Request**:
```bash
curl http://localhost:5000/api/leads/sent-by-campaign/38
```

**Respuesta Exitosa (200 OK)**:
```json
{
  "campaignId": 38,
  "campaignName": "Campaña #1",
  "clientName": "Giorgi automotores",
  "marca": "Ford",
  "marca2": null,
  "marca3": null,
  "marca4": null,
  "marca5": null,
  "zona": "Santa Fe",
  "totalSent": 44,
  "leads": [
    {
      "id": 123,
      "metaLeadId": "FORD_20250815_54932882",
      "nombre": "Juan Pérez",
      "telefono": "+5491112345678",
      "email": "juan@example.com",
      "ciudad": "Rosario",
      "modelo": "Ranger",
      "marca": "Ford",
      "campaign": "Ford",
      "origen": null,
      "localizacion": "Santa Fe",
      "cliente": "giorgi_automotores",
      "fechaCreacion": "2025-08-15T10:30:00.000Z",
      "sentAt": "2025-08-15T10:30:00.000Z"
    },
    {
      "id": 124,
      "metaLeadId": "FORD_20250815_54932883",
      "nombre": "María García",
      "telefono": "+5491123456789",
      "email": "maria@example.com",
      "ciudad": "Santa Fe",
      "modelo": "Territory",
      "marca": "Ford",
      "campaign": "Ford",
      "origen": null,
      "localizacion": "Santa Fe",
      "cliente": "giorgi_automotores",
      "fechaCreacion": "2025-08-15T11:00:00.000Z",
      "sentAt": "2025-08-15T11:00:00.000Z"
    }
    // ... más leads
  ]
}
```

**Respuesta de Error - Invalid Campaign ID (400 Bad Request)**:
```json
{
  "error": "Invalid campaign ID",
  "message": "Campaign ID must be a valid number"
}
```

**Respuesta de Error - Internal Server Error (500)**:
```json
{
  "error": "Internal server error",
  "message": "Failed to retrieve sent leads"
}
```

**Casos Especiales**:

#### Campaña No Existe
```json
{
  "campaignId": 999,
  "campaignName": null,
  "clientName": null,
  "marca": null,
  "marca2": null,
  "marca3": null,
  "marca4": null,
  "marca5": null,
  "zona": null,
  "totalSent": 0,
  "leads": []
}
```

#### Campaña Sin Leads
```json
{
  "campaignId": 50,
  "campaignName": "Campaña #5",
  "clientName": "Red Finance",
  "marca": "Toyota",
  "marca2": null,
  "marca3": null,
  "marca4": null,
  "marca5": null,
  "zona": "AMBA",
  "totalSent": 0,
  "leads": []
}
```

---

## Dependencias

### Dependencias Internas (Módulos del Sistema)

#### 1. Esquemas de Base de Datos (`@shared/schema`)
```typescript
import { opLeadsRep, campanasComerciales, clientes } from '@shared/schema';
```

**Propósito**: Definiciones de tablas con Drizzle ORM
**Ubicación**: `shared/schema.ts`

#### 2. Normalización de Clientes (`shared/utils/client-normalization.ts`)
```typescript
import { normalizeClientName } from '@shared/utils/client-normalization';
```

**Función**: Normaliza nombres de cliente a snake_case
**Ejemplo**: `"Giorgi automotores"` → `"giorgi_automotores"`
**Ubicación**: `shared/utils/client-normalization.ts:11`

#### 3. Utilidades Multi-Marca (`shared/utils/multi-brand-utils.ts`)
```typescript
import { buildCampaignLeadFilters } from '@shared/utils/multi-brand-utils';
```

**Función**: Construye condiciones de filtrado centralizadas
**Ubicación**: `shared/utils/multi-brand-utils.ts:231`

**Funciones Relacionadas**:
- `extractBrandsFromCampaign()`: Extrae marcas configuradas
- `createMultiBrandCondition()`: Crea condición SQL multi-marca
- `mapZonaToLocalizacion()`: Mapea zona a localización

#### 4. Base de Datos (`server/db.ts`)
```typescript
import { db } from '../../../db';
```

**Propósito**: Instancia de conexión a PostgreSQL con Drizzle
**Ubicación**: `server/db.ts`

### Dependencias Externas (NPM)

#### 1. Express.js
```typescript
import { Request, Response, Router } from 'express';
```

**Versión**: ^4.x
**Propósito**: Framework HTTP para Node.js

#### 2. Drizzle ORM
```typescript
import { eq, and } from 'drizzle-orm';
```

**Versión**: ^0.x
**Propósito**: ORM type-safe para PostgreSQL

---

## Ejemplos de Uso

### Ejemplo 1: Consultar Leads de Campaña Finalizada

**Escenario**: Campaña #38 (Giorgi Automotores #1) está FINALIZADA

**Request**:
```bash
curl http://localhost:5000/api/leads/sent-by-campaign/38
```

**Proceso Interno**:
1. Repository consulta `campanas_comerciales.id = 38`
2. Detecta que `fecha_fin IS NOT NULL` → Campaña FINALIZADA
3. Query simple: `SELECT * FROM op_leads_rep WHERE campaign_id = 38`
4. Retorna 44 leads asignados

**Response**:
```json
{
  "campaignId": 38,
  "campaignName": "Campaña #1",
  "clientName": "Giorgi automotores",
  "marca": "Ford",
  "zona": "Santa Fe",
  "totalSent": 44,
  "leads": [ ... ]
}
```

---

### Ejemplo 2: Consultar Leads de Campaña EN PROCESO

**Escenario**: Campaña #65 (Borussia #1) está EN PROCESO (sin cerrar)

**Request**:
```bash
curl http://localhost:5000/api/leads/sent-by-campaign/65
```

**Proceso Interno**:
1. Repository consulta `campanas_comerciales.id = 65`
2. Detecta que `fecha_fin IS NULL` → Campaña EN PROCESO
3. Consulta cliente: `clientes.id = 65.cliente_id`
4. Normaliza cliente: `"Borussia"` → `"borussia"`
5. Mapea zona: `"AMBA"` → `"Amba"`
6. Query con filtros múltiples:
```sql
WHERE (
  lower(campaign) LIKE '%peugeot%'  -- Marca principal
  AND cliente = 'borussia'
  AND localizacion = 'Amba'
  AND (campaign_id IS NULL OR campaign_id = 65)
)
```
7. Retorna leads asignados + disponibles que coinciden

**Response**:
```json
{
  "campaignId": 65,
  "campaignName": "Campaña #1",
  "clientName": "Borussia",
  "marca": "Peugeot",
  "zona": "AMBA",
  "totalSent": 84,
  "leads": [ ... ]
}
```

---

### Ejemplo 3: Campaña Multi-Marca

**Escenario**: Campaña #70 tiene múltiples marcas configuradas

**Configuración de Campaña**:
```json
{
  "id": 70,
  "numeroCampana": 5,
  "marca": "Ford",
  "marca2": "Toyota",
  "marca3": "Nissan",
  "porcentaje": 40,
  "porcentaje2": 35,
  "porcentaje3": 25,
  "zona": "NACIONAL"
}
```

**Request**:
```bash
curl http://localhost:5000/api/leads/sent-by-campaign/70
```

**Proceso Interno**:
1. `extractBrandsFromCampaign()` detecta 3 marcas
2. `createMultiBrandCondition()` crea:
```sql
(
  lower(campaign) LIKE '%ford%' OR
  lower(campaign) LIKE '%toyota%' OR
  lower(campaign) LIKE '%nissan%'
)
```
3. Query completo:
```sql
WHERE (
  (lower(campaign) LIKE '%ford%' OR lower(campaign) LIKE '%toyota%' OR lower(campaign) LIKE '%nissan%')
  AND cliente = 'cliente_normalizado'
  AND localizacion = 'Pais'
  AND (campaign_id IS NULL OR campaign_id = 70)
)
```

**Response**:
```json
{
  "campaignId": 70,
  "campaignName": "Campaña #5",
  "clientName": "Cliente Multi-Marca",
  "marca": "Ford",
  "marca2": "Toyota",
  "marca3": "Nissan",
  "marca4": null,
  "marca5": null,
  "zona": "NACIONAL",
  "totalSent": 150,
  "leads": [
    { "marca": "Ford", ... },
    { "marca": "Ford", ... },
    { "marca": "Toyota", ... },
    { "marca": "Nissan", ... }
    // ... mezclados según filtros
  ]
}
```

---

### Ejemplo 4: Uso desde Cliente Frontend (JavaScript/TypeScript)

```typescript
// Frontend: Obtener leads de una campaña
async function getLeadsForCampaign(campaignId: number) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/leads/sent-by-campaign/${campaignId}`
    );

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error('Invalid campaign ID');
      }
      throw new Error('Failed to fetch leads');
    }

    const data = await response.json();

    console.log(`Campaña: ${data.campaignName}`);
    console.log(`Cliente: ${data.clientName}`);
    console.log(`Marca: ${data.marca}`);
    console.log(`Total leads: ${data.totalSent}`);

    // Procesar leads
    data.leads.forEach((lead: any) => {
      console.log(`- ${lead.nombre} (${lead.telefono}) - ${lead.marca}`);
    });

    return data;
  } catch (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }
}

// Uso
getLeadsForCampaign(38);
```

---

## Consideraciones Técnicas

### Performance

#### 1. Índices de Base de Datos
Para optimizar las queries, asegúrate de tener estos índices:
```sql
CREATE INDEX idx_op_leads_campaign_id ON op_leads_rep(campaign_id);
CREATE INDEX idx_op_leads_cliente ON op_leads_rep(cliente);
CREATE INDEX idx_op_leads_marca ON op_leads_rep(marca);
CREATE INDEX idx_op_leads_localizacion ON op_leads_rep(localizacion);
CREATE INDEX idx_op_leads_fecha_creacion ON op_leads_rep(fecha_creacion);
CREATE INDEX idx_op_leads_campaign_lower ON op_leads_rep(LOWER(campaign));
```

#### 2. Límites de Datos
- **No hay paginación**: Endpoint retorna TODOS los leads de una campaña
- **Riesgo**: Campañas con muchos leads (10,000+) pueden causar timeouts
- **Solución futura**: Implementar paginación con `limit` y `offset`

```typescript
// Ejemplo de paginación futura
GET /api/leads/sent-by-campaign/:campaignId?page=1&limit=100
```

#### 3. Caching
- Actualmente NO hay caching
- Campañas FINALIZADAS son buenos candidatos para cache (datos inmutables)
- **Solución futura**: Redis cache para campañas cerradas

---

### Seguridad

#### 1. Validación de Entrada
- ✅ Valida que `campaignId` sea numérico
- ✅ Usa ORM para prevenir SQL Injection
- ❌ NO hay autenticación/autorización (TODO)
- ❌ NO valida permisos de usuario (cualquiera puede ver cualquier campaña)

**Mejora futura**:
```typescript
// Validar que usuario tenga permiso para ver esta campaña
if (!user.canAccessCampaign(campaignId)) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

#### 2. Rate Limiting
- ❌ NO implementado actualmente
- **Riesgo**: Abuso de endpoint (consultas masivas)
- **Solución futura**: Express rate limiting middleware

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por IP
});

router.use(limiter);
```

---

### Mantenibilidad

#### 1. Separación de Responsabilidades
- ✅ Arquitectura limpia con capas bien definidas
- ✅ Controller no conoce detalles de BD
- ✅ Repository no conoce detalles de HTTP
- ✅ Use Case orquesta sin conocer implementación

#### 2. Testabilidad
```typescript
// Ejemplo de test unitario para Use Case
describe('GetSentLeadsByCampaignUseCase', () => {
  it('should return leads for valid campaign', async () => {
    // Arrange
    const mockRepo = {
      getSentLeadsByCampaign: jest.fn().mockResolvedValue({
        campaignId: 38,
        totalSent: 44,
        leads: []
      })
    };
    const useCase = new GetSentLeadsByCampaignUseCase();
    useCase['repository'] = mockRepo;

    // Act
    const result = await useCase.execute(38);

    // Assert
    expect(result.campaignId).toBe(38);
    expect(result.totalSent).toBe(44);
    expect(mockRepo.getSentLeadsByCampaign).toHaveBeenCalledWith(38);
  });
});
```

#### 3. Documentación del Código
- ✅ Comentarios JSDoc en todos los componentes
- ✅ Explicaciones de lógica compleja inline
- ✅ Ejemplos de uso en comentarios
- ✅ Esta documentación centralizada

---

### Consistencia con Otros Módulos

#### 1. Conteo de Leads (Dashboard)
- **Ubicación**: `server/routes.ts` - endpoint `/api/campanas/contarLeadsPorCampana/:id`
- **Garantía**: Usa **MISMA función** `buildCampaignLeadFilters()`
- **Resultado**: Conteo en dashboard = Total en listado de leads

#### 2. Asignación de Leads (Campaign Closure)
- **Ubicación**: `server/campaign-closure/infrastructure/repositories/PostgresLeadRepository.ts`
- **Garantía**: Usa **MISMA función** `buildCampaignLeadFilters()`
- **Resultado**: Leads asignados = Leads que se ven en listado

#### 3. Detección de Duplicados
- **Ubicación**: `server/routes.ts` - conteo de duplicados
- **Garantía**: Usa **MISMA función** `buildCampaignLeadFilters()`
- **Resultado**: Duplicados contados = Duplicados en leads enviados

---

### Posibles Mejoras Futuras

#### 1. Paginación
```typescript
interface PaginationParams {
  page: number;
  limit: number;
}

interface PaginatedResponse extends SentLeadsByCampaignResponse {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalLeads: number;
    leadsPerPage: number;
  };
}
```

#### 2. Filtros Adicionales
```typescript
interface LeadFilters {
  marca?: string;           // Filtrar por marca específica
  ciudad?: string;          // Filtrar por ciudad
  fechaDesde?: Date;        // Filtrar por rango de fechas
  fechaHasta?: Date;
  search?: string;          // Búsqueda por nombre/teléfono
}
```

#### 3. Ordenamiento Configurable
```typescript
interface SortOptions {
  field: 'nombre' | 'fecha_creacion' | 'marca';
  order: 'asc' | 'desc';
}
```

#### 4. Exportación de Datos
```typescript
// Exportar leads a CSV/Excel
GET /api/leads/sent-by-campaign/:campaignId/export?format=csv
```

#### 5. Estadísticas Agregadas
```typescript
interface CampaignLeadStats {
  totalLeads: number;
  leadsByMarca: { [marca: string]: number };
  leadsByCiudad: { [ciudad: string]: number };
  leadsByFecha: { [fecha: string]: number };
}
```

---

## Referencias

### Código Relacionado

#### Módulos que Usan la Misma Lógica
1. **Dashboard de Campañas Pendientes**
   - Archivo: `server/routes.ts`
   - Endpoint: `/api/campanas/contarLeadsPorCampana/:id`
   - Línea: Usa `buildCampaignLeadFilters()`

2. **Cierre de Campañas**
   - Archivo: `server/campaign-closure/infrastructure/repositories/PostgresLeadRepository.ts`
   - Métodos:
     - `countUniqueLeadsForClient()`: Línea ~50
     - `getLeadsForAssignment()`: Línea ~100
     - `countAssignedLeadsForCampaign()`: Línea ~150

3. **Conteo de Duplicados**
   - Archivo: `server/routes.ts`
   - Endpoint: `/api/datos-diarios`
   - Usa misma lógica de filtrado

#### Utilidades Compartidas
1. **Normalización de Clientes**
   - Archivo: `shared/utils/client-normalization.ts:11`
   - Función: `normalizeClientName()`

2. **Filtrado Multi-Marca**
   - Archivo: `shared/utils/multi-brand-utils.ts`
   - Funciones:
     - `buildCampaignLeadFilters()`: Línea 231
     - `extractBrandsFromCampaign()`: Línea 17
     - `createMultiBrandCondition()`: Línea 63
     - `mapZonaToLocalizacion()`: Línea 162

#### Esquemas de Datos
1. **Definiciones de Tablas**
   - Archivo: `shared/schema.ts`
   - Esquemas:
     - `opLeadsRep`
     - `campanasComerciales`
     - `clientes`

---

## Glosario

- **Lead**: Contacto potencial (nombre, teléfono, email) obtenido de campañas de marketing
- **Campaña**: Conjunto de parámetros (cliente, marca, zona, fechas) para asignar leads
- **Campaña Finalizada**: Campaña con `fecha_fin` definida, leads asignados definitivamente
- **Campaña En Proceso**: Campaña sin `fecha_fin`, aún puede recibir más leads
- **Cliente Normalizado**: Nombre de cliente convertido a snake_case (ej: `giorgi_automotores`)
- **Multi-Marca**: Campaña que busca leads de múltiples marcas (ej: Ford + Toyota)
- **Localización**: Campo que mapea zona geográfica (NACIONAL→Pais, AMBA→Amba)
- **DTO**: Data Transfer Object, estructura de datos para comunicación entre capas
- **Use Case**: Caso de uso, orquesta lógica de negocio en capa de aplicación
- **Repository**: Capa de acceso a datos, abstrae queries de base de datos

---

## Changelog

### v1.0.0 - Implementación Inicial
- Estructura Clean Architecture
- Endpoint GET `/api/leads/sent-by-campaign/:campaignId`
- Soporte para campañas finalizadas y en proceso
- Integración con funciones centralizadas de filtrado
- Soporte multi-marca
- Documentación completa

---

## Contacto y Soporte

Para preguntas o reporte de bugs relacionados con este módulo:
- Revisar primero esta documentación
- Verificar logs del servidor: `console.error` en LeadsController
- Consultar documentación de módulos relacionados:
  - `CONDICIONES-ASIGNACION-LEADS.md`
  - `server/campaign-closure/README.md`
  - `server/sync/README.md`

---

**Última actualización**: 2025-01-09
**Autor**: Sistema CRM MADI
**Versión del documento**: 1.0.0
