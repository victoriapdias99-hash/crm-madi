# Tests E2E de UX - Cierre de Campañas

## 📋 Descripción

Este test automatizado con Playwright verifica la experiencia de usuario completa del proceso de cierre de campañas, identificando posibles problemas de UX.

## 🎯 Objetivos del Test

### 1. **Progreso en Tiempo Real**
- ✅ Verificar que la barra de progreso aparece inmediatamente
- ✅ Confirmar que el porcentaje se actualiza progresivamente (0% → 100%)
- ✅ Validar que los mensajes son claros y descriptivos
- ✅ Verificar WebSocket funciona correctamente

### 2. **Actualización Automática**
- ✅ Campaña desaparece de "Activas" sin reload manual
- ✅ Tabla se actualiza vía WebSocket
- ✅ Contadores se actualizan correctamente

### 3. **Feedback Visual**
- ✅ Indicadores de carga visibles
- ✅ Mensajes de éxito/error claros
- ✅ Estados deshabilitados durante procesamiento
- ✅ Animaciones fluidas

### 4. **Manejo de Errores**
- ✅ Mensajes de error claros
- ✅ Botones se rehabilitan tras error
- ✅ Estados consistentes

## 🚀 Requisitos Previos

1. **Servidor corriendo** en `http://localhost:5000`
   ```bash
   npx tsx server/index.ts
   ```

2. **Base de datos con campañas activas**
   - Al menos 1 campaña en estado "En proceso"
   - Leads disponibles para asignar

3. **Playwright instalado**
   ```bash
   npm install --save-dev @playwright/test
   npx playwright install
   ```

## 🏃 Ejecutar Tests

### Modo Interactivo (Recomendado para desarrollo)
```bash
npx playwright test --ui
```

### Modo Headless (CI/CD)
```bash
npx playwright test
```

### Solo el test de cierre de campañas
```bash
npx playwright test campaign-closure-ux.spec.ts
```

### Con navegador visible (Debug)
```bash
npx playwright test --headed
```

### Modo debug paso a paso
```bash
npx playwright test --debug
```

## 📸 Screenshots Capturados

Durante la ejecución, se capturan screenshots automáticos en momentos clave:

```
screenshots/
├── 01-estado-inicial.png          # Tabla inicial con campañas
├── 02-antes-menu-click.png        # Antes de abrir menú
├── 03-menu-abierto.png             # Menú de acciones abierto
├── 04-modal-confirmacion.png       # Modal de confirmación visible
├── 05-confirmacion-enviada.png     # Después de confirmar
├── 06-progreso-inicial.png         # Barra de progreso aparece
├── 07-progreso-20.png              # Progreso al 20%
├── 08-progreso-50.png              # Progreso al 50%
├── 09-progreso-90.png              # Progreso al 90%
├── 10-progreso-100.png             # Progreso completado
├── 11-mensaje-exito.png            # Toast de éxito
├── 12-tabla-actualizada.png        # Tabla sin la campaña cerrada
├── modal-diseño.png                # Diseño del modal
├── boton-deshabilitado.png         # Estado deshabilitado
└── test-final-*.png                # Estado final de cada test
```

## 📊 Reports

Después de ejecutar los tests, se generan reports automáticos:

### Ver report HTML
```bash
npx playwright show-report
```

### Ubicaciones de reports
- **HTML**: `playwright-report/index.html`
- **JSON**: `test-results.json`
- **Videos**: `test-results/` (solo en fallas)
- **Traces**: `test-results/` (solo en fallas)

## 🔍 Problemas de UX que Detecta

### ❌ **Problema 1: Progress Bar No Aparece**
**Síntoma**: Usuario hace clic pero no ve progreso
**Detecta**: `expect(progressBar).toBeVisible({ timeout: 5000 })`

### ❌ **Problema 2: Progreso No Se Actualiza**
**Síntoma**: Barra queda estática en 0%
**Detecta**: Monitoreo de `progresoActualizado` durante 60 segundos

### ❌ **Problema 3: Actualización Manual Requerida**
**Síntoma**: Usuario debe refrescar página
**Detecta**: Comparación de `campanasInicialesCount` vs `campanasFinalesCount`

