# Objective
Corregir la atribución del Gasto Meta Ads cuando múltiples campañas CRM comparten la misma fuente de Meta Ads (misma marca + zona + fechas). Actualmente cada campaña CRM muestra el 100% del gasto de Meta, cuando debería dividirse equitativamente entre todas las campañas que comparten esa fuente.

**Ejemplo concreto:**
- BAIC AMBA Enero: $836.743 total en Meta Ads
- 2 campañas CRM activas con BAIC AMBA en enero → clave idéntica
- Resultado correcto: cada una muestra $418.371 (÷ 2)

**Solución técnica (100% frontend, sin cambios en backend):**
La clave `makeSpendKey` ya agrupa por `marca|zona|fechaInicio|fechaFin`. Si N campañas tienen la misma clave, comparten el mismo gasto de Meta y deben dividirlo. Se agrega un `campaignCountMap` que cuenta cuántas campañas comparten cada clave, y al renderizar cada fila se divide el spend y los resultados por ese número. El CPL (que es un ratio unitario) no se divide: se recalcula desde los valores divididos.

El tooltip del Gasto Meta Ads mostrará el detalle cuando hay división: "Total Meta: $836.743 ÷ 2 campañas".

# Tasks

### T001: campanas-pendientes.tsx — Agregar campaignCountMap y dividir spend por fila
- **Blocked By**: []
- **Details**:
  - Agregar estado: `const [campaignCountMap, setCampaignCountMap] = useState<Map<string, number>>(new Map());`
  - En el `useEffect` del spendMap (línea ~206), dentro del loop `datosDiarios.forEach`, construir también el conteo por clave y llamar a `setCampaignCountMap(countMap)` antes del `setSpendMap(new Map())`
  - En el cell render de la fila (línea ~1148), después de `spendMap.get(sk)`, agregar:
    ```typescript
    const divisor = campaignCountMap.get(sk) || 1;
    const spend = spendData.spend / divisor;
    const results = spendData.results / divisor;
    const cpl = results > 0 ? spend / results : 0;
    ```
  - Reemplazar todos los `spendData.spend`, `spendData.results`, `spendData.cpl` en el bloque financiero con las variables `spend`, `results`, `cpl`
  - Actualizar el `TooltipContent`: si `divisor > 1`, agregar línea "Total Meta: {fmtCur(spendData.spend)} ÷ {divisor} campañas"
  - Files: `client/src/pages/campanas-pendientes.tsx`
  - Acceptance: Con 2 campañas BAIC AMBA mismas fechas, cada una muestra la mitad del gasto

### T002: campanas-finalizadas.tsx — Mismo tratamiento
- **Blocked By**: []
- **Details**:
  - Idéntico a T001 aplicado a `campanas-finalizadas.tsx`
  - `useEffect` está en línea ~342, cell render en línea ~874
  - Files: `client/src/pages/campanas-finalizadas.tsx`
  - Acceptance: Mismo comportamiento que T001

### T003: datos-diarios-dashboard.tsx — Mismo tratamiento (aplica a ambas tablas del dashboard)
- **Blocked By**: []
- **Details**:
  - Idéntico a T001 aplicado a `datos-diarios-dashboard.tsx`
  - El `useEffect` del spendMap está en línea ~464
  - Hay 2 cell renders con columnas financieras: tabla "en proceso" (~línea 1967) y tabla "finalizadas" (~línea 2397) — ambos deben usar el mismo `campaignCountMap`
  - Files: `client/src/pages/datos-diarios-dashboard.tsx`
  - Acceptance: Mismo comportamiento que T001 en el dashboard principal
