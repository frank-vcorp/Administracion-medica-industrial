# SPEC_FIX-20260729-01-E2E-SERIAL-MODE — Habilitar modo serial en test suite para propagación de variables

**ID:** `FIX-20260729-01`  
**Fecha:** 2026-07-29 04:50 CST  
**Prioridad:** P0 (CRÍTICA)  
**Tipo:** Fix de configuración de tests  
**Estado:** [~] Pendiente aprobación INTEGRA  

---

## 1. Problema

El test suite `frontend/tests/flujo-completo.spec.ts` comparte estado entre tests mediante closure variables (`companyId`, `workerId`, `eventId`, etc.), pero Playwright corre por defecto con **4 workers en paralelo**.

**Resultado:** Los tests posteriores (TC-02 a TC-12) no ven las variables creadas por TC-01/04 y se saltan con `test.skip(!companyId, 'Sin empresa creada')`.

**Evidencia:**
- TC-01 y TC-04 corren en paralelo en workers distintos
- TC-02, TC-03, TC-05+ se ejecutan en workers sin acceso a `companyId`
- Query a BD confirma: 2 companies + 1 worker (de TC-01/04) pero 0 medicalProfiles, 0 appointments, 0 medicalEvents

**Impacto:**
- 8/12 tests se saltan (66%)
- Imposible validar selectores de TC-05 a TC-12
- Imposible validar triggers backend (no hay datos downstream)
- Tiempo invertido en corregir selectores es desperdiciado si tests no ejecutan

---

## 2. Solución

Habilitar modo **serial** dentro del `test.describe` para forzar ejecución secuencial. Esto permite que las closure variables se propaguen entre tests.

### Cambio 1: Modificar `frontend/tests/flujo-completo.spec.ts`

**Ubicación:** Línea ~50 (después de `test.describe('Flujo End-to-End Completo', () => {`)

**Antes:**
```typescript
test.describe('Flujo End-to-End Completo', () => {
  test.use({ baseURL: BASE_URL });
  
  let authenticatedPage: Page;
  ...
});
```

**Después:**
```typescript
test.describe('Flujo End-to-End Completo', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ baseURL: BASE_URL });
  
  let authenticatedPage: Page;
  ...
});
```

### Cambio 2 (opcional): Reducir workers en CLI

Para ejecución local, agregar flag en package.json scripts:

```json
{
  "scripts": {
    "test:e2e": "playwright test --workers=1"
  }
}
```

---

## 3. Criterios de aceptación

- [x] `test.describe.configure({ mode: 'serial' })` agregado
- [ ] TC-01 a TC-12 corren secuencialmente (no en paralelo)
- [ ] `companyId` se propaga de TC-01 a TC-02
- [ ] `workerId` se propaga de TC-04 a TC-05
- [ ] Al menos 8/12 tests ejecutan (no se saltan por dependencia)
- [ ] Validación: re-ejecutar suite completa y contar SKIPs

---

## 4. Validación

### Comando de validación
```bash
cd frontend
TEST_USER_EMAIL="admin@sistema.com" \
TEST_USER_PASSWORD="Admin@2026!" \
BASE_URL="https://administracion-medica-industrial.vercel.app" \
npx playwright test flujo-completo.spec.ts --project=chromium --timeout=300000
```

### Resultado esperado
- Antes: 4 tests ejecutados (TC-01, TC-04 con skipchains), 8 SKIP
- Después: 12 tests ejecutados secuencialmente

### Verificación de propagación
```bash
railway run --service 'Administracion-medica-industrial' npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const counts = await Promise.all([
    p.company.count(),
    p.worker.count(),
    p.medicalProfile.count(),
    p.jobPosition.count(),
    p.appointment.count(),
    p.medicalEvent.count(),
    p.eventTest.count(),
    p.labOrder.count(),
  ]);
  console.log('Counts:', counts);
  await p.\$disconnect();
})();
"
```

**Esperado después de ejecución completa:**
- companies: >2
- workers: >1
- medicalProfiles: >=1
- jobPositions: >=1
- appointments: >=1
- medicalEvents: >=1

---

## 5. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Modo serial reduce velocidad total | Alta | Bajo | Tests corren en orden, no en paralelo → ~3x más lento pero confiable |
| Tests compartan estado entre runs | Media | Medio | Cada run limpia BD o usa IDs únicos con timestamp |
| Serial mode afecta otros test files | Baja | Bajo | Cambio solo afecta este `describe`, no global |

---

## 6. Estimación

- **Implementación:** 5 minutos (1 línea agregada)
- **Validación:** 5-10 minutos (re-ejecutar suite + queries)
- **Total:** ~15 minutos

---

## 7. Aprobación requerida

**INTEGRA:** Aprobar cambio en `flujo-completo.spec.ts` línea ~50 antes de proceder.

---

**Estado:** [~] Esperando aprobación INTEGRA  
**Responsable de implementación:** SOFIA tras aprobación  
**Bloquea:** Desbloqueo de TC-02 a TC-12 → habilita validación selectores y triggers
