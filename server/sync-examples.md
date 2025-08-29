# Servicio de Sincronización Refactorizado - Ejemplos de Uso

## Descripción General

El servicio de sincronización ha sido completamente refactorizado y optimizado (Agosto 2025). La arquitectura limpia incluye:

- **SyncService centralizado**: Maneja toda la lógica de sincronización
- **Sistema unificado**: Solo endpoints `/api/sync/*` (endpoints duplicados eliminados)
- **Código optimizado**: Métodos redundantes consolidados, imports sin uso eliminados
- **Separación de responsabilidades**: Lógica reutilizable en distintos contextos
- **Estado y monitoreo**: Tracking del estado de sincronización

## Endpoints Disponibles (Sistema Limpio)

> **Nota**: Tras la limpieza del 29/08/2025, solo los endpoints `/api/sync/*` están activos. Endpoints duplicados han sido eliminados.

### 1. Sincronización Manual Completa
```bash
POST /api/sync/full
# Sincroniza todas las hojas de Google Sheets con todas las opciones habilitadas
```

**Parámetros de query opcionales:**
- `forceFullSync=true|false`: Forzar sincronización completa
- `includeDashboard=true|false`: Actualizar dashboard después
- `includeMetrics=true|false`: Actualizar métricas después
- `sheets=Fiat,Peugeot`: Sincronizar solo hojas específicas

**Ejemplo:**
```bash
curl -X POST "http://localhost:5000/api/sync/full?sheets=Fiat,Peugeot&includeDashboard=false"
```

### 2. Sincronización Incremental
```bash
POST /api/sync/incremental
# Sincroniza solo los datos nuevos desde la última sincronización
```

**Ejemplo:**
```bash
curl -X POST "http://localhost:5000/api/sync/incremental?includeDashboard=true"
```

### 3. Estado de Sincronización
```bash
GET /api/sync/status
# Obtiene el estado actual del servicio de sincronización
```

**Respuesta ejemplo:**
```json
{
  "status": "idle",
  "lastSyncTime": "2025-08-18T13:25:26.759Z",
  "uptimeMs": 45000,
  "uptimeFormatted": "45s"
}
```

### 4. Sincronización por Hojas Específicas
```bash
POST /api/sync/sheets/:sheetNames
# Sincroniza solo las hojas especificadas (separadas por comas)
```

**Ejemplo:**
```bash
curl -X POST "http://localhost:5000/api/sync/sheets/Fiat,Peugeot"
```

## Casos de Uso en el CRM

### 1. Sincronización Programada
```typescript
import { syncService } from './sync-service';

// Ejecutar sincronización incremental cada hora
setInterval(async () => {
  const result = await syncService.executeIncrementalSync({
    includeDashboardUpdate: true,
    includeMetricsUpdate: true
  });
  console.log('Sync result:', result);
}, 60 * 60 * 1000);
```

### 2. Sincronización por Eventos
```typescript
// Sincronizar cuando se agrega un nuevo cliente
async function onNewClient(clientData) {
  // Sincronizar solo la hoja relevante para el nuevo cliente
  const result = await syncService.executeFullSync({
    specificSheets: [clientData.marca],
    includeDashboardUpdate: true
  });
  
  if (result.success) {
    console.log(`Cliente ${clientData.marca} sincronizado: ${result.leadsProcessed} leads`);
  }
}
```

### 3. Monitoreo de Estado
```typescript
// Verificar estado antes de ejecutar operaciones críticas
async function beforeCriticalOperation() {
  const status = syncService.getStatus();
  
  if (status.isRunning) {
    throw new Error('Sincronización en progreso, espere antes de continuar');
  }
  
  // Continuar con operación crítica
}
```

### 4. Integración con Dashboard
```typescript
// Actualizar dashboard después de cambios importantes
async function updateDashboardAfterChanges() {
  const result = await syncService.executeFullSync({
    forceFullSync: false,
    includeDashboardUpdate: true,
    includeMetricsUpdate: true
  });
  
  return result;
}
```

## Beneficios de la Refactorización

### Separación de Responsabilidades
- **SyncService**: Maneja solo la lógica de sincronización
- **Endpoints**: Solo manejan HTTP y validaciones
- **Utilidades**: Funciones específicas exportables

### Reutilización
- El servicio puede usarse desde cualquier parte del sistema
- Múltiples endpoints para diferentes necesidades
- Configuración flexible mediante opciones

### Monitoreo y Estado
- Estado de sincronización en tiempo real
- Métricas de duración y rendimiento
- Tracking de errores detallado

### Escalabilidad
- Fácil agregar nuevos tipos de sincronización
- Estructura preparada para múltiples fuentes de datos
- Configuración granular por contexto

## Sistema Actualizado (Agosto 29, 2025)

### Limpieza y Optimización Completada ✅

**Cambios Realizados:**
- ❌ **Endpoint eliminado**: `/api/sheets/sync` (duplicaba funcionalidad)
- ❌ **Método eliminado**: `getLeadsBySheet()` de GoogleSheetsService (duplicaba `getSheetData()`)
- ❌ **Import eliminado**: `node-cron` sin uso de google-sheets.ts
- ✅ **50+ líneas de código redundante eliminadas**
- ✅ **Sistema streamlined**: Solo endpoints `/api/sync/*` activos
- ✅ **Funcionalidad preservada**: Cero cambios que rompan el sistema

**Sistema Final:**
- **Endpoints Activos**: Solo `/api/sync/*` (refactorizado)
- **Código Limpio**: Sin duplicaciones ni imports sin uso
- **Documentación Actualizada**: Reflejando el sistema actual

## Próximos Pasos Sugeridos

1. **Métricas Avanzadas**: Agregar tracking de performance y errores
2. **Cache Inteligente**: Implementar cache para evitar sincronizaciones innecesarias
3. **Webhooks**: Notificaciones automáticas cuando termine la sincronización
4. **Retry Logic**: Lógica de reintentos para fallos temporales
5. **Batch Processing**: Procesamiento en lotes para grandes volúmenes de datos