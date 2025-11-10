# Lógica de Negocio - Finished Campaigns

Documentación de todas las reglas de negocio, cálculos y validaciones del módulo.

---

## 🎯 Definición de Campaña Finalizada

Una campaña es considerada **finalizada** cuando cumple:

```sql
WHERE fecha_fin IS NOT NULL
```

### Características

✅ **Tiene fecha de finalización** (`fecha_fin`) definida
✅ **Ya completó su ciclo** de entrega de leads
✅ **No recibe más leads automáticamente**
✅ **Puede reabrirse** bajo ciertas condiciones
✅ **Inversión pendiente = 0** (todo ya fue invertido)

---

## 📊 Cálculo de Métricas

### 1. Leads Enviados (enviados)

**Fuente**: Tabla `op_leads_rep` (consolidada)

**Cálculo**:
```typescript
// Usa función centralizada: contarLeadsYDuplicadosUnificado()
const enviados = await db
  .select({ count: count() })
  .from(opLeadsRep)
  .where(
    and(
      eq(opLeadsRep.assigned, true),
      eq(opLeadsRep.campaignId, campaign.id)
    )
  );
```

**Lógica**:
- ✅ Contar registros con `assigned = true`
- ✅ Del campaignId específico
- ✅ Desde `op_leads_rep` (datos consolidados)

### 2. Duplicados (duplicados)

**Fuente**: Tabla `op_leads_rep`

**Cálculo**:
```typescript
const duplicados = await db
  .select({
    totalDuplicates: sql<number>`
      CAST(
        COALESCE(
          SUM(
            COALESCE(
              array_length(duplicate_ids, 1),
              0
            )
          ),
          0
        ) AS INTEGER
      )`
  })
  .from(opLeadsRep)
  .where(
    and(
      eq(opLeadsRep.assigned, true),
      eq(opLeadsRep.campaignId, campaign.id)
    )
  );
```

**Lógica**:
- ✅ Suma de longitud de arrays `duplicate_ids[]`
- ✅ Solo leads asignados (`assigned = true`)
- ✅ Manejo de nulls con COALESCE

### 3. Días Procesados (diasProcesados)

**Fuente**: Tabla `op_lead` (para fechas)

**Cálculo**:
```typescript
const diasProcesados = await db
  .select({
    count: countDistinct(sql`date(${opLead.fechaCreacion})`)
  })
  .from(opLead)
  .where(eq(opLead.campaignId, campaign.id));
```

**Lógica**:
- ✅ Días únicos con datos
- ✅ Basado en `fecha_creacion`
- ✅ Usa `COUNT(DISTINCT date(...))`

### 4. Entregados Por Día (entregadosPorDia)

**Fórmula**:
```typescript
const entregadosPorDia = diasProcesados > 0
  ? enviados / diasProcesados
  : 0;
```

**Lógica**:
- ✅ Promedio de leads por día
- ✅ División segura (evita división por cero)
- ✅ Refleja ritmo de entrega real

### 5. Porcentaje de Datos Enviados (porcentajeDatosEnviados)

**Fórmula**:
```typescript
const porcentajeDatosEnviados = cantidadDatosSolicitados > 0
  ? (enviados / cantidadDatosSolicitados) * 100
  : 0;
```

**Lógica**:
- ✅ Progreso de completitud
- ✅ Puede ser > 100% si se entregó de más
- ✅ Usado para indicador visual

### 6. Faltantes a Enviar (faltantesAEnviar)

**Fórmula**:
```typescript
const faltantes = Math.max(0, cantidadDatosSolicitados - enviados);
```

**Lógica**:
- ✅ Diferencia entre solicitado y enviado
- ✅ Nunca negativo (Math.max con 0)
- ✅ Para campañas finalizadas, puede ser > 0 si no se completó

### 7. Inversión Realizada (inversionRealizada)

**Fórmula**:
```typescript
const inversionRealizada = enviados * cpl * 1.02;
```

