# Webhook API - Referencia Rápida

## 🔗 Endpoint

```
POST /api/webhook/lead-webhook
```

## 📋 Request

### Headers
| Header | Valor | Requerido |
|--------|-------|-----------|
| `Content-Type` | `application/json` | ✅ Sí |

### Body Parameters

| Campo | Tipo | Requerido | Máx Length | Descripción | Ejemplo |
|-------|------|-----------|------------|-------------|---------|
| `nombre` | string | ✅ Sí | - | Nombre completo del lead | `"Juan Pérez"` |
| `telefono` | string | ✅ Sí | - | Número de teléfono (se normaliza) | `"1155667788"` o `"(011) 4444-5555"` |
| `auto` | string | ❌ No | - | Modelo de auto de interés | `"Fiat Cronos 1.3"` |
| `localidad` | string | ❌ No | - | Ciudad/localidad del lead | `"Buenos Aires"` |
| `comentarios` | string | ❌ No | - | Comentarios o notas adicionales | `"Interesado en financiación"` |
| `source` | string | ❌ No | - | Fuente del lead | `"webhook"` (default) |

### Ejemplo Request

```json
{
  "nombre": "Juan Pérez",
  "telefono": "1155667788",
  "auto": "Fiat Cronos 1.3",
  "localidad": "Buenos Aires",
  "comentarios": "Interesado en financiación"
}
```

## 📤 Response

### Success Response (201 Created)

```json
{
  "success": true,
  "leadId": 1,
  "message": "Lead guardado exitosamente",
  "data": {
    "id": 1,
    "nombre": "Juan Pérez",
    "telefono": "1155667788",
    "auto": "Fiat Cronos 1.3",
    "localidad": "Buenos Aires",
    "comentarios": "Interesado en financiación",
    "source": "webhook",
    "createdAt": "2025-10-06T03:07:59.302Z",
    "updatedAt": "2025-10-06T03:07:59.302Z"
  }
}
```

### Error Response (400 Bad Request)

**Validación fallida:**

```json
{
  "success": false,
  "error": "Datos inválidos",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["telefono"],
      "message": "Required"
    }
  ]
}
```

### Error Response (500 Internal Server Error)

**Error del servidor:**

```json
{
  "success": false,
  "error": "Error al procesar webhook",
  "message": "Database connection failed"
}
```

## 📊 HTTP Status Codes

| Code | Status | Descripción |
|------|--------|-------------|
| `201` | Created | Lead creado exitosamente |
| `400` | Bad Request | Datos inválidos o campos faltantes |
| `500` | Internal Server Error | Error del servidor |

## 🔄 Normalización Automática

### Teléfono

El sistema normaliza automáticamente los números de teléfono eliminando:
- Paréntesis `( )`
- Guiones `-`
- Espacios ` `
- Otros caracteres especiales

| Input | Output |
|-------|--------|
| `(011) 4444-5555` | `01144445555` |
| `11-2233-4455` | `1122334455` |
| `+54 11 1234 5678` | `5411123456789` |
| `351 234 5678` | `3512345678` |

### Texto

Todos los campos de texto se normalizan con `.trim()`:
- Se eliminan espacios al inicio y final
- Espacios múltiples internos se mantienen

## 🧪 Casos de Prueba

### ✅ Test 1: Lead Completo

**Request:**
```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana Martínez",
    "telefono": "11-2233-4455",
    "auto": "Toyota Corolla 2024",
    "localidad": "Rosario",
    "comentarios": "Necesito cotización urgente"
  }'
```

**Expected:** `201 Created` con todos los campos guardados

---

### ✅ Test 2: Solo Requeridos

**Request:**
```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Pedro López",
    "telefono": "3512345678"
  }'
```

**Expected:** `201 Created` con campos opcionales en `null`

---

### ❌ Test 3: Sin Nombre

**Request:**
```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "telefono": "1122334455"
  }'
```

**Expected:** `400 Bad Request` con error de validación

---

### ❌ Test 4: Sin Teléfono

**Request:**
```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test Usuario"
  }'
```

**Expected:** `400 Bad Request` con error de validación

---

### ✅ Test 5: Normalización

**Request:**
```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Test Normalización",
    "telefono": "(011) 4444-5555"
  }'
```

**Expected:** `201 Created` con `telefono: "01144445555"`

## 🔐 Seguridad

### Headers Recomendados (Futuro)

```http
Authorization: Bearer YOUR_API_TOKEN
X-Webhook-Source: your-source-identifier
```

### Rate Limiting (Futuro)

| Límite | Ventana | Descripción |
|--------|---------|-------------|
| 100 requests | 15 minutos | Por IP |
| 1000 requests | 1 hora | Por IP |

## 📝 Validación de Campos

### Reglas de Validación

| Campo | Min Length | Max Length | Regex | Otros |
|-------|-----------|-----------|-------|-------|
| `nombre` | 1 | - | - | Trim automático |
| `telefono` | 1 | - | Solo dígitos después de normalización | Se eliminan caracteres especiales |
| `auto` | - | - | - | Opcional, trim automático |
| `localidad` | - | - | - | Opcional, trim automático |
| `comentarios` | - | - | - | Opcional, trim automático |
| `source` | - | - | - | Default: "webhook" |

## 🌍 Ejemplos por Lenguaje

### cURL
```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan Pérez","telefono":"1155667788"}'
```

### JavaScript (fetch)
```javascript
fetch('http://localhost:5000/api/webhook/lead-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nombre: "Juan Pérez",
    telefono: "1155667788"
  })
});
```

### Python (requests)
```python
import requests

requests.post(
  'http://localhost:5000/api/webhook/lead-webhook',
  json={'nombre': 'Juan Pérez', 'telefono': '1155667788'}
)
```

### PHP (cURL)
```php
$ch = curl_init('http://localhost:5000/api/webhook/lead-webhook');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
  'nombre' => 'Juan Pérez',
  'telefono' => '1155667788'
]));
curl_exec($ch);
```

## 📚 Más Información

- [README completo](./README.md)
- [Guía rápida](./QUICK_START.md)
- [Ejemplos detallados](./EXAMPLES.md)

## 🔗 Enlaces Útiles

| Recurso | URL |
|---------|-----|
| Endpoint Producción | `https://tu-dominio.com/api/webhook/lead-webhook` |
| Endpoint Desarrollo | `http://localhost:5000/api/webhook/lead-webhook` |
| Documentación | `/server/webhook/README.md` |
| Ejemplos | `/server/webhook/EXAMPLES.md` |

---

**Última actualización:** 2025-10-06
**Versión:** 1.0.0
