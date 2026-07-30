# SPEC-IMPL-20260729-SOFIA-CORRECCIONES — Correcciones UI y triggers backend pendientes

**ID:** `IMPL-20260729-SOFIA`  
**Fecha:** 2026-07-29 02:15 CST  
**Prioridad:** P0 (Crítica)  
**Tipo:** Implementación + Fix UI  
**Estado:** [~] En especificación  

---

## 1. Contexto

Se ejecutaron tests E2E del flujo completo contra producción. Estado actual:
- ✅ Login funcional (100%)
- ✅ TC-01 (Crear empresa): EXITOSO
- ❌ TC-04 (Crear trabajador): Bloqueado por overlay modal
- ⏸️ TC-02 a TC-12: Pendientes por dependencias

**Checkpoint referencia:** `context/checkpoints/CHK_IMPL-20260729-E2E-PARCIAL.md`

---

## 2. Trabajo requerido

### Tarea 1: Fix overlay modal en formulario de trabajadores

**Problema:**
El botón de submit del formulario de nuevo trabajador existe y es visible, pero un overlay/backdrop (`div.fixed.inset-0.bg-slate-900/40`) intercepta los clicks, impidiendo enviar el formulario.

**Archivo a modificar:** `frontend/tests/flujo-completo.spec.ts` (líneas ~250-255)

**Soluciones a implementar (probar en orden):**

#### Opción A: Forzar click ignorando overlay
```typescript
await submitButton.click({ force: true });
```

#### Opción B: Cerrar overlay primero
```typescript
// Esperar que el modal esté completamente visible
await page.waitForSelector('div[class*="backdrop"]', { state: 'visible' });

// Ocultar overlay temporalmente para permitir click
await page.locator('div[class*="backdrop"]').evaluate(el => {
  if (el instanceof HTMLElement) el.style.pointerEvents = 'none';
});

// Hacer click normal
await submitButton.click();

// Restaurar overlay
await page.locator('div[class*="backdrop"]').evaluate(el => {
  if (el instanceof HTMLElement) el.style.pointerEvents = '';
});
```

#### Opción C: Usar keyboard events
```typescript
// Enfocar el botón y presionar Enter
await submitButton.focus();
await authenticatedPage.keyboard.press('Enter');
```

#### Opción D: Dispatch directo del evento
```typescript
// Disparar click event directamente sin pointer events
await submitButton.evaluate(el => (el as HTMLElement).click());
```

**Criterio de éxito:** TC-04 ejecuta completamente y crea trabajador en BD.

---

### Tarea 2: Ejecutar tests TC-01 a TC-04 completos

**Comando:**
```bash
cd frontend
TEST_USER_EMAIL="admin@sistema.com" \
TEST_USER_PASSWORD="Admin@2026!" \
BASE_URL="https://administracion-medica-industrial.vercel.app" \
npx playwright test flujo-completo.spec.ts --grep "TC-0[1-4]" --project=chromium --timeout=120000
```

**Resultado esperado:**
- TC-01: ✅ Crear empresa (ya funciona)
- TC-02: ⏳ Crear perfil médico
- TC-03: ⏳ Crear puesto con perfil default
- TC-04: ✅ Crear trabajador (con fix de overlay)

---

### Tarea 3: Corregir selectores de formularios pendientes

Una vez TC-01 a TC-04 funcionen, continuar con los siguientes tests que probablemente requieran ajustes similares de selectores:

#### TC-05: Crear cita
**Ruta:** `/appointments`
**Acción probable:** Click en "+ Nueva Cita" o similar
**Campos esperados:** Worker, Branch, Fecha, Hora

#### TC-06: Check-in en recepción
**Ruta:** `/reception`
**Acción probable:** Buscar trabajador, corroborar identidad, subir INE

#### TC-07: Generar papeleta desde cita
**Ruta:** Desde appointments → iniciar atención
**Verificación crítica:** EventTests pre-llenados automáticamente

**Estrategia:**
Para cada test fallido:
1. Navegar manualmente a la ruta
2. Capturar snapshot con Playwright browser tool
3. Identificar selectores reales (botones, labels, placeholders)
4. Actualizar `flujo-completo.spec.ts`
5. Re-ejecutar test específico

---

### Tarea 4: Validar triggers backend críticos

Una vez los tests UI pasen, verificar que los triggers backend funcionen:

#### Trigger A: EventTests desde ProfileTest
**Contexto:** Al crear MedicalEvent desde Appointment, deben crearse automáticamente EventTests basados en el MedicalProfile asociado.

**Verificación:**
```typescript
// Después de crear papeleta (TC-07)
const eventTests = await prisma.eventTest.findMany({
  where: { eventId: newEventId },
  include: { test: true }
});

console.log(`EventTests creados: ${eventTests.length}`);
// Debe ser >= 5 (uno por cada estudio del perfil)
```

**Si NO se crean:** Implementar trigger en `backend/app/services/event_service.py` o server action correspondiente.

#### Trigger B: LabOrder desde SAMPLE_TAKEN
**Contexto:** Al cambiar EventTest.status a SAMPLE_TAKEN, debe crearse LabOrder DRAFT automáticamente.

