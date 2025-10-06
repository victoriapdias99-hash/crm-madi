# 📋 ESCENARIOS DE SINCRONIZACIÓN SMART-FAST

## 🆕 ESCENARIO 1: NUEVOS LEADS EN GOOGLE SHEETS

**Situación:**
Se agregan 5 nuevos leads a la hoja "Ford"

**¿Qué pasa?**
- ✅ Se generan 5 nuevos IDs estables (ej: `FORD_20251006_54912345`)
- ✅ Se **INSERTAN** 5 nuevos registros
- ✅ Total en BD aumenta de 10,364 a 10,369
- ✅ Los 10,364 existentes se **ACTUALIZAN** (updated_at cambia)

**Comando:**
```bash
npx tsx server/sync-smart-fast/migrate-smart-fast.ts
```

**Resultado esperado:**
```
📊 Total procesado:     10369
✅ Nuevos insertados:   10369
🔄 Actualizados:        0
```

---

## 📝 ESCENARIO 2: CAMBIOS EN DATOS EXISTENTES

**Situación:**
En Google Sheets, cambias el nombre de un lead:
- Antes: Nombre = "Juan"
- Después: Nombre = "Juan Pérez"
- Teléfono, Fecha, Marca = IGUAL

**¿Qué pasa?**
- ✅ Se genera el **MISMO ID** (porque teléfono+fecha+marca no cambiaron)
- ✅ Se **ACTUALIZA** el registro existente
- ✅ Total en BD: **NO CAMBIA** (10,364)
- ✅ Campo `nombre` actualizado: "Juan" → "Juan Pérez"
- ✅ Campo `updated_at` actualizado con timestamp nuevo

**SQL equivalente:**
```sql
UPDATE op_lead 
SET nombre = 'Juan Pérez', updated_at = NOW()
WHERE meta_lead_id = 'FORD_20250828_54381688'
```

**Resultado esperado:**
```
📊 Total procesado:     10364
✅ Nuevos insertados:   10364  (pero son updates, no inserts)
🔄 Actualizados:        0
```

---

## 🔄 ESCENARIO 3: LEADS MOVIDOS DE FILA

**Situación:**
Mueves un lead de la fila 100 a la fila 50 en Google Sheets
- Mismo teléfono: 5491123456789
- Misma fecha: 2025-08-28
- Misma marca: FORD
- Todo igual, solo cambió la posición

**¿Qué pasa?**
- ✅ Se genera el **MISMO ID**: `FORD_20250828_54911234_6789`
- ✅ Se **ACTUALIZA** el registro (detecta que ya existe)
- ✅ Total en BD: **NO CAMBIA**
- ✅ Campo `google_sheets_row_number` actualizado: 100 → 50
- ✅ **SIN DUPLICADOS** ← Este es el beneficio clave

**Antes (sistema viejo):**
- Se creaba un ID diferente por la fila
- Se insertaba como nuevo
- **DUPLICADO** ❌

**Ahora (sistema nuevo):**
- Mismo ID porque los datos son iguales
- Se actualiza el existente
- **SIN DUPLICADO** ✅

---

## 🔢 ESCENARIO 4: DUPLICADOS REALES

**Situación:**
El mismo cliente contacta 3 veces el mismo día:
- Fila 100: Tel=5491123456789, Fecha=2025-08-28, Marca=FORD
- Fila 200: Tel=5491123456789, Fecha=2025-08-28, Marca=FORD (mismo cliente)
- Fila 300: Tel=5491123456789, Fecha=2025-08-28, Marca=FORD (mismo cliente)

**¿Qué pasa?**
- ✅ Se detectan automáticamente como duplicados
- ✅ Se generan 3 IDs diferentes:
  - `FORD_20250828_54911234_6789` (primer contacto)
  - `FORD_20250828_54911234_6789-1` (segundo contacto)
  - `FORD_20250828_54911234_6789-2` (tercer contacto)
- ✅ Se **INSERTAN** 3 registros separados
- ✅ Total aumenta en 3

