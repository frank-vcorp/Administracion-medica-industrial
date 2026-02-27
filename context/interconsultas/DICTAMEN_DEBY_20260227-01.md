# DICTAMEN TÉCNICO: Auditoría de Calidad (Piso Clínico y Citas)

**ID:** DICTAMEN_DEBY_20260227-01
**Fecha:** 27 de Febrero de 2026
**Auditor:** Deby (vía INTEGRA)
**Herramienta:** Qodo CLI (Static Analysis)

## 1. Resumen Ejecutivo
La implementación del módulo "Piso Clínico" y el modal de citas es funcional, pero presenta riesgos moderados en la consistencia de datos (Timezones, Race Conditions) y detalles de UI que deben pulirse antes de un despliegue productivo. No se encontraron vulnerabilidades críticas bloqueantes, pero sí deuda técnica importante.

## 2. Hallazgos Principales

### A. Robustez y Lógica (`AppointmentFormModal.tsx`)
1.  **Race Condition en Selección de Trabajador:**
    *   **Problema:** El envío depende del estado `selectedWorker`. Si el usuario cambia rápidamente el select y presiona "Agendar", podría enviarse una `companyId` desincronizada respecto al `workerId` del formulario.
    *   **Recomendación:** Buscar el objeto worker directamente dentro de `handleSubmit` usando el `workerId` del `Config` para garantizar integridad.
2.  **Manejo de Zona Horaria (Timezone):**
    *   **Problema:** `new Date(${date}T${time}:00)` utiliza la zona horaria del navegador del cliente. Esto puede causar que una cita a las 09:00 AM se guarde como 15:00 UTC y se muestre incorrectamente si el servidor o la DB tienen otra configuración.
    *   **Recomendación:** Estandarizar el manejo de fechas (ISO string completo o UTC forzado).

### B. Privacidad y Seguridad
1.  **Datos en URL de WhatsApp:**
    *   **Observación:** Se incluye el `expedientId` y nombre completo en el texto pre-llenado de WhatsApp.
    *   **Riesgo:** Aunque `wa.me` es seguro, los datos viajan en la URL (historial, logs).
    *   **Recomendación:** Evaluar si es necesario enviar el ID interno del expediente o solo la confirmación genérica.

### C. Interfaz de Usuario (`reception/page.tsx`)
1.  **Prop `borderColor` Ignorada:**
    *   **Bug:** El componente `Lane` recibe una prop `borderColor` pero no la aplica en sus clases CSS (tiene hardcodeado `border-slate-100`).
    *   **Impacto:** Visual (los bordes de las columnas no coinciden con el color del encabezado).
2.  **Estados del Kanban:**
    *   **Observación:** Qodo reportó falta de transición en columnas finales.
    *   **Análisis:** Es un falso positivo funcional (el flujo termina en validación), pero el código podría ser más explícito.

## 3. Plan de Acción Recomendado (Quick Wins)
1.  [ ] Corregir el bug visual de `borderColor` en `Lane`.
2.  [ ] Refactorizar `handleSubmit` en el modal de citas para no depender del estado `selectedWorker`.
3.  [ ] Agregar validación de que `workerPhone` exista antes de generar link de WhatsApp.

---
**Resultado General:** APROBADO CON OBSERVACIONES (Yellow Flag)
