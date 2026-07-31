import { test, expect, chromium } from '@playwright/test';

const VERCEL_URL = process.env.VERCEL_URL || 'https://administracion-medica-industrial.vercel.app';

test.describe('Sucursales - Diagnóstico', () => {

  test('Login → /branches → click Configurar en branch-matriz', async () => {
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    // Capturar todo
    page.on('console', msg => console.log('[console.' + msg.type() + ']', msg.text()));
    page.on('pageerror', err => console.log('[PAGEERROR]', err.message));
    page.on('requestfailed', request =>
      console.log('[REQ FAIL]', request.url(), request.failure()?.errorText)
    );
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log('[HTTP ' + response.status() + ']', response.url());
      }
    });

    // 1. Login
    console.log('STEP 1: goto /login');
    await page.goto(`${VERCEL_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@sistema.com');
    await page.fill('input[type="password"]', 'Admin123');
    await page.click('button[type="submit"]');

    // Esperar redirect a dashboard o branch
    console.log('STEP 2: waiting for redirect...');
    await page.waitForTimeout(8000);
    console.log('After login attempt, URL:', page.url());
    await page.screenshot({ path: '/tmp/after-login.png', fullPage: true });

    // Si el login falló, la página sigue en /login
    if (page.url().includes('/login')) {
      console.log('LOGIN FAILED. Capturando pantalla y body');
      const bodyText = await page.locator('body').innerText();
      console.log('---LOGIN BODY---');
      console.log(bodyText);
      console.log('---END LOGIN BODY---');
      await browser.close();
      return;
    }

    // 2. Navigate to /branches
    console.log('STEP 3: goto /branches');
    await page.goto(`${VERCEL_URL}/branches`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Capturar screenshot
    await page.screenshot({ path: '/tmp/branches-list.png', fullPage: true });
    console.log('Branches URL:', page.url());
    console.log('Branches title:', await page.title());

    const branchCount = await page.locator('a:has-text("Configurar")').count();
    console.log('Branches visibles con botón "Configurar":', branchCount);

    // 3. Si hay branches, hacer click en Configurar
    if (branchCount > 0) {
      console.log('STEP 4: click en primer "Configurar"');
      const firstConfigLink = page.locator('a:has-text("Configurar")').first();
      const href = await firstConfigLink.getAttribute('href');
      console.log('href del link:', href);

      await firstConfigLink.click();
      await page.waitForTimeout(5000);

      await page.screenshot({ path: '/tmp/branch-detail.png', fullPage: true });
      console.log('After click URL:', page.url());
      console.log('Detail title:', await page.title());

      const bodyText = await page.locator('body').innerText();
      console.log('Body contiene "404":', bodyText.includes('404'));
      console.log('Body contiene "Sucursales":', bodyText.includes('Sucursales'));
      console.log('Body contiene "General":', bodyText.includes('General'));
      console.log('Body contiene "Operación":', bodyText.includes('Operación'));

      // HTML completo para ver si hay clues del error
      const html = await page.content();
      console.log('HTML length:', html.length);
      console.log('HTML contains "This page could not be found":', html.includes('could not be found'));
      console.log('HTML contains "notFound":', html.includes('notFound'));
      // Search for any error indicators
      const errorMatch = html.match(/(error|Error|notFound|crash|digest|Stack)[^<]{0,200}/g);
      if (errorMatch) {
        console.log('---ERROR CLUES---');
        errorMatch.slice(0, 5).forEach(m => console.log(' ', m));
      }

      // Body summary
      console.log('---BODY SUMMARY---');
      console.log(bodyText.substring(0, 1000));
      console.log('---END BODY---');
    } else {
      console.log('NO HAY BRANCHES — getBranches retorna []');
      const bodyText = await page.locator('body').innerText();
      console.log('---BODY SUMMARY---');
      console.log(bodyText.substring(0, 500));
    }

    await browser.close();
  });

});
