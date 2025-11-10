# 📚 Campaign Reset - Índice de Documentación

## Bienvenido

Este índice te guiará a través de toda la documentación disponible del módulo **Campaign Reset**.

---

## 🚀 Inicio Rápido

¿Primera vez usando el módulo? Empieza aquí:

1. **[README.md](./README.md)** - Vista general y ejemplos de uso
2. **[test-api.sh](./test-api.sh)** - Script para probar la API
3. **[MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)** - Si vienes de scripts CLI

---

## 📖 Documentación por Audiencia

### 👨‍💻 Para Desarrolladores

| Documento | ¿Cuándo usarlo? | Tiempo de lectura |
|-----------|-----------------|-------------------|
| [README.md](./README.md) | Entender qué hace el módulo y cómo usarlo | 10 minutos |
| [TECHNICAL-ANALYSIS.md](./TECHNICAL-ANALYSIS.md) | Entender cómo funciona internamente el código | 45-60 minutos |
| [PERFORMANCE-GUIDE.md](./PERFORMANCE-GUIDE.md) | Optimizar el rendimiento | 30 minutos |

### 🗄️ Para Database Admins

| Documento | ¿Cuándo usarlo? | Tiempo de lectura |
|-----------|-----------------|-------------------|
| [SQL-OPERATIONS.md](./SQL-OPERATIONS.md) | Ver qué queries se ejecutan y optimizarlas | 30 minutos |
| [PERFORMANCE-GUIDE.md](./PERFORMANCE-GUIDE.md) - Sección Índices | Optimizar índices de BD | 15 minutos |

### 🔄 Para Usuarios Migrando

| Documento | ¿Cuándo usarlo? | Tiempo de lectura |
|-----------|-----------------|-------------------|
| [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) | Migrar de scripts CLI a API REST | 20 minutos |
| [README.md](./README.md) - Sección API | Entender los nuevos endpoints | 10 minutos |

### 🎯 Para Product/Project Managers

| Documento | ¿Cuándo usarlo? | Tiempo de lectura |
|-----------|-----------------|-------------------|
| [README.md](./README.md) - Resumen | Entender qué hace el módulo | 5 minutos |
| [TECHNICAL-ANALYSIS.md](./TECHNICAL-ANALYSIS.md) - Sección 1 | Ver arquitectura y métricas | 10 minutos |

---

## 📑 Documentos Detallados

### 1. README.md
**[Abrir README.md](./README.md)**

**Contenido:**
- Estructura del módulo
- API Endpoints (REST)
- Arquitectura Clean Architecture
- Ejemplos de uso
- Testing básico
- Métricas de rendimiento

**Audiencia:** Todos

---

### 2. TECHNICAL-ANALYSIS.md
**[Abrir TECHNICAL-ANALYSIS.md](./TECHNICAL-ANALYSIS.md)**

**Contenido:**
- Análisis línea por línea del código
- Arquitectura de 4 capas detallada
- Flujos de ejecución
- Modelos de datos y relaciones
- Manejo de errores
- Consideraciones de seguridad
- Áreas de mejora identificadas

**Audiencia:** Desarrolladores, Arquitectos

**Longitud:** ~12,000 palabras

---

### 3. SQL-OPERATIONS.md
**[Abrir SQL-OPERATIONS.md](./SQL-OPERATIONS.md)**

**Contenido:**
- Todas las queries SQL generadas
- Análisis de performance por query
- Volumen de queries por operación
- Índices utilizados
- EXPLAIN ANALYZE de queries críticas
- Optimizaciones SQL propuestas

**Audiencia:** Desarrolladores, DBAs

**Longitud:** ~8,000 palabras

---

### 4. PERFORMANCE-GUIDE.md
**[Abrir PERFORMANCE-GUIDE.md](./PERFORMANCE-GUIDE.md)**

**Contenido:**
- Optimizaciones implementables con código
- Plan de migración paso a paso
- Scripts de testing de performance
- Benchmarks y métricas
- Configuración de monitoreo
- Checklist de implementación

**Audiencia:** Desarrolladores, DevOps

**Longitud:** ~7,000 palabras

---

### 5. MIGRATION-GUIDE.md
**[Abrir MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)**

**Contenido:**
- Comparación scripts CLI vs API REST
- Tabla de equivalencias
- Ventajas del nuevo sistema
- Plan de migración
- Troubleshooting

**Audiencia:** Usuarios de scripts CLI

**Longitud:** ~3,000 palabras

---

### 6. test-api.sh
**[Abrir test-api.sh](./test-api.sh)**

**Contenido:**
- Script Bash para testing
- Ejemplos de curl
- Tests de dry-run

**Audiencia:** Desarrolladores, QA

---

## 🎯 Guías de Lectura por Objetivo

### Objetivo: "Quiero usar el módulo"
```
1. README.md (sección API Endpoints)
2. test-api.sh (para ver ejemplos)
```

### Objetivo: "Quiero entender cómo funciona"
```
1. README.md (estructura y arquitectura)
2. TECHNICAL-ANALYSIS.md (análisis completo)
```

### Objetivo: "Quiero optimizar el rendimiento"
```
1. SQL-OPERATIONS.md (queries actuales)
2. PERFORMANCE-GUIDE.md (optimizaciones)
3. Implementar optimizaciones
4. PERFORMANCE-GUIDE.md (testing)
```

### Objetivo: "Quiero migrar de scripts CLI"
```
1. MIGRATION-GUIDE.md (guía completa)
2. README.md (API Endpoints)
3. test-api.sh (probar)
```