**Lógica**:
- ✅ CPL × leads enviados
- ✅ Factor 1.02 (2% adicional)
- ✅ Basado en leads realmente entregados

### 8. Inversión Pendiente (inversionPendiente)

**Valor**:
```typescript
const inversionPendiente = 0; // Siempre 0 para finalizadas
```

**Lógica**:
- ✅ Campañas finalizadas no tienen inversión pendiente
- ✅ Todo ya fue invertido al cerrar la campaña

### 9. Porcentaje de Desvío (porcentajeDesvio)

**Fórmula**:
```typescript
const porcentajeDesvio = pedidosPorDia > 0
  ? ((entregadosPorDia - pedidosPorDia) / pedidosPorDia) * 100
  : 0;
```

**Interpretación**:
- ✅ **Positivo (+)**: Entregamos más de lo pedido por día
- ✅ **Negativo (-)**: Entregamos menos de lo pedido por día
- ✅ **Cero (0%)**: Entregamos exactamente lo pedido

**Ejemplos**:
```
Pedidos por día: 30
Entregados por día: 35
Desvío: ((35 - 30) / 30) * 100 = +16.67%

Pedidos por día: 30
Entregados por día: 25
Desvío: ((25 - 30) / 30) * 100 = -16.67%
```

### 10. Es Superior a 100% (esSuperior100)

**Fórmula**:
```typescript
const esSuperior100 = porcentajeDatosEnviados > 100;
```

**Lógica**:
- ✅ Flag booleano para UI
- ✅ Indica sobre-entrega
- ✅ Puede mostrar badge especial

---

## ✅ Reglas de Validación de Reapertura

### Regla #1: La campaña debe estar finalizada

```typescript
if (!campaign.fechaFin) {
  return {
    canReopen: false,
    reason: 'La campaña no está finalizada'
  };
}
```

**Lógica**:
- ✅ Solo campañas con `fecha_fin` pueden reabrirse
- ✅ Campañas activas no necesitan reapertura

### Regla #2: Debe ser la última finalizada para TODAS sus marcas

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

**Lógica**:
- ✅ Verifica TODAS las marcas de la campaña
- ✅ Cada marca debe ser su última campaña finalizada
- ✅ Soporta campañas multimarca (hasta 5 marcas)

### Ejemplo Complejo: Campaña Multimarca

```
Red Finance - Campaña #1: Fiat 50% + Peugeot 50% (finalizada)
Red Finance - Campaña #2: Fiat 100% (finalizada)
Red Finance - Campaña #3: Peugeot 100% (finalizada)

Validación de reapertura:
┌─────────────┬───────────────────────┬────────────┐
│ Campaña     │ Marcas                │ ¿Reabrir?  │
├─────────────┼───────────────────────┼────────────┤
│ #1          │ Fiat + Peugeot        │ ❌ NO      │
│             │ Fiat → tiene #2       │            │
│             │ Peugeot → tiene #3    │            │
├─────────────┼───────────────────────┼────────────┤
│ #2          │ Fiat                  │ ✅ SÍ      │
│             │ Fiat → última         │            │
├─────────────┼───────────────────────┼────────────┤
│ #3          │ Peugeot               │ ✅ SÍ      │
│             │ Peugeot → última      │            │
└─────────────┴───────────────────────┴────────────┘
```

### Detección de Campañas Posteriores

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
        eq(campanasComerciales.clienteId, clienteId),
        sql`CAST(${campanasComerciales.numeroCampana} AS INTEGER) > ${numeroCampana}`,
        sql`${campanasComerciales.fechaFin} IS NOT NULL`,
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

**Lógica**:
- ✅ Busca mismo cliente
- ✅ Número de campaña mayor
- ✅ Debe estar finalizada (`fecha_fin IS NOT NULL`)
- ✅ Marca en cualquiera de los 5 campos posibles