**Verificación:**
```typescript
// Después de marcar muestra tomada
const labOrder = await prisma.labOrder.findFirst({
  where: { medicalEventId: eventId },
  include: { items: true }
});

console.log(`LabOrder creado: ${!!labOrder}, Items: ${labOrder?.items.length || 0}`);
```

**Si NO se crea:** Implementar trigger en backend.

---

### Tarea 5: Identificar e implementar gaps funcionales

Basado en resultados de tests, documentar qué partes del flujo NO están implementadas:

**Gaps potenciales identificados:**
1. **Componente dictamen final:** ¿Existe UI para cerrar papeleta con aptitud médica?
2. **Trigger EventTests:** ¿Se crean automáticamente al generar MedicalEvent?
3. **Trigger LabOrder:** ¿Se crea automáticamente al tomar muestra?
4. **Pipeline IA:** ¿Upload de audiometría/espirometría dispara extracción y prediagnóstico?

**Acción:** Para cada gap identificado:
- Si es feature faltante: crear SPEC de implementación
- Si es bug: crear SPEC de fix
- Documentar en checkpoint final

---

## 3. Criterios de aceptación

- [ ] TC-01 a TC-04 ejecutándose exitosamente
- [ ] Al menos 50% de los 12 tests pasando
- [ ] Triggers backend verificados (EventTests, LabOrder)
- [ ] Gaps funcionales documentados con SPECs de follow-up
- [ ] Checkpoint final actualizado con resultados

---

## 4. Archivos clave

### Tests
- `frontend/tests/flujo-completo.spec.ts` - Suite E2E principal (~500 líneas)

### Backend (para triggers)
- `backend/app/services/event_service.py` - Creación MedicalEvent + EventTests
- `backend/app/services/lab_service.py` - Trigger LabOrder desde SAMPLE_TAKEN
- `backend/app/api/v1/event_tests.py` - Endpoints status changes

### Frontend (para selectores)
- `frontend/src/app/companies/page.tsx` - Formulario empresa
- `frontend/src/app/workers/page.tsx` - Formulario trabajador
- `frontend/src/app/appointments/page.tsx` - Formulario cita
- `frontend/src/app/reception/page.tsx` - Check-in recepción
- `frontend/src/app/events/[id]/page.tsx` - Papeleta completa

---

## 5. Comandos útiles

### Ejecutar test individual
```bash
cd frontend
TEST_USER_EMAIL="admin@sistema.com" \
TEST_USER_PASSWORD="Admin@2026!" \
BASE_URL="https://administracion-medica-industrial.vercel.app" \
npx playwright test flujo-completo.spec.ts --grep "TC-04" --project=chromium --timeout=120000
```

### Ejecutar rango de tests
```bash
npx playwright test flujo-completo.spec.ts --grep "TC-0[1-6]" --project=chromium --timeout=120000
```

### Ejecutar todos los tests E2E
```bash
npx playwright test flujo-completo.spec.ts --project=chromium --timeout=300000
```

### Verificar usuarios en BD
```bash
cd frontend
railway run --service 'Administracion-medica-industrial' npx tsx scripts/create-new-admin.ts
```

---

## 6. Escalamiento

**Escalar a INTEGRA si:**
- Triggers backend requieren cambios arquitectónicos mayores
- Más de 3 tests fallan por gaps funcionales (no solo selectores)
- Se necesita decisión de producto sobre flujos alternativos

**Escalar a DEBUGGER si:**
- Upload de archivos falla consistentemente (>3 intentos)
- Pipeline IA retorna errores 503 o timeout >2min
- Triggers backend no disparan a pesar de estar correctamente invocados

**Escalar a GEMINI si:**
- Cambios no triviales antes de merge a main
- Auditoría de seguridad requerida para nuevos endpoints

---

## 7. Estimación

| Tarea | Complejidad | Tiempo estimado |
|-------|-------------|-----------------|
| Fix overlay modal | Baja | 0.5h |
| Corrección selectores TC-05 a TC-08 | Media | 2h |
| Validación triggers backend | Media | 1.5h |
| Documentación gaps funcionales | Media | 1h |
| Ejecución completa + screenshots | Baja | 1h |
| **Total** | | **~6 horas** |

---

## 8. Entregables esperados

1. `frontend/tests/flujo-completo.spec.ts` actualizado con fixes de overlay y selectores
2. Checkpoint `context/checkpoints/CHK_IMPL-20260729-E2E-FINAL-SOFIA.md` con:
   - Tabla de resultados por test (✅/❌/⚠️)
   - Selectores corregidos documentados
   - Triggers backend verificados (con queries SQL de validación)
   - Gaps funcionales listados con priorización
   - Screenshots de cada fase exitosa
3. SPECs de follow-up para gaps identificados (si aplica)

---

**Estado:** [~] Listo para implementación por SOFIA

**Responsable:** @SOFIA  
**Deadline sugerido:** 2-3 horas para fixes iniciales, 6 horas para completitud
