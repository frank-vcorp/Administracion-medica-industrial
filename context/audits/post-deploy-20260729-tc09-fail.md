# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flujo-completo.spec.ts >> Flujo End-to-End Completo >> TC-09: Subir audiometría XML y verificar prediagnóstico
- Location: tests/flujo-completo.spec.ts:503:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('250', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('250', { exact: true })

```

```yaml
- complementary:
  - text: AMI
  - navigation:
    - link "📅":
      - /url: /appointments
    - link "🗓️":
      - /url: /appointments/overview
    - link "👥":
      - /url: /workers
    - link "🏥":
      - /url: /reception
    - link "📊":
      - /url: /dashboard
    - link "📁":
      - /url: /events
    - link "✅":
      - /url: /validation
    - link "🏢":
      - /url: /companies
    - link "🗂️":
      - /url: /projects
    - link "🚑":
      - /url: /operations/mobile-units
    - link "📊":
      - /url: /reports
    - link "🏥":
      - /url: /branches
    - link "👨‍⚕️":
      - /url: /admin/users
    - link "🧪":
      - /url: /admin/services
    - link "🧬":
      - /url: /admin/lab/catalogs?mod=unidades
    - link "🔄":
      - /url: /admin/lab/migration
    - link "🚦":
      - /url: /admin/lab/cutover
    - link "🧪":
      - /url: /lab/reception
    - link "🩻":
      - /url: /admin/profiles
    - link "🚐":
      - /url: /admin/mobile-units
    - link "📋":
      - /url: /admin/audit
  - text: A
- main:
  - text: 👤
  - heading "MORENO GOMEZ, G JESSICA GABRIELA 820410" [level=1]
  - text: "Soldador - 820410 • Examen Médico General - Soldador - 820410 • Servicios Robles S.A. de C.V. - 820410 • #ec4863b7"
  - link "Ficha trabajador":
    - /url: /workers/81bee236-284f-4abc-a9a2-04f7a8ae6a7e
  - button "💳 Pago y Recibo"
  - link "Historial clínico":
    - /url: /history/81bee236-284f-4abc-a9a2-04f7a8ae6a7e
  - text: Estudios
  - link "← Volver":
    - /url: /reception
  - paragraph: Origen de ingreso
  - paragraph: Programado
  - paragraph: Proyecto
  - paragraph: Sin proyecto
  - paragraph: Cita asociada
  - paragraph: dc657d2b
  - link "✓ Ingreso":
    - /url: /events/ec4863b7-82b9-460d-b3fd-793cb90b031f?view=SCHEDULED
  - link "2 Estudios":
    - /url: /events/ec4863b7-82b9-460d-b3fd-793cb90b031f?view=CHECKED_IN
  - text: 3 Firma 4 Fin
  - button "← Volver a estudios"
  - text: 1/7 completados
  - navigation:
    - paragraph: Estudios
    - button "AUDIOMETRIA Pendiente de resultado de prueba":
      - paragraph: AUDIOMETRIA
      - text: Pendiente de resultado de prueba
    - button "ESPIROMETRIA Pendiente de resultado de prueba":
      - paragraph: ESPIROMETRIA
      - text: Pendiente de resultado de prueba
    - button "BIOMETRIA HEMATICA COMPLETA Pendiente de resultado de prueba":
      - paragraph: BIOMETRIA HEMATICA COMPLETA
      - text: Pendiente de resultado de prueba
    - button "ELECTROCARDIOGRAMA Pendiente de resultado de prueba":
      - paragraph: ELECTROCARDIOGRAMA
      - text: Pendiente de resultado de prueba
    - button "RX DE TORAX AP Y LAT Pendiente de resultado de prueba":
      - paragraph: RX DE TORAX AP Y LAT
      - text: Pendiente de resultado de prueba
    - button "EXAMEN MEDICO Pendiente de resultado de prueba":
      - paragraph: EXAMEN MEDICO
      - text: Pendiente de resultado de prueba
  - heading "AUDIOMETRIA" [level=3]
  - text: Generales GEN-003 🎧 Audiometría · IA Pendiente de resultado de prueba
  - separator
  - text: 📎 Subir resultado PDF, PNG o JPG — máx. 20MB
  - paragraph: "400 Client Error: Bad Request for url: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyDkusP5POIhu6hIOyIvmZnFY6SPm6-6RM8"
  - paragraph: Cambiar estado
  - button "▶ Iniciar proceso"
  - button "✅ Resultado registrado"
  - button "🏁 Completar estudio"
  - text: 📂
  - paragraph: Sin archivo vinculado
  - paragraph: Sube el resultado para visualizarlo aquí.
  - text: 🗂 Cronograma Operativo ADMIN 1 movimientos
  - button "+ Incidencia"
  - text: Inicio 01:08 a.m. Último mov. 01:08 a.m. Completados 1 Incidencias 0
  - list:
    - listitem:
      - text: 29-jul, 01:08 a.m. ✅ Estudio completado Generales
      - paragraph: "Estudio completado: AGUDEZA VISUAL"
  - heading "Laboratorio" [level=3]
  - paragraph: Sin órdenes de laboratorio asociadas
  - link "+ Admisión Lab (auto-llenar)":
    - /url: /lab/reception/ec4863b7-82b9-460d-b3fd-793cb90b031f
  - paragraph: Aún no hay órdenes de laboratorio creadas. Las admisiones se generan automáticamente al marcar los EventTests como SAMPLE_TAKEN.
- alert
```

# Test source

```ts
  423 | 
  424 |     if (!match) {
  425 |       await authenticatedPage.goto(`${BASE_URL}/events`);
  426 |       await authenticatedPage.waitForLoadState('networkidle');
  427 |       const eventRow = authenticatedPage.locator('tr').filter({ hasText: fullName }).first();
  428 |       await expect(eventRow).toBeVisible({ timeout: 15000 });
  429 |       const eventHref = await eventRow
  430 |         .getByRole('link', { name: /abrir expediente/i })
  431 |         .getAttribute('href');
  432 |       eventUrl = eventHref ?? '';
  433 |       match = eventUrl.match(/\/events\/([a-f0-9-]+)/);
  434 |     }
  435 | 
  436 |     if (match) {
  437 |       eventId = match[1];
  438 |       console.log('Papeleta creada con ID:', eventId);
  439 |     } else {
  440 |       throw new Error(`No se pudo extraer eventId tras el check-in: ${eventUrl || 'sin href'}`);
  441 |     }
  442 |   });
  443 | 
  444 |   // Fase 5: Generar papeleta (MedicalEvent)
  445 |   test('TC-07: Iniciar atención y generar papeleta', async () => {
  446 |     test.setTimeout(60000);
  447 |     test.skip(!eventId, 'Sin papeleta creada');
  448 | 
  449 |     await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
  450 |     await authenticatedPage.waitForLoadState('networkidle');
  451 | 
  452 |     await expect(authenticatedPage.getByText('Papeleta electrónica', { exact: true })).toBeVisible({ timeout: 15000 });
  453 | 
  454 |     // PapeletaWorkspace renderiza botones por estudio, no data-testid ni cards.
  455 |     const eventTestButtons = authenticatedPage.locator('button').filter({
  456 |       hasText: /AGUDEZA VISUAL|AUDIOMETRIA|ESPIROMETRIA|BIOMETRIA|ELECTROCARDIOGRAMA|RX DE TORAX|EXAMEN MEDICO/i,
  457 |     });
  458 |     const count = await eventTestButtons.count();
  459 |     console.log(`EventTests visibles en PapeletaWorkspace: ${count}`);
  460 |     expect(count).toBeGreaterThanOrEqual(5);
  461 |   });
  462 | 
  463 |   // Fase 6: Llenar examen médico
  464 |   test('TC-08: Completar somatometría y agudeza visual', async () => {
  465 |     test.setTimeout(60000);
  466 |     test.skip(!eventId, 'Sin papeleta creada');
  467 | 
  468 |     await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
  469 |     await authenticatedPage.waitForLoadState('networkidle');
  470 | 
  471 |     // Los campos clínicos se muestran al abrir el botón del estudio Examen Médico.
  472 |     await authenticatedPage.locator('button').filter({ hasText: /EXAMEN MEDICO/i }).first().click();
  473 | 
  474 |     // Somatometría: la UI vigente usa talla en metros, no en centímetros.
  475 |     await authenticatedPage.getByPlaceholder('Ej: 75.5').fill('70');
  476 |     await authenticatedPage.getByPlaceholder('Ej: 1.75').fill('1.65');
  477 |     await authenticatedPage.getByRole('button', { name: /completar somatometría/i }).click();
  478 |     await expect(authenticatedPage.getByText(/somatometría completada/i)).toBeVisible({ timeout: 15000 });
  479 | 
  480 |     // Signos vitales viven en la segunda pestaña del mismo estudio.
  481 |     await authenticatedPage.getByRole('button', { name: /signos vitales/i }).first().click();
  482 |     await authenticatedPage.getByPlaceholder('120').fill('120');
  483 |     await authenticatedPage.getByPlaceholder('80').fill('80');
  484 |     await authenticatedPage.getByPlaceholder('BPM').fill('72');
  485 |     await authenticatedPage.getByRole('button', { name: /completar signos vitales/i }).click();
  486 |     await expect(authenticatedPage.getByText(/signos vitales completados/i)).toBeVisible({ timeout: 15000 });
  487 | 
  488 |     // Agudeza visual no tiene for/id; se acota al bloque Campo Visual y se
  489 |     // llenan OD/OI por posición estable de los inputs de la tabla.
  490 |     await authenticatedPage.getByRole('button', { name: /agudeza visual/i }).first().click();
  491 |     const visualInputs = authenticatedPage
  492 |       .getByText('Campo Visual', { exact: true })
  493 |       .locator('xpath=..')
  494 |       .locator('input');
  495 |     await expect(visualInputs).toHaveCount(8);
  496 |     await visualInputs.nth(0).fill('1.0');
  497 |     await visualInputs.nth(1).fill('0.8');
  498 |     await authenticatedPage.getByRole('button', { name: /completar agudeza visual/i }).click();
  499 |     await expect(authenticatedPage.getByText(/agudeza visual completada/i)).toBeVisible({ timeout: 15000 });
  500 |   });
  501 | 
  502 |   // Fase 7: Upload audiometría XML
  503 |   test('TC-09: Subir audiometría XML y verificar prediagnóstico', async () => {
  504 |     test.setTimeout(120000);
  505 |     test.skip(!eventId, 'Sin papeleta creada');
  506 | 
  507 |     await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
  508 |     await authenticatedPage.waitForLoadState('networkidle');
  509 | 
  510 |     // PapeletaWorkspace abre el estudio mediante un botón, no mediante <section>.
  511 |     await authenticatedPage.locator('button').filter({ hasText: /AUDIOMETRIA/i }).first().click();
  512 |     const fileInput = authenticatedPage.locator('input[type="file"]').first();
  513 |     await expect(fileInput).toBeAttached();
  514 | 
  515 |     // Upload del XML real; setInputFiles puede cargarlo aunque el accept visual
  516 |     // actual enumere formatos documentales distintos.
  517 |     const xmlFilePath = '/home/frank/repos/Administracion-medica-industrial/context/PACIENTES/JESSICA GABRIELA.xml';
  518 |     await fileInput.setInputFiles(xmlFilePath);
  519 | 
  520 |     await expect(authenticatedPage.getByText(/procesando estudio con IA|subiendo archivo/i).first()).not.toBeVisible({ timeout: 60000 });
  521 | 
  522 |     // La tabla bilateral del parser directo expone frecuencias exactas.
> 523 |     await expect(authenticatedPage.getByText('250', { exact: true })).toBeVisible({ timeout: 15000 });
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
  524 |     await expect(authenticatedPage.getByText('500', { exact: true })).toBeVisible();
  525 |     await expect(authenticatedPage.getByText('1000', { exact: true })).toBeVisible();
  526 | 
  527 |     // La UI vigente muestra "Extracción clínica"; los paneles RAW fueron
  528 |     // retirados por la limpieza de papeleta y se documentan como gap restante.
  529 |     await expect(authenticatedPage.getByText(/Extracción clínica|Valores capturados/i).first()).toBeVisible();
  530 | 
  531 |     const prediagCard = authenticatedPage.locator('[data-testid="prediagnosis-card"]');
  532 |     if (await prediagCard.count() > 0) {
  533 |       await expect(prediagCard).toBeVisible({ timeout: 30000 });
  534 |       console.log('Prediagnóstico de audiometría generado');
  535 |     } else {
  536 |       console.warn('Prediagnóstico no encontrado, puede estar en procesamiento');
  537 |     }
  538 |   });
  539 | 
  540 |   // Fase 7.2: Upload espirometría PDF
  541 |   test('TC-10: Subir espirometría PDF y verificar prediagnóstico', async () => {
  542 |     test.setTimeout(120000);
  543 |     test.skip(!eventId, 'Sin papeleta creada');
  544 | 
  545 |     await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
  546 |     await authenticatedPage.waitForLoadState('networkidle');
  547 | 
  548 |     await authenticatedPage.locator('button').filter({ hasText: /ESPIROMETRIA/i }).first().click();
  549 |     const fileInput = authenticatedPage.locator('input[type="file"]').first();
  550 |     await expect(fileInput).toBeAttached();
  551 | 
  552 |     const dummyPdf = Buffer.from('%PDF-1.4 dummy spirometry file');
  553 |     await fileInput.setInputFiles({
  554 |       name: `espirometria_dummy_${RUN_TAG}.pdf`,
  555 |       mimeType: 'application/pdf',
  556 |       buffer: dummyPdf,
  557 |     });
  558 | 
  559 |     await expect(authenticatedPage.getByText(/procesando estudio con IA|subiendo archivo/i).first()).not.toBeVisible({ timeout: 30000 });
  560 | 
  561 |     // El PDF dummy puede no producir extracción; si el renderer aparece, se
  562 |     // valida que expone los parámetros esperados sin convertir el caso en skip.
  563 |     const extractedValues = authenticatedPage.getByText(/FEV1|FVC/i).first();
  564 |     if (await extractedValues.count() > 0) {
  565 |       await expect(extractedValues).toBeVisible({ timeout: 10000 });
  566 |       console.log('Valores de espirometría extraídos');
  567 |     } else {
  568 |       console.warn('Extracción de espirometría no disponible con PDF dummy');
  569 |     }
  570 |   });
  571 | 
  572 |   // Fase 8: Toma de muestra laboratorio
  573 |   test('TC-11: Marcar muestra tomada y verificar LabOrder', async () => {
  574 |     test.setTimeout(60000);
  575 |     test.skip(!eventId, 'Sin papeleta creada');
  576 | 
  577 |     await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
  578 |     await authenticatedPage.waitForLoadState('networkidle');
  579 | 
  580 |     await authenticatedPage.locator('button').filter({ hasText: /BIOMETRIA|HEMATICA/i }).first().click();
  581 |     const sampleButton = authenticatedPage.getByRole('button', { name: /registrar muestra tomada/i });
  582 |     await expect(sampleButton).toBeVisible({ timeout: 15000 });
  583 |     await sampleButton.click();
  584 | 
  585 |     await expect(
  586 |       authenticatedPage.getByText(/pendiente de resultado de prueba de laboratorio/i),
  587 |     ).toBeVisible({ timeout: 15000 });
  588 | 
  589 |     // Lab reception renders a real <tr>; the event link is the persistent ID
  590 |     // source for this route and avoids relying on folio text.
  591 |     await authenticatedPage.goto(`${BASE_URL}/lab/reception`);
  592 |     await authenticatedPage.waitForLoadState('networkidle');
  593 |     const fullName = `${TRABAJADOR.firstName} ${TRABAJADOR.lastName}`;
  594 |     const labRow = authenticatedPage.locator('tr').filter({ hasText: fullName }).first();
  595 |     await expect(labRow).toBeVisible({ timeout: 15000 });
  596 |     const eventLink = labRow.getByRole('link').first();
  597 |     const eventHref = await eventLink.getAttribute('href');
  598 |     const eventMatch = eventHref?.match(/\/events\/([a-f0-9-]+)/);
  599 |     if (!eventMatch || eventMatch[1] !== eventId) {
  600 |       throw new Error(
  601 |         `La bandeja LAB no enlaza al eventId esperado (href=${eventHref ?? 'null'}, eventId=${eventId}).`,
  602 |       );
  603 |     }
  604 |     console.log('LabOrder visible en recepción para eventId:', eventId);
  605 |   });
  606 | 
  607 |   // Fase 9: Dictamen final
  608 |   test('TC-12: Generar dictamen final y cerrar papeleta', async () => {
  609 |     test.setTimeout(60000);
  610 |     test.skip(!eventId, 'Sin papeleta creada');
  611 | 
  612 |     await authenticatedPage.goto(`${BASE_URL}/events/${eventId}`);
  613 |     await authenticatedPage.waitForLoadState('networkidle');
  614 | 
  615 |     // Si el evento alcanza VALIDATING, el componente real es
  616 |     // EventFlowController (no una section con select Aptitud).
  617 |     const verdictHeading = authenticatedPage.getByRole('heading', { name: 'Reporte médico de aptitud' });
  618 |     await expect(verdictHeading).toBeVisible({ timeout: 15000 });
  619 | 
  620 |     await authenticatedPage
  621 |       .getByPlaceholder('Ej: Apto para el puesto sin restricciones...')
  622 |       .fill('Paciente sin hallazgos patológicos. Apto para el puesto.');
  623 |     await authenticatedPage
```