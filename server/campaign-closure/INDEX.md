# 📚 Índice de Documentación - Campaign Closure

## Resumen

Este índice proporciona acceso rápido a toda la documentación del módulo de **Campaign Closure** del sistema CRM MADI.

---

## 📖 Documentos Principales

### 1. [README.md](./README.md)
**Punto de Entrada Principal**

- ✅ Descripción general del módulo
- ✅ Características principales
- ✅ Inicio rápido con ejemplos
- ✅ Conceptos clave (leads únicos, asignación cronológica, multi-marca)
- ✅ Estructura de archivos
- ✅ Troubleshooting básico

**Audiencia**: Todos (Desarrolladores, QA, Product Managers)

**Cuándo leer**: Primera vez que trabajas con el módulo

---

### 2. [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md)
**Guía Técnica Completa**

- ✅ Flujo detallado con diagramas paso a paso
- ✅ Explicación de filtros de leads
- ✅ Modo automático vs manual (multi-marca)
- ✅ Proceso de asignación optimizado
- ✅ Casos especiales y edge cases
- ✅ Errores comunes y soluciones
- ✅ Queries SQL clave
- ✅ Glosario técnico

**Audiencia**: Desarrolladores Backend, IA, Tech Leads

**Cuándo leer**: Para entender el flujo completo del sistema

---

### 3. [ARCHITECTURE.md](./ARCHITECTURE.md)
**Arquitectura y Patrones**

- ✅ Clean Architecture explicada en detalle
- ✅ Capas: Presentation, Application, Domain, Infrastructure
- ✅ Patrones de diseño (Repository, Factory, Strategy, Observer, DTO)
- ✅ Principios SOLID aplicados
- ✅ Dependency Inversion
- ✅ Diagrama de flujo de datos completo
- ✅ Cómo extender el sistema
- ✅ Decisiones de diseño y trade-offs

**Audiencia**: Arquitectos de Software, Desarrolladores Senior

**Cuándo leer**: Para entender decisiones de diseño y cómo agregar nuevas funcionalidades

---

### 4. [API.md](./API.md)
**Referencia Completa de API**

- ✅ Todos los endpoints HTTP documentados
- ✅ Request/Response con ejemplos
- ✅ Query parameters y body schemas
- ✅ Códigos de estado HTTP
- ✅ Side effects de cada endpoint
- ✅ Eventos WebSocket
- ✅ Ejemplos con cURL
- ✅ Manejo de errores

**Endpoints Principales**:
- `POST /execute` - Ejecutar cierre
- `POST /validate` - Validar sin ejecutar
- `GET /availability/:id` - Verificar disponibilidad
- `POST /reopen/:id` - Reabrir campaña
- `POST /multi-brand/execute/:id` - Cierre multi-marca

**Audiencia**: Desarrolladores Backend, Frontend, QA

**Cuándo leer**: Como referencia durante desarrollo o testing

---

### 5. [FRONTEND.md](./FRONTEND.md)
**Componentes y Hooks React**

- ✅ Componente `CampaignClosureProgress`
- ✅ Hook `useCampaignClosureProgress`
- ✅ Integración con WebSocket
- ✅ Ejemplos de uso completos
- ✅ Props, eventos y callbacks
- ✅ Personalización de estilos
- ✅ Testing frontend
- ✅ Debugging tips

**Audiencia**: Desarrolladores Frontend

**Cuándo leer**: Para integrar el cierre de campañas en la UI

---

## 🗂️ Guía de Lectura por Rol

### Para Nuevos Desarrolladores

