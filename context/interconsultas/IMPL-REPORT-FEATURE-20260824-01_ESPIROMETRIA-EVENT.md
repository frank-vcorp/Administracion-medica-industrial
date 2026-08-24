# IMPL-REPORT — FEATURE-20260824-01

ID intervención: IMPL-20260824-01
ID tarea: FEATURE-20260824-01 (Criterios clínicos de Espirometría en Events)
SPEC: `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` v1
Discovery refs: FND-20260824-03 (origen); FND-20260821-02 (PDF Sibelmed real)
Estado: READY_FOR_VERIFYING

## Archivos modificados

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` (nuevo): componente presentacional puro que lee `extractedData.calidad` y renderiza los 11 criterios del PDF más el marbete explícito "Texto fuente del documento (no es diagnóstico IA)" si el payload expone `impresion_diagnostica_texto` / `recomendaciones_texto`. Sin recálculos ni reinterpretación clínica. Tolerante a payload parcial/histórico (ausencia de campos → no se renderiza el bloque, sin placeholders ni valores inventados).
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`: +19 líneas — import del nuevo componente y bloque presentacional insertado en la **columna derecha** del grid de estudios documentales, **entre el visor (`StudyDocumentViewer`) y `StudyAIPrediagnosisPanel`**. Sólo se renderiza cuando `getCanonicalAIStudyType(test) === 'Espirometria'` y existe `extractionSnapshot` con claves conocidas (helper `hasRenderableEspirometriaCriteria`).
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`: +11/-3 líneas — atributo `open` agregado a los tres `<details>` (Justificación, Limitaciones, Fuentes clínicas). Contrato IA y modo sombra clínica intactos (guardrail "Modo sombra clínica" sigue visible; el contrato `AIPrediagnosisData` no cambia).
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` (nuevo): 14 casos — cubren AC-1, AC-2, AC-3, AC-5, AC-6 (helper discriminador), texto fuente del documento, notas de calidad como string/objeto, valores booleanos NO y enteros sin decimales forzados.
- `frontend/src/components/clinical/__tests__/StudyAIPrediagnosisPanel.open-details.test.ts` (nuevo): 3 casos — AC-4 (los 3 `<details>` inician con `open`), guardrail del modo sombra intacto, ausencia de datos → no se renderizan `<details>` vacíos.

## Contratos afectados

- **Protegidos (no tocados):** schema Prisma, migraciones, endpoints, persistencia, `extractedData`, `fuente_texto_crudo`, modo sombra clínica, revisión médica, renderer de Audiometría, `StudyPresentationSchema`.
- **Aceptablemente modificados:** presentación UI de Events para estudios Espirometría (nuevo bloque) y estado inicial de tres `<details>` en el panel IA (acordado por la SPEC §3).

## Validación

- **baseline:** PASS — antes de editar, `npx tsc --noEmit` y suite frontend estaba verde para los archivos en alcance (los 15 fallos preexistentes en `medical-exam.actions.test.ts` son ajenos y ya existían en `9df05fb` HEAD sin mis cambios, confirmado con `git stash` + rerun).
- **build/typecheck:** PASS — `npx tsc --noEmit` (frontend) sin errores tras las 3 ediciones (componente nuevo + PapeletaWorkspace + StudyAIPrediagnosisPanel).
- **tests focales (V1):** PASS — `npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts src/components/clinical/__tests__/StudyAIPrediagnosisPanel.open-details.test.ts` → 17/17 PASS (14 criterios + 3 panel IA).
- **tests (V2):** PASS-EN-ALCANCE — `npx vitest run` → 713 PASS / 15 FAIL preexistentes en `src/actions/__tests__/medical-exam.actions.test.ts` (Zod schema `ImpresiónAptitudSchema` legacy con campos `estado_nutricional`/`salud_bucal` no aceptados; falla idéntica con `git stash`, sin regresión introducida por este incremento).
- **lint:** N/A — `package.json` define `"lint": "eslint"` pero el repo no trae `.eslintrc` operativo (verificado por convención del proyecto); no se solicitó ejecutar lint en el handoff.
- **smoke/E2E (V3):** NO EJECUTADA — corresponde a GEMINI en el gate final sobre el Event real con `context/RD2026/ESPIROMETRIA.pdf` (Playwright + consola/network). Señalado abajo.

## Trazabilidad (AC → evidencia)

