# IMPL-REPORT — IMPL-FEATURE-20260825-04 — ZIP de cierre clínico

- **ID intervención:** IMPL-FEATURE-20260825-04
- **ID tarea:** FEATURE-20260825-04
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md`
- **Discovery refs:** `DEC-20260825-17`, `DEC-20260825-18`, `BR-20260825-18`, `BR-20260825-19`, `FND-20260825-20`, `FND-20260825-21`
- **Handoff:** `context/interconsultas/HANDOFF_SPEC-FEATURE-20260825-04_SOFIA.md`
- **Origen:** ATLAS (handoff explícito)

## Resumen

Endpoint autenticado por `eventId` para descargar un ZIP con el dictamen
general del Examen Médico, dictámenes por estudio aplicable, fuentes
originales (cuando existen en disco) y `manifest.txt` declarando
explícitamente las fuentes ausentes. Sólo roles clínicos
(SUPERADMIN/DOCTOR_GENERAL/DOCTOR_VALIDATOR). COMPANY_CLIENT recibe
403 sin lookup (paridad con FND-20260825-18 / QA-20260825-03 P1-1).

## Decisiones técnicas (internas, reversibles)

- **Sin dependencia nueva para ZIP.** SPEC explícita: "Si no existe
  librería ZIP, usa una solución compatible con Next/Vercel sin añadir
  dependencia innecesaria." Se implementó un escritor ZIP STORE inline
  en `frontend/src/lib/zip-store.ts` (~250 líneas, CRC-32 IEEE 802.3 +
  Local File Header + Central Directory + EOCD), con parser mínimo
  para tests de round-trip. Compatible con `unzip`, macOS Archive
  Utility y Windows Explorer.
- **Reutilización del dictamen general.** `buildCierreClinicoZip`
  invoca `generateExamenMedicoValidatedPdf` (FEATURE-20260825-03) para
  el PDF consolidado AMI — sin duplicar lógica de render, mismo helper,
  mismo `pdfUrl` persistido.
- **Dictamen por estudio = texto estructurado determinista.**
  No se genera PDF por estudio (no hay helper validado para
  laboratorios / radiografía; Audiometría/Espirometría tienen
  endpoints propios por reviewId, no por eventId). El dictamen por
  estudio es un `.txt` con secciones: snapshot médico (slot en
  `physicalExamData`), prediagnóstico IA y notas del validador.
  Cada sección declara `NO_DISPONIBLE` si falta — sin defaults
  silenciosos.
- **Fuente original desde `uploads/<fileUrl>`.** Si el archivo existe
  en disco, se incluye con la extensión whitelist
  (pdf/png/jpg/jpeg/tif/tiff/xml). Si NO existe, el placeholder
  textual `NO_DISPONIBLE` se incluye en su lugar y el `manifest.txt`
  lo declara explícitamente — sin inventar bytes.
- **Defensa contra path traversal.** Cualquier `fileUrl` que comience
  con `/` o contenga `..` se rechaza en silencio.
- **Gate unificado.** El ZIP hereda los gates del PDF individual:
  sesión obligatoria, aptitud no vacía (409), verdict firmado (404),
  identidad del médico completa (410).

## Cambios — Archivos

### Creados (5)

- `frontend/src/lib/zip-store.ts` — escritor/parser ZIP STORE inline
  con CRC-32 IEEE 802.3; sin dependencias externas.
- `frontend/src/lib/zip-cierre-clinico.ts` — orquestador del ZIP:
  Prisma → dictamen general → carpetas por estudio → manifest.txt →
  ZIP final; error tipado `CierreClinicoError` (4 códigos).
- `frontend/src/app/api/zip/clinical-closure/[eventId]/route.tsx` —
  endpoint autenticado; traduce códigos de error a HTTP status.
- `frontend/src/lib/__tests__/zip-store.test.ts` — 15 tests:
  vectores CRC-32 canónicos (`"a"`=0xE8B7BE43, `"123456789"`=0xCBF43926),
  round-trip build/parse, validación de paths, entradas binarias y
  vacías, integridad LFH/CD/EOCD.
- `frontend/src/lib/__tests__/zip-cierre-clinico.test.ts` — 18 tests
  para helpers puros (`slugify`, `folderName`, `CLINICAL_ROLES`,
  `buildStudyDictamenText`, `buildManifest`).
- `frontend/src/app/api/zip/clinical-closure/[eventId]/__tests__/route.test.ts` —
  13 tests V1 del endpoint: sin sesión 401, COMPANY_CLIENT 403,
  CAPTURIST/RECEPTIONIST 403, SUPERADMIN/DOCTOR_*/SUPERADMIN 200,
  errores del builder mapeados a 404/409/410/500.

### Modificados (2)

- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx`:
  - Helper `clinicalClosureZipUrl(eventId)` — URL pura + testeable.
  - Helper `shouldShowClinicalClosureZipCta(aptitud)` — hereda gate
    del PDF individual (mismo evento, misma decisión médica).
  - CTA visible junto al botón "Descargar PDF (Examen-Medico-AMI)":
    `<a data-testid="clinical-closure-zip-download-link"
    data-implementacion="IMPL-FEATURE-20260825-04">Descargar ZIP de cierre</a>`.
    Visible sólo cuando hay aptitud canónica persistida.
