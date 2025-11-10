# Módulo Finished Campaigns

## Índice de Documentación

Bienvenido a la documentación completa del módulo de **Campañas Finalizadas**. Este módulo gestiona las campañas que han completado su ciclo de vida y han sido marcadas como cerradas con una fecha de finalización.

### 📚 Documentación Disponible

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Arquitectura Hexagonal del Módulo
   - Estructura de capas (Domain, Application, Infrastructure, Presentation)
   - Patrones de diseño implementados
   - Diagramas de arquitectura

2. **[API-REFERENCE.md](./API-REFERENCE.md)** - Referencias de API
   - Endpoints REST disponibles
   - DTOs y modelos de datos
   - Ejemplos de requests y responses

3. **[BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md)** - Lógica de Negocio
   - Reglas de negocio para campañas finalizadas
   - Validaciones de reapertura
   - Cálculos de métricas

4. **[DATA-FLOW.md](./DATA-FLOW.md)** - Flujo de Datos
   - Pipeline de enriquecimiento de datos
   - Integración con op_leads_rep
   - Optimizaciones de performance

5. **[REOPEN-CAMPAIGN.md](./REOPEN-CAMPAIGN.md)** - Reapertura de Campañas
   - Funcionalidad de reapertura
   - Validaciones multimarca
   - Casos de uso y ejemplos

6. **[CLIENT-COMPONENT.md](./CLIENT-COMPONENT.md)** - Componente Frontend
   - Componente React campanas-finalizadas.tsx
   - Funcionalidades de UI
   - WebSocket y actualizaciones en tiempo real

---

## 🎯 Resumen del Módulo

### Propósito

El módulo **Finished Campaigns** gestiona las campañas comerciales que han completado su ciclo de vida y han sido cerradas oficialmente. Proporciona:

- ✅ Consulta de campañas finalizadas con filtros avanzados
- 📊 Cálculo de métricas y estadísticas agregadas
- 🔄 Funcionalidad de reapertura controlada
- 📈 Enriquecimiento de datos en tiempo real
- 🔍 Análisis histórico de campañas

### Características Principales

1. **Arquitectura Hexagonal**
   - Separación clara de responsabilidades
   - Testeable y mantenible
   - Bajo acoplamiento entre capas

2. **Enriquecimiento de Datos**
   - Cálculo de métricas desde `op_leads_rep`
   - Consistencia con campañas pendientes
   - Datos en tiempo real

3. **Reapertura Inteligente**
   - Validación multimarca
   - Solo última campaña por marca
   - Liberación completa de leads

4. **Filtrado Avanzado**
   - Por zona, marca, cliente
   - Por rangos de fechas
   - Solo duplicados

5. **Performance**
   - Queries optimizadas
   - Caching inteligente
   - Actualización en segundo plano

---

## 📦 Estructura del Proyecto

```
server/finished-campaigns/
├── application/                 # Capa de Aplicación
│   ├── dto/                    # Data Transfer Objects
│   │   └── FinishedCampaignDto.ts
│   └── usecases/               # Casos de Uso
│       ├── GetFinishedCampaignsUseCase.ts
│       ├── GetFinishedCampaignByIdUseCase.ts
│       ├── GetFinishedCampaignStatsUseCase.ts
│       └── ReopenFinishedCampaignUseCase.ts
│
├── domain/                      # Capa de Dominio
│   ├── entities/               # Entidades de Dominio
│   │   └── FinishedCampaign.ts
│   ├── interfaces/             # Contratos
│   │   └── IFinishedCampaignRepository.ts
│   └── services/               # Servicios de Dominio
│       ├── FinishedCampaignService.ts
│       └── FinishedCampaignEnrichmentService.ts
│
├── infrastructure/              # Capa de Infraestructura
│   ├── factories/              # Factories (Singleton)
│   │   └── FinishedCampaignFactory.ts
│   └── repositories/           # Implementaciones de Repositorios
│       └── PostgresFinishedCampaignRepository.ts
│
├── presentation/                # Capa de Presentación
│   ├── controllers/            # Controladores REST
│   │   └── FinishedCampaignController.ts
│   └── routes/                 # Definición de Rutas
│       └── finished-campaign-routes.ts
│
└── docs/                        # Documentación (este directorio)
    ├── INDEX.md
    ├── ARCHITECTURE.md
    ├── API-REFERENCE.md
    ├── BUSINESS-LOGIC.md
    ├── DATA-FLOW.md
    ├── REOPEN-CAMPAIGN.md
    └── CLIENT-COMPONENT.md
```

