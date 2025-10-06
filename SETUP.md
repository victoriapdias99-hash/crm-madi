# Guía de Configuración - CRM MADI

## 📋 Requisitos Previos

- **Node.js** v18 o superior
- **PostgreSQL** (local o remoto)
- **npm** o **yarn**

## 🚀 Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd crm-madi
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/nombre_bd

# Puerto del servidor (opcional, default: 5000)
PORT=5000

# Meta Ads (opcional)
META_ACCESS_TOKEN=tu_token
META_AD_ACCOUNT_ID=tu_account_id
META_APP_ID=tu_app_id
META_APP_SECRET=tu_app_secret

# Google Sheets (opcional)
GOOGLE_SHEETS_CREDENTIALS=tu_credencial_json
```

### 4. Configurar Base de Datos

Ejecuta las migraciones para crear las tablas necesarias:

```bash
npm run db:push
```

## 🖥️ Iniciar el Servidor

### En Windows

```bash
npx cross-env NODE_ENV=development tsx server/index.ts
```

O usando el script npm (requiere ajuste):

```bash
npm run dev
```

> **Nota**: Si `npm run dev` falla en Windows, usa el comando con `cross-env` mostrado arriba.

### En Linux/macOS

```bash
npm run dev
```

## 🌐 Acceder a la Aplicación

Una vez iniciado el servidor, accede a:

- **Frontend**: http://localhost:5000
- **API**: http://localhost:5000/api

## 📁 Estructura del Proyecto

```
crm-madi/
├── client/              # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/  # Componentes UI
│   │   ├── pages/       # Páginas de la app
│   │   ├── hooks/       # Custom hooks
│   │   └── lib/         # Utilidades
├── server/              # Backend (Express)
│   ├── routes/          # Rutas API
│   ├── db.ts           # Configuración BD
│   └── index.ts        # Punto de entrada
├── shared/             # Código compartido
└── package.json
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo

# Producción
npm run build        # Compilar para producción
npm start            # Iniciar en modo producción

# Base de datos
npm run db:push      # Sincronizar esquema con BD

# Verificación
npm run check        # Verificar tipos TypeScript
```

## 🐛 Solución de Problemas

### Error: `NODE_ENV` no reconocido (Windows)

**Causa**: Windows no soporta la sintaxis `NODE_ENV=development` en npm scripts.

**Solución**: Usa `cross-env`:

```bash
npx cross-env NODE_ENV=development tsx server/index.ts
```

### Error: `ENOTSUP: operation not supported on socket`

**Causa**: La opción `reusePort: true` no es compatible con Windows.

**Solución**: Ya está corregido en [server/index.ts:115](server/index.ts#L115). El servidor usa `server.listen(port, host)` en lugar de opciones con `reusePort`.

### Error de conexión a la base de datos

**Verifica**:
1. PostgreSQL está corriendo
2. `DATABASE_URL` en `.env` es correcta
3. Las credenciales son válidas
4. La base de datos existe

## 🔌 Endpoints API Principales

- `POST /api/sync/*` - Sistema de sincronización
- `POST /api/campaign-closure/execute` - Cierre de campañas
- `GET /api/campaign-closure/status` - Estado de cierre
- `GET /api/campaign-closure/clients` - Lista de clientes

## 📝 Notas Adicionales

- El servidor combina API y cliente en el puerto 5000
- En desarrollo, Vite proporciona HMR (Hot Module Replacement)
- Las credenciales de Meta Ads y Google Sheets son opcionales
- El modo testing está activado por defecto (sincronización manual)

## 🆘 Soporte

Para problemas o dudas, revisa los logs del servidor y verifica la configuración del archivo `.env`.
