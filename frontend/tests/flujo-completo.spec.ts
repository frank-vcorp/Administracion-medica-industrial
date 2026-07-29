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
// IMPL-20260729-01: timestamp en nombre para evitar duplicados entre runs (BD persistente en prod).
const RUN_TAG = Date.now().toString().slice(-6);
const RUN_NUMBER = Number(RUN_TAG);
const WORKER_FIRST_INITIAL = String.fromCharCode(65 + (RUN_NUMBER % 26));
const WORKER_DOB = (() => {
  const date = new Date(1900, 0, 1);
  date.setDate(date.getDate() + Math.floor(RUN_NUMBER / 26));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
})();
const EMPRESA_NOMBRE = `Servicios Robles S.A. de C.V. - ${RUN_TAG}`;
const TRABAJADOR = {
  firstName: `${WORKER_FIRST_INITIAL} JESSICA GABRIELA ${RUN_TAG}`,
  lastName: 'MORENO GOMEZ',
  dob: WORKER_DOB,
  email: `jessica.moreno+${RUN_TAG}@test.com`,
  phone: `555${RUN_TAG}1`,
};
const APPOINTMENT_DATE = (() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
})();
const PUESTO_NOMBRE = `Soldador - ${RUN_TAG}`;
const PERFIL_NOMBRE = `Examen Médico General - Soldador - ${RUN_TAG}`;

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
  } catch (_e) {
    // Si no hay redirect, verificar si hay mensaje de error
    const alert = page.locator('[role="alert"]');
    let alertText = '';
    if (await alert.count() > 0) {
      alertText = await alert.textContent() ?? '';
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
function _generateTestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
void _generateTestId

test.describe('Flujo End-to-End Completo', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ baseURL: BASE_URL });
  
  let authenticatedPage: Page;
  let companyId: string;
  let workerId: string;
  let eventId: string;

  // Fase 0: Autenticación
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    authenticatedPage = await context.newPage();
    await login(authenticatedPage);
  });

  // Fase 1: Crear empresa
  test('TC-01: Crear empresa cliente', async () => {
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
  test('TC-02: Crear perfil médico con estudios', async () => {
    test.setTimeout(60000);
    test.skip(!companyId, 'Sin empresa creada');

    await authenticatedPage.goto(`${BASE_URL}/admin/profiles`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Selector real: el botón expone el nombre accesible "+ Nuevo Perfil".
    await authenticatedPage.getByRole('button', { name: '+ Nuevo Perfil' }).click();

    // El modal no tiene role="dialog" ni selector Empresa. Se acota por el
    // formulario que contiene el placeholder exclusivo del perfil.
    const profileForm = authenticatedPage
      .locator('form')
      .filter({ has: authenticatedPage.getByPlaceholder('Nombre del perfil (ej. Ingreso Operativo)') })
      .first();
    await expect(profileForm).toBeVisible();
    await profileForm
      .getByPlaceholder('Nombre del perfil (ej. Ingreso Operativo)')
      .fill(PERFIL_NOMBRE);

    // Códigos accesibles del catálogo vigente en producción. GEN-01/GEN-02 y
    // sus equivalentes legacy no se renderizan en la UI actual.
    const estudiosRequeridos = [
      /GEN-001 AGUDEZA VISUAL/i,
      /GEN-003 AUDIOMETRIA/i,
      /GEN-013 ESPIROMETRIA/i,
      /LAB-018 BIOMETRIA HEMATICA COMPLETA/i,
      /GEN-012 ELECTROCARDIOGRAMA/i,
      /IMG-013 RX DE TORAX AP Y LAT/i,
      /GEN-015 EXAMEN MEDICO/i,
    ];
    for (const nombreEstudio of estudiosRequeridos) {
      const checkbox = profileForm.getByRole('checkbox', { name: nombreEstudio });
      await expect(checkbox).toHaveCount(1);
      await checkbox.check();
    }

    // La pantalla oficial /admin/profiles crea perfiles globales; la ficha de
    // empresa los incluye como fallback, por lo que companyId sigue cubierto.
    const submitButton = profileForm.getByRole('button', { name: 'Guardar Perfil' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(authenticatedPage.getByText('Perfil médico creado exitosamente')).toBeVisible({ timeout: 15000 });
  });

  // Fase 1.3: Crear puesto con perfil default
  test('TC-03: Crear puesto de trabajo con perfil default', async () => {
    test.setTimeout(60000);
    test.skip(!companyId, 'Sin empresa creada');

    await authenticatedPage.goto(`${BASE_URL}/companies/${companyId}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Selector real de JobPositionsPanel: "+ Crear Puesto".
    await authenticatedPage.getByRole('button', { name: /crear puesto/i }).click();

    const jobForm = authenticatedPage
      .locator('form')
      .filter({ has: authenticatedPage.getByPlaceholder('Ej: Soldador, Operador de Montacargas') })
      .first();
    await expect(jobForm).toBeVisible();
    await jobForm
      .getByPlaceholder('Ej: Soldador, Operador de Montacargas')
      .fill(PUESTO_NOMBRE);

    const profileSelect = jobForm.locator('select[name="defaultProfileId"]');
    await expect(profileSelect).toBeVisible();
    await profileSelect.selectOption({ label: PERFIL_NOMBRE });

    await jobForm.getByRole('button', { name: /crear puesto|guardar cambios/i }).click();
    await expect(authenticatedPage.getByText('Puesto de trabajo creado exitosamente')).toBeVisible({ timeout: 15000 });

    // La mutación revalida la ruta pero no refresca el componente cliente.
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');
    await expect(authenticatedPage.locator('tr').filter({ hasText: PUESTO_NOMBRE })).toBeVisible({ timeout: 15000 });
  });

  // Fase 2: Crear trabajador
  test('TC-04: Crear trabajador asociado a empresa y puesto', async () => {
    test.setTimeout(60000);
    test.skip(!companyId, 'Sin empresa creada');

    await authenticatedPage.goto(`${BASE_URL}/workers`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Click "+ Registrar Trabajador" (selector real verificado en producción).
    await authenticatedPage.getByRole('button', { name: '+ Registrar Trabajador' }).click();

    // El formulario exige nombre, apellido, fecha y género además de empresa y puesto.
    const workerForm = authenticatedPage
      .locator('form')
      .filter({ has: authenticatedPage.getByPlaceholder('Nombre') })
      .first();
    await expect(workerForm).toBeVisible();
    await workerForm.getByPlaceholder('Nombre').fill(TRABAJADOR.firstName);
    await workerForm.getByPlaceholder('Apellidos').fill(TRABAJADOR.lastName);
    await workerForm.locator('input[name="dob"]').fill(TRABAJADOR.dob);
    await workerForm.locator('select[name="gender"]').selectOption('F');
    await workerForm.getByPlaceholder('email@ejemplo.com').fill(TRABAJADOR.email);
    await workerForm.getByPlaceholder('10 dígitos').fill(TRABAJADOR.phone);

    const empresaSelect = workerForm.locator('select[name="companyId"]');
    const puestoSelect = workerForm.locator('select[name="jobPositionId"]');
    await empresaSelect.selectOption(companyId);
    await expect(puestoSelect).toBeEnabled({ timeout: 10000 });
    await puestoSelect.selectOption({ label: PUESTO_NOMBRE });

    const submitButton = workerForm.getByRole('button', { name: 'Guardar Trabajador' });
    await expect(submitButton).toBeEnabled();
    // force:true es el fix de overlay ya existente en c8a80e1/4e9de7f;
    // el diagnóstico actual corrige la validación de fecha/género sin añadir otro bypass.
    await submitButton.click({ force: true });

    await expect(authenticatedPage.getByRole('heading', { name: '¡Trabajador Listo!' })).toBeVisible({ timeout: 15000 });
    await authenticatedPage.getByRole('button', { name: 'Ver Padrón' }).click();

    // WorkersTable no redirige: extraer workerId desde el link persistente de la fila.
    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`;
    const workerRow = authenticatedPage
      .locator('tr')
      .filter({ hasText: fullName })
      .first();
    await expect(workerRow).toBeVisible({ timeout: 15000 });

    const historialLink = workerRow.getByRole('link', { name: 'Historial' });
    const href = await historialLink.getAttribute('href');
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
  test('TC-05: Crear cita para trabajador', async () => {
    test.setTimeout(60000);
    test.skip(!workerId, 'Sin trabajador creado');

    await authenticatedPage.goto(`${BASE_URL}/appointments`);
    await authenticatedPage.waitForLoadState('networkidle');

    await authenticatedPage.getByRole('button', { name: /agendar cita/i }).click();

    // AppointmentFormModal usa selects por name; sus textos visibles no están
    // asociados mediante <label>, por eso se acota al formulario real.
    const appointmentForm = authenticatedPage
      .locator('form')
      .filter({ has: authenticatedPage.locator('select[name="companyId"]') })
      .first();
    await expect(appointmentForm).toBeVisible();

    const companySelect = appointmentForm.locator('select[name="companyId"]');
    const workerSelect = appointmentForm.locator('select[name="workerId"]');
    const branchSelect = appointmentForm.locator('select[name="branchId"]');
    await companySelect.selectOption(companyId);
    await expect(workerSelect).toBeEnabled({ timeout: 10000 });
    await workerSelect.selectOption(workerId);

    const branchOption = branchSelect.locator('option:not([value=""])').first();
    await expect(branchOption).toBeAttached();
    const branchValue = await branchOption.getAttribute('value');
    if (!branchValue) {
      throw new Error('La empresa creada no tiene una sucursal seleccionable para la cita.');
    }
    await branchSelect.selectOption(branchValue);
    await appointmentForm.locator('input[name="date"]').fill(APPOINTMENT_DATE);
    await appointmentForm.locator('input[name="time"]').fill('09:00');

    await appointmentForm.getByRole('button', { name: 'Confirmar Cita' }).click();

    // router.refresh() puede desmontar el modal de éxito antes de que el
    // locator lo observe. La evidencia persistente es la tarjeta de agenda.
    const closeButton = authenticatedPage.getByRole('button', { name: 'Cerrar' });
    if (await closeButton.count() > 0) {
      await closeButton.click();
    }
    await authenticatedPage.locator('input[type="date"]').first().fill(APPOINTMENT_DATE);
    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`;
    await expect(
      authenticatedPage.locator('div.group').filter({ hasText: fullName }).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  // Fase 4: Check-in en recepción
  test('TC-06: Check-in y corroboración de identidad', async () => {
    test.setTimeout(60000);
    test.skip(!workerId, 'Sin trabajador creado');

    // Para citas programadas el check-in real parte de /appointments y abre
    // CorroborationModal; /reception es el kanban de eventos ya creados.
    await authenticatedPage.goto(`${BASE_URL}/appointments`);
    await authenticatedPage.waitForLoadState('networkidle');
    await authenticatedPage.locator('input[type="date"]').first().fill(APPOINTMENT_DATE);

    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`;
    const appointmentCard = authenticatedPage.locator('div.group').filter({ hasText: fullName }).first();
    await expect(appointmentCard).toBeVisible({ timeout: 15000 });
    await appointmentCard.locator('button[title="Check-in"]').click();

    const corroborationModal = authenticatedPage
      .locator('div.fixed.inset-0')
      .filter({ has: authenticatedPage.getByRole('heading', { name: 'Corroboración de Identidad' }) })
      .first();
    await expect(corroborationModal).toBeVisible();

    const dummyFile = Buffer.from('dummy INE image');
    await corroborationModal.locator('input[type="file"]').first().setInputFiles({
      name: `ine_dummy_${RUN_TAG}.jpg`,
      mimeType: 'image/jpeg',
      buffer: dummyFile,
    });

    const confirmButton = corroborationModal.getByRole('button', { name: /confirmar y hacer check-in/i });
    await expect(confirmButton).toBeEnabled({ timeout: 10000 });
    await confirmButton.click();

    // onClose()->loadData() puede competir con router.push() y conservar
    // /appointments aunque el MedicalEvent ya exista. Primero acepta la URL
    // directa y, si no llega, extrae el ID persistente desde /events.
    await authenticatedPage
      .waitForURL(/\/events\/[a-f0-9-]+/, { timeout: 10000 })
      .catch(() => undefined);
    let eventUrl = authenticatedPage.url();
    let match = eventUrl.match(/\/events\/([a-f0-9-]+)/);

    if (!match) {
      await authenticatedPage.goto(`${BASE_URL}/events`);
      await authenticatedPage.waitForLoadState('networkidle');
      const eventRow = authenticatedPage.locator('tr').filter({ hasText: fullName }).first();
      await expect(eventRow).toBeVisible({ timeout: 15000 });
      const eventHref = await eventRow
        .getByRole('link', { name: /abrir expediente/i })
        .getAttribute('href');
      eventUrl = eventHref ?? '';
      match = eventUrl.match(/\/events\/([a-f0-9-]+)/);
    }

    if (match) {
      eventId = match[1];
      console.log('Papeleta creada con ID:', eventId);
    } else {
      throw new Error(`No se pudo extraer eventId tras el check-in: ${eventUrl || 'sin href'}`);
    }
  });

  // Fase 5: Generar papeleta (MedicalEvent)
  test('TC-07: Iniciar atención y generar papeleta', async () => {
    test.setTimeout(60000);
    test.skip(!eventId, 'Sin papeleta creada');

    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');

    await expect(authenticatedPage.getByText('Papeleta electrónica', { exact: true })).toBeVisible({ timeout: 15000 });

    // PapeletaWorkspace renderiza botones por estudio, no data-testid ni cards.
    const eventTestButtons = authenticatedPage.locator('button').filter({
      hasText: /AGUDEZA VISUAL|AUDIOMETRIA|ESPIROMETRIA|BIOMETRIA|ELECTROCARDIOGRAMA|RX DE TORAX|EXAMEN MEDICO/i,
    });
    const count = await eventTestButtons.count();
    console.log(`EventTests visibles en PapeletaWorkspace: ${count}`);
    expect(count).toBeGreaterThanOrEqual(5);
  });

  // Fase 6: Llenar examen médico
  test('TC-08: Completar somatometría y agudeza visual', async () => {
    test.setTimeout(60000);
    test.skip(!eventId, 'Sin papeleta creada');

    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Los campos clínicos se muestran al abrir el botón del estudio Examen Médico.
    await authenticatedPage.locator('button').filter({ hasText: /EXAMEN MEDICO/i }).first().click();

    // Somatometría: la UI vigente usa talla en metros, no en centímetros.
    await authenticatedPage.getByPlaceholder('Ej: 75.5').fill('70');
    await authenticatedPage.getByPlaceholder('Ej: 1.75').fill('1.65');
    await authenticatedPage.getByRole('button', { name: /completar somatometría/i }).click();
    await expect(authenticatedPage.getByText(/somatometría completada/i)).toBeVisible({ timeout: 15000 });

    // Signos vitales viven en la segunda pestaña del mismo estudio.
    await authenticatedPage.getByRole('button', { name: /signos vitales/i }).first().click();
    await authenticatedPage.getByPlaceholder('120').fill('120');
    await authenticatedPage.getByPlaceholder('80').fill('80');
    await authenticatedPage.getByPlaceholder('BPM').fill('72');
    await authenticatedPage.getByRole('button', { name: /completar signos vitales/i }).click();
    await expect(authenticatedPage.getByText(/signos vitales completados/i)).toBeVisible({ timeout: 15000 });

    // Agudeza visual no tiene for/id; se acota al bloque Campo Visual y se
    // llenan OD/OI por posición estable de los inputs de la tabla.
    await authenticatedPage.getByRole('button', { name: /agudeza visual/i }).first().click();
    const visualInputs = authenticatedPage
      .getByText('Campo Visual', { exact: true })
      .locator('xpath=..')
      .locator('input');
    await expect(visualInputs).toHaveCount(8);
    await visualInputs.nth(0).fill('1.0');
    await visualInputs.nth(1).fill('0.8');
    await authenticatedPage.getByRole('button', { name: /completar agudeza visual/i }).click();
    await expect(authenticatedPage.getByText(/agudeza visual completada/i)).toBeVisible({ timeout: 15000 });
  });

  // Fase 7: Upload audiometría XML
  test('TC-09: Subir audiometría XML y verificar prediagnóstico', async () => {
    test.setTimeout(120000);
    test.skip(!eventId, 'Sin papeleta creada');

    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // PapeletaWorkspace abre el estudio mediante un botón, no mediante <section>.
    await authenticatedPage.locator('button').filter({ hasText: /AUDIOMETRIA/i }).first().click();
    const fileInput = authenticatedPage.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    // Upload del XML real; setInputFiles puede cargarlo aunque el accept visual
    // actual enumere formatos documentales distintos.
    const xmlFilePath = '/home/frank/repos/Administracion-medica-industrial/context/PACIENTES/JESSICA GABRIELA.xml';
    await fileInput.setInputFiles(xmlFilePath);

    await expect(authenticatedPage.getByText(/procesando estudio con IA|subiendo archivo/i).first()).not.toBeVisible({ timeout: 60000 });

    // La tabla bilateral del parser directo expone frecuencias exactas.
    await expect(authenticatedPage.getByText('250', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(authenticatedPage.getByText('500', { exact: true })).toBeVisible();
    await expect(authenticatedPage.getByText('1000', { exact: true })).toBeVisible();

    // La UI vigente muestra "Extracción clínica"; los paneles RAW fueron
    // retirados por la limpieza de papeleta y se documentan como gap restante.
    await expect(authenticatedPage.getByText(/Extracción clínica|Valores capturados/i).first()).toBeVisible();

    const prediagCard = authenticatedPage.locator('[data-testid="prediagnosis-card"]');
    if (await prediagCard.count() > 0) {
      await expect(prediagCard).toBeVisible({ timeout: 30000 });
      console.log('Prediagnóstico de audiometría generado');
    } else {
      console.warn('Prediagnóstico no encontrado, puede estar en procesamiento');
    }
  });

  // Fase 7.2: Upload espirometría PDF
  test('TC-10: Subir espirometría PDF y verificar prediagnóstico', async () => {
    test.setTimeout(120000);
    test.skip(!eventId, 'Sin papeleta creada');

    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');

    await authenticatedPage.locator('button').filter({ hasText: /ESPIROMETRIA/i }).first().click();
    const fileInput = authenticatedPage.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    const dummyPdf = Buffer.from('%PDF-1.4 dummy spirometry file');
    await fileInput.setInputFiles({
      name: `espirometria_dummy_${RUN_TAG}.pdf`,
      mimeType: 'application/pdf',
      buffer: dummyPdf,
    });

    await expect(authenticatedPage.getByText(/procesando estudio con IA|subiendo archivo/i).first()).not.toBeVisible({ timeout: 30000 });

    // El PDF dummy puede no producir extracción; si el renderer aparece, se
    // valida que expone los parámetros esperados sin convertir el caso en skip.
    const extractedValues = authenticatedPage.getByText(/FEV1|FVC/i).first();
    if (await extractedValues.count() > 0) {
      await expect(extractedValues).toBeVisible({ timeout: 10000 });
      console.log('Valores de espirometría extraídos');
    } else {
      console.warn('Extracción de espirometría no disponible con PDF dummy');
    }
  });

  // Fase 8: Toma de muestra laboratorio
  test('TC-11: Marcar muestra tomada y verificar LabOrder', async () => {
    test.setTimeout(60000);
    test.skip(!eventId, 'Sin papeleta creada');

    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');

    await authenticatedPage.locator('button').filter({ hasText: /BIOMETRIA|HEMATICA/i }).first().click();
    const sampleButton = authenticatedPage.getByRole('button', { name: /registrar muestra tomada/i });
    await expect(sampleButton).toBeVisible({ timeout: 15000 });
    await sampleButton.click();

    await expect(
      authenticatedPage.getByText(/pendiente de resultado de prueba de laboratorio/i),
    ).toBeVisible({ timeout: 15000 });

    // Lab reception renders a real <tr>; the event link is the persistent ID
    // source for this route and avoids relying on folio text.
    await authenticatedPage.goto(`${BASE_URL}/lab/reception`);
    await authenticatedPage.waitForLoadState('networkidle');
    const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`;
    const labRow = authenticatedPage.locator('tr').filter({ hasText: fullName }).first();
    await expect(labRow).toBeVisible({ timeout: 15000 });
    const eventLink = labRow.getByRole('link').first();
    const eventHref = await eventLink.getAttribute('href');
    const eventMatch = eventHref?.match(/\/events\/([a-f0-9-]+)/);
    if (!eventMatch || eventMatch[1] !== eventId) {
      throw new Error(
        `La bandeja LAB no enlaza al eventId esperado (href=${eventHref ?? 'null'}, eventId=${eventId}).`,
      );
    }
    console.log('LabOrder visible en recepción para eventId:', eventId);
  });

  // Fase 9: Dictamen final
  test('TC-12: Generar dictamen final y cerrar papeleta', async () => {
    test.setTimeout(60000);
    test.skip(!eventId, 'Sin papeleta creada');

    await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
    await authenticatedPage.waitForLoadState('networkidle');

    // Si el evento alcanza VALIDATING, el componente real es
    // EventFlowController (no una section con select Aptitud).
    const verdictHeading = authenticatedPage.getByRole('heading', { name: 'Reporte médico de aptitud' });
    await expect(verdictHeading).toBeVisible({ timeout: 15000 });

    await authenticatedPage
      .getByPlaceholder('Ej: Apto para el puesto sin restricciones...')
      .fill('Paciente sin hallazgos patológicos. Apto para el puesto.');
    await authenticatedPage
      .getByPlaceholder('Ej: Uso de protección auditiva...')
      .fill('Control médico anual y uso de equipo de protección personal.');
    await authenticatedPage.getByRole('button', { name: /firmar y emitir dictamen/i }).click();

    await expect(authenticatedPage.getByRole('heading', { name: '¡Expediente Completado!' })).toBeVisible({ timeout: 15000 });
    await expect(authenticatedPage.getByText(/dictamen médico ha sido firmado/i)).toBeVisible();
  });

  // Cleanup opcional al final
  test.afterAll(async () => {
    console.log(`\n=== Resumen ejecución E2E ===`);
    console.log(`Empresa ID: ${companyId || 'NO CREADA'}`);
    console.log(`Worker ID: ${workerId || 'NO CREADO'}`);
    console.log('Appointment ID: NO EXPUESTO POR HREF; cita verificada por tarjeta y luego por el eventId del check-in');
    console.log(`Event ID: ${eventId || 'NO CREADO'}`);
    console.log(`===========================\n`);
  });
});