### ❌ **Problema 4: WebSocket No Conecta**
**Síntoma**: Sin actualizaciones en tiempo real
**Detecta**: Timeout si progreso no cambia en 60 segundos

### ❌ **Problema 5: Mensajes Confusos**
**Síntoma**: Usuario no entiende qué está pasando
**Detecta**: Verificación de mensajes claros en cada fase

### ❌ **Problema 6: Botón No Se Deshabilita**
**Síntoma**: Permite múltiples clics (doble cierre)
**Detecta**: `text=Cerrando campaña. Espere` debe estar visible

### ❌ **Problema 7: Sin Feedback de Errores**
**Síntoma**: Falla silenciosamente
**Detecta**: Toast de error debe aparecer en failures

## 🎨 Selectores Clave Utilizados

```typescript
// Progress Bar
'[role="progressbar"]'
'[data-testid="progress-${cliente}"]'

// Botones
'text=Cerrar Campaña'
'button:has-text("Cerrar Campaña")'
'button[role="combobox"]'

// Modal
'text=Confirmar Cierre de Campaña'
'button:has-text("Cancelar")'

// Mensajes
'text=Campaña cerrada exitosamente'
'text=Cerrando campaña. Espere'

// Tabla
'table tbody tr'
```

## 📝 Estructura del Test

```typescript
test.describe('UX - Cierre de Campaña Completo', () => {
  // Test 1: Progreso en tiempo real ⭐ Principal
  test('Debe mostrar progreso en tiempo real', async () => {
    // 1. Estado inicial
    // 2. Abrir menú
    // 3. Clic en cerrar
    // 4. Confirmar
    // 5. Monitorear progreso
    // 6. Verificar éxito
    // 7. Verificar tabla actualizada
  });

  // Test 2: Actualización automática
  test('Debe actualizar tabla sin reload', async () => {
    // Contar antes
    // Cerrar campaña
    // Esperar
    // Contar después
    // Comparar
  });

  // Test 3: Estado deshabilitado
  test('Debe deshabilitar botón durante proceso', async () => {
    // Iniciar cierre
    // Intentar abrir mismo menú
    // Verificar está deshabilitado
  });

  // Test 4: Manejo de errores
  test('Debe mostrar mensaje de error claro', async () => {
    // Simular escenario de error
    // Verificar toast de error
  });
});
```

## 🐛 Debugging

### Ver qué ve Playwright
```bash
npx playwright test --headed --slow-mo=1000
```

### Inspector de Playwright
```bash
npx playwright test --debug
```

### Generar código del test
```bash
npx playwright codegen http://localhost:5000
```

### Ver trace de un test fallido
```bash
npx playwright show-trace test-results/trace.zip
```

## ⚙️ Configuración Avanzada

### Timeout personalizado
```typescript
test.setTimeout(300000); // 5 minutos
```

### Retry en fallas
```typescript
test.describe.configure({ retries: 2 });
```

### Ejecutar en múltiples navegadores
Editar `playwright.config.ts` y descomentar:
```typescript
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

## 📈 Métricas de Performance

El test también mide:
- ⏱️ Tiempo de respuesta inicial (< 1s esperado)
- 📊 Frecuencia de actualización de progreso
- 🔄 Tiempo total de cierre
- 📡 Latencia del WebSocket

## 🚨 Troubleshooting

### Error: "Browser not installed"
```bash
npx playwright install chromium
```

### Error: "Timeout waiting for element"
- Verificar que el servidor está corriendo
- Verificar que hay campañas activas
- Aumentar timeout en el test

### Screenshots no se guardan
```bash
mkdir -p screenshots
chmod 777 screenshots
```

### WebSocket no conecta
- Verificar firewall
- Verificar puerto 5000 abierto
- Ver logs del servidor

## 📚 Referencias

- [Playwright Docs](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors](https://playwright.dev/docs/selectors)
- [Test Assertions](https://playwright.dev/docs/test-assertions)

## 🎯 Próximos Tests

- [ ] Test de múltiples cierres en paralelo
- [ ] Test de reconexión WebSocket
- [ ] Test de cambio de pestaña durante proceso
- [ ] Test responsive (mobile)
- [ ] Test de accesibilidad (a11y)
