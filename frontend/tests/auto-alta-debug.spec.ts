import { test, chromium } from '@playwright/test';

const VERCEL_URL = process.env.VERCEL_URL || 'https://administracion-medica-industrial.vercel.app';
const TOKEN = 'test-frank-b29563cd5e574bd7';

test('Visualizar Sección 8 Crédito y 10 leyenda', async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('pageerror', err => console.log('[PAGEERROR]', err.message));

  console.log('Going to auto-alta/[token]');
  await page.goto(`${VERCEL_URL}/auto-alta/${TOKEN}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/auto-alta-full.png', fullPage: true });
  console.log('URL:', page.url());

  const bodyText = await page.locator('body').innerText();

  console.log('\n=== CHECKS ===');
  console.log('Contains "Crédito y Referencias Comerciales":', bodyText.includes('Crédito y Referencias Comerciales'));
  console.log('Contains "Solicitudes de Crédito":', bodyText.includes('Solicitudes de Crédito'));
  console.log('Contains "442-480-05-48":', bodyText.includes('442-480-05-48'));
  console.log('Contains "cuentasxcobrar@medicaindustrial.com":', bodyText.includes('cuentasxcobrar@medicaindustrial.com'));
  console.log('Contains "Referencia #1":', bodyText.includes('Referencia #1'));
  console.log('Contains "Referencia #2":', bodyText.includes('Referencia #2'));
  console.log('Contains "Referencia #3":', bodyText.includes('Referencia #3'));
  console.log('Contains "10. Términos y Condiciones":', bodyText.includes('10. Términos y Condiciones'));
  console.log('Contains "5% de morosidad":', bodyText.includes('5% de morosidad'));
  console.log('Contains "AMI SALUD RESPONSABLE SC":', bodyText.includes('AMI SALUD RESPONSABLE SC'));

  console.log('\n=== BODY EXCERPT (sección 8) ===');
  const sec8Start = bodyText.indexOf('Crédito y Referencias Comerciales');
  const sec8End = bodyText.indexOf('9. Documentación');
  console.log(bodyText.substring(sec8Start, sec8End > -1 ? sec8End : sec8Start + 800));

  console.log('\n=== BODY EXCERPT (sección 10) ===');
  const sec10Start = bodyText.indexOf('10. Términos');
  console.log(bodyText.substring(sec10Start > -1 ? sec10Start : 0, sec10Start > -1 ? sec10Start + 1500 : 0));

  await browser.close();
});
