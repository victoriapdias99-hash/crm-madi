# Reapertura de Campañas - Documentación Completa

Sistema de reapertura inteligente para campañas finalizadas con validación multimarca.

---

## 🎯 Propósito

Permitir reabrir campañas finalizadas bajo condiciones controladas, manteniendo la integridad de datos y evitando conflictos con campañas posteriores.

---

## 🔄 ¿Qué es la Reapertura?

La **reapertura** de una campaña finalizada significa:

✅ **Eliminar `fecha_fin`** de la campaña
✅ **Volver a estado activo** (aparece en pendientes)
✅ **Permitir recibir más leads** automáticamente
✅ **Mantener todos los datos** existentes (leads, duplicados, etc.)
✅ **Continuar desde donde quedó** sin resetear contadores

---

## 📋 Reglas de Validación

### Regla #1: La campaña debe estar finalizada

```typescript
if (!campaign.fechaFin) {
  return {
    canReopen: false,
    reason: 'La campaña no está finalizada'
  };
}
```

**¿Por qué?**
- Solo campañas con `fecha_fin` necesitan reapertura
- Campañas activas ya están abiertas

---

### Regla #2: Debe ser la ÚLTIMA finalizada para TODAS sus marcas

```typescript
// Para cada marca de la campaña
for (const brand of brands) {
  const hasNewerCampaign = await hasNewerFinishedCampaignForBrand(
    clienteId,
    brand.marca,
    numeroCampana
  );

  if (hasNewerCampaign) {
    return {
      canReopen: false,
      reason: `Existe una campaña posterior finalizada para la marca ${brand.marca}.
               Solo puede reabrirse la última campaña de cada marca.`
    };
  }
}

return { canReopen: true };
```

**¿Por qué?**
- Evitar conflictos de asignación de leads
- Mantener orden cronológico
- Prevenir sobre-asignación de leads a campañas antiguas

---

## 🏢 Soporte para Campañas Multimarca

### Extracción de Marcas

Una campaña puede tener hasta **5 marcas** simultáneas:

```typescript
// Campos en base de datos
{
  marca: "Fiat",        // Marca principal
  marca2: "Peugeot",    // Marca secundaria 1
  marca3: null,         // Marca secundaria 2
  marca4: null,         // Marca secundaria 3
  marca5: null          // Marca secundaria 4
}
```

```typescript
// Usando multi-brand-utils.ts
const brands = extractBrandsFromCampaign(campaign, true);

// Resultado:
[
  { marca: "Fiat", porcentaje: 50 },
  { marca: "Peugeot", porcentaje: 50 }
]
```

### Validación Multimarca

Para una campaña con múltiples marcas, **TODAS** deben cumplir la regla de ser la última finalizada:

```
Campaña #1: Fiat 50% + Peugeot 50%
¿Puede reabrirse?

Validación:
1. ¿Es Fiat la última finalizada? → Verificar
2. ¿Es Peugeot la última finalizada? → Verificar

Si ambas son las últimas → ✅ SÍ puede reabrirse
Si alguna NO es la última → ❌ NO puede reabrirse
```

---

## 📊 Casos de Uso Detallados

### Caso 1: Campaña Simple (Una Marca)

```
Cliente: Red Finance
Historial:
- Campaña #1: Fiat (finalizada)
- Campaña #2: Fiat (finalizada)
- Campaña #3: Fiat (activa)

Intentos de reapertura:
┌──────────┬──────────┬─────────────────────────────────┐
│ Campaña  │ ¿Reabrir?│ Razón                           │
├──────────┼──────────┼─────────────────────────────────┤
│ #1       │ ❌ NO    │ Existe #2 posterior finalizada  │
│ #2       │ ❌ NO    │ Existe #3 activa (no finalizd.) │
│ #3       │ ⚠️ N/A   │ Ya está activa                  │
└──────────┴──────────┴─────────────────────────────────┘
```

### Caso 2: Campaña Multimarca - Escenario Complejo

