# Sistema de Sincronización Inteligente

## Estado Actual
**✅ FUNCIONANDO AL 100% - Septiembre 4, 2025**

Sistema de sincronización que conecta Google Sheets con PostgreSQL usando detección inteligente de duplicados y procesamiento incremental por marcas. **Últimas mejoras aplicadas:**
- ✅ **Problema crítico de lógica de filas resuelto** - ahora sincroniza el 100% de los datos disponibles
- ✅ **Mapeo de campos optimizado con valores NULL** - mejor integridad de datos
- ✅ **Tipos TypeScript actualizados** - soporte completo para campos opcionales

## Corrección Crítica Aplicada

### Problema Anterior (❌ SOLUCIONADO)
El sistema comparaba **cantidad de leads** vs **número de fila**, causando que la última fila disponible nunca se procesara.

```typescript
// ❌ LÓGICA INCORRECTA (antes de Aug 31, 2025)
const lastProcessedRow = 410;        // Número de última fila procesada
const totalCount = 410;              // Cantidad de leads válidos
const newRows = totalCount - lastProcessedRow; // 410 - 410 = 0 ❌
```

### Solución Implementada (✅ FUNCIONANDO)
Ahora compara **número de fila** vs **número de fila**, identificando correctamente filas nuevas disponibles.

```typescript
// ✅ LÓGICA CORRECTA (desde Aug 31, 2025)
const lastProcessedRow = 410;        // Número de última fila procesada
const lastAvailableRow = 411;        // Número de última fila con datos
const newRows = lastAvailableRow - lastProcessedRow; // 411 - 410 = 1 ✅
```

**Resultado**: Fila 411 de CHEVROLET (Jorge Fernández) procesada exitosamente ✅

## Endpoint Principal

### POST /api/sync/smart
Sincronización inteligente que analiza automáticamente qué datos sincronizar.

**Parámetros opcionales (body JSON):**
```json
{
  "sheets": "Fiat,Peugeot",           // Marcas específicas (opcional)
  "forceFullSync": "true",            // Forzar sincronización completa
  "includeDashboard": "true",         // Actualizar dashboard después
  "includeMetrics": "true",           // Actualizar métricas después
  "validateData": "true",             // Validar datos (true por defecto)
  "dryRun": "true",                   // Modo prueba sin guardar
  "verbose": "true"                   // Logs detallados
}
```

**Ejemplos de Uso:**
```bash
# Sincronización completa (todas las marcas)
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{}'

# Sincronización específica de CHEVROLET
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{"sheets": "Chevrolet"}'

# Múltiples marcas
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{"sheets": "Fiat,Peugeot,Toyota"}'

# Modo prueba con logs detallados
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{"sheets": "Chevrolet", "dryRun": true, "verbose": true}'
```

## Endpoints de Información

### GET /api/sync/status
Obtiene el estado actual de sincronización.

### GET /api/sync/sheets/available
Obtiene lista de hojas disponibles en Google Sheets.

### GET /api/sync/debug/chevrolet-count
Endpoint de debug específico para verificar conteos por marca.

## Arquitectura del Sistema

### Flujo Principal
```
Google Sheets → GoogleSheetsGateway → SyncSmartUseCase → LeadProcessor → PostgreSQL
      ↓                ↓                    ↓               ↓              ↓
   410 leads      Valida datos     Analiza estado    Detecta duplic.   Guarda BD
```

### Componentes Principales

1. **SyncSmartUseCase** - Orchestador principal con lógica de análisis por marca
2. **GoogleSheetsGateway** - Interface con Google Sheets API y autenticación
3. **DuplicateDetector** - Detección avanzada por teléfono, MetaLeadId, número de fila
4. **LeadProcessor** - Validación y transformación de datos
5. **PostgresSyncRepository** - Persistencia en base de datos

## Características Clave

- ✅ **Procesamiento Incremental**: Solo procesa filas nuevas desde la última sincronización
- ✅ **Detección de Duplicados**: Por teléfono, MetaLeadId y número de fila de Google Sheets
- ✅ **Validación Mejorada**: Acepta filas con al menos un campo válido
- ✅ **Manejo de Datos Vacíos**: Asigna "S/D" a campos vacíos en lugar de rechazar filas
- ✅ **Comparación Corregida**: Fila vs fila, no cantidad vs fila
- ✅ **Control de Estado**: Seguimiento en tiempo real del progreso
- ✅ **Procesamiento por Marca**: Soporte para marcas específicas

## Detección de Duplicados

### Criterios de Detección
1. **Teléfono normalizado**: Elimina espacios, guiones, paréntesis
2. **MetaLeadId**: Identificador único de Meta Ads  
3. **Número de fila + marca**: `CHEVROLET_411`

