# Sistema de Webhooks - Documentación

## 📋 Descripción

Sistema para recibir y almacenar leads externos mediante webhooks HTTP. Implementado siguiendo **Clean Architecture** para mantener la separación de responsabilidades y facilitar el testing y mantenimiento.

## 🏗️ Arquitectura

El módulo sigue el patrón de Clean Architecture con las siguientes capas:

```
server/webhook/
├── domain/                      # Capa de dominio (reglas de negocio)
│   ├── entities/
│   │   └── WebhookLead.ts      # Entidad principal con lógica de validación
│   └── interfaces/
│       └── IWebhookRepository.ts # Contrato del repositorio
│
├── application/                 # Capa de aplicación (casos de uso)
│   ├── dto/
│   │   └── WebhookLeadDto.ts   # DTOs de entrada/salida con validación Zod
│   └── usecases/
│       └── CreateWebhookLeadUseCase.ts # Caso de uso: crear lead
│
├── infrastructure/              # Capa de infraestructura (implementaciones)
│   └── repositories/
│       └── PostgresWebhookRepository.ts # Repositorio con Drizzle ORM
│
├── presentation/                # Capa de presentación (API REST)
│   ├── controllers/
│   │   └── WebhookController.ts # Controlador Express
│   └── routes/
│       └── webhook-routes.ts    # Definición de rutas HTTP
│
└── index.ts                     # Punto de entrada del módulo
```

## 📡 API Endpoints

### POST `/api/webhook/lead-webhook`

Recibe y almacena un lead desde un webhook externo.

#### Request

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "nombre": "string (requerido)",
  "telefono": "string (requerido)",
  "auto": "string (opcional)",
  "localidad": "string (opcional)",
  "comentarios": "string (opcional)",
  "source": "string (opcional, default: 'webhook')"
}
```

#### Response Success (201)

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

#### Response Error (400)

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

#### Response Error (500)

```json
{
  "success": false,
  "error": "Error al procesar webhook",
  "message": "Descripción del error"
}
```

### GET `/api/webhook/leads`

Obtiene todos los leads recibidos vía webhook (endpoint para uso futuro).

**Status:** No implementado aún

## 🗄️ Base de Datos

### Tabla: `op_lead_webhook`

```sql
CREATE TABLE op_lead_webhook (
  id serial PRIMARY KEY,
  nombre text NOT NULL,
  telefono text NOT NULL,
  auto text,
  localidad text,
  comentarios text,
  source text DEFAULT 'webhook' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
```

**Campos:**
- `id`: Identificador único autoincremental
- `nombre`: Nombre del lead (requerido)
- `telefono`: Teléfono normalizado sin caracteres especiales (requerido)
- `auto`: Modelo o tipo de auto de interés (opcional)
- `localidad`: Localidad o ciudad del lead (opcional)
- `comentarios`: Comentarios adicionales del lead (opcional)
- `source`: Origen del lead (default: 'webhook')
- `created_at`: Fecha de creación del registro
- `updated_at`: Fecha de última actualización

## 🔧 Características

### 1. Validación de Datos

- ✅ Validación de esquema con **Zod**
- ✅ Campos requeridos: `nombre`, `telefono`
- ✅ Mensajes de error descriptivos
- ✅ Validación en capa de dominio adicional

### 2. Normalización de Teléfono

El sistema normaliza automáticamente los números de teléfono:

**Entrada:** `"(011) 4444-5555"`
**Guardado:** `"01144445555"`

Elimina: paréntesis, guiones, espacios y otros caracteres especiales.

### 3. Manejo de Errores

- Errores de validación (400): Datos inválidos o faltantes
- Errores del servidor (500): Problemas de BD o sistema
- Logging completo de errores para debugging

### 4. Campos Opcionales

Los campos opcionales se guardan como `null` si no se proporcionan:
```json
{
  "nombre": "Pedro López",
  "telefono": "3512345678"
  // auto, localidad, comentarios serán null
}
```

## 💡 Ejemplos de Uso

### Ejemplo 1: Lead Completo

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

### Ejemplo 2: Solo Campos Requeridos

```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Pedro López",
    "telefono": "3512345678"
  }'
```

### Ejemplo 3: Con Source Personalizado

```bash
curl -X POST http://localhost:5000/api/webhook/lead-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Carlos Díaz",
    "telefono": "1122334455",
    "auto": "Chevrolet Onix",
    "source": "landing-page"
  }'