```
Cliente: Red Finance
Historial:
- Campaña #1: Fiat 50% + Peugeot 50% (finalizada)
- Campaña #2: Fiat 100% (finalizada)
- Campaña #3: Peugeot 100% (finalizada)

Análisis de reapertura:

Campaña #1 (Fiat 50% + Peugeot 50%):
  Validación Fiat:
    ¿Es la última finalizada de Fiat?
    → NO, existe #2 (Fiat 100%) posterior
    → ❌ FALLO

  Validación Peugeot:
    ¿Es la última finalizada de Peugeot?
    → NO, existe #3 (Peugeot 100%) posterior
    → ❌ FALLO

  Resultado: ❌ NO puede reabrirse
  Razón: "Existe una campaña posterior finalizada para la marca Fiat"

Campaña #2 (Fiat 100%):
  Validación Fiat:
    ¿Es la última finalizada de Fiat?
    → SÍ, no hay campañas Fiat posteriores finalizadas
    → ✅ ÉXITO

  Resultado: ✅ SÍ puede reabrirse

Campaña #3 (Peugeot 100%):
  Validación Peugeot:
    ¿Es la última finalizada de Peugeot?
    → SÍ, no hay campañas Peugeot posteriores finalizadas
    → ✅ ÉXITO

  Resultado: ✅ SÍ puede reabrirse
```

### Caso 3: Múltiples Clientes

```
Clientes diferentes pueden tener campañas independientes:

Cliente A - Red Finance:
- Campaña #1: Fiat (finalizada)
- Campaña #2: Fiat (finalizada) ✅ Puede reabrirse

Cliente B - Giorgi:
- Campaña #1: Fiat (finalizada) ✅ Puede reabrirse

Regla: Las validaciones son por cliente.
No hay conflicto entre clientes diferentes.
```

---

## 🔍 Algoritmo de Detección

### Función: hasNewerFinishedCampaignForBrand()

```typescript
async hasNewerFinishedCampaignForBrand(
  clienteId: number,
  marca: string,
  numeroCampana: number
): Promise<boolean> {

  const newerCampaigns = await db
    .select()
    .from(campanasComerciales)
    .where(
      and(
        // Mismo cliente
        eq(campanasComerciales.clienteId, clienteId),

        // Número de campaña mayor
        sql`CAST(${campanasComerciales.numeroCampana} AS INTEGER) > ${numeroCampana}`,

        // Debe estar finalizada
        sql`${campanasComerciales.fechaFin} IS NOT NULL`,

        // Marca en cualquiera de los 5 campos
        or(
          eq(campanasComerciales.marca, marca),
          eq(campanasComerciales.marca2, marca),
          eq(campanasComerciales.marca3, marca),
          eq(campanasComerciales.marca4, marca),
          eq(campanasComerciales.marca5, marca)
        )
      )
    )
    .limit(1);

  return newerCampaigns.length > 0;
}
```

**Características**:
- ✅ Busca mismo cliente
- ✅ Número de campaña mayor (cast a INTEGER para comparación correcta)
- ✅ Solo campañas finalizadas (`fecha_fin IS NOT NULL`)
- ✅ Marca en cualquier campo (marca, marca2, ..., marca5)
- ✅ `LIMIT 1` para performance (solo necesitamos saber si existe)

---

## 🚀 Flujo de Reapertura Completo

### 1. Usuario Solicita Reapertura (Frontend)

```typescript
// Usuario hace clic en botón de reapertura
const handleReopenClick = async (campaign) => {
  // Validar primero
  const validation = await fetch(
    `/api/finished-campaigns/${campaign.id}/can-reopen`
  );

  if (!validation.ok || !validation.data.canReopen) {
    toast.error(validation.data.reason);
    return;
  }

  // Mostrar modal de confirmación
  setShowReopenConfirmModal(true);
  setCampaignToReopen(campaign);
};
```

### 2. Validación en Backend

```typescript
// GET /api/finished-campaigns/:id/can-reopen
async canReopenCampaign(req: Request, res: Response) {
  const id = parseInt(req.params.id);

  const service = FinishedCampaignFactory.getService();
  const validation = await service.canReopen(id);

  res.json({
    success: true,
    data: {
      canReopen: validation.canReopen,
      reason: validation.reason || 'La campaña puede ser reabierta'
    },
    timestamp: new Date().toISOString()
  });
}
```

### 3. Confirmación del Usuario

