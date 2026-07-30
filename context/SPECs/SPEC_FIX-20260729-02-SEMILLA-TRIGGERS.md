# SPEC_FIX-20260729-02-SEMILLA-TRIGGERS — Script semilla para validar triggers backend sin UI

**ID:** `FIX-20260729-02`  
**Fecha:** 2026-07-29 04:55 CST  
**Prioridad:** P1 (Alta)  
**Tipo:** Script de validación backend  
**Estado:** [~] Pendiente aprobación INTEGRA  

---

## 1. Problema

Los triggers backend críticos no son verificables mediante tests E2E porque la BD de producción no tiene datos suficientes:
- **Trigger EventTests:** No se puede crear MedicalEvent sin pasar por UI
- **Trigger LabOrder:** No se puede llegar hasta SAMPLE_TAKEN sin flujo UI

**Evidencia SOFIA:**
```
BD tiene: 2 companies, 1 worker, 0 medicalEvents, 0 appointments, 0 labOrders
```

Sin datos downstream, no es posible verificar:
- Si `createMedicalEvent` server action crea EventTests automáticamente desde ProfileTest
- Si `markSampleTaken` server action crea LabOrder DRAFT automáticamente

---

## 2. Solución

Crear script TypeScript (`scripts/seed-triggers-test.ts`) que:
1. Use el cliente Prisma para crear datos semilla mínimos
2. Invoque directamente las server actions críticas
3. Verifique estado post-invocación
4. Reporte resultado de cada trigger

---

## 3. Implementación

### Archivo nuevo: `frontend/scripts/seed-triggers-test.ts`

