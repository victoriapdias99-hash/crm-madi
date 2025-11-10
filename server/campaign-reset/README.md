# 🔄 Campaign Reset Module

Módulo refactorizado para reset de campañas usando Clean Architecture.

## 📁 Estructura

```
campaign-reset/
├── domain/                     # Capa de Dominio (reglas de negocio)
│   ├── entities/
│   │   └── ResetResult.ts     # Entidades del resultado de reset
│   └── interfaces/
│       └── ICampaignResetRepository.ts  # Contratos del dominio
│
├── application/                # Capa de Aplicación (casos de uso)
│   ├── dto/
│   │   └── ResetOptions.ts    # DTOs para opciones de reset
│   └── usecases/
│       ├── ResetCampaignUseCase.ts     # UC: Reset individual
│       └── BatchResetUseCase.ts        # UC: Reset en batch
│
├── infrastructure/             # Capa de Infraestructura (implementaciones)
│   └── repositories/
│       └── PostgresCampaignResetRepository.ts  # Repositorio PostgreSQL
│
└── presentation/               # Capa de Presentación (API)
    ├── controllers/
    │   ├── ResetCampaignController.ts  # Controller reset individual
    │   └── BatchResetController.ts     # Controller reset batch
    └── routes/
        └── campaign-reset-routes.ts     # Definición de rutas
```

---

## 🎯 API Endpoints

### 1. Reset Campaña Individual

```http
POST /api/campaign-reset/:campaignId?dryRun=true
```

**Parámetros:**
- `campaignId` (path): ID de la campaña
- `dryRun` (query, opcional): `true` para preview, `false` para ejecutar

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "campaignId": 65,
    "campaignName": "Red Finance",
    "campaignNumber": 1,
    "leadsReset": 82,
    "fechaFinCleared": true,
    "success": true
  },
  "message": "Successfully reset 82 leads and cleared fecha_fin"
}
```

**Ejemplo de uso:**
```bash
# Dry run (preview)
curl -X POST "http://localhost:5000/api/campaign-reset/65?dryRun=true"

# Ejecutar
curl -X POST "http://localhost:5000/api/campaign-reset/65"
```

---

### 2. Reset Batch (Múltiples Campañas)

```http
POST /api/campaign-reset/batch?dryRun=true&onlyFinished=true
```

**Parámetros de Query:**
- `beforeDate` (opcional): Fecha límite superior (ISO format)
- `afterDate` (opcional): Fecha límite inferior (ISO format)
- `onlyFinished` (opcional, default: `true`): Solo campañas finalizadas
- `dryRun` (opcional, default: `false`): Preview sin ejecutar

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "totalCampaigns": 40,
    "successfulResets": 40,
    "failedResets": 0,
    "totalLeadsReset": 7676,
    "campaignsReopened": 40,
    "results": [
      {
        "campaignId": 65,
        "campaignName": "Red Finance",
        "campaignNumber": 1,
        "leadsReset": 82,
        "fechaFinCleared": true,
        "success": true
      }
    ],
    "errors": []
  },
  "message": "Successfully reset 40 campaigns with 7676 total leads"
}
```

**Ejemplos de uso:**
```bash
# Dry run - todas las finalizadas
curl -X POST "http://localhost:5000/api/campaign-reset/batch?dryRun=true"

# Ejecutar - todas las finalizadas
curl -X POST "http://localhost:5000/api/campaign-reset/batch"

# Solo campañas finalizadas antes del 2025-09-01
curl -X POST "http://localhost:5000/api/campaign-reset/batch?beforeDate=2025-09-01"

# Rango de fechas
curl -X POST "http://localhost:5000/api/campaign-reset/batch?afterDate=2025-07-01&beforeDate=2025-09-30"
```

---

## 🏗️ Arquitectura

### Domain Layer (Dominio)

**Responsabilidades:**
- Definir entidades y reglas de negocio
- Definir interfaces (contratos) para repositorios
- No depende de ninguna otra capa

**Archivos:**
- `ResetResult.ts`: Entidades que representan el resultado de operaciones
- `ICampaignResetRepository.ts`: Interface que define qué operaciones debe tener el repositorio

### Application Layer (Aplicación)

**Responsabilidades:**
- Implementar casos de uso (use cases)
- Orquestar lógica de negocio
- Depende solo del Dominio

**Archivos:**
- `ResetCampaignUseCase.ts`: Lógica para resetear una campaña
- `BatchResetUseCase.ts`: Lógica para resetear múltiples campañas
- `ResetOptions.ts`: DTOs para pasar opciones

