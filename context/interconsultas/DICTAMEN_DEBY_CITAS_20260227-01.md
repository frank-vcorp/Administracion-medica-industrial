# DICTAMEN TÉCNICO: Auditoría de Módulo de Citas

**ID:** DICTAMEN_DEBY_CITAS_20260227-01
**Fecha:** 27 de Febrero de 2026
**Auditor:** Deby (vía INTEGRA)
**Herramienta:** Qodo CLI (Static Analysis)

## 1. Resumen Ejecutivo
La auditoría del módulo de Citas revela hallazgos importantes en la lógica de negocio del lado servidor (`appointment.actions.ts`) que comprometen la consistencia de datos (Check-in no atómico, bugs de auditoría) y manejo riesgoso de fechas en el cliente (`page.tsx`). Si bien el frontend es funcional, el backend requiere robustecimiento inmediato para evitar datos corruptos o duplicados en producción.

## 2. Hallazgos Críticos (Must Fix)

### A. Integridad de Datos en `checkInAppointment` (Backend)
1.  **Falta de Atomicidad (Transacción):**
    *   **Problema:** La operación de Check-in realiza dos escrituras independientes: 1) Actualizar cita a `COMPLETED` y 2) Crear `MedicalEvent`. Si el paso 2 falla, la cita queda "completada" sin expediente médico, dejando un estado huérfano irrecuperable por el usuario.
    *   **Riesgo:** Pérdida de trazabilidad de pacientes.
    *   **Solución:** Envolver ambas operaciones en un `prisma.$transaction`.

2.  **Bug en Auditoría (`updateAppointmentStatus`):**
    *   **Problema:** Se registra el `previousStatus` después de haber actualizado el registro, por lo que el log guarda "Status A -> Status A" en lugar de "Status A -> Status B".
    *   **Solución:** Capturar el estado anterior antes del update.

### B. Manejo de Fechas y Timezones (Full Stack)
1.  **Interpretación Inconsistente:**
    *   **Problema:** El cliente envía fechas como strings "YYYY-MM-DD". El backend las interpreta como UTC (`new Date(date)`), lo que a menudo resulta en el día anterior (e.g., 2026-02-27 se convierte en 2026-02-26T18:00:00.000Z en CST).
    *   **Impacto:** Citas que desaparecen del filtro diario o aparecen en días incorrectos.
    *   **Solución:** Normalizar el filtro de fechas en el backend para usar rangos explícitos (`gte`, `lt`) basados en la zona horaria del negocio, o forzar UTC desde el cliente.

### C. Frontend (`appointments/page.tsx`)
1.  **Manejo de Errores Silencioso:**
    *   **Problema:** `loadData` no tiene `try/catch`. Si la carga falla, el usuario se queda con un spinner infinito o una pantalla vacía sin feedback.
    *   **Solución:** Implementar estado de error y mensaje visual.

## 3. Plan de Acción Inmediato
1.  [ ] **Frontend (`AppointmentFormModal`):** Corregir Race Condition y manejo de WhatsApp (autorizado previamente).
2.  [ ] **Frontend (`reception/page.tsx`):** Corregir bug visual en `Lane` (autorizado previamente).
3.  [ ] **Backend (`appointment.actions.ts`):** Implementar `prisma.$transaction` para el Check-in y corregir el log de auditoría.
4.  [ ] **Backend:** Validar input de fechas para evitar desfases de día.

---
**Resultado General:** REQUIERE CORRECCIONES BLOQUEANTES EN BACKEND