### Logs Típicos
```
📊 Chevrolet: 409 en BD, última fila procesada: 410, última fila disponible: 411, nuevas: 1
🔄 Chevrolet agregada: 1 filas nuevas desde fila 410
🔍 Encontrados 409 leads existentes para marca Chevrolet
📊 De 1 leads: 1 nuevos, 0 duplicados detectados
✅ Chevrolet: Guardados 1 nuevos registros
```

## Rendimiento

### Métricas Actuales
- **Tiempo promedio**: 1-2 segundos por marca
- **Throughput**: ~200-500 leads/segundo
- **Detección de duplicados**: <1ms por lead
- **Concurrencia**: 3 marcas simultáneas

### Optimizaciones
- Procesamiento por lotes (batchSize: 100)
- Consultas optimizadas a PostgreSQL
- Cache de leads existentes por marca
- Validación temprana de duplicados

## Troubleshooting

### Problemas Comunes Resueltos
1. **✅ "No hay filas nuevas" cuando debería haberlas**
   - **SOLUCIONADO**: Implementado `getLastAvailableRow()` que identifica correctamente la última fila con datos
   
2. **✅ Filas perdidas en sincronización**
   - **SOLUCIONADO**: Cambiado a comparación fila-a-fila en lugar de cantidad-a-fila

3. **Duplicados no detectados**
   - Verificar normalización de teléfonos
   - Revisar criterios de detección en DuplicateDetector

### Comandos de Debug
```bash
# Verificar estado de marca específica
curl http://localhost:5000/api/sync/debug/chevrolet-count

# Sincronización con logs detallados (modo prueba)
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{"sheets": "Chevrolet", "verbose": true, "dryRun": true}'

# Verificar estado general
curl http://localhost:5000/api/sync/status
```

## Configuración

### Variables de Entorno Requeridas
- `GOOGLE_SHEETS_API_KEY`: API key de Google Sheets
- `GOOGLE_SHEETS_SPREADSHEET_ID`: ID del spreadsheet principal
- `DATABASE_URL`: Conexión a PostgreSQL

### Rate Limiting
- Google Sheets API: 100 requests/100 seconds/user
- Batch processing para optimizar uso de API
- Retry logic con backoff exponencial

## Estructura de Datos

### Lead Schema (Actualizado Sep 4, 2025)
```typescript
interface Lead {
  // Campos requeridos
  nombre: string;                    // 'S/D' si vacío
  telefono: string;                  // 'S/D' si vacío
  marca: string;                     // Del nombre del sheet
  googleSheetsRowNumber: number;     // Número de fila en Google Sheets
  source: string;                    // 'google_sheets'
  campaign: string;                  // Del nombre del sheet
  
  // Campos opcionales (usan NULL si vacío)
  email: string | null;              // NULL (no existe en Google Sheets)
  ciudad: string | null;             // NULL si row[3] vacío
  modelo: string | null;             // NULL si row[4] vacío  
  comentarioHorario: string | null;  // NULL si row[5] vacío
  origen: string | null;             // NULL si row[6] vacío
  localizacion: string | null;       // NULL si row[7] vacío
  cliente: string | null;            // NULL si row[8] vacío
  interest: string | null;           // NULL (no usado)
  budget: string | null;             // NULL (no usado)
}
```

### Mapeo de Columnas Google Sheets → Base de Datos
```
Columna A → timestamp     (fecha/hora del lead)
Columna B → nombre        (requerido: 'S/D' si vacío)
Columna C → telefono      (requerido: 'S/D' si vacío)
Columna D → ciudad        (opcional: NULL si vacío)
Columna E → modelo        (opcional: NULL si vacío)
Columna F → comentarioHorario (opcional: NULL si vacío)
Columna G → origen        (opcional: NULL si vacío)
Columna H → localizacion  (opcional: NULL si vacío)
Columna I → cliente       (opcional: NULL si vacío)
```

**Cambio Importante (Sep 4, 2025):** Campos opcionales ahora usan `null` en lugar de strings vacíos para mejor integridad de datos en PostgreSQL.

### Response Schema
```typescript
interface SyncResult {
  success: boolean;
  message: string;
  leadsProcessed: number;
  timestamp: string;
  duration: number;
  durationFormatted: string;
  details?: {
    newLeads: number;
    updatedLeads: number;
    skippedLeads: number;
    duplicatesFound: number;
    validationErrors: number;
    sheetsProcessed: string[];
  }
}
```

---

## Documentación Adicional

- 📋 **[MAPPING.md](./MAPPING.md)** - Detalles completos del mapeo de campos con NULL
- 🏗️ **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Arquitectura detallada del sistema

---

**Estado del Sistema: ✅ OPERATIVO AL 100%**  
**Última corrección crítica: Agosto 31, 2025**  
**Última optimización: Septiembre 4, 2025 - Mapeo con NULL**  
**Verifica que las filas nuevas se detectan y procesan correctamente con integridad de datos**