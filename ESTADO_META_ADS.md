# Estado Meta Ads - Diagnóstico Completo

## 🔍 Estado Actual 
- **Configurado**: ✅ SÍ (credenciales en variables de entorno)
- **Token Válido**: ❌ NO (`"tokenValid":false`)
- **Auto-sync**: ❌ Deshabilitado
- **Campañas en cache**: 0

## 🔑 Credenciales Detectadas
- ✅ META_ACCESS_TOKEN: Presente
- ✅ META_AD_ACCOUNT_ID: Presente  
- ✅ META_APP_ID: Presente
- ✅ META_APP_SECRET: Presente

## ❌ Problema Principal
El token de acceso está **VENCIDO** o **NO VÁLIDO**. El error específico es:
```
"tokenValid": false
```

## 🚨 Qué Falta Para Conectar Meta Ads

### 1. **RENOVAR TOKEN DE ACCESO**
El token actual no es válido. Necesitas:

**Opción A - Generar Nuevo Token (Facebook Developer)**:
1. Ir a: https://developers.facebook.com/tools/explorer/
2. Seleccionar tu App ID
3. Agregar permisos: `ads_read`, `ads_management`
4. Generar token de "User Token" o "App Token"
5. Reemplazar `META_ACCESS_TOKEN` con el nuevo valor

**Opción B - Business Manager**:
1. Ir a: https://business.facebook.com/settings/system-users
2. Crear/editar System User  
3. Generar token con permisos de ads
4. Usar ese token como `META_ACCESS_TOKEN`

### 2. **VERIFICAR ACCOUNT ID**
Confirmar que `META_AD_ACCOUNT_ID` tenga formato correcto:
- Debe empezar con `act_` (ej: `act_1234567890`)
- O ser solo números (ej: `1234567890`)

### 3. **PERMISOS REQUERIDOS**
El token debe tener estos permisos:
- `ads_read` - Para leer datos de campañas
- `ads_management` - Para acceso completo
- `business_management` - Para cuentas empresariales

## 🔧 Solución Rápida
1. **Conseguir nuevo token válido** (paso crítico)
2. Actualizar variable `META_ACCESS_TOKEN` 
3. Reiniciar aplicación
4. Verificar con: `curl http://localhost:5000/api/meta-ads/status`

## 📊 Una Vez Conectado
El sistema automáticamente:
- ✅ Sincronizará cada 30 minutos
- ✅ Mostrará gasto real en "CPL Real" 
- ✅ Calculará CPL auténtico: Gasto ÷ Leads
- ✅ Integrará con dashboard principal

## 🎯 Estado Final Esperado
```json
{
  "configured": true,
  "tokenValid": true,
  "autoSyncEnabled": true,
  "cacheStats": {
    "cachedCampaigns": 5+,
    "lastSyncTime": "2025-01-21T...",
    "cacheAge": "..."
  }
}
```

---
**ACCIÓN INMEDIATA REQUERIDA**: Renovar token de Meta Ads