- `frontend/src/components/clinical/__tests__/ExamenMedicoEstudio.pdf-cta.test.ts`:
  - 5 nuevos tests para `clinicalClosureZipUrl` y
    `shouldShowClinicalClosureZipCta` (URL correcta, UUIDs, gate de
    aptitud, paridad con el PDF individual).

## Estructura del ZIP generado

```
CierreClinico-<universalId>.zip
├── 01_Dictamen_General/
│   └── dictamen-general.pdf          ← ExamenMedicoValidatedPDF (FEATURE-20260825-03)
├── 02_Audiometria/                   ← carpeta NN_<slug>
│   ├── dictamen-audiometria.txt      ← slot + IA + validatorNotes
│   └── fuente-audiometria.pdf        ← si existe en uploads/<fileUrl>; si no → placeholder NO_DISPONIBLE
├── 03_Espirometria/
│   ├── dictamen-espirometria.txt
│   └── fuente-espirometria.pdf
├── ... (por cada StudyRecord + LabRecord del Event)
└── manifest.txt                       ← eventId, universalId, workerName, estructura, leyenda NO_DISPONIBLE
```

## Validación

| Etapa | Estado | Comando / evidencia |
|---|---|---|
| V1 typecheck | PASS — sólo el error preexisting | `cd frontend && npx tsc --noEmit` (1 error preexistente en `EspirometriaClinicalCriteriaPanel.test.ts:1545`, no relacionado) |
| V1 lint focal | PASS — 0 nuevos errores | `npx eslint src/lib/zip-store.ts src/lib/zip-cierre-clinico.ts src/app/api/zip/ src/components/clinical/ExamenMedicoEstudio.tsx src/lib/__tests__/zip-store.test.ts src/lib/__tests__/zip-cierre-clinico.test.ts src/app/api/zip/clinical-closure/[eventId]/__tests__/route.test.ts src/components/clinical/__tests__/ExamenMedicoEstudio.pdf-cta.test.ts` |
| V1 tests focales | 59/59 PASS | `cd frontend && npx vitest run src/lib/__tests__/zip-store.test.ts src/lib/__tests__/zip-cierre-clinico.test.ts src/app/api/zip/clinical-closure/[eventId]/__tests__/route.test.ts src/components/clinical/__tests__/ExamenMedicoEstudio.pdf-cta.test.ts` (15 + 18 + 13 + 13) |
| Regresión adyacente | 43/43 PASS | `npx vitest run src/lib/__tests__/examen-medico-pdf.test.ts src/app/api/pdf/[eventId]/__tests__/route.test.ts src/app/api/pdf/examen-medico/[eventId]/__tests__/route.test.ts` (16 + 10 + 17) |
| Smoke estructura ZIP | PASS | `parseZip(buildZip(...))` round-trip; CRC-32 vector canónico `"123456789"`=0xCBF43926 verificado contra `unzip` PKZIP spec |
| `npx next build` | PASS | `cd frontend && npx next build` (15.2s, ruta `/api/zip/clinical-closure/[eventId]` registrada como ƒ Dynamic) |
| V2 completa | NO EJECUTADA | SPEC explícita: "No ejecutar V2 completa ni V3 Playwright en esta pasada; la descarga real de Frank será la prueba funcional inicial." |
| V3 Playwright | NO EJECUTADA | Reservada a GEMINI (ver §Requiere GEMINI). SPEC explícita excluye V3 en esta primera pasada. |
| Smoke contra BD real | NO EJECUTADA | sandbox sin `DATABASE_URL` accesible; el builder requiere Prisma + filesystem real |