```typescript
// Modal de confirmación
<AlertDialog open={showReopenConfirmModal}>
  <AlertDialogContent>
    <AlertDialogTitle>¿Reabrir esta campaña?</AlertDialogTitle>
    <AlertDialogDescription>
      Esta acción reabrirá la campaña y permitirá que continúe activa.

      {campaignToReopen && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg">
          <p className="font-semibold">
            {campaignToReopen.clienteNombre} - Campaña #{campaignToReopen.numeroCampana}
          </p>
          <p className="text-sm mt-1">
            Marca: {campaignToReopen.marca} | Zona: {campaignToReopen.zona}
          </p>
        </div>
      )}
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleReopenCampaign}>
        Confirmar reapertura
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 4. Ejecución de Reapertura

```typescript
// POST /api/finished-campaigns/:id/reopen
async reopenCampaign(req: Request, res: Response) {
  const id = parseInt(req.params.id);

  // Validar nuevamente (seguridad)
  const service = FinishedCampaignFactory.getService();
  const validation = await service.canReopen(id);

  if (!validation.canReopen) {
    return res.status(400).json({
      success: false,
      error: validation.reason
    });
  }

  // Ejecutar reapertura
  const useCase = FinishedCampaignFactory.createReopenFinishedCampaignUseCase();
  const result = await useCase.execute(id);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: result.message
    });
  }

  res.json({
    success: true,
    message: result.message,
    campaignId: id,
    timestamp: new Date().toISOString()
  });
}
```

### 5. Actualización en Base de Datos

```typescript
// PostgresFinishedCampaignRepository.reopen()
async reopen(id: number): Promise<void> {
  await this.db.update(campanasComerciales)
    .set({ fechaFin: null })
    .where(eq(campanasComerciales.id, id));

  console.log(`✅ Campaña ${id} reabierta exitosamente`);
}
```

**Cambios en BD**:
```sql
-- ANTES
fecha_fin: '2024-06-30'

