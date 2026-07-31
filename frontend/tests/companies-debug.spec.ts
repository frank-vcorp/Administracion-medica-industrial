import { test, chromium } from '@playwright/test';

const VERCEL_URL = process.env.VERCEL_URL || 'https://administracion-medica-industrial.vercel.app';

test('Visualizar /companies para SUPERADMIN', async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login as SUPERADMIN
  await page.goto(`${VERCEL_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'admin@sistema.com');
  await page.fill('input[type="password"]', 'Admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Navigate to /companies
  console.log('Going to /companies');
  await page.goto(`${VERCEL_URL}/companies`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/companies-superadmin.png', fullPage: true });
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  const bodyText = await page.locator('body').innerText();
  console.log('\n=== LAYOUT INFO ===');
  console.log('Body length:', bodyText.length);

  // Inspeccionar cuántos cards se ven y cuántos contienen "Configurar Empresa"
  const configButtons = await page.locator('a:has-text("Configurar Empresa")').count();
  console.log('Tarjetas con "Configurar Empresa":', configButtons);

  // Detectar grid: contar width de las primeras tarjetas
  if (configButtons > 0) {
    const firstBox = await page.locator('a:has-text("Configurar Empresa")').first().boundingBox();
    console.log('Primera tarjeta bbox:', JSON.stringify(firstBox));
    if (configButtons >= 2) {
      const secondBox = await page.locator('a:has-text("Configurar Empresa")').nth(1).boundingBox();
      console.log('Segunda tarjeta bbox:', JSON.stringify(secondBox));
    }
  }

  // Detectar selector de columnas
  const gridContainer = page.locator('div.grid').filter({ hasText: 'Configurar Empresa' }).first();
  const gridClass = await gridContainer.getAttribute('class');
  console.log('Grid container class:', gridClass);

  // Mostrar primeros 3000 chars del body
  console.log('\n=== BODY (primeros 2000 chars) ===');
  console.log(bodyText.substring(0, 2000));

  await browser.close();
});
