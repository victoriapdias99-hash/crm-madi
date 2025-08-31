# Sistema de Sincronización Inteligente

## Overview
Sistema único de sincronización que conecta Google Sheets con PostgreSQL usando detección inteligente de duplicados y procesamiento secuencial por marcas.

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
  "validateData": "true"              // Validar datos (true por defecto)
}
```

**Ejemplos:**
```bash
# Sincronización completa (todas las marcas)
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{}'

# Sincronización específica de FIAT
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{"sheets": "Fiat"}'

# Múltiples marcas
curl -X POST http://localhost:5000/api/sync/smart -H "Content-Type: application/json" -d '{"sheets": "Fiat,Peugeot,Toyota"}'
```

## Endpoints de Información

### GET /api/sync/status
Obtiene el estado actual de sincronización.

### GET /api/sync/sheets/available
Obtiene lista de hojas disponibles en Google Sheets.

## Características Clave

- ✅ **Procesamiento Secuencial**: Una marca después de otra para evitar límites de API
- ✅ **Detección de Duplicados**: Por teléfono, MetaLeadId y número de fila de Google Sheets
- ✅ **Validación Mejorada**: Acepta filas con al menos un campo válido (no todos los campos)
- ✅ **Manejo de Datos Vacíos**: Asigna "S/D" a campos vacíos en lugar de rechazar filas
- ✅ **Respeto de parámetros específicos**: `specificSheets` funciona consistentemente
- ✅ **Control de Estado**: Seguimiento en tiempo real del progreso

## Estado del Sistema
Solo la versión **smart** está activa. Todas las implementaciones de prueba han sido eliminadas.