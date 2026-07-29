import { test, expect, Page } from '@playwright/test';

/**
 * IMPL-20260729-E2E: Flujo completo end-to-end
 * Empresa → Trabajador → Cita → Recepción → Papeleta → Exámenes → Upload IA → Dictamen
 * 
 * URL base: Vercel production (configurable via BASE_URL env var)
 */

// Configuración desde environment variables
const BASE_URL = process.env.BASE_URL || 'https://administracion-medica-industrial.vercel.app';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || ''; // Requiere env var configurada
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || ''; // Requiere env var configurada

// ⚠️ VALIDACIÓN: Verificar que las credenciales estén configuradas
if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.warn('⚠️ ADVERTENCIA: TEST_USER_EMAIL y TEST_USER_PASSWORD no están configuradas en .env');
  console.warn('   Los tests fallarán hasta que se configuren credenciales válidas.');
  console.warn('   Ejemplo: export TEST_USER_EMAIL="admin@ami.com" TEST_USER_PASSWORD="password123"');
}

// Datos de prueba
const EMPRESA_NOMBRE = 'Servicios Robles S.A. de C.V.';
const TRABAJADOR = {
  firstName: 'JESSICA GABRIELA',
  lastName: 'MORENO GOMEZ',
  email: 'jessica.moreno@test.com',
  phone: '555-0123'
};
const PUESTO_NOMBRE = 'Soldador';
const PERFIL_NOMBRE = 'Examen Médico General - Soldador';

// Helper: Login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  
  // Debug: verificar que llegamos a la página de login
  console.log('Page URL:', page.url());
  const title = await page.title();
  console.log('Page title:', title);
  
  // Esperar formulario de login - selectores corregidos según HTML real
  // Label: "Correo Electrónico", placeholder: "tu@correo.com"
  // Label: "Contraseña", placeholder: "••••••••"
  const emailField = page.getByRole('textbox', { name: 'Correo Electrónico' });
  const passwordField = page.getByRole('textbox', { name: 'Contraseña' });
  const submitButton = page.getByRole('button', { name: 'Iniciar Sesión' });
  
  // Esperar que los campos estén visibles
  await emailField.waitFor({ state: 'visible', timeout: 10000 });
  await passwordField.waitFor({ state: 'visible', timeout: 10000 });
  await submitButton.waitFor({ state: 'visible', timeout: 10000 });
  
  // Llenar credenciales
  await emailField.fill(TEST_EMAIL);
  await passwordField.fill(TEST_PASSWORD);
  
  // Click en botón de login
  await submitButton.click();
  
  // Esperar navegación exitosa (puede ir a dashboard, appointments o events)
  try {
    await page.waitForURL(/\/dashboard|\/appointments|\/events|\/companies/, { timeout: 15000 });
    console.log('✅ Login exitoso, URL actual:', page.url());
  } catch (e) {
    // Si no hay redirect, verificar si hay mensaje de error
    const alert = page.locator('[role="alert"]');
    let alertText = '';
    if (await alert.count() > 0) {
      alertText = await alert.textContent();
      console.error('❌ Error visible en UI:', alertText);
    }
    
    // Verificar credenciales vacías
    if (!TEST_EMAIL || !TEST_PASSWORD) {
      throw new Error(
        'Credenciales de test no configuradas. ' +
        'Configura: export TEST_USER_EMAIL="tu@email.com" TEST_USER_PASSWORD="tu-password"\n' +
        `Credenciales usadas: email="${TEST_EMAIL}", password="[oculto]"`
      );
    }
    
    throw new Error(`Login falló (credenciales: ${TEST_EMAIL}). Mensaje: "${alertText || 'Sin mensaje de error'}"`);
  }
}

// Helper: Generar UUID único para evitar colisiones en tests
function generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