---

## 🚀 Quick Start

### 1. Obtener Campañas Finalizadas

```typescript
GET /api/finished-campaigns

// Con filtros
GET /api/finished-campaigns?zona=Buenos+Aires&marca=Fiat&includeStats=true
```

### 2. Obtener Campaña Específica

```typescript
GET /api/finished-campaigns/:id
```

### 3. Verificar si Puede Reabrirse

```typescript
GET /api/finished-campaigns/:id/can-reopen
```

### 4. Reabrir Campaña

```typescript
POST /api/finished-campaigns/:id/reopen
```

---

## 📊 Diferencias con Campañas Pendientes

| Característica | Campañas Finalizadas | Campañas Pendientes |
|---------------|---------------------|---------------------|
| **Filtro SQL** | `WHERE fecha_fin IS NOT NULL` | `WHERE fecha_fin IS NULL` |
| **Estado** | Finalizada (cerrada) | Activa (abierta) |
| **Inversión Pendiente** | Siempre 0 | Calculada dinámicamente |
| **Reapertura** | Disponible con validación | No aplica |
| **Ordenamiento por defecto** | Por fecha de cierre (desc) | Por fecha de inicio |
| **Enriquecimiento** | Usa FinishedCampaignEnrichmentService | Usa UpdateEnviadosService |
| **Datos Base** | Misma lógica centralizada (campaign-counting-utils.ts) | |

---

## 🔗 Dependencias Clave

- **Base de Datos**: PostgreSQL vía Drizzle ORM
- **Tablas**: `campanas_comerciales`, `clientes`, `op_leads_rep`, `op_lead`
- **Servicios Compartidos**: `campaign-counting-utils.ts`, `multi-brand-utils.ts`
- **Storage**: Sistema de storage centralizado

---

## 📝 Convenciones

- **Nombres de archivos**: PascalCase para clases, kebab-case para rutas
- **Logging**: Emojis para identificar contexto (🔍 búsqueda, ✅ éxito, ❌ error, 🔄 actualización)
- **Manejo de errores**: Try-catch en todos los use cases y controllers
- **Async/Await**: Preferido sobre callbacks y promesas encadenadas

---

## 🧪 Testing

```bash
# Ejecutar tests del módulo
npm test -- finished-campaigns

# Tests E2E específicos
npm run test:e2e -- finished-campaigns
```

---

## 🛠️ Mantenimiento

### Agregar Nuevo Filtro

1. Actualizar `FinishedCampaignFilters` en `domain/entities/FinishedCampaign.ts`
2. Implementar lógica en `PostgresFinishedCampaignRepository.findAllFinished()`
3. Actualizar controller para parsear query param
4. Actualizar frontend en `campanas-finalizadas.tsx`

### Agregar Nueva Métrica

1. Actualizar `FinishedCampaign` interface en `domain/entities/`
2. Implementar cálculo en `FinishedCampaignEnrichmentService`
3. Actualizar mapeo en repository si es campo de BD
4. Actualizar UI en componente React

---

## 📞 Soporte

Para preguntas o issues relacionados con este módulo:

1. Revisar documentación en este directorio
2. Consultar logs del servidor con prefix `[FinishedCampaign*]`
3. Verificar queries SQL en logs de desarrollo

---

## 📅 Última Actualización

- **Fecha**: 2025-01-09
- **Versión**: 2.0.0
- **Autor**: Sistema de Documentación Automática
- **Cambios Principales**:
  - Refactorización a arquitectura hexagonal
  - Integración con campaign-counting-utils centralizado
  - Enriquecimiento consistente con campañas pendientes
  - Sistema de validación de reapertura multimarca

---

## 🔄 Próximos Pasos

Explora la documentación detallada en los archivos listados arriba para entender en profundidad cada aspecto del módulo.
