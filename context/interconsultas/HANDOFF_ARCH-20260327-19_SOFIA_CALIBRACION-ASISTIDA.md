# HANDOFF DE IMPLEMENTACIÓN

- **ID:** `ARCH-20260327-19`
- **Fecha:** `2026-03-27`
- **Agente origen:** `INTEGRA - Arquitecto`
- **Agente destino:** `SOFIA - Builder`
- **Estado:** `Listo para implementación`
- **SPEC fuente:** `context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md`

## Objetivo
Implementar la evolución del módulo de calibración IA ya existente en la ruta administrativa por prueba para pasar de captura manual a curaduría asistida, con versionado automático y layout de revisión documental dominante.

## Contexto funcional
Ya existe un MVP de calibración en:
- `frontend/src/app/admin/services/[id]/calibration/page.tsx`
- `frontend/src/components/calibration/CalibrationTabs.tsx`
- `frontend/src/components/calibration/AICalibrationEditor.tsx`
- `frontend/src/actions/medical-profiles.ts`

Ese MVP ya permite:
- entrar desde catálogo de pruebas
- ver snapshots reales
- editar configuración básica `aiCalibration`

La siguiente iteración debe resolver tres huecos de producto:
1. demasiada captura manual
2. ausencia de versionado automático
3. ausencia de un layout de trabajo con documento grande y permanente a la derecha

## Entregable obligatorio

### 1. Layout nuevo de calibración
- En desktop, dividir la pantalla en 2 paneles principales.
- Izquierda: calibración, propuesta IA, versiones, acciones.
- Derecha: documento fuente grande, sticky y siempre visible.
- El documento debe ser dominante visualmente y ocupar aproximadamente 55-60% del ancho útil.

### 2. Propuesta IA asistida
- Generar propuesta inicial de esquema candidato usando snapshots reales ya existentes.
- Si no conviene tocar aún el backend Python, la propuesta puede derivarse heurísticamente de `structuredData`, `extractedData`, `missing_fields` y snapshots relacionados.
- La UI debe permitir como mínimo:
  - aceptar campo candidato
  - editar nombre/tipo/unidad
  - descartar candidato
  - promover candidatos al contrato oficial

### 3. Versionado automático
- Persistir dentro de `MedicalTest.options.aiCalibration` una estructura V2 con:
  - `currentVersion`
  - `currentVersionLabel`
  - `versions[]`
  - `draft`
  - `fieldDefinitions[]`
- Cada guardado que altere el contrato efectivo debe crear una nueva versión automáticamente.
- La UI debe diferenciar entre:
  - versión vigente
  - borrador actual
  - historial reciente

### 4. Asistente IA persistente
- Mostrar sugerencias y observaciones accionables durante la calibración:
  - aliases detectados
  - faltantes respecto a esquema vigente
  - posibles conflictos
  - sugerencias de tipo/unidad
  - resumen de cambios propuestos

## Restricciones
- No romper el flujo clínico ni la papeleta.
- No eliminar el MVP actual si puede evolucionarse.
- No introducir migraciones Prisma salvo necesidad extrema.
- Mantener compatibilidad con usos existentes de `MedicalTest.options`.
- Reusar snapshots reales del sistema.

## Archivos probables a modificar
- `frontend/src/app/admin/services/[id]/calibration/page.tsx`
- `frontend/src/actions/medical-profiles.ts`
- `frontend/src/components/calibration/CalibrationTabs.tsx`
- `frontend/src/components/calibration/AICalibrationEditor.tsx`
- componentes nuevos bajo `frontend/src/components/calibration/`

## Criterios de aceptación mínimos
1. La pantalla ya no parte solo de formulario vacío.
2. Existe propuesta IA visible de campos/esquema candidatos.
3. El documento permanece grande a la derecha en desktop.
4. Guardar crea nuevas versiones automáticas cuando cambie la calibración efectiva.
5. El usuario puede curar candidatos sin redactar todo desde cero.

## Validación esperada
- Ejecutar validación local disponible si el entorno lo permite.
- Si no hay toolchain local, dejar constancia explícita.
- Ejecutar `qodo self-review` si está disponible.
- Generar checkpoint de implementación con archivos tocados, validación y riesgos.

## Nota operativa
Se intentó invocar directamente al subagente SOFIA desde VS Code, pero la llamada quedó bloqueada por rate limit del servicio. Este handoff deja el mandato listo para ejecución apenas el agente quede disponible nuevamente.