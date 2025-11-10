import { test, expect } from '@playwright/test';

test('Test cierre de campaña y actualización WebSocket', async ({ page }) => {
  const consoleLogs: string[] = [];
  const websocketMessages: any[] = [];

  // Capturar todos los console.log del navegador
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    console.log(`🖥️ BROWSER CONSOLE [${msg.type()}]:`, text);
  });

  // Capturar mensajes WebSocket
  page.on('websocket', ws => {
    console.log(`🔌 WebSocket abierto: ${ws.url()}`);

    ws.on('framereceived', event => {
      try {
        const data = JSON.parse(event.payload.toString());
        websocketMessages.push(data);
        console.log('📨 WebSocket RECIBIDO:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('📨 WebSocket RECIBIDO (raw):', event.payload.toString());
      }
    });

    ws.on('framesent', event => {
      try {
        const data = JSON.parse(event.payload.toString());
        console.log('📤 WebSocket ENVIADO:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('📤 WebSocket ENVIADO (raw):', event.payload.toString());
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket cerrado');
    });
  });

  console.log('🚀 Navegando a la página de datos diarios...');
  await page.goto('http://localhost:5000/datos-diarios');

  console.log('⏳ Esperando que la página cargue...');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Esperar a que WebSocket se conecte

  console.log('📸 Estado inicial - Buscando campañas de ALBENS...');

  // Buscar tabla de campañas "En Proceso"
  const enProcesoSection = page.locator('text=En Proceso').first();
  await expect(enProcesoSection).toBeVisible({ timeout: 10000 });

  console.log('🔍 Buscando campañas de ALBENS en "En Proceso"...');

  // Capturar el estado antes del cierre
  const campanasAntes = await page.locator('tr').filter({ hasText: 'ALBENS' }).count();
  console.log(`📊 Campañas de ALBENS encontradas: ${campanasAntes}`);

  // Buscar el primer botón de cierre para ALBENS
  console.log('🔍 Buscando botón de cierre para ALBENS...');
  const albensRow = page.locator('tr').filter({ hasText: 'ALBENS' }).first();
  const cerrarButton = albensRow.locator('button').filter({ hasText: /cerrar|finalizar/i }).first();

  const isVisible = await cerrarButton.isVisible().catch(() => false);
  if (!isVisible) {
    console.log('⚠️ No se encontró botón de cierre visible. Verificando estructura...');
    const rowText = await albensRow.textContent();
    console.log('📋 Contenido de la fila:', rowText);

    // Intentar encontrar cualquier botón en la fila
    const buttons = albensRow.locator('button');
    const buttonCount = await buttons.count();
    console.log(`🔘 Botones encontrados en la fila: ${buttonCount}`);

    for (let i = 0; i < buttonCount; i++) {
      const buttonText = await buttons.nth(i).textContent();
      console.log(`  Botón ${i + 1}: "${buttonText}"`);
    }
  }

  console.log('🖱️ Haciendo clic en el botón de cierre...');
  await cerrarButton.click();

  console.log('⏳ Esperando confirmación (si hay modal)...');
  await page.waitForTimeout(500);

  // Buscar modal de confirmación
  const confirmButton = page.locator('button').filter({ hasText: /confirmar|sí|aceptar/i }).first();
  const modalVisible = await confirmButton.isVisible().catch(() => false);

  if (modalVisible) {
    console.log('✅ Modal de confirmación encontrado, confirmando...');
    await confirmButton.click();
  } else {
    console.log('ℹ️ No se encontró modal de confirmación');
  }

  console.log('⏳ Esperando respuesta del servidor...');
  await page.waitForTimeout(3000); // Esperar cierre + WebSocket broadcast

  console.log('\n📊 RESUMEN DE LOGS DE CONSOLA:');
  console.log('=' .repeat(80));

  const websocketLogs = consoleLogs.filter(log =>
    log.includes('WebSocket') ||
    log.includes('dashboard_refresh') ||
    log.includes('campaign_update') ||
    log.includes('Refrescando')
  );

  console.log('\n🔌 Logs de WebSocket:');
  websocketLogs.forEach(log => console.log(log));

  console.log('\n📨 Mensajes WebSocket recibidos:');
  websocketMessages.forEach((msg, i) => {
    console.log(`\nMensaje ${i + 1}:`, JSON.stringify(msg, null, 2));
  });

  console.log('\n🔍 Verificando si recibió dashboard_refresh...');
  const receivedDashboardRefresh = websocketMessages.some(msg => msg.type === 'dashboard_refresh');
  console.log(`✅ dashboard_refresh recibido: ${receivedDashboardRefresh}`);

  console.log('\n🔍 Verificando logs de invalidación de queries...');
  const invalidationLogs = consoleLogs.filter(log =>
    log.includes('invalidate') ||
    log.includes('Refrescando todos los datos')
  );
  console.log(`Logs de invalidación encontrados: ${invalidationLogs.length}`);
  invalidationLogs.forEach(log => console.log(log));

  console.log('\n📸 Estado final después del cierre...');
  await page.waitForTimeout(2000); // Esperar actualización del UI

  const campanasDespues = await page.locator('tr').filter({ hasText: 'ALBENS' }).count();
  console.log(`📊 Campañas de ALBENS después: ${campanasDespues}`);

  console.log('\n✅ Test completado');
  console.log('='.repeat(80));
});
