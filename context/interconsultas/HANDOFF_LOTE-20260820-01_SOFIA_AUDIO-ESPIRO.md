# SPEC-HANDOFF — LOTE-20260820-01 (Audio/Espiro nocturno)

~~~
SPEC-HANDOFF
Origen: INTEGRA
ID tarea: LOTE-20260820-01
SPEC activa: context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md (v1.0)
ADR: no requiere (lote operativo, no introduce decisión arquitectónica nueva)
Referencias funcionales: DEC-20260820-04 (autorización), FND-20260820-05 (cierre nocturno con evidencia real), DEC-20260820-01/02/03 (calibración/operationMode/publicación), BR-20260820-01 (paridad), FND-20260820-01/02/03 (gaps), SPEC_ARCH-20260513-01, SPEC_ARCH-20260516-07, SPEC_ARCH-20260516-12, FIX-20260812-20
Resultado: Lote nocturno operativo con 6 unidades verificables que deja calibraciones V3 Audio/Espiro en draft/tested (no published), evidencia reproducible (Playwright + PNG + diff), gaps priorizados y handoff matinal a Frank; sin commit/push/deploy/migración; IA no emite diagnóstico ni aptitud.
Alcance de archivos/módulos: ver §5 abajo
Contratos que cambian: ninguno (sólo estados draft/tested de aiCalibration V3 ya existente)
Contratos protegidos: aiCalibration V3 schemaVersion, typecheck/lint/build, MedicalTest.options.shape, ClinicalExtractionRenderer, calibracion-v3.actions.ts (save/publish/getPublished*), context/SPECs/, context/datos AMI/** (read-only)
Criterios AC: AC-1.x … AC-6.x (ver SPEC §4)
Casos borde: insumo Espirometría = sólo PNG (no PDF); sin Playwright headless (Unidad 1 aborta); GEMINI sin respuesta (Unidad 5 BLOCKED, no detiene Unidades 1-4)
Validaciones detectadas: npm run typecheck (0 errores), npm test (vitest), npm run lint, npm run build (sólo si es necesario), backend pytest, backend mypy, Playwright headless
Restricciones: WIP=1; sin commit/push/deploy/migración; sin published V3; sin secretos; sin PII persistida; sin tocar context/datos AMI/**; AI no diagnostica ni emite aptitud
Dependencias: backend/app/services/ai/calibration_resolver.py (Fase 1), frontend/src/actions/calibration-v3.actions.ts (Fase 2), calibracion-v3-shared.ts, ClinicalExtractionRenderer, backend/app/services/ai/extractor.py (FIX-20260812-20)
DoD: 6 unidades con AC verificado; cero V3 published; ningún dato clínico real persistido; git status sin staged; CIERRE-LOTE.md firmado
Prohibido inferir: ningún cambio en contratos V3; ningún rediseño de Events; ningún avance de ARCH-20260820-01 Fase 5; ninguna publicación V3
~~~

Estado: **READY** (sin `DISCOVERY-GAP`; autorización de Frank vigente en `DEC-20260820-04`; ventana 2026-08-20 23:48 → 2026-08-21 07:00 America/Mexico_City; WIP=1).

---

## 1. Precedencia y orden de ejecución

INTEGRA inicializa esta sesión **una vez**. INTEGRA no conversa con SOFIA; cualquier clarification vuelve a ATLAS como handoff para una nueva sesión SOFIA. ATLAS activa la sesión SOFIA con este documento y la SPEC. INTEGRA decide `DONE` o `BLOCKED` al regreso.

**Loop breakers (AGENTS.md §10):** máximo 2 intentos SOFIA sobre el mismo fallo reproducible antes de devolver handoff a ATLAS para DEBY. Máximo 1 ciclo DEBY→SOFIA por error. Si tras 3 ciclos no hay convergencia, handoff a ATLAS para escalar a Frank.

## 2. Insumo canónico (sin reinterpretar)

- Documentos AMI: `context/datos AMI/informacion para revision/` (read-only)
- Ver `SPEC §3` para inventario y `SPEC §4` para uso por unidad.
- Si algún archivo no existe, registrar en `INVENTARIO-INSUMOS.md` y marcar la unidad correspondiente como `BLOCKED` con causa.

## 3. Comandos baseline a detectar (no ejecutar preventivamente)

- `node --version`, `python3 --version`, `npx playwright --version`
- `npm run typecheck`, `npm test`, `npm run lint`
- `cd backend && pytest -q`, `cd backend && mypy app`
- `cd backend && uvicorn app.main:app --reload --port 8000` (sólo si no está arriba)
- `npm run dev` (sólo si no está arriba)

Si no existen, registrar en `INVENTARIO-INSUMOS.md` y reportar bloqueo.

## 4. Estructura de directorios a crear

```
context/lote-nocturno-20260820-01/
├── INVENTARIO-INSUMOS.md
├── DIFF-AUDIO.md
├── DIFF-ESPIRO.md
├── EVIDENCIA-RENDERER.md
├── GAPS.md
├── CIERRE-LOTE.md
└── evidencia/
    ├── audio/   (PNG + accessiblity snapshot)
    ├── espirometria/   (PNG + accessiblity snapshot)
    └── playwright/   (5+ specs auto-contenidos; retirables al cierre)
```

NO crear `.ts`, `.tsx`, `.prisma`, `.sql`, `.yml`, `.json` de config runtime; los specs Playwright del lote son `.spec.ts` locales y se retiran al cierre.

## 5. Alcance de archivos por unidad

### Unidad 1 — Inventario (lectura/inspección)
- Lectura de `context/datos AMI/informacion para revision/` (sha256sum, no mod).
- Lectura/inspección de `MedicalTest.options.aiCalibration` (consulta de sólo lectura vía Prisma Studio local o `prisma studio`).
- NO modificar nada.

### Unidad 2 — Calibración V3 Audiometría
- Editar vía UI (`Admin → Servicios → Calibración IA`) o vía `saveAICalibrationV3` en `frontend/src/actions/calibration-v3.actions.ts`.
- Permitido: `status='draft'` y `status='tested'` (no `'published'`).
- Snapshot/render con `ClinicalExtractionRenderer` (pantalla papeleta).
- Captura PNG + HTML de la presentación.
- Comparación visual contra `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf`.

### Unidad 3 — Calibración V3 Espirometría
- Mismo patrón que Unidad 2.
- Validación adicional: `git log -- backend/app/services/ai/extractor.py | grep -i espirometria` confirma vigencia de `FIX-20260812-20`.
- Insumo: `ESPIRO OB.png` (sólo PNG; declarar límite en `DIFF-ESPIRO.md`).

### Unidad 4 — Renderer headless (Playwright)
- Crear `context/lote-nocturno-20260820-01/evidencia/playwright/*.spec.ts` (auto-contenidos, no en `frontend/tests/`).
- Usar `playwright.chromium.launch({ headless: true })`.
- Capturar PNG + `accessibility.snapshot()`.
- Validar `AI_NON_CONCLUSIVE` con string `AI_NON_CONCLUSIVE` o clase explícita en el snapshot.

### Unidad 5 — QA (GEMINI)
- INTEGRA devuelve handoff a ATLAS para activar sesión GEMINI independiente. Este handoff NO se ejecuta desde SOFIA.

### Unidad 6 — Cierre
- Verificación de lectura (no escritura):
  - `git status` → sin staged
  - `git diff --stat` → vacío
  - `SELECT 1 FROM MedicalTest.options.aiCalibration WHERE schemaVersion='V3' AND status='published'` → 0 filas
  - `find context/datos AMI -newer …` → 0 modificados
- Actualizar `context/CURRENT.md` y `PROYECTO.md` (entrada corta, no más de 5 líneas).

## 6. Criterios AC mapeados a comandos

| AC | Comando/verificación |
|---|---|
| AC-1.1 hashes | `sha256sum context/datos\ AMI/informacion\ para\ revision/* \| wc -l` ≥ 13 |
| AC-1.2 inventarios | `jq` o lectura del CSV en `INVENTARIO-INSUMOS.md` |
| AC-1.3 Playwright | `npx playwright --version` no vacío |
| AC-2.1 V3 tested Audio | `jq '.aiCalibration.publishedVersions[]? // empty' \| …` (verificación de estado) |
| AC-2.3 diff umbrales | lectura de `DIFF-AUDIO.md` con 8+ filas OD/OI |
| AC-3.1 V3 Espiro | análogo |
| AC-3.4 LLN coherente | lectura de `DIFF-ESPIRO.md` con tabla LLN vs `VALORES DE REFERENCIA.xlsx` |
| AC-4.1 capturas | `ls context/lote-nocturno-20260820-01/evidencia/**/*.png \| wc -l` ≥ 5 |
| AC-4.2 renderer | `grep -l 'AI_NON_CONCLUSIVE\\|umbrales\\|M1' *.spec.ts` ≥ 4 |
| AC-5.1 GEMINI | presencia de `context/reviews/QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md` |
| AC-6.1 cierre | `wc -l context/lote-nocturno-20260820-01/CIERRE-LOTE.md` ≤ 80 |
| AC-6.2 sin staged | `git status --porcelain \| wc -l` = 0 (o sólo docs `M`) |
| AC-6.3 sin published | consulta Prisma equival. → 0 |
| AC-6.4 AMI intacto | `find context/datos\ AMI -newer /tmp/kilo/.lote-start -type f \| wc -l` = 0 |

## 7. Comportamiento ante fallo

- Si Playwright no instala (Unidad 1): reportar `BLOCKED` para Unidades 1 y 4; Unidades 2 y 3 pueden continuar con.diff visual manual + acceso BD a `MedicalTest.options.aiCalibration`.
- Si FIX-20260812-20 no está en el árbol: reportar `BLOCKED` para Unidad 3; Unidades 1, 2 y 4 pueden continuar.
- Si una calibración no puede llegar a `tested` en 3 iteraciones: salir con `draft` y gap `P1` en `GAPS.md`.
- Si Frank responde antes de las 07:00 con `cancelar lote`: respetar y abortar inmediatamente, persistir `BLOCKED (cancelado-Frank)` en `CIERRE-LOTE.md`.

## 8. Salida esperada

Al cierre, devolver a ATLAS:

```
Origen: SOFIA
Lote: LOTE-20260820-01
Unidades: 1=READY/DONE/BLOCKED, 2=…, 3=…, 4=…, 5=…, 6=READY_FOR_VERIFYING
Calibraciones V3 resultantes: Audio.status=…, Espiro.status=…
Evidencia: context/lote-nocturno-20260820-01/evidencia/ (n capturas)
Gaps: context/lote-nocturno-20260820-01/GAPS.md (n hallazgos)
Publicado: NO (cumple §5 D4)
Git status: limpio
Próximo paso: INTEGRA verifica AC, solicita QA GEMINI, decide DONE/BLOCKED en context/CURRENT.md
```

## 9. Anti-patrones prohibidos

- No generar `git commit` ni `git push`.
- No invocar `publishAICalibrationV3` (ni cualquiera que mueva a `published`).
- No aplicar `prisma migrate`.
- No modificar `context/datos AMI/**`.
- No persistir datos reales de pacientes en BD.
- No llamar a APIs de IA en producción.
- No notificar a Frank directamente; un solo `notify_user` al cierre (no spam de progreso).
- No crear archivos en `frontend/src/**` ni `backend/app/**` (excepto los specs Playwright locales del lote).

## 10. Resiliencia

- Si SOFIA se queda sin créditos a mitad: persistir estado en `context/CURRENT.md` y `context/lote-nocturno-20260820-01/INVENTARIO-INSUMOS.md` antes de cerrar; INTEGRA recibirá handoff parcial.
- Si hay rate-limit 429 de IA: degradar a `draft` (no `tested`) y registrar en `GAPS.md`; no reintentar agresivamente.
- Si Playwright headless no detecta `AI_NON_CONCLUSIVE` en el accessibility snapshot: probar `text=` global + `aria-label` + clase CSS; documentar el criterio adoptado en `EVIDENCIA-RENDERER.md`.