| AC | Cobertura |
|---|---|
| AC-1 — Criterios visibles antes de `Prediagnóstico IA` con `context/RD2026/ESPIROMETRIA.pdf` | `PapeletaWorkspace.tsx` líneas ~1506-1524 (inserción del bloque en columna derecha, entre visor y panel IA). Test "AC-1: renderiza el bloque cuando hay criterios válidos". V3 GEMINI pendiente. |
| AC-2 — FVC 30 ml y FEV1 40 ml | Test "AC-2: muestra FVC 30 ml y FEV1 40 ml cuando están presentes" verifica `>30<…ml` y `>40<…ml` para `data-criteria-key="Repetibilidad FVC"` / `…FEV1"`. |
| AC-3 — 3 pruebas aceptables y calidad A | Test "AC-3: muestra 3 pruebas aceptables y calidad A…" verifica `>3<` en `#Pruebas aceptables` y `>A<` en `Calidad`. Cobertura completa de los 8 criterios SI/NO. |
| AC-4 — Justificación, Limitaciones y Fuentes clínicas desplegadas | Test "Justificación, Limitaciones y Fuentes clínicas inician con atributo open" cuenta `≥ 3` matches `<details … open>`; texto visible de las tres secciones verificado. |
| AC-5 — Payload parcial/histórico sin invención | 4 tests: "payload parcial sin campos conocidos NO genera render ni excepción" (null/undefined/{} sin claves conocidas → `''`), "payload parcial con sólo pruebas_aceptables + calidad" (sin `ml` cuando no hay repetibilidad numérica), "Notas de calidad como objeto (legacy)" (aplanamiento seguro). |
| AC-6 — Audiometría y otros tipos conservan comportamiento actual | Helper `hasRenderableEspirometriaCriteria` discrimina: aplica `false` para un payload tipo Audiometría con `oido_derecho` + `completitud_documental` (no son claves del namespace de criterios de espirometría). `PapeletaWorkspace.tsx` sólo renderiza el bloque si `getCanonicalAIStudyType(test) === 'Espirometria'`. |
| AC-7 — Typecheck y tests focales frontend pasan | PASS — `tsc --noEmit` sin errores; 17/17 tests focales PASS. |

## Riesgos y desviaciones

- **Riesgo bajo:** cambio puramente presentacional sobre snapshots existentes. Renderiza tolerancia a payload parcial. No introduce claves nuevas al contrato extractivo, ni recalcula `repetibilidad_fvc_ml`/`repetibilidad_fev1_ml` (los lee directamente del snapshot).
- **Texto fuente del documento:** si el payload NO expone `impresion_diagnostica_texto`/`recomendaciones_texto` (caso actual del fixture `extraction-espirometria-rd2026.json`), el bloque D no se renderiza y NO se inventa. Si el payload los expone, se renderizan dentro de un contenedor amber explícitamente etiquetado como "Texto fuente del documento (no es diagnóstico IA)". El médico conserva el control de aptitud/dictamen.
- **Enteros sin decimales forzados:** `Number.isInteger(n)` muestra 30/40 en lugar de 30.00/40.00. Coherente con la presentación de la página AMI y con la lectura clínica habitual; el test fue ajustado para reflejarlo y la SPEC no exige decimales fijos.
- **V3 Playwright NO ejecutada** desde SOFIA: queda en el gate final de GEMINI sobre el Event real con el PDF Sibelmed, según `HANDOFF_FEATURE-20260824-01_SOFIA_ESPIROMETRIA-EVENT.md` §Validaciones. Sin autorización para ejecutarla en este incremento.
- **No-detectado SPEC-GAP técnico.**

## Requiere GEMINI: sí (V3 gate)

Regla aplicable: §5 SOFIA — "cambio toca UI clínico sobre Events con datos de extracción y cambia el panel IA pre-existente". Aunque es presentacional, conviene verificación independiente del orden visual y del estado `open` con Playwright sobre el expediente real (Olvera/Jorge del lote nocturno o uno equivalente) cargando `context/RD2026/ESPIROMETRIA.pdf`. Esto complementa AC-1/AC-4 sin que SOFIA pueda ejecutar el flujo de carga.

## Requiere DEBY: no

Sin bug reproducible; sin causa raíz de runtime. El cambio es declarativo (atributo `open`) y tolerante a payload parcial.

## Pendientes ATLAS

1. Decidir si conserva los snapshots congelados del lote (`extraction-espirometria-rd2026.json` no expone `impresion_diagnostica_texto` aún) o si reabre el extractor para emitir el texto fuente cuando exista en el PDF (FND-20260824-03 lo menciona como opcional).
2. Gate GEMINI V3 sobre Playwright con `context/RD2026/ESPIROMETRIA.pdf`.
3. Confirmar archivado/limpieza del expediente Olvera/Jorge (FND-20260824-01) antes de cualquier prueba clínica nueva — Frank tiene la palabra.

## Notas de reversión

Rollback 100% presentacional:
- Quitar el import y el bloque JSX agregado en `PapeletaWorkspace.tsx` (3 líneas netas de import + 13 del bloque).
- Quitar los tres atributos `open` en `StudyAIPrediagnosisPanel.tsx` (3 cambios `open` removidos).
- Eliminar `EspirometriaClinicalCriteriaPanel.tsx` y los dos `__tests__/*.test.ts`.
Sin migración, sin datos, sin impacto en backend ni en snapshots persistidos.