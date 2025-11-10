# 🔄 Guía de Migración: Scripts CLI → API REST

Esta guía explica cómo migrar del sistema antiguo de scripts CLI al nuevo sistema de API REST.

---

## 📋 Comparación Rápida

| Aspecto | ❌ Antiguo (Scripts CLI) | ✅ Nuevo (API REST) |
|---------|-------------------------|---------------------|
| **Arquitectura** | Scripts monolíticos | Clean Architecture |
| **Ejecución** | `npx tsx script.ts` | `curl` / HTTP request |
| **Testing** | Modificar código | Query params (`?dryRun=true`) |
| **Integración** | Difícil | Fácil (HTTP API) |
| **Logs** | Console output | Structured JSON |
| **Mantenibilidad** | Baja | Alta |

---

## 🔄 Equivalencias

### Reset de Campaña Individual

#### ❌ Antiguo
```bash
npx tsx server/reset-campaign-leads.ts --dry-run --campaign-id=65
npx tsx server/reset-campaign-leads.ts --campaign-id=65
```

#### ✅ Nuevo
```bash
curl -X POST "http://localhost:5000/api/campaign-reset/65?dryRun=true"
curl -X POST "http://localhost:5000/api/campaign-reset/65"
```

---

### Reset Batch (Todas las Finalizadas)

#### ❌ Antiguo
```bash
npx tsx server/reset-all-finished-campaigns.ts --dry-run
npx tsx server/reset-all-finished-campaigns.ts --execute
```

#### ✅ Nuevo
```bash
curl -X POST "http://localhost:5000/api/campaign-reset/batch?dryRun=true"
curl -X POST "http://localhost:5000/api/campaign-reset/batch"
```

---

### Reset con Filtro de Fechas

#### ❌ Antiguo
```bash
npx tsx server/reset-all-finished-campaigns.ts --dry-run --before="2025-09-01"
npx tsx server/reset-all-finished-campaigns.ts --execute --before="2025-09-01"
```

#### ✅ Nuevo
```bash
curl -X POST "http://localhost:5000/api/campaign-reset/batch?dryRun=true&beforeDate=2025-09-01"
curl -X POST "http://localhost:5000/api/campaign-reset/batch?beforeDate=2025-09-01"
```

---

### Solo Reabrir Campañas (sin tocar leads)

#### ❌ Antiguo
```bash
npx tsx server/reopen-finished-campaigns.ts --dry-run
npx tsx server/reopen-finished-campaigns.ts --execute
```

#### ✅ Nuevo
```bash
# Por ahora, el reset batch hace ambas operaciones
# Si necesitas solo reabrir, usa el batch con campañas que no tengan leads
curl -X POST "http://localhost:5000/api/campaign-reset/batch"
```

---

## 📦 Formato de Respuesta

### Antiguo (Console Output)
```
✅ Campaña 65 (Red Finance #1): 82 leads liberados + fecha_fin limpiada
✅ Campaña 73 (GRUPO SVA #3): 1009 leads liberados + fecha_fin limpiada
...
✅ PROCESO COMPLETADO
Campañas procesadas: 40 de 40
```

### Nuevo (JSON Structured)
```json
{
  "success": true,
  "data": {
    "totalCampaigns": 40,
    "successfulResets": 40,
    "failedResets": 0,
    "totalLeadsReset": 7676,
    "campaignsReopened": 40,
    "results": [
      {
        "campaignId": 65,
        "campaignName": "Red Finance",
        "campaignNumber": 1,
        "leadsReset": 82,
        "fechaFinCleared": true,
        "success": true
      }
    ],
    "errors": []
  },
  "message": "Successfully reset 40 campaigns with 7676 total leads"
}
```

---

## 🎯 Ventajas del Nuevo Sistema

### 1. Integración con Frontend
```javascript
// Fácil de consumir desde React/Vue/etc
const resetCampaign = async (campaignId) => {
  const response = await fetch(`/api/campaign-reset/${campaignId}`, {
    method: 'POST'
  });
  return response.json();
};
```

### 2. Automation/CI-CD
```yaml
# GitHub Actions / Jenkins
- name: Reset test campaigns
  run: |
    curl -X POST "http://localhost:5000/api/campaign-reset/batch"
```

### 3. Monitoreo
```javascript
// Prometheus metrics
campaignResetCounter.inc({ status: 'success' });
```

### 4. Testing Automatizado
```typescript
describe('Campaign Reset API', () => {
  it('should reset campaign', async () => {
    const response = await request(app)
      .post('/api/campaign-reset/65')
      .query({ dryRun: true });
    expect(response.status).toBe(200);
  });
});
```

---

## 🔧 Mantenimiento de Scripts Antiguos

Los scripts antiguos seguirán funcionando mientras migramos:

```bash
# Todavía disponibles (legacy)
npx tsx server/reset-campaign-leads.ts --campaign-id=65
npx tsx server/reset-all-finished-campaigns.ts --execute
npx tsx server/reopen-finished-campaigns.ts --execute
```

**Recomendación:** Usa la API REST para nuevas integraciones.

---

## 🚀 Plan de Migración

### Fase 1: Coexistencia (Actual)
- ✅ API REST disponible
- ✅ Scripts CLI siguen funcionando
- ✅ Ambos métodos válidos

### Fase 2: Migración Gradual
- Comenzar a usar API REST en desarrollo
- Actualizar documentación
- Probar en staging

### Fase 3: Deprecación (Futuro)
- Marcar scripts como deprecated
- Eliminar scripts después de 6 meses

---

## 📝 Checklist de Migración

- [ ] Probar endpoint de reset individual en desarrollo
- [ ] Probar endpoint de reset batch en desarrollo
- [ ] Actualizar scripts de CI/CD para usar API
- [ ] Actualizar documentación del equipo
- [ ] Capacitar al equipo en nuevo sistema
- [ ] Migrar scripts de producción
- [ ] Monitorear errores post-migración
- [ ] Deprecar scripts antiguos (después de 3 meses)

---

## 🆘 Troubleshooting

### Problema: "Cannot connect to server"
**Solución:** Asegúrate de que el servidor esté corriendo
```bash
npm run dev
```

### Problema: "404 Not Found"
**Solución:** Verifica que las rutas estén registradas en `routes.ts`
```bash
# Busca este mensaje en los logs del servidor:
✅ Rutas del sistema de reset de campañas registradas: /api/campaign-reset/*
```

### Problema: "500 Internal Server Error"
**Solución:** Revisa los logs del servidor para ver el error específico

---

## 💡 Tips

### 1. Dry Run Siempre Primero
```bash
# Buena práctica
curl -X POST "/api/campaign-reset/batch?dryRun=true"  # Ver qué pasaría
curl -X POST "/api/campaign-reset/batch"              # Ejecutar
```

### 2. Guardar Resultados
```bash
curl -X POST "/api/campaign-reset/batch" > reset-result.json
```

### 3. Pretty Print con jq
```bash
curl -X POST "/api/campaign-reset/batch?dryRun=true" | jq '.'
```

### 4. Desde Postman/Insomnia
- Método: POST
- URL: `http://localhost:5000/api/campaign-reset/65`
- Query Params: `dryRun=true`

---

## 📚 Recursos

- [README del módulo](./README.md)
- [Documentación de API](./README.md#api-endpoints)
- [Scripts de prueba](./test-api.sh)
- [Arquitectura](./README.md#arquitectura)

---

¿Preguntas? Contacta al equipo de desarrollo.