-- DESPUÉS
fecha_fin: NULL
```

### 6. Notificación WebSocket

```typescript
// Servidor envía evento a todos los clientes conectados
websocket.broadcast({
  type: 'campaign_update',
  action: 'reopen',
  campaignId: 38,
  timestamp: new Date().toISOString()
});
```

### 7. Actualización de UI

```typescript
// Frontend recibe evento y actualiza
ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'campaign_update') {
    // Invalidar queries para refrescar
    await queryClient.invalidateQueries(['/api/finished-campaigns']);
    await queryClient.invalidateQueries(['/api/dashboard/campanas-pendientes']);

    toast.success('Campaña reabierta exitosamente');
  }
};
```

**Efectos visuales**:
- ✅ Campaña desaparece de lista de finalizadas
- ✅ Campaña aparece en lista de pendientes
- ✅ Estado actualizado sin refresh manual

---

## 🎨 UX/UI de Reapertura

### Botón de Reapertura

```typescript
// Estado del botón según validación
const validation = canReopenCache.get(campaign.id);
const canReopen = validation?.canReopen || false;

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        onClick={() => handleReopen(campaign)}
        disabled={!canReopen}
        className={canReopen
          ? 'text-green-600 hover:bg-green-50'
          : 'text-slate-400 cursor-not-allowed'
        }
        data-testid={`reopen-campaign-${campaign.clienteNombre}`}
      >
        {isReopening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
      </Button>
    </TooltipTrigger>

    {!canReopen && (
      <TooltipContent>
        <p className="text-xs">{validation?.reason}</p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

**Estados visuales**:
- 🟢 **Verde**: Puede reabrirse (habilitado)
- ⚪ **Gris**: No puede reabrirse (deshabilitado)
- 🔄 **Spinner**: Reabriendo en proceso

### Caching de Validaciones

```typescript
// Cache en frontend para evitar queries repetidas
const [canReopenCache, setCanReopenCache] = useState<
  Map<number, { canReopen: boolean; reason: string }>
>(new Map());

// Validar al cargar campañas
useEffect(() => {
  if (campanasFinalizadas && campanasFinalizadas.length > 0) {
    const campaignsToValidate = campanasFinalizadas
      .filter(c => c.campaignId && !canReopenCache.has(c.campaignId));

    campaignsToValidate.forEach(campaign => {
      if (campaign.campaignId) {
        checkCanReopenCampaign(campaign.campaignId);
      }
    });
  }
}, [campanasFinalizadas]);
```

**Ventaja**: Una sola validación por campaña, luego desde cache.

### Optimistic Update

```typescript
// Actualizar UI inmediatamente sin esperar respuesta
const handleReopenCampaign = async () => {
  const campaignKey = `${campaign.cliente}-${campaign.numeroCampana}`;

  // Marcar como reabierta inmediatamente
  setReopenedCampaignIds(prev => new Set([...prev, campaignKey]));

  try {
    // Llamada a API
    await fetch(`/api/finished-campaigns/${campaign.id}/reopen`, {
      method: 'POST'
    });

    // Refrescar datos
    await queryClient.invalidateQueries(['/api/finished-campaigns']);
  } catch (error) {
    // Revertir si falla
    setReopenedCampaignIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(campaignKey);
      return newSet;
    });

    toast.error('Error al reabrir campaña');
  }
};
```

**Ventaja**: UX instantánea, sin esperar al servidor.

---

## ⚠️ Casos Edge y Manejo de Errores

### Caso 1: Campaña No Encontrada

```typescript
if (!campaign) {
  return {
    success: false,
    message: 'Campaña no encontrada',
    errors: ['CAMPAIGN_NOT_FOUND']
  };
}
```

### Caso 2: Campaña Ya Está Abierta

```typescript
if (!campaign.fechaFin) {
  return {
    success: false,
    message: 'La campaña ya está abierta',
    errors: ['CAMPAIGN_ALREADY_OPEN']
  };
}
```

### Caso 3: Campaña con Marcas Posteriores

```typescript
if (!isLastForAllBrands.isLast) {
  return {
    success: false,
    message: isLastForAllBrands.reason,
    errors: ['HAS_NEWER_CAMPAIGNS']
  };
}
```

### Caso 4: Error en Base de Datos

```typescript
try {
  await repository.reopen(id);
} catch (error) {
  console.error('❌ Error reopening campaign:', error);
  return {
    success: false,
    message: `Error al reabrir campaña: ${error.message}`,
    errors: ['DATABASE_ERROR']
  };
}
```

---

## 🧪 Testing de Reapertura

### Unit Test: Validación Simple

```typescript
describe('FinishedCampaignService.canReopen', () => {
  it('should allow reopening last finished campaign', async () => {
    const mockRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 1,
        fechaFin: '2024-06-30'
      })
    };

    const service = new FinishedCampaignService(mockRepository);
    const result = await service.canReopen(1);

    expect(result.canReopen).toBe(true);
  });

  it('should not allow reopening if newer campaign exists', async () => {
    // Mock setup para campaña con posterior
    const result = await service.canReopen(1);

    expect(result.canReopen).toBe(false);
    expect(result.reason).toContain('campaña posterior');
  });
});
```

### Integration Test: Reapertura Real

```typescript
describe('Reopen Campaign E2E', () => {
  it('should reopen campaign and move to pending', async () => {
    // 1. Verificar campaña en finalizadas
    const finishedResponse = await request(app)
      .get('/api/finished-campaigns');

    const campaign = finishedResponse.body.data.find(c => c.id === 38);
    expect(campaign).toBeDefined();

    // 2. Reabrir campaña
    const reopenResponse = await request(app)
      .post('/api/finished-campaigns/38/reopen');

    expect(reopenResponse.status).toBe(200);
    expect(reopenResponse.body.success).toBe(true);

    // 3. Verificar campaña ya no está en finalizadas
    const finishedAfter = await request(app)
      .get('/api/finished-campaigns');

    const campaignAfter = finishedAfter.body.data.find(c => c.id === 38);
    expect(campaignAfter).toBeUndefined();

    // 4. Verificar campaña está en pendientes
    const pendingResponse = await request(app)
      .get('/api/dashboard/campanas-pendientes');

    const campaignPending = pendingResponse.body.data.find(c => c.id === 38);
    expect(campaignPending).toBeDefined();
    expect(campaignPending.fechaFin).toBeNull();
  });
});
```

---

## 📊 Logs y Debugging

### Logs de Validación

```typescript
console.log(`🔍 [FinishedCampaignService] Validando campaña #${numeroCampana}`);
console.log(`   Cliente ID: ${clienteId}`);
console.log(`   Marcas: ${brands.map(b => b.marca).join(', ')}`);

for (const brand of brands) {
  console.log(`   ✅ Marca ${brand.marca}: Es la última`);
  // o
  console.log(`   ❌ Marca ${brand.marca}: Existe campaña posterior`);
}

console.log(`✅ [FinishedCampaignService] Campaña #${numeroCampana} puede reabrirse`);
```

### Logs de Reapertura

```typescript
console.log(`🔄 [PostgresFinishedCampaignRepository] Reabriendo campaña ID: ${id}`);
console.log(`✅ [PostgresFinishedCampaignRepository] Campaña ${id} reabierta exitosamente`);
```

---

## 🔗 Ver También

- [BUSINESS-LOGIC.md](./BUSINESS-LOGIC.md) - Reglas de negocio detalladas
- [API-REFERENCE.md](./API-REFERENCE.md) - Endpoints de reapertura
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Servicios involucrados