```

## 🧪 Testing

### Pruebas Manuales

1. **Test de campos completos:**
   - Verificar que todos los campos se guarden correctamente
   - Confirmar normalización de teléfono

2. **Test de campos requeridos:**
   - Verificar que solo con nombre y teléfono funcione
   - Confirmar que campos opcionales sean null

3. **Test de validación:**
   - Sin nombre: debe retornar error 400
   - Sin teléfono: debe retornar error 400
   - Datos inválidos: debe retornar error 400

4. **Test de normalización:**
   - Enviar teléfono con formato: `(011) 4444-5555`
   - Verificar que se guarde como: `01144445555`

### Script de Verificación

Ejecutar para verificar datos en BD:

```bash
npx tsx verify-webhook-data.ts
```

## 🔌 Integración

### Integración con Make.com

```javascript
// Configuración del módulo HTTP en Make.com
URL: https://tu-dominio.com/api/webhook/lead-webhook
Method: POST
Headers: Content-Type: application/json
Body: {
  "nombre": "{{nombre}}",
  "telefono": "{{telefono}}",
  "auto": "{{auto}}",
  "localidad": "{{localidad}}",
  "comentarios": "{{comentarios}}"
}
```

### Integración con Zapier

```
URL: https://tu-dominio.com/api/webhook/lead-webhook
Method: POST
Data Pass-Through: No
Data:
  nombre: [Campo nombre]
  telefono: [Campo telefono]
  auto: [Campo auto]
  localidad: [Campo localidad]
  comentarios: [Campo comentarios]
```

### Integración con n8n

```json
{
  "url": "https://tu-dominio.com/api/webhook/lead-webhook",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "nombre": "={{ $json.nombre }}",
    "telefono": "={{ $json.telefono }}",
    "auto": "={{ $json.auto }}",
    "localidad": "={{ $json.localidad }}",
    "comentarios": "={{ $json.comentarios }}"
  }
}
```

## 🔐 Seguridad

### Recomendaciones

1. **Rate Limiting:** Implementar limitación de peticiones por IP
2. **Autenticación:** Agregar token de autenticación para webhooks
3. **Validación de IP:** Whitelist de IPs permitidas
4. **HTTPS:** Usar siempre HTTPS en producción
5. **Logs:** Monitorear intentos de acceso sospechosos

### Ejemplo de Rate Limiting (futuro)

```typescript
import rateLimit from 'express-rate-limit';

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Demasiadas peticiones desde esta IP'
});

app.post('/api/webhook/lead-webhook', webhookLimiter, ...);
```

## 📊 Monitoreo

### Logs del Sistema

El sistema genera logs automáticos:

```
📨 Webhook lead-webhook recibido: { nombre: '...', telefono: '...' }
✅ Lead webhook guardado: 3
```

### Métricas Sugeridas

- Total de leads recibidos por día
- Tasa de errores de validación
- Tiempo promedio de respuesta
- Leads por fuente (source)

## 🚀 Deployment

### Variables de Entorno

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
PORT=5000
```

### Despliegue

El módulo se registra automáticamente al iniciar el servidor:

```typescript
// server/routes.ts
import { registerWebhookRoutes } from './webhook';

// En la función registerRoutes:
registerWebhookRoutes(app);
```

### Verificación Post-Deployment

1. Verificar que las rutas estén registradas:
   ```
   ✅ Rutas del sistema de webhooks registradas:
      POST /api/webhook/lead-webhook
      GET  /api/webhook/leads
   ```

2. Test de endpoint:
   ```bash
   curl -X POST https://tu-dominio.com/api/webhook/lead-webhook \
     -H "Content-Type: application/json" \
     -d '{"nombre":"Test","telefono":"1234567890"}'
   ```

## 🛠️ Mantenimiento

### Agregar Nuevos Campos

1. **Actualizar Schema** ([shared/schema.ts](../../shared/schema.ts)):
   ```typescript
   export const opLeadWebhook = pgTable("op_lead_webhook", {
     // ... campos existentes
     nuevocampo: text("nuevo_campo"),
   });
   ```

2. **Actualizar DTO** ([application/dto/WebhookLeadDto.ts](application/dto/WebhookLeadDto.ts)):
   ```typescript
   export const CreateWebhookLeadDto = z.object({
     // ... campos existentes
     nuevoCampo: z.string().optional()
   });
   ```

3. **Actualizar Entidad** ([domain/entities/WebhookLead.ts](domain/entities/WebhookLead.ts)):
   ```typescript
   constructor(
     // ... parámetros existentes
     public readonly nuevocampo?: string | null
   ) {}
   ```

4. **Generar y ejecutar migración:**
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit push
   ```

### Agregar Nuevos Casos de Uso

1. Crear archivo en `application/usecases/`
2. Implementar lógica de negocio
3. Registrar en el controlador
4. Crear ruta correspondiente

## 📚 Referencias

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Zod Documentation](https://zod.dev/)
- [Express.js Guide](https://expressjs.com/)

## 📝 Changelog

### v1.0.0 (2025-10-06)
- ✨ Implementación inicial del sistema de webhooks
- ✅ Endpoint POST /api/webhook/lead-webhook
- ✅ Validación con Zod
- ✅ Normalización de teléfonos
- ✅ Persistencia en PostgreSQL
- ✅ Clean Architecture implementation
- ✅ Documentación completa

## 👥 Soporte

Para preguntas o issues:
- Revisar logs del servidor
- Verificar datos en BD con script de verificación
- Consultar ejemplos de uso en esta documentación
