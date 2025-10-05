# 🚀 Smart-Fast Migration System

Sistema de migración simplificado para Google Sheets → PostgreSQL con **ID estable** basado en teléfono + fecha + marca.

## 📋 Características

- ✅ **ID Estable**: Basado en `teléfono + fecha + marca` (no cambia aunque la fila se mueva)
- ✅ **UPSERT Automático**: Inserta nuevos, actualiza existentes
- ✅ **Preserva metaLeadId**: IDs nunca cambian en actualizaciones
- ✅ **Solo ~200 líneas** vs ~1,700 del sistema anterior
- ✅ **Idempotente**: Ejecutar múltiples veces es seguro
- ✅ **Detecta movimientos**: Identifica cuando filas cambian de posición

## 🏗️ Estructura

```
server/sync-smart-fast/
├── migrate-smart-fast.ts        # Script principal de migración
├── utils/
│   └── generate-stable-id.ts    # Generador de IDs estables
├── api/
│   ├── smart-fast-controller.ts # Controlador API
│   └── smart-fast-routes.ts     # Rutas Express
├── migrations/
│   └── 001-add-stable-constraints.sql  # Constraints DB
└── README.md                     # Esta documentación
```

## 🔑 Formato del ID

```typescript
metaLeadId = `{MARCA}_{YYYYMMDD}_{TELEFONO_8_DIGITOS}_{NANO_6}`

// Ejemplos:
"FIAT_20250104_12347890_a8B9cD"
"CHEVROLET_20250105_99998888_x1Y2z3"
"PEUGEOT_20250106_54915678_f9G0h1"
```

**Componentes:**
- `MARCA`: Marca en uppercase (FIAT, CHEVROLET, etc.)
- `YYYYMMDD`: Fecha compacta (20250104 = 4 de Enero 2025)
- `TELEFONO_8`: Primeros 4 + últimos 4 dígitos del teléfono
- `NANO_6`: 6 caracteres aleatorios (nanoid)

## 🚀 Instalación

### 1. Setup de Base de Datos

```bash
# Ejecutar migración SQL para agregar constraints
npm run sync:setup-db

# O manualmente:
psql $DATABASE_URL -f server/sync-smart-fast/migrations/001-add-stable-constraints.sql
```

Esto crea:
- Constraint único: `(telefono, fecha_creacion, marca)`
- Índices para performance
- Vista `op_lead_row_movements` para monitoreo

### 2. Configurar Variables de Entorno

```bash
# .env
GOOGLE_SHEETS_SPREADSHEET_ID=tu_spreadsheet_id
DATABASE_URL=postgresql://user:pass@host:5432/db
```

## 📦 Uso

### CLI (Línea de Comandos)

```bash
# Ejecutar migración completa
npm run sync:smart-fast
```

**Salida esperada:**
```
🚀 SMART-FAST Migration System
📋 ID Estable: teléfono + fecha + marca

📋 Marcas encontradas: FIAT, CHEVROLET, PEUGEOT

🔄 Procesando: FIAT
   📊 150 filas encontradas
   ✅ Fila 2: Insertado - ID: FIAT_20250104_12347890_a8B9cD
   🔄 Fila 6: Actualizado (antes fila 5) - ID: FIAT_20250103_99998888_x1Y2z3
   ✅ Insertados: 20 | Actualizados: 130 | Movidos: 15

======================================================================
🎉 MIGRACIÓN SMART-FAST COMPLETADA
======================================================================
📊 Total procesado:     450
✅ Nuevos insertados:   80
🔄 Actualizados:        370
⏭️  Omitidos (sin tel): 0
❌ Errores:             0
======================================================================

📋 DETALLE POR MARCA:
----------------------------------------------------------------------
   FIAT                 → 20 nuevos, 130 actualizados (15 movidos)
   CHEVROLET            → 50 nuevos, 150 actualizados (8 movidos)
   PEUGEOT              → 10 nuevos, 90 actualizados (2 movidos)
----------------------------------------------------------------------
```

### API (Endpoints HTTP)

#### Ejecutar Migración

```bash
POST /api/sync/smart-fast

# Response:
{
  "success": true,
  "duration": "15.3s",
  "stats": {
    "totalProcessed": 450,
    "inserted": 80,
    "updated": 370,
    "skipped": 0,
    "errors": 0
  },
  "details": [...]
}
```

#### Obtener Status

```bash
GET /api/sync/smart-fast/status

# Response:
{
  "success": true,
  "stats": {
    "totalLeads": 1250,
    "recentlyUpdated": 450,
    "newToday": 30,
    "byMarca": [
      { "marca": "FIAT", "count": 500, "lastUpdated": "..." }
    ]
  },
  "system": "smart-fast",
  "idFormat": "{MARCA}_{YYYYMMDD}_{TELEFONO}_{NANO}"
}
```

#### Validar Integridad

```bash
GET /api/sync/smart-fast/validate

# Response:
{
  "success": true,
  "integrity": {
    "isValid": true,
    "duplicatesFound": 0,
    "duplicates": []
  },
  "message": "✅ Sin duplicados - integridad OK"
}
```

## 🔍 Queries Útiles

### Ver registros actualizados recientemente

```sql
SELECT * FROM op_lead_row_movements LIMIT 20;
```

### Buscar duplicados (debe retornar 0)

```sql
SELECT
  telefono,
  fecha_creacion,
  marca,
  COUNT(*) as duplicados
FROM op_lead
GROUP BY telefono, fecha_creacion, marca
HAVING COUNT(*) > 1;
```

### Ver distribución de IDs por formato

