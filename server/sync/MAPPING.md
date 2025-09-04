# Mapeo de Campos con Valores NULL

## Estado Actual
**✅ IMPLEMENTADO - Septiembre 4, 2025**

Sistema de mapeo optimizado que utiliza valores `NULL` para campos vacíos en lugar de strings vacíos, mejorando la integridad de datos en PostgreSQL.

## Problema Resuelto

### ❌ Problema Anterior
El sistema guardaba strings vacíos (`""`) para campos opcionales sin datos:
```sql
SELECT cliente, ciudad, email FROM leads WHERE cliente = '';
-- Resultado: strings vacíos difíciles de distinguir de datos reales
```

### ✅ Solución Implementada
Ahora usa valores `NULL` para campos sin datos:
```sql
SELECT cliente, ciudad, email FROM leads WHERE cliente IS NULL;
-- Resultado: consultas más claras y mejores prácticas de BD
```

## Mapeo Detallado

### Estructura Google Sheets → PostgreSQL

```typescript
// Google Sheets Row Example:
// [timestamp, "Juan Pérez", "5491123456789", "Buenos Aires", "Fiesta", "Mañana", "WhatsApp", "AMBA", "Albens"]
//    A           B              C                D              E         F           G           H        I

const mapeo = {
  // === CAMPOS REQUERIDOS (usan 'S/D' si vacío) ===
  timestamp: row[0] || new Date().toISOString(),     // A - Fecha (generada si vacía)
  nombre: row[1] ? row[1].toString().trim() : 'S/D', // B - Nombre del lead
  telefono: row[2] ? row[2].toString().trim() : 'S/D', // C - Teléfono del lead
  
  // === CAMPOS OPCIONALES (usan NULL si vacío) ===
  email: null,                                       // Email no existe en Google Sheets
  ciudad: row[3] ? row[3].toString().trim() : null,  // D - Ciudad/Localidad
  modelo: row[4] ? row[4].toString().trim() : null,  // E - Modelo del auto
  comentarioHorario: row[5] ? row[5].toString().trim() : null, // F - Horario/Comentarios
  origen: row[6] ? row[6].toString().trim() : null,  // G - Origen del lead
  localizacion: row[7] ? row[7].toString().trim() : null, // H - Localización geográfica
  cliente: row[8] ? row[8].toString().trim() : null, // I - Cliente específico
  
  // === CAMPOS AUTOMÁTICOS ===
  marca: sheetName,                                  // Del nombre del sheet (ej: "Peugeot")
  campaign: sheetName,                               // Del nombre del sheet
  source: 'google_sheets',                           // Origen fijo
  googleSheetsRowNumber: rowIndex,                   // Número de fila para duplicados
  
  // === CAMPOS NO USADOS (NULL) ===
  interest: null,                                    // No usado actualmente
  budget: null,                                      // No usado actualmente
  cost: '0'                                         // Costo fijo por defecto
}
```

## Ejemplos Prácticos

### Caso 1: Fila Completa
```javascript
// Google Sheets Row:
// ["2025-09-04T10:00:00", "María García", "5491198765432", "Córdoba", "308", "Tarde", "Facebook", "Córdoba", "Borussia"]

// Resultado en BD:
{
  timestamp: "2025-09-04T10:00:00",
  nombre: "María García",
  telefono: "5491198765432", 
  email: null,                        // ← NULL (no existe)
  ciudad: "Córdoba",                  // ← String con datos
  modelo: "308",                      // ← String con datos  
  comentarioHorario: "Tarde",         // ← String con datos
  origen: "Facebook",                 // ← String con datos
  localizacion: "Córdoba",            // ← String con datos
  cliente: "Borussia",                // ← String con datos
  marca: "Peugeot",
  campaign: "Peugeot",
  source: "google_sheets"
}
```

### Caso 2: Fila Parcial
```javascript
// Google Sheets Row:
// ["2025-09-04T10:00:00", "Pedro López", "5491156789012", "", "", "", "", "", ""]

// Resultado en BD:
{
  timestamp: "2025-09-04T10:00:00",
  nombre: "Pedro López",
  telefono: "5491156789012",
  email: null,                        // ← NULL (no existe)
  ciudad: null,                       // ← NULL (vacío en sheet)
  modelo: null,                       // ← NULL (vacío en sheet)
  comentarioHorario: null,            // ← NULL (vacío en sheet)
  origen: null,                       // ← NULL (vacío en sheet)
  localizacion: null,                 // ← NULL (vacío en sheet)
  cliente: null,                      // ← NULL (vacío en sheet)
  marca: "Peugeot",
  campaign: "Peugeot",
  source: "google_sheets"
}
```