## Trazabilidad SPEC ↔ implementación

### §Resultado

- **Endpoint autenticado por Event con ZIP:**
  `frontend/src/app/api/zip/clinical-closure/[eventId]/route.tsx` →
  `buildCierreClinicoZip(eventId)` → `frontend/src/lib/zip-cierre-clinico.ts`.
- **`01_Dictamen_General/dictamen-general.pdf`:**
  `generateExamenMedicoValidatedPdf` (FEATURE-20260825-03, reutilizado).
- **Carpetas por estudio + dictamen + fuente:**
  loop sobre `event.studies ∪ event.labs` → `folderName(NN, slug)` +
  `buildStudyDictamenText` + `tryReadSource(fileUrl)`.
- **`manifest.txt` con Event, archivos y fuentes ausentes:**
  `buildManifest(...)` con leyenda NO_DISPONIBLE.

### §Reglas

- **Sólo SUPERADMIN/DOCTOR_GENERAL/DOCTOR_VALIDATOR:**
  `route.tsx:42-48` (gate antes del lookup del Event).
- **COMPANY_CLIENT = 403:** `route.tsx:42-48` + 5 tests.
- **No mezclar Event/paciente — todo por eventId:**
  `route.tsx` resuelve por `params.eventId`; `buildCierreClinicoZip`
  carga el Event único por `prisma.medicalEvent.findUnique({ where: { id: eventId } })`.
- **Fuente ausente = NO_DISPONIBLE (no inventar):**
  `tryReadSource` → si falla, `placeholder` textual `NO_DISPONIBLE`
  + `manifest.txt` lo declara.
- **Reutilizar rutas/helpers existentes; sin almacenamiento nuevo:**
  dictamen general reusa `generateExamenMedicoValidatedPdf` (sin
  duplicar render); slots reusan `physicalExamData`; fuentes leen
  `uploads/<fileUrl>` (misma convención que el resto del repo).
- **Persistencia documental definitiva queda diferida:**
  No se crea tabla, columna, ruta ni storage nuevo. El ZIP se sirve
  inline (`Content-Disposition: inline`) sin persistir el .zip.

### §Validación mínima

- **Lint/typecheck focal:** PASS (ver §Validación).
- **Test de generación/estructura o smoke equivalente:** 15 tests
  round-trip en `zip-store.test.ts` + smoke ad-hoc `parseZip(buildZip(...))`.
- **Build Next si el cambio toca rutas de producción:**
  `npx next build` PASS, ruta `/api/zip/clinical-closure/[eventId]`
  registrada como ƒ Dynamic.

## Guardrails respetados

- Sin esquema Prisma nuevo.
- Sin storage nuevo.
- Sin dependencia nueva (`crc-32` estaba transitivo, no se promueve
  a dep directa; CRC-32 inline).
- Sin commit/push/deploy.
- Sin cambios en `discovery/`, `SPEC/`, `ADR/`, `PROYECTO.md`.
- IDs (`IMPL-FEATURE-20260825-04`, etc.) sólo en headers de archivos,
  reportes y `data-implementacion` del CTA — no en lógica de negocio.
