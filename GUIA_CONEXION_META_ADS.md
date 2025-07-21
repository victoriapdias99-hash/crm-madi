# 🚀 Guía Paso a Paso: Conectar Meta Ads

## 📋 PASOS PARA CONECTAR META ADS

### PASO 1: Facebook Developer Console
1. **Ve a**: https://developers.facebook.com/tools/explorer/
2. **Inicia sesión** con tu cuenta de Facebook Business

### PASO 2: Configurar API Explorer
1. **Selecciona tu App** en el dropdown superior izquierdo
   - Si no tienes app: https://developers.facebook.com/apps/ → "Create App"
2. **Verifica** que esté seleccionado tu usuario en "User or Page"

### PASO 3: Generar Token de Acceso
1. **Haz clic** en "Get Token" → "Get User Access Token"
2. **Marca estos permisos**:
   - ✅ `ads_read` 
   - ✅ `ads_management`
   - ✅ `business_management`
3. **Copia** el token generado

### PASO 4: Extender Token (Importante)
1. **Ve a**: https://developers.facebook.com/tools/debug/accesstoken/
2. **Pega tu token** y haz clic "Debug"
3. **Si aparece "Extend Access Token"**, haz clic y usa el token extendido
4. **Copia el token final**

### PASO 5: Obtener Account ID
1. **En API Explorer**, prueba: `GET /me/adaccounts`
2. **Busca tu cuenta** y copia el "id" (ejemplo: "act_1234567890")

### PASO 6: Actualizar Secrets en Replit
1. **Ve a la pestaña "Secrets"** 🔒 en Replit
2. **Actualiza**:
   - `META_ACCESS_TOKEN`: Tu token nuevo
   - `META_AD_ACCOUNT_ID`: El ID de cuenta (con "act_")

### PASO 7: Reiniciar App
1. **Para** la aplicación (botón Stop)
2. **Inicia** nuevamente (botón Run)

### PASO 8: Verificar Conexión
**Resultado esperado**:
```json
{
  "configured": true,
  "tokenValid": true,
  "autoSyncEnabled": true
}
```

## 🎯 LO QUE VERÁS UNA VEZ CONECTADO:

### En Datos Diarios:
- **Columna "CPL Real"** con datos auténticos de Meta Ads
- **Gasto real** en lugar de estimaciones
- **Cálculo preciso**: Gasto Meta Ads ÷ Cantidad leads = CPL Real

### Sincronización Automática:
- **Cada 30 minutos** actualiza datos
- **Métricas reales**: impresiones, clics, CPC, CPM
- **Alertas** cuando campañas superan presupuesto

## ⚠️ PROBLEMAS COMUNES:

### "Invalid token"
**Solución**: Repetir pasos 3-4, generar token nuevo

### "Account not found"  
**Solución**: Verificar Account ID en paso 5

### "Permissions denied"
**Solución**: Asegurar permisos ads_read y ads_management

---
**⏱️ Tiempo**: 5-10 minutos  
**🎯 Resultado**: Meta Ads 100% conectado y sincronizado