---

## 🔄 Proceso de Reapertura

### Paso 1: Validación Previa

```typescript
const validation = await service.canReopen(campaignId);

if (!validation.canReopen) {
  throw new Error(validation.reason);
}
```

### Paso 2: Reapertura en Base de Datos

```typescript
await db.update(campanasComerciales)
  .set({ fechaFin: null })
  .where(eq(campanasComerciales.id, campaignId));
```

**Efecto**:
- ✅ `fecha_fin` se vuelve `NULL`
- ✅ La campaña deja de ser "finalizada"
- ✅ Vuelve a aparecer en campañas pendientes

### Paso 3: Notificación WebSocket

```typescript
// Se envía automáticamente desde el servidor
{
  type: 'campaign_update',
  action: 'reopen',
  campaignId: 38,
  timestamp: '2025-01-09T...'
}
```

**Efecto**:
- ✅ UIs conectadas se actualizan automáticamente
- ✅ Campañas pendientes refrescan datos
- ✅ Campañas finalizadas eliminan la campaña reabierta

### Paso 4: Actualización de Estado

```typescript
// Frontend optimistic update
setReopenedCampaignIds(prev => new Set([...prev, campaignKey]));

// Invalidar queries
await queryClient.invalidateQueries(['/api/finished-campaigns']);
await queryClient.invalidateQueries(['/api/dashboard/campanas-pendientes']);
```

---

## 📈 Estadísticas Agregadas

### FinishedCampaignStats

```typescript
interface FinishedCampaignStats {
  totalCampaigns: number;           // Total de campañas
  totalInvestment: number;          // Suma de inversiones
  totalLeadsAssigned: number;       // Suma de leads enviados
  averageProgress: number;          // Promedio de progreso
  totalDuplicates: number;          // Suma de duplicados
  averageCompletionDays: number;    // Promedio de duración
}
```

### Cálculo

```typescript
const stats: FinishedCampaignStats = {
  totalCampaigns: campaigns.length,
  totalInvestment: 0,
  totalLeadsAssigned: 0,
  averageProgress: 0,
  totalDuplicates: 0,
  averageCompletionDays: 0
};

let totalProgress = 0;
let totalDays = 0;

campaigns.forEach(campaign => {
  stats.totalLeadsAssigned += campaign.enviados;
  stats.totalInvestment += campaign.inversionRealizada;
  stats.totalDuplicates += campaign.duplicados;
  totalProgress += campaign.porcentajeDatosEnviados;

  // Calcular días de duración
  const start = new Date(campaign.fechaCampana);
  const end = new Date(campaign.fechaFin);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  totalDays += days;
});

stats.averageProgress = totalProgress / campaigns.length;
stats.averageCompletionDays = totalDays / campaigns.length;
```

---

## 🎨 Lógica de Visualización

### Color de Progreso

```typescript
const progressColor = porcentajeDatosEnviados > 100
  ? 'bg-gradient-to-r from-green-500 to-green-600'  // Sobre-entrega
  : 'bg-gradient-to-r from-blue-500 to-blue-600';   // Normal
```

### Color de Desvío

```typescript
const desvioColor = desvio > 0
  ? 'text-green-600'    // Positivo (entregamos más)
  : desvio < 0
    ? 'text-red-600'    // Negativo (entregamos menos)
    : 'text-slate-600'; // Cero (exacto)
```

### Badge de Duplicados

```typescript
if (duplicados > 0) {
  return (
    <Badge className="bg-gradient-to-r from-orange-500 to-red-500">
      {duplicados}
    </Badge>
  );
}
```

### Botón de Reapertura

```typescript
const canReopen = canReopenCache.get(campaignId)?.canReopen || false;

<Button
  disabled={!canReopen}
  className={canReopen
    ? 'text-green-600 hover:bg-green-50'
    : 'text-slate-400 cursor-not-allowed'
  }
>
  <RotateCcw />
</Button>
```