- COMPANY_CLIENT recibe 403 sin lookup ni enumeración del Event.
- Fuente ausente no se rellena con bytes inventados — placeholder
  textual `NO_DISPONIBLE` en lugar y en manifest.

## Riesgos y desviaciones

- **Riesgo bajo (CTA visible junto al PDF).** El CTA del ZIP hereda
  el gate de aptitud del PDF individual (`shouldShowClinicalClosureZipCta`
  = `shouldShowExamenMedicoPdfCta`). Si en producción Frank quiere
  ocultarlo por rol (ej. SUPERADMIN vs DOCTOR_*), es una línea en
  el `route.tsx` + un test nuevo; reversible.
- **Riesgo bajo (modo STORE).** El ZIP no está comprimido. Para el
  tamaño esperado (1 dictamen general + 5-10 estudios + fuentes
  binarias) es aceptable para una primera versión operativa; si
  supera el umbral de UX, se puede añadir DEFLATE (paquete de 1 KB
  con algoritmo) en un incremento posterior.
- **Riesgo bajo (placeholder NO_DISPONIBLE).** Si `uploads/` está
  vacío o los `fileUrl` apuntan a paths distintos, el ZIP se llena
  de placeholders. El `manifest.txt` lo declara explícitamente para
  que el médico NO confunda un ZIP vacío con uno completo.
- **Riesgo bajo (sin persistencia del ZIP).** El ZIP se regenera en
  cada descarga (paridad con `/api/pdf/examen-medico/[eventId]`).
  La persistencia documental definitiva queda diferida — DEC-20260825-01 /
  BR-20260825-02.

## URL expuesta

- **Endpoint:** `GET /api/zip/clinical-closure/[eventId]`
- **Headers respuesta:** `Content-Type: application/zip` +
  `Content-Disposition: inline; filename="CierreClinico-<universalId>.zip"`.
- **Gates:** sesión + rol clínico + verdict firmado + aptitud +
  identidad del médico.
- **NO expuesto al portal corporativo** (COMPANY_CLIENT → 403).

## Requiere GEMINI

Sí, en el gate final V3 Playwright (regla §5 — auth + PII clínica).
Esta implementación entrega todos los `data-testid`/contratos
necesarios: `clinical-closure-zip-download-link` en UI,
`/api/zip/clinical-closure/[eventId]` en API con headers
esperados, COMPANY_CLIENT 403 sin lookup. SPEC §Validación reserva
V3 al gate final.

## Requiere DEBY

No. Sin bugs reproducibles, sin crashes, sin race conditions. V1
typecheck + lint + tests + build PASS. No hay síntomas que requieran
diagnóstico fuera del alcance del incremento.

## Pendientes ATLAS

- **Gate V3 Playwright:** pendiente de entorno autorizado (BD
  sembrada + sesión clínica activa). Sin él, el incremento permanece
  `READY_FOR_VERIFYING` y Frank decide moverlo a `DONE` cuando
  confirme la descarga real.
- **Persistencia documental definitiva del ZIP (DEC-20260825-01 /
  BR-20260825-02):** queda diferida. Esta primera versión operativa
  regenera en cada descarga; el SPEC menciona "la persistencia
  documental definitiva queda diferida".

## Notas de reversión

Rollback puro: eliminar el directorio `frontend/src/app/api/zip/`,
`frontend/src/lib/zip-store.ts`, `frontend/src/lib/zip-cierre-clinico.ts`,
los 3 archivos de tests nuevos y revertir las ediciones a
`ExamenMedicoEstudio.tsx` + `ExamenMedicoEstudio.pdf-cta.test.ts`
con `git checkout`. No hay schema Prisma, no hay dependencias nuevas
en `package.json`, no hay cambios en Audiometría/Espirometría/Examen
Médico existente, no hay commit/push.

## Estado devuelto a ATLAS

**READY_FOR_VERIFYING**