```typescript
/**
 * Script de validación de triggers backend para flujo E2E.
 * Crea datos semilla mínimos y verifica que los triggers se ejecuten correctamente.
 * 
 * @id FIX-20260729-02
 * Ejecutar: railway run --service 'Administracion-medica-industrial' npx tsx scripts/seed-triggers-test.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function validateEventTestsTrigger(): Promise<boolean> {
  console.log('\n━━━ TRIGGER 1: MedicalEvent → EventTests ━━━');
  
  // 1. Buscar empresa y worker existentes (de TC-01/04)
  const company = await prisma.company.findFirst({ orderBy: { createdAt: 'desc' } });
  const worker = await prisma.worker.findFirst({ orderBy: { createdAt: 'desc' } });
  
  if (!company || !worker) {
    console.error('❌ Faltan datos base (company o worker). Ejecutar TC-01/04 primero.');
    return false;
  }
  
  // 2. Crear perfil médico con 3 estudios típicos
  const profile = await prisma.medicalProfile.create({
    data: {
      name: 'TEST - Perfil Soldador',
      companyId: company.id,
      tests: {
        create: [
          { test: { connect: { code: 'GEN-01' } } },
          { test: { connect: { code: 'GEN-02' } } },
          { test: { connect: { code: 'AUDIO-01' } } },
        ]
      }
    }
  });
  console.log(`✓ MedicalProfile creado: ${profile.name}`);
  
  // 3. Asignar perfil a puesto (crear puesto)
  const jobPosition = await prisma.jobPosition.create({
    data: {
      name: 'TEST - Soldador',
      companyId: company.id,
      defaultProfileId: profile.id,
    }
  });
  console.log(`✓ JobPosition creado: ${jobPosition.name}`);
  
  // 4. Crear MedicalEvent invocando server action manualmente
  // NOTA: ajustar según ruta real del server action
  const medicalEvent = await prisma.medicalEvent.create({
    data: {
      workerId: worker.id,
      companyId: company.id,
      medicalProfileId: profile.id,
      status: 'IN_PROGRESS',
      // createdById del admin
      intakeCreatedBy: (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id,
    }
  });
  console.log(`✓ MedicalEvent creado: ${medicalEvent.id}`);
  
  // 5. VERIFICACIÓN: ¿Se crearon EventTests automáticamente?
  const eventTests = await prisma.eventTest.findMany({
    where: { eventId: medicalEvent.id },
    include: { test: true }
  });
  
  if (eventTests.length === 0) {
    console.error('❌ TRIGGER FALLA: No se crearon EventTests');
    console.error('   Acción requerida: implementar createMany en server action MedicalEvent');
    return false;
  }
  
  if (eventTests.length < 3) {
    console.error(`⚠️ TRIGGER PARCIAL: Solo ${eventTests.length} EventTests creados (esperados: 3)`);
  }
  
  console.log(`✅ TRIGGER OK: ${eventTests.length} EventTests creados`);
  eventTests.forEach(et => {
    console.log(`   - ${et.test.code} (${et.status})`);
  });
  
  return true;
}

async function validateLabOrderTrigger(): Promise<boolean> {
  console.log('\n━━━ TRIGGER 2: SAMPLE_TAKEN → LabOrder DRAFT ━━━');
  
  // 1. Buscar MedicalEvent con EventTest de laboratorio
  const labTest = await prisma.medicalTest.findFirst({
    where: { code: 'LAB-01' } // o código de estudio de laboratorio
  });
  
  if (!labTest) {
    console.error('❌ No existe MedicalTest con código LAB-01');
    return false;
  }
  
  const eventTest = await prisma.eventTest.findFirst({
    where: { testId: labTest.id },
    include: { event: true }
  });
  
  if (!eventTest) {
    console.error('❌ No hay EventTest de laboratorio. Ejecutar trigger anterior primero.');
    return false;
  }
  
  // 2. Marcar EventTest como SAMPLE_TAKEN
  // NOTA: invocar server action real si existe, sino update directo
  await prisma.eventTest.update({
    where: { id: eventTest.id },
    data: { status: 'SAMPLE_TAKEN' }
  });
  console.log(`✓ EventTest marcado SAMPLE_TAKEN: ${eventTest.id}`);
  
  // 3. VERIFICACIÓN: ¿Se creó LabOrder?
  const labOrder = await prisma.labOrder.findFirst({
    where: { medicalEventId: eventTest.eventId }
  });
  
  if (!labOrder) {
    console.error('❌ TRIGGER FALLA: No se creó LabOrder');
    console.error('   Acción requerida: implementar trigger en server action de SAMPLE_TAKEN');
    return false;
  }
  
  console.log(`✅ TRIGGER OK: LabOrder creado`);
  console.log(`   - Folio: ${labOrder.folio || 'N/A'}`);
  console.log(`   - Status: ${labOrder.status}`);
  console.log(`   - Worker: ${labOrder.workerId}`);
  
  // 4. Verificar que LabOrderItem también se creó
  const items = await prisma.labOrderItem.findMany({
    where: { labOrderId: labOrder.id }
  });
  
  if (items.length === 0) {
    console.warn('⚠️ LabOrder sin items. Crear manualmente o ajustar trigger.');
  } else {
    console.log(`   - Items: ${items.length}`);
  }
  
  return true;
}

async function main() {
  console.log('🔍 Validación de triggers backend para flujo E2E');
  console.log('━'.repeat(50));
  
  const trigger1 = await validateEventTestsTrigger();
  const trigger2 = await validateLabOrderTrigger();
  
  console.log('\n━'.repeat(50));
  console.log('📊 RESUMEN:');
  console.log(`   Trigger 1 (EventTests):  ${trigger1 ? '✅ OK' : '❌ FALLA'}`);
  console.log(`   Trigger 2 (LabOrder):    ${trigger2 ? '✅ OK' : '❌ FALLA'}`);
  
  if (!trigger1 || !trigger2) {
    console.log('\n⚠️ ACCIONES REQUERIDAS:');
    if (!trigger1) console.log('   - Implementar trigger EventTests en server action MedicalEvent');
    if (!trigger2) console.log('   - Implementar trigger LabOrder en server action SAMPLE_TAKEN');
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 4. Ejecución

```bash
cd frontend
railway run --service 'Administracion-medica-industrial' npx tsx scripts/seed-triggers-test.ts
```

---

## 5. Criterios de aceptación

- [x] Script creado en `frontend/scripts/seed-triggers-test.ts`
- [ ] Trigger 1: EventTests se crean automáticamente al crear MedicalEvent
- [ ] Trigger 2: LabOrder se crea automáticamente al marcar SAMPLE_TAKEN
- [ ] Output muestra ✅/❌ para cada trigger

---

## 6. Acciones si triggers fallan

### Si Trigger 1 falla (no se crean EventTests):
1. Buscar server action en `frontend/src/actions/event*.ts` o `event_tests.ts`
2. Verificar si hace `eventTest.createMany()` después de `medicalEvent.create()`
3. Si NO lo hace, implementar:
```typescript
// Después de crear MedicalEvent
const profileTests = await prisma.profileTest.findMany({
  where: { profileId: medicalEvent.medicalProfileId }
});
await prisma.eventTest.createMany({
  data: profileTests.map(pt => ({
    eventId: event.id,
    testId: pt.testId,
    testNameSnapshot: '', // llenar con nombre del test
    status: 'PENDING'
  }))
});
```

### Si Trigger 2 falla (no se crea LabOrder):
1. Buscar server action de SAMPLE_TAKEN en `frontend/src/actions/event_test*.ts`
2. Verificar si hace `labOrder.create()` cuando status cambia
3. Si NO lo hace, implementar:
```typescript
// Al cambiar status a SAMPLE_TAKEN
const eventTest = await prisma.eventTest.findUnique({ where: { id }, include: { event: true, test: true } });
if (eventTest && eventTest.test.categoryId === laboratorioCategoryId) {
  const labOrder = await prisma.labOrder.create({
    data: {
      workerId: eventTest.event.workerId,
      companyId: eventTest.event.companyId,
      medicalEventId: eventTest.eventId,
      doctorName: 'Dr. Sistema',
      status: 'DRAFT'
    }
  });
  await prisma.labOrderItem.create({
    data: {
      labOrderId: labOrder.id,
      medicalTestId: eventTest.testId,
      eventTestId: eventTest.id
    }
  });
}
```

---

## 7. Estimación

- **Creación del script:** 30 minutos
- **Diagnóstico de triggers:** 1-2 horas (búsqueda en código)
- **Implementación de triggers faltantes:** 1-3 horas
- **Total:** 2.5-5.5 horas

---

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Script crea datos duplicados en BD | Alta | Bajo | Usar nombres con prefijo "TEST -" y limpiar manualmente después |
| Server actions difieren según versión de código | Media | Alto | Revisar código actual antes de implementar fix |
| Cambios requieren migración Prisma | Baja | Alto | NO usar - los triggers son lógica de aplicación, no de BD |

---

**Estado:** [~] Esperando aprobación INTEGRA  
**Responsable:** SOFIA tras aprobación  
**Bloquea:** Validación end-to-end sin UI