**Beneficio:**
Puedes rastrear que el cliente contactó múltiples veces

---

## 🗑️ ESCENARIO 5: LEADS ELIMINADOS DE SHEETS

**Situación:**
Eliminas 10 leads de Google Sheets

**¿Qué pasa?**
- ⚠️ Los registros **SE MANTIENEN** en la BD
- ⚠️ No se eliminan automáticamente
- ℹ️ Esto es por diseño (histórico)

**Si quieres sincronizar eliminaciones:**
Opción 1: Limpiar BD y re-ejecutar migración
```bash
node server/sync-smart-fast/clean-database.js
npx tsx server/sync-smart-fast/migrate-smart-fast.ts
```

Opción 2: Implementar soft-delete (marcar como eliminados)

---

## 🔄 ESCENARIO 6: CAMBIO DE TELÉFONO

**Situación:**
Cambias el teléfono de un lead en Sheets:
- Antes: Tel=5491123456789
- Después: Tel=5491987654321
- Fecha, Marca = IGUAL

**¿Qué pasa?**
- ⚠️ Se genera un **ID DIFERENTE** (porque el teléfono cambió)
- ⚠️ Se **INSERTA** como nuevo registro
- ⚠️ El registro viejo **SE MANTIENE** en BD
- ⚠️ Resultado: 2 registros (uno viejo, uno nuevo)

**Recomendación:**
Si cambias el teléfono, mejor elimina el registro viejo manualmente de la BD

---

## 📅 ESCENARIO 7: CAMBIO DE FECHA

**Situación:**
Corriges la fecha de un lead:
- Antes: Fecha=2025-08-28
- Después: Fecha=2025-08-29
- Teléfono, Marca = IGUAL

**¿Qué pasa?**
- ⚠️ Se genera un **ID DIFERENTE**:
  - Antes: `FORD_20250828_54911234_6789`
  - Después: `FORD_20250829_54911234_6789`
- ⚠️ Se **INSERTA** como nuevo registro
- ⚠️ El registro viejo se mantiene
- ⚠️ Resultado: 2 registros (duplicado accidental)

**Solución:**
Si corriges fechas, limpia la BD y re-ejecuta migración completa

---

## 🎯 RESUMEN DE COMPORTAMIENTOS

| Cambio en Sheets | ID Cambia? | Acción en BD | Total BD | Notas |
|------------------|------------|--------------|----------|-------|
| Nuevo lead | ✅ Sí (nuevo) | INSERT | ⬆️ Aumenta | ✅ Correcto |
| Cambio nombre/ciudad/modelo | ❌ No | UPDATE | ➡️ Igual | ✅ Correcto |
| Lead movido de fila | ❌ No | UPDATE | ➡️ Igual | ✅ Correcto |
| Duplicado real | ✅ Sí (sufijo -N) | INSERT | ⬆️ Aumenta | ✅ Correcto |
| Lead eliminado | - | Nada | ➡️ Igual | ⚠️ Queda en BD |
| Cambio teléfono | ✅ Sí | INSERT | ⬆️ Aumenta | ⚠️ Duplica |
| Cambio fecha | ✅ Sí | INSERT | ⬆️ Aumenta | ⚠️ Duplica |

---

## ✅ MEJORES PRÁCTICAS

1. **Para cambios normales** (nombre, ciudad, modelo, cliente):
   - Simplemente ejecuta la migración
   - Se actualizarán automáticamente

2. **Para agregar nuevos leads:**
   - Simplemente ejecuta la migración
   - Se insertarán automáticamente

3. **Para correcciones de teléfono/fecha:**
   - Limpia BD y re-ejecuta migración completa
   - O corrige manualmente en BD

4. **Para eliminar leads:**
   - Limpia BD y re-ejecuta migración completa
   - O elimina manualmente en BD

5. **Frecuencia recomendada:**
   - Diaria: Para mantener sincronizado
   - Tiempo real: Implementar webhook/cron job