### Objetivo: "Quiero mantener el código"
```
1. TECHNICAL-ANALYSIS.md (entender código)
2. README.md (estructura)
3. SQL-OPERATIONS.md (queries)
```

### Objetivo: "Necesito resolver un problema"
```
1. README.md (troubleshooting básico)
2. MIGRATION-GUIDE.md (troubleshooting avanzado)
3. TECHNICAL-ANALYSIS.md (manejo de errores)
```

---

## 📊 Métricas de la Documentación

| Documento | Palabras | Secciones | Ejemplos de código |
|-----------|----------|-----------|-------------------|
| README.md | ~3,500 | 12 | 15+ |
| TECHNICAL-ANALYSIS.md | ~12,000 | 12 | 50+ |
| SQL-OPERATIONS.md | ~8,000 | 7 | 40+ |
| PERFORMANCE-GUIDE.md | ~7,000 | 7 | 30+ |
| MIGRATION-GUIDE.md | ~3,000 | 9 | 20+ |

**Total:** ~33,500 palabras de documentación

---

## 🔍 Búsqueda Rápida

### Por Concepto

| Concepto | Documento Principal | Sección |
|----------|-------------------|---------|
| **Clean Architecture** | TECHNICAL-ANALYSIS.md | Sección 2 |
| **API Endpoints** | README.md | Sección "API Endpoints" |
| **Bulk Operations** | PERFORMANCE-GUIDE.md | Sección 3.1 |
| **Transacciones** | PERFORMANCE-GUIDE.md | Sección 3.3 |
| **Queries SQL** | SQL-OPERATIONS.md | Sección 2 |
| **Índices** | SQL-OPERATIONS.md | Sección 4 |
| **Optimizaciones** | PERFORMANCE-GUIDE.md | Todo el documento |
| **Migración CLI → REST** | MIGRATION-GUIDE.md | Todo el documento |

### Por Archivo de Código

| Archivo | Análisis en | Ubicación |
|---------|------------|-----------|
| `ResetCampaignUseCase.ts` | TECHNICAL-ANALYSIS.md | Sección 3.2 |
| `BatchResetUseCase.ts` | TECHNICAL-ANALYSIS.md | Sección 3.2 |
| `PostgresCampaignResetRepository.ts` | TECHNICAL-ANALYSIS.md | Sección 3.3 |
| `ResetCampaignController.ts` | TECHNICAL-ANALYSIS.md | Sección 3.4 |
| `campaign-reset-routes.ts` | TECHNICAL-ANALYSIS.md | Sección 3.4 |

### Por Query SQL

| Query | Documento | Sección |
|-------|-----------|---------|
| `getAssignedLeadsCount` | SQL-OPERATIONS.md | Sección 2.1 |
| `clearCampaignLeads` | SQL-OPERATIONS.md | Sección 2.2 |
| `clearCampaignEndDate` | SQL-OPERATIONS.md | Sección 2.3 |
| `getFinishedCampaigns` | SQL-OPERATIONS.md | Sección 2.4 |
| `isCampaignFinished` | SQL-OPERATIONS.md | Sección 2.5 |

---

## 🏗️ Estructura del Directorio

```
campaign-reset/
├── README.md                    # Guía general y API
├── INDEX.md                     # Este archivo
├── TECHNICAL-ANALYSIS.md        # Análisis técnico completo
├── SQL-OPERATIONS.md            # Análisis de queries SQL
├── PERFORMANCE-GUIDE.md         # Guía de optimización
├── MIGRATION-GUIDE.md           # Guía de migración
├── test-api.sh                  # Script de testing
│
├── domain/                      # Capa de Dominio
│   ├── entities/
│   │   └── ResetResult.ts
│   └── interfaces/
│       └── ICampaignResetRepository.ts
│
├── application/                 # Capa de Aplicación
│   ├── dto/
│   │   └── ResetOptions.ts
│   └── usecases/
│       ├── ResetCampaignUseCase.ts
│       └── BatchResetUseCase.ts
│
├── infrastructure/              # Capa de Infraestructura
│   └── repositories/
│       └── PostgresCampaignResetRepository.ts
│
└── presentation/                # Capa de Presentación
    ├── controllers/
    │   ├── ResetCampaignController.ts
    │   └── BatchResetController.ts
    └── routes/
        └── campaign-reset-routes.ts
```

---

## 🆘 ¿Necesitas Ayuda?

### Problemas Comunes

| Problema | Solución |
|----------|----------|
| No puedo acceder a la API | Ver README.md - Sección Testing |
| Queries muy lentas | Ver PERFORMANCE-GUIDE.md |
| Migrando de scripts CLI | Ver MIGRATION-GUIDE.md |
| Error de transacción | Ver TECHNICAL-ANALYSIS.md - Sección 7 |
| No entiendo el código | Ver TECHNICAL-ANALYSIS.md - Análisis línea por línea |

### Contacto

- **Issues**: Reportar en el sistema de tickets
- **Documentación**: Abrir PR con mejoras
- **Preguntas**: Canal de Slack del equipo

---

## 📝 Notas de Versión

- **Versión 1.0.0** (2025-11-09)
  - Documentación inicial completa
  - Análisis técnico detallado
  - Guía de optimización
  - Guía de migración

---

## 🎓 Recursos Adicionales

### Patrones y Principios
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

### Herramientas
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)

### Módulos Relacionados
- [campaign-closure](../campaign-closure/) - Módulo hermano con arquitectura similar

---

**Última actualización:** 2025-11-09
**Autor de la documentación:** Claude Code
