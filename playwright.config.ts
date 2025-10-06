import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  // Timeout global por test
  timeout: 180000, // 3 minutos por test

  // Configuración de reintentos
  retries: 1, // Reintentar una vez si falla

  // Trabajadores en paralelo
  workers: 1, // Un solo worker para evitar conflictos

  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }]
  ],

  use: {
    // URL base
    baseURL: 'http://localhost:5000',

    // Capturar screenshot en fallas
    screenshot: 'only-on-failure',

    // Capturar video en fallas
    video: 'retain-on-failure',

    // Trace en fallas
    trace: 'on-first-retry',

    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // Proyectos de navegadores
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Descomentar para probar en más navegadores
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // Web Server
  // Descomentar si quieres que Playwright inicie el servidor automáticamente
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5000',
  //   reuseExistingServer: true,
  //   timeout: 120000,
  // },
});