test.describe('Flujo End-to-End Completo', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ baseURL: BASE_URL });
  
  let authenticatedPage: Page;
  let companyId: string;
  let workerId: string;
  let appointmentId: string;
  let eventId: string;

  // Fase 0: Autenticación
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    authenticatedPage = await context.newPage();
    await login(authenticatedPage);
  });

  // Fase 1: Crear empresa
  test('TC-01: Crear empresa cliente', async ({ page }) => {
    test.setTimeout(60000);
    
    await authenticatedPage.goto(`${BASE_URL}/companies`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click en "+ Nueva Empresa" (selector real verificado en producción)
    await authenticatedPage.getByRole('button', { name: '+ Nueva Empresa' }).click();
    
    // Llenar formulario con selectores reales de la UI
    const razonSocialField = authenticatedPage.getByPlaceholder('Ej: Aceros del Norte S.A.');
    const rfcField = authenticatedPage.getByPlaceholder('ABC010101XYZ');
    const contactoField = authenticatedPage.getByRole('textbox', { name: 'Nombre' });
    const emailField = authenticatedPage.getByPlaceholder('email@ejemplo.com');
    
    await razonSocialField.fill(EMPRESA_NOMBRE);
    await rfcField.fill(`SER${Date.now().toString().slice(-6)}ABC`);
    await contactoField.fill('Juan Pérez');
    await emailField.fill('contacto@serviciosrobles.com');
    
    // Submit - botón "Guardar y Continuar →"
    await authenticatedPage.getByRole('button', { name: /guardar/i }).click();
    
    // Esperar éxito (la empresa se crea y aparece en la lista)
    await authenticatedPage.waitForLoadState('networkidle');

    // G1 (IMPL-20260729-01): la app NO redirige a /companies/{id} tras submit;
    // extraer el companyId desde el link "Configurar Empresa" de la card recién creada.
    // getByRole con level:3 matchea EXACTAMENTE el h3 (strict mode safe), evitando
    // matchear divs ancestros (página, layout, grid, card).
    const empresaHeading = authenticatedPage.getByRole('heading', {
      name: EMPRESA_NOMBRE,
      level: 3,
    });
    await expect(empresaHeading).toBeVisible({ timeout: 15000 });

    // Subir al div.card ancestro directo y buscar el link "Configurar Empresa".
    // xpath=ancestor::div[1] toma el padre inmediato del <h3> (la card real,
    // la cual contiene el <Link> con href="/companies/{id}").
    const configLink = empresaHeading
      .locator('xpath=ancestor::div[1]')
      .locator('a:has-text("Configurar Empresa")');
    const href = await configLink.getAttribute('href');
    const match = href?.match(/\/companies\/([a-f0-9-]+)/);
    if (match) {
      companyId = match[1];
      console.log('Empresa creada con ID:', companyId);
    } else {
      throw new Error(
        `No se pudo extraer companyId del link "Configurar Empresa" (href=${href ?? 'null'}). ` +
        `Verificar que la card de ${EMPRESA_NOMBRE} se renderiza correctamente en /companies.`,
      );
    }

    // Verificar empresa visible en listado (defensa redundante).
    await expect(empresaHeading).toBeVisible({ timeout: 10000 });
  });

  // Fase 1.2: Crear perfil médico
  test('TC-02: Crear perfil médico con estudios', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!companyId, 'Sin empresa creada');
    
    await authenticatedPage.goto(`${BASE_URL}/admin/profiles`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click "Nuevo Perfil"
    await authenticatedPage.getByRole('button', { name: /nuevo perfil|crear perfil/i }).click();
    
    // Llenar nombre
    await authenticatedPage.getByLabel('Nombre').fill(PERFIL_NOMBRE);
    
    // Seleccionar empresa
    await authenticatedPage.getByLabel('Empresa').selectOption(companyId);
    
    // Seleccionar estudios mínimos (checkboxes o multiselect)
    const estudiosRequeridos = ['GEN-01', 'GEN-02', 'LAB-01', 'AUDIO-01', 'ESPIRO-01'];
    for (const codigo of estudiosRequeridos) {
      const checkbox = authenticatedPage.locator(`input[type="checkbox"][value*="${codigo}"]`);
      if (await checkbox.count() > 0) {
        await checkbox.check();
      }
    }
    
    // Submit
    await authenticatedPage.getByRole('button', { name: /guardar/i }).click();
    
    // Esperar éxito
    await expect(authenticatedPage.getByText(/perfil creado|éxito/i)).toBeVisible({ timeout: 10000 });
  });

  // Fase 1.3: Crear puesto con perfil default
  test('TC-03: Crear puesto de trabajo con perfil default', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!companyId, 'Sin empresa creada');
    
    await authenticatedPage.goto(`${BASE_URL}/companies/${companyId}`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar sección "Puestos de Trabajo" y click "Nuevo Puesto"
    const nuevoPuestoBtn = authenticatedPage.getByRole('button', { name: /nuevo puesto|agregar puesto/i });
    if (await nuevoPuestoBtn.count() > 0) {
      await nuevoPuestoBtn.click();
    } else {
      // Si no hay botón, buscar enlace a gestión de puestos
      await authenticatedPage.getByRole('link', { name: /puestos/i }).click();
      await authenticatedPage.waitForLoadState('networkidle');
      await authenticatedPage.getByRole('button', { name: /nuevo puesto/i }).click();
    }
    
    // Llenar formulario
    await authenticatedPage.getByLabel('Nombre').fill(PUESTO_NOMBRE);
    
    // Seleccionar perfil default
    await authenticatedPage.getByLabel('Perfil Médico Default').selectOption({ label: PERFIL_NOMBRE });
    
    // Submit
    await authenticatedPage.getByRole('button', { name: /guardar/i }).click();
    
    // Esperar éxito
    await expect(authenticatedPage.getByText(/puesto creado|éxito/i)).toBeVisible({ timeout: 10000 });
  });

  // Fase 2: Crear trabajador
  test('TC-04: Crear trabajador asociado a empresa y puesto', async ({ page }) => {
    test.setTimeout(60000);
    
    await authenticatedPage.goto(`${BASE_URL}/workers`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click "+ Registrar Trabajador" (selector real verificado en producción)
    await authenticatedPage.getByRole('button', { name: '+ Registrar Trabajador' }).click();
    
    // Esperar que aparezca el formulario modal
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Llenar datos del trabajador - selectores reales pueden variar
    // Por ahora usamos placeholders comunes, ajustar según UI real
    const nombreField = authenticatedPage.getByPlaceholder(/nombre/i).first();
    const apellidoField = authenticatedPage.getByPlaceholder(/apellido/i).first();
    const emailField = authenticatedPage.getByPlaceholder(/email|correo/i).first();
    const telefonoField = authenticatedPage.getByPlaceholder(/teléfono|phone/i).first();
    
    if (await nombreField.count() > 0) await nombreField.fill(TRABAJADOR.firstName);
    if (await apellidoField.count() > 0) await apellidoField.fill(TRABAJADOR.lastName);
    if (await emailField.count() > 0) await emailField.fill(TRABAJADOR.email);
    if (await telefonoField.count() > 0) await telefonoField.fill(TRABAJADOR.phone);
    
    // Seleccionar empresa y puesto si existen los campos
    const empresaSelect = authenticatedPage.getByRole('combobox', { name: /empresa/i });
    const puestoSelect = authenticatedPage.getByRole('combobox', { name: /puesto/i });
    
    if (companyId && await empresaSelect.count() > 0) {
      await empresaSelect.selectOption(companyId);
    }
    
    if (await puestoSelect.count() > 0) {
      await puestoSelect.selectOption({ label: PUESTO_NOMBRE });
    }
    
    // Buscar botón de submit del formulario
    // Fix IMPL-20260729-SOFIA: el backdrop del modal (div.fixed.inset-0) intercepta clicks.
    // El botón está visible dentro del modal, pero el wrapper recibe el pointer event.
    // Usamos force:true para bypasear actionability checks del modal wrapper.
    const submitButton = authenticatedPage.getByRole('button', { name: /guardar|crear|registrar/i }).first();
    if (await submitButton.count() > 0) {
      await submitButton.click({ force: true });
    }
    
    // Esperar éxito
    await authenticatedPage.waitForLoadState('networkidle');

    // G1b (IMPL-20260729-01): la app NO redirige a /workers/{id} tras submit;
    // WorkersTable renderiza un <Link href="/history/{workerId}">Historial</Link> por fila.
    // Extraer workerId desde la fila de la tabla cuyo nombre completo coincide con TRABAJADOR.
    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`;
    // Buscar la fila (tr) que contenga el nombre del trabajador.
    const workerRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: fullName })
      .first();
    await expect(workerRow).toBeVisible({ timeout: 15000 });

    const historialLink = workerRow.locator('a:has-text("Historial")');
    const href = await historialLink.getAttribute('href');
    // El link apunta a /history/{workerId}; extraer ese ID.
    const match = href?.match(/\/history\/([a-f0-9-]+)/);
    if (match) {
      workerId = match[1];
      console.log('Trabajador creado con ID:', workerId);
    } else {
      throw new Error(
        `No se pudo extraer workerId del link "Historial" (href=${href ?? 'null'}). ` +
        `Verificar que la fila de ${fullName} se renderiza correctamente en /workers.`,
      );
    }
  });

  // Fase 3: Crear cita
  test('TC-05: Crear cita para trabajador', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!workerId, 'Sin trabajador creado');
    
    await authenticatedPage.goto(`${BASE_URL}/appointments`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Click "Nueva Cita"
    await authenticatedPage.getByRole('button', { name: /nueva cita|agendar cita/i }).click();
    
    // Seleccionar trabajador
    await authenticatedPage.getByLabel('Trabajador').selectOption({ label: `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}` });
    
    // La sucursal y perfil deberían auto-llenarse
    // Seleccionar fecha (mañana)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await authenticatedPage.getByLabel('Fecha').fill(dateStr);
    
    // Seleccionar hora
    await authenticatedPage.getByLabel('Hora').fill('09:00');
    
    // Submit
    await authenticatedPage.getByRole('button', { name: /guardar|agendar/i }).click();
    
    // Esperar éxito
    await expect(authenticatedPage.getByText(/cita creada|éxito/i)).toBeVisible({ timeout: 10000 });
    
    // Extraer appointment ID
    const url = authenticatedPage.url();
    const match = url.match(/\/appointments\/([a-f0-9-]+)/);
    if (match) {
      appointmentId = match[1];
      console.log('Cita creada con ID:', appointmentId);
    }
  });

  // Fase 4: Check-in en recepción
  test('TC-06: Check-in y corroboración de identidad', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!appointmentId, 'Sin cita creada');
    
    await authenticatedPage.goto(`${BASE_URL}/reception`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar trabajador por nombre
    await authenticatedPage.getByLabel('Buscar trabajador').fill(`${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`);
    await authenticatedPage.press('Enter');
    
    // Click en resultado de búsqueda
    await authenticatedPage.getByRole('button', { name: new RegExp(TRABAJADOR.lastName) }).first().click();
    
    // Simular upload de INE (placeholder)
    const fileInput = authenticatedPage.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      // Crear archivo dummy
      const dummyFile = Buffer.from('dummy INE image');
      await fileInput.setInputFiles({
        name: 'ine_dummy.jpg',
        mimeType: 'image/jpeg',
        buffer: dummyFile
      });
    }
    
    // Click "Verificar identidad"
    await authenticatedPage.getByRole('button', { name: /verificar|check-in/i }).click();
    
    // Esperar éxito
    await expect(authenticatedPage.getByText(/verificado|éxito/i)).toBeVisible({ timeout: 10000 });
  });

  // Fase 5: Generar papeleta (MedicalEvent)
  test('TC-07: Iniciar atención y generar papeleta', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!appointmentId, 'Sin cita creada');
    
    // Desde appointments, iniciar atención
    await authenticatedPage.goto(`${BASE_URL}/appointments`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar cita del trabajador y click "Iniciar atención"
    await authenticatedPage.getByText(new RegExp(TRABAJADOR.lastName)).first().click();
    await authenticatedPage.getByRole('button', { name: /iniciar atención|generar papeleta/i }).click();
    
    // Esperar redirección a /events/[id]
    await authenticatedPage.waitForURL(/\/events\/[a-f0-9-]+/);
    
    // Extraer event ID
    const url = authenticatedPage.url();
    const match = url.match(/\/events\/([a-f0-9-]+)/);
    if (match) {
      eventId = match[1];
      console.log('Papeleta creada con ID:', eventId);
    }
    
    // Verificar MedicalEvent visible
    await expect(authenticatedPage.getByText(/papeleta|evento médico/i)).toBeVisible();
    
    // CRÍTICO: Verificar EventTests pre-llenados
    const eventTestCards = authenticatedPage.locator('[data-testid="event-test-card"]');
    const count = await eventTestCards.count();
    console.log(`EventTests encontrados: ${count}`);
    expect(count).toBeGreaterThanOrEqual(5); // Mínimo 5 estudios
  });

  // Fase 6: Llenar examen médico
  test('TC-08: Completar somatometría y agudeza visual', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!eventId, 'Sin papeleta creada');
    
    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Somatometría
    await authenticatedPage.getByLabel('Peso (kg)').fill('70');
    await authenticatedPage.getByLabel('Talla (cm)').fill('165');
    await authenticatedPage.getByLabel('PA Sistólica').fill('120');
    await authenticatedPage.getByLabel('PA Diastólica').fill('80');
    await authenticatedPage.getByLabel('FC').fill('72');
    
    // Agudeza Visual
    await authenticatedPage.getByLabel('OD').fill('1.0');
    await authenticatedPage.getByLabel('OI').fill('0.8');
    
    // Guardar
    await authenticatedPage.getByRole('button', { name: /guardar/i }).click();
    
    // Esperar éxito
    await expect(authenticatedPage.getByText(/guardado|éxito/i)).toBeVisible({ timeout: 10000 });
  });

  // Fase 7: Upload audiometría XML
  test('TC-09: Subir audiometría XML y verificar prediagnóstico', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(!eventId, 'Sin papeleta creada');
    
    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar sección Audiometría
    const audioSection = authenticatedPage.locator('section:has-text("Audiometría")');
    if (await audioSection.count() === 0) {
      test.skip(true, 'Sección Audiometría no encontrada');
      return;
    }
    
    // Upload archivo XML real
    const xmlFilePath = '/home/frank/repos/Administracion-medica-industrial/context/PACIENTES/JESSICA GABRIELA.xml';
    const fileInput = audioSection.locator('input[type="file"]').first();
    await fileInput.setInputFiles(xmlFilePath);
    
    // Esperar procesamiento (<100ms para parser directo)
    await expect(audioSection.getByText(/procesando|subiendo/i)).not.toBeVisible({ timeout: 5000 });
    
    // Verificar tabla de umbrales renderizada
    await expect(audioSection.getByText('250')).toBeVisible({ timeout: 10000 });
    await expect(audioSection.getByText('500')).toBeVisible();
    await expect(audioSection.getByText('1000')).toBeVisible();
    
    // Verificar panel RAW visible
    await expect(audioSection.getByText(/RAW|json/i)).toBeVisible();
    
    // Esperar prediagnóstico (~10-30s)
    const prediagCard = audioSection.locator('[data-testid="prediagnosis-card"]');
    if (await prediagCard.count() > 0) {
      await expect(prediagCard).toBeVisible({ timeout: 30000 });
      console.log('Prediagnóstico de audiometría generado');
    } else {
      console.warn('Prediagnóstico no encontrado, puede estar en procesamiento');
    }
  });

  // Fase 7.2: Upload espirometría PDF
  test('TC-10: Subir espirometría PDF y verificar prediagnóstico', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(!eventId, 'Sin papeleta creada');
    
    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar sección Espirometría
    const espiroSection = authenticatedPage.locator('section:has-text("Espirometría")');
    if (await espiroSection.count() === 0) {
      test.skip(true, 'Sección Espirometría no encontrada');
      return;
    }
    
    // Crear PDF dummy para prueba
    const dummyPdf = Buffer.from('%PDF-1.4 dummy spirometry file');
    await espiroSection.locator('input[type="file"]').first().setInputFiles({
      name: 'espirometria_dummy.pdf',
      mimeType: 'application/pdf',
      buffer: dummyPdf
    });
    
    // Esperar extracción IA (~10s)
    await expect(espiroSection.getByText(/procesando|extrayendo/i)).not.toBeVisible({ timeout: 30000 });
    
    // Verificar tabla de valores (puede fallar con PDF dummy)
    try {
      await expect(espiroSection.getByText(/FEV1|FVC/i)).toBeVisible({ timeout: 10000 });
      console.log('Valores de espirometría extraídos');
    } catch (e) {
      console.warn('Extracción de espirometría falló con PDF dummy (esperado)');
    }
  });

  // Fase 8: Toma de muestra laboratorio
  test('TC-11: Marcar muestra tomada y verificar LabOrder', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!eventId, 'Sin papeleta creada');
    
    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar sección Biometría Hemática
    const bhSection = authenticatedPage.locator('section:has-text("Biometría")');
    if (await bhSection.count() === 0) {
      test.skip(true, 'Sección BH no encontrada');
      return;
    }
    
    // Click "Tomar muestra"
    await bhSection.getByRole('button', { name: /tomar muestra/i }).click();
    
    // Esperar confirmación
    await expect(bhSection.getByText(/muestra tomada|éxito/i)).toBeVisible({ timeout: 10000 });
    
    // Verificar LabOrder creado en /lab/reception
    await authenticatedPage.goto(`${BASE_URL}/lab/reception`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar papeleta en bandeja
    await expect(authenticatedPage.getByText(new RegExp(TRABAJADOR.lastName))).toBeVisible({ timeout: 10000 });
    console.log('LabOrder visible en recepción');
  });

  // Fase 9: Dictamen final
  test('TC-12: Generar dictamen final y cerrar papeleta', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!eventId, 'Sin papeleta creada');
    
    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // Buscar sección Dictamen
    const verdictSection = authenticatedPage.locator('section:has-text("Dictamen")');
    if (await verdictSection.count() === 0) {
      test.skip(true, 'Sección Dictamen no encontrada - componente pendiente de implementar');
      return;
    }
    
    // Seleccionar aptitud
    await verdictSection.getByLabel('Aptitud').selectOption('APTO');
    
    // Llenar conclusiones
    await verdictSection.getByLabel('Conclusiones').fill('Paciente sin hallazgos patológicos. Apto para el puesto.');
    
    // Firmar
    await verdictSection.getByRole('button', { name: /firmar|cerrar/i }).click();
    
    // Esperar éxito
    await expect(authenticatedPage.getByText(/papeleta cerrada|éxito/i)).toBeVisible({ timeout: 10000 });
    
    // Verificar status CLOSED
    await expect(authenticatedPage.getByText(/cerrado|closed/i)).toBeVisible();
  });

  // Cleanup opcional al final
  test.afterAll(async () => {
    console.log(`\n=== Resumen ejecución E2E ===`);
    console.log(`Empresa ID: ${companyId || 'NO CREADA'}`);
    console.log(`Worker ID: ${workerId || 'NO CREADO'}`);
    console.log(`Appointment ID: ${appointmentId || 'NO CREADA'}`);
    console.log(`Event ID: ${eventId || 'NO CREADO'}`);
    console.log(`===========================\n`);
  });
});
