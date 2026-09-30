/**
 * @file Configuración mínima de Playwright para LOTE-20260820-01 (CommonJS).
 * @id IMPL-20260820-06 / LOTE-20260820-01 Unidad 4
 */
const path = require('node:path')

module.exports = {
  testDir: __dirname,
  testMatch: ['lote-nocturno.spec.cjs'],
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    launchOptions: {
      executablePath: '/opt/kilo-playwright-browsers/chromium-1237/chrome-linux64/chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
  },
  outputDir: '/tmp/kilo/lote-playwright-output',
}