### Caso 3: Fila Mínima
```javascript
// Google Sheets Row:
// ["", "Ana", "", "", "", "", "", "", ""]

// Resultado en BD:
{
  timestamp: "2025-09-04T22:00:00.000Z", // ← Generada automáticamente
  nombre: "Ana",                          // ← Único dato disponible
  telefono: "S/D",                        // ← 'S/D' (requerido pero vacío)
  email: null,                            // ← NULL (no existe)
  ciudad: null,                           // ← NULL (vacío en sheet)
  modelo: null,                           // ← NULL (vacío en sheet)
  comentarioHorario: null,                // ← NULL (vacío en sheet)
  origen: null,                           // ← NULL (vacío en sheet)
  localizacion: null,                     // ← NULL (vacío en sheet)
  cliente: null,                          // ← NULL (vacío en sheet)
  marca: "Peugeot",
  campaign: "Peugeot",
  source: "google_sheets"
}
```

## Interfaces TypeScript Actualizadas

### RawSheetLead
```typescript
export interface RawSheetLead {
  timestamp: string;
  name: string;
  email: string | null;              // ← Permite NULL
  phone: string;
  city: string | null;               // ← Permite NULL
  interest: string | null;           // ← Permite NULL
  budget: string | null;             // ← Permite NULL
  modelo: string | null;             // ← Permite NULL
  comentarioHorario: string | null;  // ← Permite NULL
  origen: string | null;             // ← Permite NULL
  localizacion: string | null;       // ← Permite NULL
  cliente: string | null;            // ← Permite NULL
  googleSheetsRowNumber?: number;
  source: string;
  campaign: string;
  cost: string;
}
```

### SheetLead
```typescript
interface SheetLead {
  timestamp: string;
  name: string;
  email: string | null;              // ← Permite NULL
  phone: string;
  city: string | null;               // ← Permite NULL
  interest: string | null;           // ← Permite NULL
  budget: string | null;             // ← Permite NULL
  modelo: string | null;             // ← Permite NULL
  comentarioHorario: string | null;  // ← Permite NULL
  origen: string | null;             // ← Permite NULL
  localizacion: string | null;       // ← Permite NULL
  cliente: string | null;            // ← Permite NULL
  googleSheetsRowNumber?: number;
  source: string;
  campaign: string;
  cost: string;
}
```

## Ventajas del Nuevo Sistema

### 🎯 Integridad de Datos
- **NULL vs Vacío**: Diferencia clara entre "sin datos" (NULL) vs "dato vacío" ("")
- **Consultas más precisas**: `WHERE cliente IS NULL` vs `WHERE cliente = ''`
- **Mejores prácticas**: PostgreSQL maneja NULL de forma optimizada

### 🚀 Performance
- **Índices optimizados**: PostgreSQL indexa NULL de forma más eficiente
- **Menos espacio**: NULL ocupa menos espacio que strings vacíos
- **Consultas más rápidas**: Operadores IS NULL/IS NOT NULL son más rápidos

### 🛠️ Mantenimiento
- **Código más limpio**: Lógica clara entre campos obligatorios y opcionales
- **TypeScript mejorado**: Tipos explícitos `string | null`
- **Debugging más fácil**: Distinción visual clara entre NULL y strings

## Validación y Testing

### Consultas de Verificación
```sql
-- Verificar campos NULL correctamente asignados
SELECT 
  COUNT(*) as total_leads,
  COUNT(cliente) as leads_con_cliente,
  COUNT(*) - COUNT(cliente) as leads_sin_cliente
FROM leads 
WHERE marca = 'Peugeot';

-- Verificar tipos de datos
SELECT 
  cliente,
  CASE 
    WHEN cliente IS NULL THEN 'NULL'
    WHEN cliente = '' THEN 'STRING_VACIO'
    ELSE 'CON_DATOS'
  END as tipo_cliente
FROM leads 
LIMIT 10;
```

### Logs de Verificación
```
💾 BEFORE INSERT: lead.cliente="Albens" (string) | lead.normalizedClient="albens" (string)
💾 BEFORE INSERT: lead.cliente=null (null) | lead.normalizedClient=null (null)
```

## Archivos Modificados

### Interfaces
- `server/sync/domain/entities/SyncLead.ts` → RawSheetLead interface
- `server/google-sheets.ts` → SheetLead interface

### Lógica de Mapeo
- `server/sync/infrastructure/gateways/GoogleSheetsGateway.ts`:
  - `mapToRawSheetLeads()` método
  - `parseRowToRawSheetLead()` método

## Migración de Datos Existentes

Los datos existentes en la BD **no requieren migración**. El cambio es hacia adelante:
- ✅ Datos nuevos usan NULL para campos vacíos
- ✅ Datos existentes con strings vacíos siguen funcionando
- ✅ Consultas compatibles con ambos formatos

## Troubleshooting

### Problema: Campo que debería ser NULL aparece como string vacío
```typescript
// ❌ Incorrecto
const ciudad = row[3] || '';

// ✅ Correcto  
const ciudad = row[3] ? row[3].toString().trim() : null;
```

### Problema: Error TypeScript "Type 'null' is not assignable to type 'string'"
```typescript
// ❌ Interface incorrecta
interface Lead {
  cliente: string;  // No permite NULL
}

// ✅ Interface correcta
interface Lead {
  cliente: string | null;  // Permite NULL
}
```

---

**Estado: ✅ IMPLEMENTADO Y FUNCIONANDO**  
**Fecha: Septiembre 4, 2025**  
**Próximo paso: Monitorear integridad de datos en producción**