### Infrastructure Layer (Infraestructura)

**Responsabilidades:**
- Implementar interfaces del dominio
- Acceso a base de datos
- Detalles técnicos de implementación

**Archivos:**
- `PostgresCampaignResetRepository.ts`: Implementación concreta usando PostgreSQL

### Presentation Layer (Presentación)

**Responsabilidades:**
- Exponer API REST
- Validar requests
- Formatear responses
- Depende de Application

**Archivos:**
- `ResetCampaignController.ts`: Maneja requests HTTP para reset individual
- `BatchResetController.ts`: Maneja requests HTTP para reset batch
- `campaign-reset-routes.ts`: Define endpoints y conecta con controllers

---

## 🔄 Flujo de Ejecución

### Ejemplo: Reset de una campaña

```
1. HTTP Request
   POST /api/campaign-reset/65

2. Presentation Layer
   ResetCampaignController.execute()
   - Valida parámetros
   - Extrae campaignId

3. Application Layer
   ResetCampaignUseCase.execute()
   - Obtiene conteo de leads
   - Verifica si está finalizada
   - Coordina operaciones

4. Infrastructure Layer
   PostgresCampaignResetRepository
   - clearCampaignLeads()
   - clearCampaignEndDate()
   - Ejecuta queries SQL

5. Response
   { success: true, data: {...}, message: "..." }
```

---

## 🧪 Testing

### Probar desde cURL

```bash
# 1. Dry run de una campaña
curl -X POST "http://localhost:5000/api/campaign-reset/65?dryRun=true"

# 2. Ejecutar reset de una campaña
curl -X POST "http://localhost:5000/api/campaign-reset/65"

# 3. Dry run batch
curl -X POST "http://localhost:5000/api/campaign-reset/batch?dryRun=true"

# 4. Ejecutar reset batch
curl -X POST "http://localhost:5000/api/campaign-reset/batch"
```

### Probar desde navegador/Postman

```
POST http://localhost:5000/api/campaign-reset/65?dryRun=true
POST http://localhost:5000/api/campaign-reset/batch?dryRun=true
```

---

## 📊 Operaciones que realiza

### Reset Individual (`/api/campaign-reset/:campaignId`)

1. **Limpia leads asignados:**
   ```sql
   UPDATE op_lead
   SET campaign_id = NULL
   WHERE campaign_id = :campaignId
   ```

2. **Limpia fecha_fin (si existe):**
   ```sql
   UPDATE campanas_comerciales
   SET fecha_fin = NULL
   WHERE id = :campaignId
   ```

### Reset Batch (`/api/campaign-reset/batch`)

1. Obtiene todas las campañas finalizadas (con `fecha_fin`)
2. Filtra por fechas si se especificaron
3. Para cada campaña:
   - Limpia leads asignados
   - Limpia fecha_fin
4. Retorna resumen con totales y detalles

---

## 🔧 Ventajas de esta arquitectura

1. **Separación de responsabilidades**
   - Cada capa tiene un propósito claro
   - Fácil de mantener y extender

2. **Testeable**
   - Cada capa se puede testear independientemente
   - Fácil crear mocks de repositorios

3. **Flexible**
   - Cambiar de PostgreSQL a otro DB solo requiere nueva implementación de repository
   - Agregar nuevos casos de uso es simple

4. **Consistente**
   - Misma estructura que `campaign-closure`
   - Patrón familiar para el equipo

5. **API REST estándar**
   - Endpoints HTTP en lugar de scripts CLI
   - Integrable con frontend o herramientas

---

## 📚 Referencias

- Arquitectura similar a `campaign-closure`
- Clean Architecture principles
- Dependency Inversion Principle
- Repository Pattern

---

## 🚀 Próximos Pasos

### Extensiones posibles:

1. **Agregar autenticación/autorización**
   ```typescript
   router.post('/campaign-reset/:campaignId', authMiddleware, (req, res) => {
     resetCampaignController.execute(req, res);
   });
   ```

2. **Agregar logging estructurado**
   ```typescript
   logger.info('Campaign reset started', { campaignId, userId });
   ```

3. **Agregar validación con schemas**
   ```typescript
   router.post('/campaign-reset/:campaignId',
     validateRequest(resetSchema),
     (req, res) => { ... }
   );
   ```

4. **Agregar tests unitarios**
   ```typescript
   describe('ResetCampaignUseCase', () => {
     it('should reset campaign leads', async () => {
       // test implementation
     });
   });
   ```