```sql
SELECT
  CASE
    WHEN meta_lead_id ~ '^[A-Z]+_[0-9]{8}_[0-9]{8}_[a-zA-Z0-9]{6}$'
      THEN 'Smart-Fast (nuevo)'
    WHEN meta_lead_id LIKE 'SHEET_%'
      THEN 'Sistema antiguo'
    ELSE 'Otro formato'
  END as formato,
  COUNT(*) as cantidad
FROM op_lead
GROUP BY formato;
```

### Ver leads que cambiaron de fila

```sql
SELECT
  meta_lead_id,
  marca,
  nombre,
  telefono,
  google_sheets_row_number as fila_actual,
  updated_at
FROM op_lead
WHERE updated_at > created_at
ORDER BY updated_at DESC
LIMIT 20;
```

## 🎯 Comportamiento

### Caso 1: Lead Nuevo
```
Google Sheets: Tel=1234567890, Fecha=2025-01-04
BD: NO existe
→ Genera ID: "FIAT_20250104_12347890_a8B9cD"
→ INSERT nuevo registro ✅
```

### Caso 2: Lead Existente - Datos Cambian
```
BD: Tel=1234567890, Fecha=2025-01-04, Ciudad=Buenos Aires
Sheets: Tel=1234567890, Fecha=2025-01-04, Ciudad=Córdoba
→ Busca por (telefono + fecha + marca)
→ ENCUENTRA registro
→ UPDATE: ciudad=Córdoba, updatedAt=NOW()
→ PRESERVA: metaLeadId (no cambia) ✅
```

### Caso 3: Fila se Mueve en Sheets
```
Estado inicial:
Fila 5: Tel=1234567890, Fecha=2025-01-04
→ BD: metaLeadId="FIAT_20250104_12347890_abc"

Alguien inserta fila arriba:
Fila 6: Tel=1234567890, Fecha=2025-01-04 (mismo lead)

Próxima migración:
→ Busca por (telefono + fecha + marca)
→ ENCUENTRA registro existente
→ UPDATE: googleSheetsRowNumber=6
→ PRESERVA: metaLeadId="FIAT_20250104_12347890_abc" ✅
→ Log: "🔄 Fila 6: Actualizado (antes fila 5)"
```

## ⚙️ Integración con Express

```typescript
// server/index.ts
import smartFastRoutes from './sync-smart-fast/api/smart-fast-routes';

app.use('/api/sync', smartFastRoutes);
```

## 🔒 Constraints de Base de Datos

```sql
-- Constraint único (evita duplicados)
ALTER TABLE op_lead
  ADD CONSTRAINT unique_telefono_fecha_marca
  UNIQUE (telefono, fecha_creacion, marca);

-- Índices para performance
CREATE INDEX idx_telefono_fecha_marca_lookup
  ON op_lead(telefono, fecha_creacion, marca);
```

## 📊 Comparación: Sistema Anterior vs Smart-Fast

| Aspecto | Sistema Anterior | Smart-Fast | Mejora |
|---------|-----------------|------------|---------|
| **Líneas de código** | ~1,769 | ~200 | **-91%** |
| **Archivos** | 10+ | 4 | **-60%** |
| **Capas de abstracción** | 8 | 2 | **-75%** |
| **Tiempo de ejecución** | 5-10 min | 1-2 min | **-70%** |
| **ID estable** | ❌ Basado en row (inestable) | ✅ Basado en teléfono+fecha | ✅ |
| **Manejo de duplicados** | Código JS (244 líneas) | Constraint BD (1 línea) | **-99%** |
| **UPSERT nativo** | ❌ Lógica manual | ✅ PostgreSQL ON CONFLICT | ✅ |
| **Detección de movimientos** | ❌ No detecta | ✅ Log automático | ✅ |

## 🚨 Notas Importantes

1. **Teléfono y Fecha son Inmutables**: El sistema asume que estos campos NUNCA cambian. Si cambian, se crea un nuevo registro.

2. **googleSheetsRowNumber es Solo Referencia**: Se actualiza automáticamente pero NO se usa para identificar registros.

3. **Idempotencia**: Puedes ejecutar la migración múltiples veces sin crear duplicados.

4. **Pestañas Excluidas**: `Datos Diarios` y `Control Campañas` se omiten automáticamente.

## 🐛 Troubleshooting

### Error: "Teléfono inválido para generar ID"
- **Causa**: Fila sin teléfono o con menos de 4 dígitos
- **Solución**: Se omite automáticamente (stats.skipped++)

### Error: "GOOGLE_SHEETS_SPREADSHEET_ID no configurado"
- **Causa**: Variable de entorno faltante
- **Solución**: Agregar `GOOGLE_SHEETS_SPREADSHEET_ID` en `.env`

### Duplicados detectados
- **Causa**: Datos inconsistentes previos
- **Solución**: Ejecutar `GET /api/sync/smart-fast/validate` y limpiar manualmente

## 📝 Mantenimiento

### Cron Job para Sincronización Diaria

```typescript
// server/cron-jobs.ts
import cron from 'node-cron';
import { migrateSmartFast } from './sync-smart-fast/migrate-smart-fast';

// Ejecutar todos los días a las 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('🔄 Iniciando sincronización automática...');
  await migrateSmartFast();
});
```

### Monitoreo de Cambios

```sql
-- Ver cambios de las últimas 24 horas
SELECT
  marca,
  COUNT(*) as registros_actualizados,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as nuevos
FROM op_lead
WHERE updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY marca;
```

## 🎉 Conclusión

El sistema Smart-Fast es:
- ✅ **Más simple** (91% menos código)
- ✅ **Más rápido** (70% menos tiempo)
- ✅ **Más confiable** (IDs estables, sin duplicados)
- ✅ **Más mantenible** (menos archivos, lógica clara)

**Ejecuta `npm run sync:smart-fast` y listo!** 🚀
