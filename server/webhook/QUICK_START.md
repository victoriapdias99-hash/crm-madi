# Webhook - Guía Rápida

## 🚀 Inicio Rápido

### Endpoint Principal

```
POST http://localhost:5000/api/webhook/lead-webhook
```

### Ejemplo Mínimo

```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan Pérez","telefono":"1155667788"}'
```

### Ejemplo Completo

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

## 📋 Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `nombre` | string | ✅ Sí | Nombre del lead |
| `telefono` | string | ✅ Sí | Teléfono (se normaliza automáticamente) |
| `auto` | string | ❌ No | Modelo de auto de interés |
| `localidad` | string | ❌ No | Ciudad/localidad |
| `comentarios` | string | ❌ No | Comentarios adicionales |
| `source` | string | ❌ No | Fuente del lead (default: "webhook") |

## ✅ Respuestas

### Success (201)
```json
{
  "success": true,
  "leadId": 1,
  "message": "Lead guardado exitosamente",
  "data": { ... }
}
```

### Error de Validación (400)
```json
{
  "success": false,
  "error": "Datos inválidos",
  "details": [ ... ]
}
```

### Error del Servidor (500)
```json
{
  "success": false,
  "error": "Error al procesar webhook",
  "message": "..."
}
```

## 🔧 Normalización de Teléfono

El sistema elimina automáticamente caracteres especiales:

- `(011) 4444-5555` → `01144445555`
- `11-2233-4455` → `1122334455`
- `+54 11 1234 5678` → `5411123456789`

## 🌐 Integraciones

### Make.com
```
URL: https://tu-dominio.com/api/webhook/lead-webhook
Method: POST
Content-Type: application/json
```

### Zapier
```
Webhook URL: https://tu-dominio.com/api/webhook/lead-webhook
Payload Type: JSON
```

### Google Forms (con script)
```javascript
function onFormSubmit(e) {
  const url = 'https://tu-dominio.com/api/webhook/lead-webhook';
  const payload = {
    nombre: e.values[1],
    telefono: e.values[2],
    auto: e.values[3],
    localidad: e.values[4],
    comentarios: e.values[5]
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}
```

## 📊 Verificar Datos

Para verificar los leads guardados en la base de datos:

```bash
npx tsx verify-webhook-data.ts
```

## 🐛 Troubleshooting

### Error 400 - Datos inválidos
- Verificar que `nombre` y `telefono` estén presentes
- Verificar formato JSON correcto

### Error 500 - Error del servidor
- Verificar conexión a base de datos
- Revisar logs del servidor

### No se recibe respuesta
- Verificar que el servidor esté corriendo
- Verificar URL correcta
- Verificar firewall/CORS

## 📖 Documentación Completa

Para más detalles, consultar [README.md](./README.md)
