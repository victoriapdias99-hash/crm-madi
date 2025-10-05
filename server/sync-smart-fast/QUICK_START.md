# 🚀 Quick Start - Smart-Fast Migration

Guía rápida para ejecutar la migración en **5 minutos**.

---

## 📋 Pre-requisitos

- ✅ Node.js instalado
- ✅ PostgreSQL configurado
- ✅ Google Sheets API con credenciales
- ✅ Variables de entorno configuradas

---

## ⚡ Paso 1: Configurar Variables de Entorno

```bash
# .env (raíz del proyecto)
GOOGLE_SHEETS_SPREADSHEET_ID=1a2b3c4d5e6f7g8h9i0j
DATABASE_URL=postgresql://user:password@localhost:5432/crm_madi
```

---

## ⚡ Paso 2: Setup de Base de Datos

```bash
# Ejecutar migración SQL para constraints
npm run sync:setup-db
```

**Esto crea:**
- Constraint único: `(telefono, fecha_creacion, marca)`
- Índices de performance
- Vista de monitoreo `op_lead_row_movements`

**Verificar que salga:**
```
✅ Sin duplicados - constraint se puede aplicar de forma segura
```

---

## ⚡ Paso 3: Ejecutar Migración

```bash
# Migración completa
npm run sync:smart-fast
```

**Salida esperada:**
```
🚀 SMART-FAST Migration System
📋 ID Estable: teléfono + fecha + marca

📋 Marcas encontradas: FIAT, CHEVROLET, PEUGEOT

🔄 Procesando: FIAT
   📊 150 filas encontradas
   ✅ Insertados: 20 | Actualizados: 130

======================================================================
🎉 MIGRACIÓN SMART-FAST COMPLETADA
======================================================================
📊 Total procesado:     450
✅ Nuevos insertados:   80
🔄 Actualizados:        370
⏭️  Omitidos (sin tel): 0
❌ Errores:             0
======================================================================
```

---

## ⚡ Paso 4: Verificar Resultados

### Opción A: CLI

```bash
# Consultar PostgreSQL directamente
psql $DATABASE_URL -c "SELECT COUNT(*) FROM op_lead;"
```

### Opción B: API (si tienes servidor corriendo)

```bash
# Status de migración
curl http://localhost:5000/api/sync/smart-fast/status

# Validar integridad (sin duplicados)
curl http://localhost:5000/api/sync/smart-fast/validate
```

---

## 📊 Queries de Verificación

### Ver últimos registros insertados

```sql
SELECT
  meta_lead_id,
  marca,
  nombre,
  telefono,
  google_sheets_row_number as fila,
  created_at
FROM op_lead
ORDER BY created_at DESC
LIMIT 10;
```

### Ver registros actualizados (movimientos de fila)

```sql
SELECT * FROM op_lead_row_movements LIMIT 10;
```

### Confirmar sin duplicados

```sql
SELECT
  telefono,
  fecha_creacion,
  marca,
  COUNT(*) as count
FROM op_lead
GROUP BY telefono, fecha_creacion, marca
HAVING COUNT(*) > 1;
-- Debe retornar 0 filas
```

---

## 🔄 Ejecutar Nuevamente (Idempotente)

```bash
# Puedes ejecutar múltiples veces sin crear duplicados
npm run sync:smart-fast
npm run sync:smart-fast  # Segunda vez → solo actualiza cambios
```

**Comportamiento:**
- Filas nuevas → INSERT
- Filas existentes → UPDATE (preserva metaLeadId)
- Filas sin cambios → UPDATE (actualiza updatedAt)

---

## 🎯 Formato del ID Generado

```
Formato: {MARCA}_{YYYYMMDD}_{TELEFONO_8}_{NANO_6}

Ejemplos:
- FIAT_20250104_12347890_a8B9cD
- CHEVROLET_20250105_99998888_x1Y2z3
- PEUGEOT_20250106_54915678_f9G0h1
```

**Componentes:**
- `MARCA`: Marca uppercase
- `YYYYMMDD`: Fecha compacta
- `TELEFONO_8`: Primeros 4 + últimos 4 dígitos
- `NANO_6`: ID único aleatorio

---

## 🚨 Troubleshooting

### Error: "GOOGLE_SHEETS_SPREADSHEET_ID no configurado"

```bash
# Verificar .env
cat .env | grep GOOGLE_SHEETS_SPREADSHEET_ID

# Si no existe, agregar:
echo "GOOGLE_SHEETS_SPREADSHEET_ID=tu_id_aqui" >> .env
```

### Error: "constraint unique_telefono_fecha_marca already exists"

```bash
# Ya está configurado, ignorar error y continuar
npm run sync:smart-fast
```

### Error: "Permission denied for table op_lead"

```bash
# Verificar permisos de usuario PostgreSQL
psql $DATABASE_URL -c "GRANT ALL ON op_lead TO current_user;"
```

### Warning: "Encontrados N grupos duplicados"

```bash
# Ver duplicados
psql $DATABASE_URL -c "
SELECT telefono, fecha_creacion, marca, COUNT(*)
FROM op_lead
GROUP BY 1,2,3
HAVING COUNT(*) > 1;
"

# Limpiar duplicados manualmente si es necesario
# (consultar con el equipo antes de eliminar)
```

---

## 📅 Automatizar con Cron (Opcional)

### Crear archivo cron

```bash
# server/cron-sync.ts
import cron from 'node-cron';
import { migrateSmartFast } from './sync-smart-fast/migrate-smart-fast';

// Ejecutar todos los días a las 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('🔄 Sincronización automática iniciada');
  await migrateSmartFast();
});
```

### Agregar a server/index.ts

```typescript
import './cron-sync'; // Importar cron jobs
```

---

## 🎉 ¡Listo!

Tu sistema Smart-Fast está configurado y funcionando.

**Próximos pasos:**
1. ✅ Ejecutar `npm run sync:smart-fast` diariamente
2. ✅ Monitorear `op_lead_row_movements` para ver cambios
3. ✅ Integrar endpoints API en tu frontend si es necesario

**Comandos útiles:**
```bash
# Migración manual
npm run sync:smart-fast

# Ver status
curl http://localhost:5000/api/sync/smart-fast/status

# Validar integridad
curl http://localhost:5000/api/sync/smart-fast/validate
```

---

## 📚 Más Información

Ver [README.md](./README.md) para documentación completa.