---

## 🔍 Filtros y Búsquedas

### Filtro por Duplicados

```typescript
if (showDuplicatesOnly) {
  filtered = filtered.filter(data => {
    const duplicados = typeof data.duplicados === 'number'
      ? data.duplicados
      : 0;
    return duplicados > 0;
  });
}
```

### Filtro por Fecha de Cierre

```typescript
if (fechaCierreInicio && fechaCierreFin) {
  filtered = filtered.filter(data => {
    const fechaCierre = data.fechaFinReal || data.fechaFin;
    return fechaCierre >= fechaCierreInicio &&
           fechaCierre <= fechaCierreFin;
  });
}
```

### Ordenamiento

```typescript
filtered.sort((a, b) => {
  const fechaA = a.fechaFinReal || a.fechaFin || '1970-01-01';
  const fechaB = b.fechaFinReal || b.fechaFin || '1970-01-01';

  return sortByDate === 'desc'
    ? new Date(fechaB).getTime() - new Date(fechaA).getTime()
    : new Date(fechaA).getTime() - new Date(fechaB).getTime();
});
```

---

## 🚨 Casos Especiales

### Campaña sin CPL

```typescript
if (!cpl || cpl === 0) {
  inversionRealizada = 0;
  inversionPendiente = 0;
}
```

**Efecto**: Inversión se muestra como $0 o "-"

### Campaña sin Leads

```typescript
if (enviados === 0) {
  porcentajeDatosEnviados = 0;
  entregadosPorDia = 0;
  porcentajeDesvio = 0;
}
```

**Efecto**: Métricas en 0, sin errores de división

### Campaña Sobre 100%

```typescript
if (porcentajeDatosEnviados > 100) {
  esSuperior100 = true;
  faltantes = 0;
  inversionPendiente = 0;
}
```

**Efecto**:
- ✅ Badge especial verde
- ✅ No hay faltantes
- ✅ No hay inversión pendiente

---

## 📊 Consistencia con Campañas Pendientes

### Misma Lógica de Conteo

```typescript
// AMBOS módulos usan:
import { contarLeadsYDuplicadosUnificado } from '@shared/utils/campaign-counting-utils';

const { enviados, duplicados } = await contarLeadsYDuplicadosUnificado(
  campaign,
  cliente,
  db,
  opLeadsRep,
  opLead,
  count,
  campanasComerciales
);
```

**Garantía**:
- ✅ Números idénticos antes y después de finalizar
- ✅ Transición pendiente→finalizada sin cambios
- ✅ Fuente de datos única: `op_leads_rep`

### Diferencias Clave

| Métrica | Pendientes | Finalizadas |
|---------|------------|-------------|
| `inversionPendiente` | Calculada dinámicamente | Siempre 0 |
| `faltantes` | Positivo si incompleto | Puede ser > 0 |
| `estadoCampana` | "Activa" o varios | "Finalizada" |
| Reapertura | No aplica | Disponible |

---

## 🎯 Objetivos de Negocio

### 1. Análisis Histórico

✅ Entender rendimiento pasado
✅ Identificar patrones de éxito
✅ Detectar problemas recurrentes

### 2. Gestión de Duplicados

✅ Visualizar campañas con duplicados
✅ Analizar impacto en inversión
✅ Optimizar procesos futuros

### 3. Control de Inversión

✅ Calcular inversión total realizada
✅ Comparar con presupuesto original
✅ ROI por campaña finalizada

### 4. Flexibilidad Operativa

✅ Reabrir campañas si es necesario
✅ Continuar entrega de leads
✅ Corrección de errores

---

## 🔗 Ver También

- [REOPEN-CAMPAIGN.md](./REOPEN-CAMPAIGN.md) - Detalles de reapertura
- [DATA-FLOW.md](./DATA-FLOW.md) - Flujo de enriquecimiento
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Servicios de dominio
