import { test, chromium } from '@playwright/test';

const VERCEL_URL = process.env.VERCEL_URL || 'https://administracion-medica-industrial.vercel.app';

test('Vista companies con tabla densa', async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${VERCEL_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'admin@sistema.com');
  await page.fill('input[type="password"]', 'Admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Navigate
  console.log('Going to /companies');
  await page.goto(`${VERCEL_URL}/companies`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/companies-table.png', fullPage: true });
  console.log('URL:', page.url());

  // Detectar tipo de layout
  const tableCount = await page.locator('table').count();
  const cardCount = await page.locator('div.group').count();
  const checkboxInTable = await page.locator('table input[type="checkbox"]').count();
  console.log('Tablas:', tableCount, 'Cards (legacy):', cardCount, 'Checkboxes en tabla:', checkboxInTable);

  // Inspeccionar una fila
  const firstRow = page.locator('tbody tr').first();
  if (await firstRow.count() > 0) {
    const rowBox = await firstRow.boundingBox();
    console.log('Primera fila bbox:', JSON.stringify(rowBox));
  }

  // Detectar header
  const theadVisible = await page.locator('thead').isVisible();
  console.log('thead visible:', theadVisible);

  // Probar checkbox "select all"
  if (checkboxInTable > 0) {
    const selectAll = page.locator('thead input[type="checkbox"]');
    await selectAll.click();
    await page.waitForTimeout(500);
    const selectedRows = await page.locator('tbody input[type="checkbox"]:checked').count();
    console.log('Filas seleccionadas tras select all:', selectedRows);
    await page.screenshot({ path: '/tmp/companies-table-selected.png', fullPage: true });
    // Desmarcar
    await selectAll.click();
  }

  console.log('Title:', await page.title());

  // Body excerpt
  const bodyText = await page.locator('body').innerText();
  console.log('\n=== BODY (primeros 1500 chars) ===');
  console.log(bodyText.substring(0, 1500));

  await browser.close();
});
