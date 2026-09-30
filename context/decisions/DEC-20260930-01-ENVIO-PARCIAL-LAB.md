# DEC-20260930-01 — Envío parcial de resultados (solo laboratorio)

**Fecha:** 2026-09-30  
**Origen:** Junta 23-Sep-2026 (`context/Juntas/transcripcion23092026.txt`) + acuerdo Frank.

## Decisión

El **envío parcial** por correo es **manual** (nunca automático al subir archivos) y **un solo correo** con las pruebas seleccionadas.

### Gates obligatorios (servidor + UI)

1. **Laboratorio en la batería**  
   El expediente debe incluir al menos una prueba de categoría **Laboratorio** (o `LabOrder` asociada al `MedicalEvent`).  
   Sin lab → **no** se muestra acción de envío parcial.

2. **Resto de estudios cerrados para entrega**  
   Toda prueba **que no sea laboratorio** debe estar en estado entregable:
   - interpretada / PDF de estudio validado, **o**
   - **no realizada** con incidencia/motivo registrado, **o**
   - examen médico con **captura cerrada** (y reglas de validación por estudio que apliquen).

   Lo pendiente de envío parcial son principalmente resultados de **lab** (p. ej. cultivos tardíos).

### Fuera de alcance del parcial

- **Dictamen final de aptitud** (`MedicalVerdict`) y **ZIP de cierre clínico** → solo en **envío final**, cuando todo (incluido lab) esté cerrado.
- No enviar un correo por cada prueba (evitar spam; un correo por acción manual).

## Referencia junta

- Parcial solo con laboratorio en batería (~1:17:12 Frank).
- Selección manual y un solo correo (~34:49–35:26 Leticia/Frank).

## Implementación (#14)

- Helper `canOfferPartialResultSend(eventId)` evalúa (1) y (2).
- Modal: checkboxes solo sobre ítems de lab elegibles; destinatarios desde perfil/trabajador.
- `ResultDeliveryLog` (recomendado) para auditoría.