1. **Día 1**: Lee [README.md](./README.md) para visión general
2. **Día 2**: Estudia [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md)
3. **Día 3**: Revisa [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Día 4+**: Consulta [API.md](./API.md) y [FRONTEND.md](./FRONTEND.md) según necesites

### Para Backend Developers

1. [README.md](./README.md) - Conceptos básicos
2. [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md) - Flujo técnico
3. [API.md](./API.md) - Endpoints
4. [ARCHITECTURE.md](./ARCHITECTURE.md) - Si vas a modificar código

### Para Frontend Developers

1. [README.md](./README.md) - Conceptos básicos
2. [FRONTEND.md](./FRONTEND.md) - Componentes y hooks
3. [API.md](./API.md) - Endpoints para llamar desde el frontend

### Para Arquitectos / Tech Leads

1. [ARCHITECTURE.md](./ARCHITECTURE.md) - Patrones y decisiones de diseño
2. [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md) - Lógica de negocio
3. [README.md](./README.md) - Overview general

### Para QA / Testers

1. [README.md](./README.md) - Qué hace el sistema
2. [API.md](./API.md) - Endpoints y ejemplos de testing
3. [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md) - Errores comunes

---

## 🎯 Búsqueda Rápida por Tema

### Conceptos Fundamentales

| Tema | Documento | Sección |
|------|-----------|---------|
| ¿Qué es un lead único? | [README.md](./README.md#1-leads-únicos-vs-duplicados) | Conceptos Clave |
| Asignación cronológica | [README.md](./README.md#2-asignación-cronológica-pura) | Conceptos Clave |
| Una campaña por cliente | [README.md](./README.md#3-una-campaña-por-cliente) | Conceptos Clave |
| Modo automático vs manual | [README.md](./README.md#4-modo-automático-vs-manual-multi-marca) | Conceptos Clave |

### Flujos Técnicos

| Tema | Documento | Sección |
|------|-----------|---------|
| Flujo completo de cierre | [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#flujo-principal-de-cierre) | Líneas 97-192 |
| Filtros de leads | [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#filtros-de-leads) | Líneas 240-347 |
| Asignación en lotes | [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#asignación-de-leads) | Líneas 454-648 |
| Multi-marca | [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#multi-marca-automático-vs-manual) | Líneas 350-452 |

### Arquitectura

| Tema | Documento | Sección |
|------|-----------|---------|
| Clean Architecture | [ARCHITECTURE.md](./ARCHITECTURE.md#-capas-de-la-arquitectura) | Líneas 9-40 |
| Patrones de diseño | [ARCHITECTURE.md](./ARCHITECTURE.md#-patrones-de-diseño-utilizados) | Líneas 280-410 |
| Principios SOLID | [ARCHITECTURE.md](./ARCHITECTURE.md#-principios-solid-aplicados) | Líneas 450-510 |
| Dependency Injection | [ARCHITECTURE.md](./ARCHITECTURE.md#4-infrastructure-layer) | Líneas 210-250 |

### API Reference

| Tema | Documento | Sección |
|------|-----------|---------|
| Ejecutar cierre | [API.md](./API.md#post-execute) | POST /execute |
| Validar sin ejecutar | [API.md](./API.md#post-validate) | POST /validate |
| Verificar disponibilidad | [API.md](./API.md#get-availabilityid) | GET /availability/:id |
| Reabrir campaña | [API.md](./API.md#post-reopenid) | POST /reopen/:id |
| Cierre multi-marca | [API.md](./API.md#post-multi-brandexecuteid) | POST /multi-brand/execute/:id |
| WebSocket events | [API.md](./API.md#-websocket-events) | Eventos |

### Frontend

| Tema | Documento | Sección |
|------|-----------|---------|
| Componente de progreso | [FRONTEND.md](./FRONTEND.md#campaignclosureprogress) | Líneas 14-180 |
| Hook WebSocket | [FRONTEND.md](./FRONTEND.md#usecampaignclosureprogress) | Líneas 185-340 |
| Integración completa | [FRONTEND.md](./FRONTEND.md#-integración-con-backend) | Líneas 345-480 |
| Estilos y personalización | [FRONTEND.md](./FRONTEND.md#-estilos-y-personalización) | Líneas 485-530 |

### Troubleshooting

| Tema | Documento | Sección |
|------|-----------|---------|
| "No hay leads disponibles" | [README.md](./README.md#problema-no-hay-leads-disponibles-pero-dashboard-muestra-duplicados) | Troubleshooting |
| Porcentajes no se respetan | [README.md](./README.md#problema-porcentajes-multi-marca-no-se-respetan) | Troubleshooting |
| Timeout en asignación | [README.md](./README.md#problema-timeout-en-asignación) | Troubleshooting |
| Errores comunes completos | [CIERRE_CAMPANAS_GUIA_COMPLETA.md](./CIERRE_CAMPANAS_GUIA_COMPLETA.md#errores-comunes-y-soluciones) | Líneas 987-1065 |

---

## 📊 Estadísticas de Documentación

| Documento | Líneas | Palabras aprox. | Tiempo de lectura |
|-----------|--------|-----------------|-------------------|
| README.md | ~400 | 3,500 | 15 min |
| CIERRE_CAMPANAS_GUIA_COMPLETA.md | ~1,350 | 12,000 | 45 min |
| ARCHITECTURE.md | ~700 | 6,500 | 30 min |
| API.md | ~950 | 8,000 | 35 min |
| FRONTEND.md | ~600 | 5,000 | 25 min |
| **TOTAL** | **~4,000** | **~35,000** | **~2.5 horas** |

---

## 🔍 Búsqueda de Archivos de Código

### Archivos Principales por Capa

#### Domain Layer (Lógica de Negocio)

```
domain/
├── services/
│   ├── CampaignProcessor.ts          ⭐ ARCHIVO PRINCIPAL
│   └── LeadAssigner.ts               Multi-marca
├── entities/
│   ├── CampaignClosure.ts            Entidad campaña
│   └── ClosureResult.ts              Resultado
└── interfaces/
    ├── ICampaignRepository.ts        Interface campañas
    └── ILeadRepository.ts            Interface leads
```

**Documentado en**: [ARCHITECTURE.md](./ARCHITECTURE.md#3-domain-layer)

#### Application Layer (Casos de Uso)

```
application/
├── usecases/
│   ├── CampaignClosureUseCase.ts
│   └── MultiBrandCampaignClosureUseCase.ts
└── dto/
    └── ClosureOptions.ts
```

**Documentado en**: [ARCHITECTURE.md](./ARCHITECTURE.md#2-application-layer)

#### Infrastructure Layer (Acceso a Datos)

```
infrastructure/
├── repositories/
│   ├── PostgresCampaignRepository.ts
│   └── PostgresLeadRepository.ts     ⭐ ASIGNACIÓN DE LEADS
└── factories/
    └── ClosureFactory.ts
```

**Documentado en**: [ARCHITECTURE.md](./ARCHITECTURE.md#4-infrastructure-layer)

#### Presentation Layer (HTTP/WebSocket)

```
presentation/
├── controllers/
│   ├── CampaignClosureController.ts  ⭐ CONTROLLER PRINCIPAL
│   ├── MultiBrandCampaignClosureController.ts
│   ├── CampaignAvailabilityController.ts
│   └── CampaignReopenController.ts
└── routes/
    └── campaign-closure-routes.ts
```

**Documentado en**: [API.md](./API.md)

#### Frontend (React)

```
client/src/
├── components/ui/
│   └── campaign-closure-progress.tsx
└── hooks/
    └── use-campaign-closure-progress.tsx
```

**Documentado en**: [FRONTEND.md](./FRONTEND.md)

---

## 🚀 Quick Start Guides

### Para Ejecutar un Cierre

```bash
# 1. Verificar disponibilidad
curl "http://localhost:5000/api/campaign-closure/availability/38"

# 2. Ejecutar cierre
curl -X POST "http://localhost:5000/api/campaign-closure/execute" \
  -H "Content-Type: application/json" \
  -d '{"clientName": "red finance", "campaignNumber": "1"}'
```

**Ver más**: [README.md](./README.md#-inicio-rápido)

### Para Integrar en Frontend

```typescript
import { CampaignClosureProgress } from '@/components/ui/campaign-closure-progress';

function MyComponent() {
  const [campaignKey, setCampaignKey] = useState<string>();

  return (
    <CampaignClosureProgress
      campaignKey={campaignKey}
      onComplete={() => console.log('Done!')}
    />
  );
}
```

**Ver más**: [FRONTEND.md](./FRONTEND.md#ejemplo-de-uso)

### Para Testear

```bash
# Test completo
cd crm-madi
npx playwright test e2e/campaign-closure-ux.spec.ts
```

**Ver más**: [README.md](./README.md#-testing)

---

## 📞 Soporte y Contacto

- **GitHub Issues**: Reportar bugs o pedir nuevas funcionalidades
- **Slack Channel**: #crm-support
- **Email**: dev@crm-madi.com

---

## 📝 Changelog

### v1.1.0 (2025-01-15)
- ✅ Suite completa de documentación
- ✅ README.md como punto de entrada
- ✅ ARCHITECTURE.md con Clean Architecture
- ✅ API.md con todos los endpoints
- ✅ FRONTEND.md con componentes React
- ✅ INDEX.md (este documento)
- ✅ Referencias cruzadas entre documentos

### v1.0.0 (2025-10-30)
- ✅ CIERRE_CAMPANAS_GUIA_COMPLETA.md inicial

---

## 🎯 Contribuir a la Documentación

Para mantener la documentación actualizada:

1. **Al modificar código**: Actualizar documentos relacionados
2. **Al agregar endpoints**: Actualizar [API.md](./API.md)
3. **Al cambiar arquitectura**: Actualizar [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Al agregar componentes**: Actualizar [FRONTEND.md](./FRONTEND.md)
5. **Nuevos conceptos**: Agregar a [README.md](./README.md)

---

**Última actualización**: 2025-01-15
**Mantenido por**: Equipo CRM MADI
