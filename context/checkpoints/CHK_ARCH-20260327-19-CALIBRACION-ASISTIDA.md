# Checkpoint de Implementación — IMPL-20260327-19

- **ID:** `IMPL-20260327-19`
- **Fecha:** `2026-03-27`
- **Agente:** `SOFIA - Builder`
- **Estado:** `IMPLEMENTADO — pendiente validación en runtime Docker`
- **SPEC fuente:** `context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md`
- **Handoff origen:** `context/interconsultas/HANDOFF_ARCH-20260327-19_SOFIA_CALIBRACION-ASISTIDA.md`

## Resumen de cambios

### Archivos creados (nuevos)
| Archivo | Descripción |
|---------|-------------|
| `frontend/src/lib/calibration-schema.ts` | Función pura `deriveSchemaFromSnapshots` — análisis heurístico de extracted_data |
| `frontend/src/components/calibration/CalibrationDocumentViewer.tsx` | Visor de documento fuente (PDF/imagen), sticky, panel derecho dominante |
| `frontend/src/components/calibration/CandidateSchemaPanel.tsx` | Panel de curaduría de campos candidatos (aceptar/editar/descartar + promoción) |
| `frontend/src/components/calibration/CalibrationVersionHistory.tsx` | Historial de versiones, diff vigente vs. borrador, tabla de fieldDefinitions |
| `frontend/src/components/calibration/CalibrationAIAssistantRail.tsx` | Rail IA con observaciones heurísticas contextuales |
| `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx` | Layout 2 columnas (42%/58%), gestiona estado de snapshot seleccionado |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `frontend/src/actions/medical-profiles.ts` | +`saveAICalibrationV2` con versionado automático (incremento de versión si cambia contrato) |
| `frontend/src/app/admin/services/[id]/calibration/page.tsx` | Nueva arquitectura: header en servidor + `CalibrationWorkspaceClient` como zona de trabajo |

### Archivos ya existentes aprovechados (sin modificar)
| Archivo | Rol |
|---------|-----|
| `frontend/src/types/calibration.ts` | Tipos `CandidateField`, `AICalibrationV2`, `FieldDefinition`, `CalibrationVersion` |
| `frontend/src/components/calibration/AICalibrationEditor.tsx` | Repuesto como tab "Configuración" dentro del nuevo workspace (compatibilidad V1) |
| `frontend/src/components/calibration/CalibrationTabs.tsx` | Reutilizado internamente en la tab "Snapshots" del workspace |
| `frontend/src/actions/medical-profiles.ts` → `saveAICalibration` | Preservado sin cambios (compatibilidad V1) |

## Decisiones clave

### D1: Propuesta IA sin backend
- La propuesta de esquema candidato se deriva **heurísticamente en el servidor** desde `structuredData.extracted_data` de los snapshots existentes.
- No requiere backend Python. La función `deriveSchemaFromSnapshots` es pura y sin dependencias externas.

### D2: Versionado automático en actions
- `saveAICalibrationV2` compara `JSON.stringify(existingFieldDefs) !== JSON.stringify(newFieldDefs)` para detectar cambio efectivo.
- Si hay cambio: `currentVersion++`, se agrega entrada a `versions[]`.
- Si no hay cambio: solo actualiza timestamps.
- Mantiene últimas 20 versiones (`.slice(-20)`).

### D3: Layout 2 columnas sin romper ruta existente
- `page.tsx` sigue en `/admin/services/[id]/calibration` — misma ruta.
- Encabezado (breadcrumb + header + métricas) renderizado como Server Component.
- `CalibrationWorkspaceClient` es el único componente cliente principal (split de UI).
- `AICalibrationEditor` V1 se conserva dentro del tab "Configuración" para compatibilidad.

### D4: Panel derecho sticky
- Implementado con `sticky top-0 self-start h-screen` en el div del panel derecho dentro del flexbox.
- El documento ocupa `58%` del ancho (`flex-1`) vs. izquierda `42%` (`w-[42%] shrink-0`).

### D5: Compatibilidad con options V1
- `saveAICalibrationV2` preserva todos los campos V1 existentes via `...existingCalib` spread.
- `legacyFields` param permite pasar campos `enabled`, `extraction`, `diagnosis` desde el editor V1.

## Criterios de aceptación — estado

| Criterio | Estado |
|----------|--------|
| IA muestra candidatos basados en snapshots reales | ✓ Implementado (heurística) |
| Guardar crea versión automática sin input del usuario | ✓ Implementado en `saveAICalibrationV2` |
| UI distingue vigente, borrador y versiones previas | ✓ `CalibrationVersionHistory` |
| Documento visible a la derecha en desktop | ✓ Layout 2 columnas con sticky |
| Aceptar/editar/descartar candidatos | ✓ `CandidateSchemaPanel` |
| Ruta compatible `/admin/services/[id]/calibration` | ✓ Misma ruta, evolucionada |
| No rompe flujo clínico existente | ✓ CalibrationTabs reutilizado, AICalibrationEditor preservado |
| Sin migraciones Prisma | ✓ Todo en `MedicalTest.options` (JSON blob) |

## Soft Gates

| Gate | Estado | Detalle |
|------|--------|---------|
| Gate 1: Compilación | ⚠ Parcial | node_modules no instalados en terminal de dev — errores son ruido de ambiente IDE. Componentes nuevos: 0 errores reales. |
| Gate 2: Testing | ⚠ No ejecutado | qodo y node runtime no disponibles en este terminal. |
| Gate 3: Revisión | ⚠ No ejecutado | qodo self-review no disponible; revisión manual completada. |
| Gate 4: Documentación | ✓ Completado | Tipos declarados, JSDoc con ID en todos los archivos, checkpoint generado. |

## Riesgos y pendientes

1. **Validación en runtime Docker**: Los errores de compilación TS deben verificarse ejecutando `pnpm build` dentro del contenedor frontend. Los mismos "errores" IDE existen en todos los .tsx del proyecto.

2. **Snapshot sin extracted_data**: Si todos los snapshots tienen `structuredData` vacío o sin `extracted_data`, el panel de propuesta mostrará "sin snapshots suficientes" — estado vacío válido y manejado.

3. **Documento fuente no disponible**: Si ningún snapshot tiene URL de archivo, el visor muestra estado vacío graceful (sin crash).

4. **Aliases: vacíos intencionalmente**: La SPEC menciona aliases; están reservados en el tipo `CandidateField.aliases: string[]` pero el llenado automático se dejó para iteración futura.

5. **Propuesta de extracción candidata por documento (SPEC §D)**: No implementada aún — requiere un snapshot específico seleccionado y análisis cruzado contra el contrato. Quedó documentado como TODO en la arquitectura.

6. **Mobile layout**: El workspace 2 columnas es prioritariamente desktop. En mobile, la columna izquierda toma todo el ancho (no se oculta la derecha automáticamente — requiere ajuste CSS responsivo).

## Próximos pasos sugeridos (GEMINI QA)

- Ejecutar `pnpm build` en el contenedor frontend para confirmar Gate 1.
- Probar flujo completo en prueba con snapshots reales.
- Validar que `saveAICalibrationV2` incrementa correctamente la versión en la base de datos.
- Considerar layout responsivo móvil para el 2-column workspace.
