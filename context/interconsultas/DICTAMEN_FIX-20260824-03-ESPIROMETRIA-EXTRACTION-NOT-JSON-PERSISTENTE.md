# DICTAMEN — FIX-20260824-03: `EXTRACTION_NOT_JSON` persistente en Espirometría tras fix `ed96912`

```
ID:           FIX-20260824-03
Fecha:        2026-08-24 (America/Mexico_City)
Solicitante:  Frank (vía ATLAS)
Tarea/SPEC:   FEATURE-20260824-01 rev. 1.5 (IMPL_FIX-20260824-02 = commit ed96912)
Nivel:        L3
Estado:       REQUIERE_MAS_CONTEXTO
```

> **Loop breaker (§10):** existe dictamen previo `IMPL-REPORT_FIX-20260824-02`
> (el propio commit `ed96912`, de SOFIA) para el MISMO síntoma
> (`EXTRACTION_NOT_JSON` al subir `context/RD2026/ESPIROMETRIA.pdf`).
> Ese fix ya fue implementado y mergeado a `origin/main`, y el fallo
> **persiste**. No redacto la misma solución ni delego otro ciclo
> DEBY→SOFIA sobre la misma causa. Comparo evidencia anterior vs. actual y
> elevo a `REQUIERE_MAS_CONTEXTO`: la causa del prior dictamen (comas
> finales) **nunca se confirmó contra la respuesta real del proveedor**, y
> el fix es estructuralmente estrecho (6+ formatos plausibles siguen
> fallando). Falta la evidencia discriminante (raw provider response).

---

## A. Síntoma y alcance

- **Síntoma:** tras hard refresh + reintento, Events muestra
  `La IA no pudo procesar el documento` / `error_code="EXTRACTION_NOT_JSON"`.
  No se crea snapshot de extracción.
- **Insumo:** `context/RD2026/ESPIROMETRIA.pdf` (Sibelmed W20s, paciente
  PEÑA PATRICIO MARBELLA; 1 pág., mitad imagen embebida Im7 + mitad texto
  nativo — ver `context/lote-nocturno-20260820-01/DIFF-ESPIRO-RD2026.md`).
- **Fix presunto:** commit `ed96912` "fix(ai): tolerar JSON de extracción
  con comas finales" (HEAD local, en `origin/main`).
- **Alcance de este dictamen:** diagnóstico de por qué el síntoma persiste
  a pesar del fix. **No** se proponen cambios de producto/contrato.

---

## B. Reproducción

- **Reproducción del síntoma real:** **NO lograda.** Requiere la respuesta
  cruda del proveedor (M3/Gemini) para ese PDF, que **nunca fue capturada**
  en artefacto retrievable (ver §E). Regenerarla exige `M3_API_KEY` /
  `GEMINI_API_KEY` (secretos) + backend corriendo + DB + calibración.
- **Reproducción local del PARSER (sin secretos, sin red):** sí, determinista.
  Experimento discriminante (§14) sobre `GeminiBase._tolerant_json_parse`
  (réplica fiel de `backend/app/services/ai/base.py:108-188`):

  | Caso | Cubierto por fix ed96912? | Resultado |
  |---|---|---|
  | comas finales `,}`/`,]` | SÍ | PARSEA OK |
  | fence markdown + comas finales | SÍ | PARSEA OK |
  | **respuesta truncada por `max_tokens`** | NO | → EXTRACTION_NOT_JSON |
  | comillas simples `{'a':1}` | NO | → EXTRACTION_NOT_JSON |
  | keys sin comillas `{a:1}` | NO | → EXTRACTION_NOT_JSON |
  | respuesta vacía del proveedor | NO | → EXTRACTION_NOT_JSON |
  | prosa con `{` antes del JSON real | NO | → EXTRACTION_NOT_JSON |
  | JSON truncado dentro de un array | NO | → EXTRACTION_NOT_JSON |
  | comentario estilo JS `/* */` | NO | → EXTRACTION_NOT_JSON |

  **Conclusión del experimento:** el fix es **estrecho**. Cubre sólo la
  familia "comas finales + fences + whitespace líder". Cualquier otro
  formato plausible del proveedor sigue produciendo exactamente el
  síntoma reportado.

---

## C. Hipótesis evaluadas (matriz)

| # | Hipótesis | Evidencia a favor | En contra | Prueba discriminante | Estado |
|---|---|---|---|---|---|
| H1 | Existe otra ruta con parser no corregido | — | grep: todos los parseos de respuesta-LLM delegan a `GeminiBase._tolerant_json_parse` (base.py:108; Featherless:369; M3:588; prediagnostic.py:1268,1305). Otros `json.loads` son de config/BD, no de modelo. | inspección de código | **DESCARTADA** |
| H2 | El error se transforma incorrectamente en `EXTRACTION_NOT_JSON` | — | main.py:1506 mapea `ValueError` con `"no es JSON"` → `EXTRACTION_NOT_JSON`; los mensajes de base.py (332/523/828/187) todos contienen `"no es JSON"` → mapeo consistente para el caso de parseo. Catch-all amplio es riesgo latente, no causa aquí. | traza de mensajes | **DESCARTADA como causa** (riesgo latente documentado) |
| H3a | El fix sólo cubre comas finales y el formato real es otro | Experimento §B: 6+ formatos siguen fallando. Los 13 tests de regresión usan payloads **sintéticos escritos a mano**; `test_extractor_handles_m3_response_with_trailing_commas` hace `@patch call_m3` devolviendo un **dict Python ya parseado** (¡ni siquiera pasa por el parser!). El prior IMPL-REPORT admite E2E no hecho. | El prior dictamen la asumió sin evidencia. | experimento §B | **CAUSA_PROBABLE** (no confirmada) |
| H3b | Sub-hipótesis: truncación por `max_tokens=4096` | El prior IMPL-REPORT narra "el prompt creció → M3 emite respuestas más largas" (§7-§9 guardrails añadidos). `call_m3`/`call_featherless` usan `max_tokens=4096` (base.py:505,808). Respuestas largas + tope bajo = truncación. El fix NO cubre truncación. | Sin raw response no se confirma. | capturar raw response y ver si termina abruptamente | **CAUSA_PROBABLE** (al menos tan plausible como H3a) |
| H4 | El backend remoto no tiene `ed96912` desplegado | `ed96912` está en `origin/main` (push confirmado). Pero el backend **no es app Coolify** (solo hay un app frontend `sistema-vectoria` @ `b55f4e8`, repo GitHub distinto, `pnpm start` puerto 3000). `.deby-scratch/` (sesión DEBY previa 20-ago) referencia **Railway**. No hay tool de Railway ni evidencia de redeploy tras el push. | Si Railway auto-deploya on-push a main, sí estaría desplegado. | verificar deploy Railway + `/api/v2/ai/status` o hash de versión en remoto | **NO DESCARTADA** (bloqueo de despliegue) |

---

## D. Causa raíz

**No determinada (REQUIERE_MAS_CONTEXTO).**

- La causa asignada por el prior dictamen (`IMPL-REPORT_FIX-20260824-02`:
  "comas finales") **es sólo probable** y **compite con al menos la
  truncación por `max_tokens`**, que el fix no cubre. Nunca se validó
  contra la respuesta real del proveedor.
- Hay una causa de primer orden **no técnica** que explicaría la
  persistencia por sí sola: **despliegue remoto no verificado** (H4).
  Si el backend remoto no corrió `ed96912`, el fix de comas finales —sea
  o no la causa real— nunca tomó efecto en el entorno donde Frank observó
  el síntoma.

---

## E. Evidencia (logs redactados / hallazgos de inspección)

- **Parser unificado (no hay ruta no corregida):**
  - `GeminiBase._tolerant_json_parse` — `backend/app/services/ai/base.py:108`
  - `FeatherlessVisionBase._tolerant_json_parse` → delega — `base.py:369`
  - `M3VisionBase._tolerant_json_parse` → delega — `base.py:588`
  - `prediagnostic.py:1268,1305` → llama a `GeminiBase._tolerant_json_parse`
  - Otros `json.loads` (main.py:985,1721; calibration.py:82,194;
    calibration_resolver.py:778) parsean config/options de BD, no modelo.
- **Catch-all HTTP (main.py:1490-1549):** `except Exception as e:` →
  `if isinstance(e, ValueError) and ("no es JSON" in str(e) or "not JSON" in str(e))`
  → `error_code="EXTRACTION_NOT_JSON"` con msg user-friendly; el raw del
  modelo **sólo** se loguea vía `sanitize_provider_text_for_log` (len +
  sha256_16). **El raw NUNCA se persiste en artefacto retrievable**
  (contrato de privacidad QA-20260824-13 G-1). → Por eso no existe
  evidencia de la respuesta real: la arquitectura la descarta por diseño.
- **Asimetría menor (no causa, riesgo):** `call_gemini` (base.py:326)
  NO llama a `_sanitize_model_json_text` (que quita tokens `<pad>`), mientras
  que `call_m3`/`call_featherless` (base.py:816-820, 511-515) sí. Inocua
  para Gemini (los `<pad>` son quirk Featherless/M3), pero documentada.
- **Tests de regresión del prior fix son no-vinculantes:**
  - `test_tolerant_json_parse_recovers_fenced_with_trailing_commas`: usa
    payload **sintético** ("Salida cruda típica del proveedor M3" —
    supuesto del autor, no captura real).
  - `test_extractor_handles_m3_response_with_trailing_commas`: `@patch
    call_m3` devuelve un **dict Python** — evita el parser por completo.
  - Ningún test cargó la respuesta real del proveedor para ESPIROMETRIA.pdf.
- **Despliegue:**
  - Coolify: 1 sola app `frank-vcorp/sistema-vectoria` @ `b55f4e8`,
    `pnpm start`, puerto 3000, nginx → **frontend**, repo GitHub distinto
    al local (`Administracion-medica-industrial`). `b55f4e8` no existe en
    este repo. **No hay app Coolify para el backend.**
  - `ed96912` está en `origin/main` (GitHub push OK).
  - `.deby-scratch/repro_deployed.py` (FIX-20260810-09, 20-ago) referencia
    "variante DESPLEGADA" y `.deby-scratch/railway_logs.txt` referencia
    `railway logs` → el backend se despliega por **Railway**, no Coolify.
  - No hay tool de Railway en esta sesión ni evidencia de redeploy
    posterior al push de `ed96912`.

---

## F. Causa raíz (resumen ejecutivo)

`CAUSA_PROBABLE` (no confirmada). Dos frentes:
1. **Evidencia faltante de formato:** el prior dictamen asumió "comas
   finales" sin captura de la respuesta real. El fix cubre sólo esa
   familia; la truncación por `max_tokens=4096` (prompt extendido por
   §7-§9) es igualmente plausible y **no está cubierta**.
2. **Evidencia faltante de despliegue:** no se confirma que el backend
   remoto (Railway) corra `ed96912`.

Hasta obtener la respuesta cruda del proveedor y confirmar el despliegue,
cualquier parche adicional al parser es **adivinación** (violación §12:
"prefiere la prueba más barata que discrimine hipótesis").

---

## G. Solución recomendada (reparación mínima, NO aplicada)

**No aplicar parche de código ahora** (gate §7 falla en "causa
confirmada"). Secuencia recomendada a ATLAS, en orden de costo:

1. **Verificar despliegue (lo más barato, H4):** confirmar que el backend
   remoto (Railway) corrió `ed96912`. Si no → el fix de comas finales
   nunca tomó efecto; redeployar y reintentar. Esto solo puede explicar
   la persistencia sin tocar código.
2. **Capturar la respuesta cruda del proveedor (discriminante, §14):**
   añadir captura redactada del raw del modelo cuando
   `_tolerant_json_parse` falle — persistir a artefacto de evidencia
   (`len` + `sha256` + primeros/últimos N caracteres + balance de
   llaves/paréntesis + flag `ends_mid_token`). Esto cruza el contrato de
   privacidad QA-20260824-13 G-1 → **requiere OK de ATLAS/Frank (L3)**.
   Es el **desbloqueo diagnóstico de mayor valor**: sin esto, cualquier
   fix futuro es ciego.
3. **Según el formato capturado, fix dirigido (no a ciegas):**
   - **Truncación** (la más probable si el prompt creció): subir
     `max_tokens` de 4096 a 8192 en `call_m3`/`call_featherless`
     (base.py:505,808) Y/O detección de "respuesta incompleta" que
     reintente con prompt de continuación. Es cambio de comportamiento
     (posiblemente contract-adyacente) → L3.
   - **Comas finales** (la causa asumida): si la captura lo confirma, el
     fix `ed96912` ya es correcto — sólo falta confirmar/redeployar.
   - **Otro formato** (single-quote, keys sin comillas, etc.): añadir la
     estrategia segura específica al parser unificado.

---

## H. Prueba de regresión y validación

- **Existente (no repetir sin delta, §22.4):** los 13 tests de
  `TestIMPLFIX20260824_02ExtractionNotJsonRegression` pasan pero **no
  vinculan** el síntoma real (payloads sintéticos). No reejecutar por
  costumbre.
- **Faltante (la prueba discriminante real):** una vez capturada la
  respuesta cruda (paso G-2), materializarla como fixture
  (`context/.../evidence/raw-m3-espirometria-rd2026-trailing.txt` o
  `...-truncated.txt`) y añadir un test que la cargue contra
  `_tolerant_json_parse`. Ese test SÍ discrimina: pasa si el fix cubre el
  formato real, falla si no. Es la prueba que el prior dictamen omitió.
- **V3 independiente (§22.3):** E2E con `context/RD2026/ESPIROMETRIA.pdf`
  en entorno dev/staging con `M3_API_KEY` real (el prior IMPL-REPORT lo
  listó como pendiente y nunca se hizo). Sin esto, estado `VERIFYING`.

---

## I. Parche L1 aplicado

**No.** Gate §7 falla en "causa confirmada" (es `CAUSA_PROBABLE`, dos
candidatas sin desempate) y en "no existe dictamen previo fallido para el
mismo síntoma" (existe `IMPL-REPORT_FIX-20260824-02` y el fallo persiste).
Cualquier parche ahora sería adivinación. La reparación mínima es
**diagnóstica** (capturar raw) y requiere OK de ATLAS/Frank por tocar el
contrato de privacidad → L3.

---

## Handoff

```text
[REQUIERE_MAS_CONTEXTO]
FIX: FIX-20260824-03 (context/interconsultas/DICTAMEN_FIX-20260824-03-ESPIROMETRIA-EXTRACTION-NOT-JSON-PERSISTENTE.md)
Tarea/SPEC: FEATURE-20260824-01 rev. 1.5 / IMPL_FIX-20260824-02 (commit ed96912)
Nivel: L3
Síntoma: Events sigue mostrando "La IA no pudo procesar el documento" / EXTRACTION_NOT_JSON al subir ESPIROMETRIA.pdf pese al fix de comas finales en ed96912.
Causa: no determinada — CAUSA_PROBABLE (dos candidatas sin desempate: (a) formato real != comas finales, p.ej. truncación por max_tokens=4096; (b) backend remoto sin ed96912 desplegado).
Parche aplicado: no (gate L1 falla; loop breaker: prior dictamen 20260824-02 implementado y el mismo fallo persiste)
Evidencia: parser unificado (sin ruta no corregida); mapeo main.py consistente; experimento discriminante demuestra fix estrecho (6+ formatos siguen fallando); prior tests son sintéticos/no vinculantes; despliegue Railway no verificado; raw provider response nunca capturado (arquitectura lo descarta por privacidad).
Dueño siguiente: ATLAS
Acción exacta: (1) verificar que Railway desplegó ed96912 (lo más barato, puede explicar la persistencia solo); (2) si sí, autorizar captura redactada del raw del proveedor al fallar _tolerant_json_parse (cruza QA-20260824-13 G-1) para confirmar el formato real; (3) con el raw, re-clasificar (truncación→max_tokens/continuación L3; comas→redeploy; otro→estrategia dirigida).
Riesgos: parchear a ciegas al parser = inventar contenido/scope creep y violar §12; repetir el fix de comas finales = loop (§10, mismo fallo persistente).
```

---

## Autoauditoría (§13)

- [x] Diferencié síntoma / causa probable / causa confirmada (causa NO confirmada).
- [x] Evidencia sin secretos ni PII (solo len/sha256/estructura de código).
- [x] Clasificación por riesgo, no sólo líneas (L3: toca contrato de privacidad + multimódulo parser/catch-all/proveedor).
- [x] No edité código (gate §7 falla; causa no confirmada).
- [x] No inserté FIX ID ni marcas de agua en código.
- [x] No edité artefactos de otro owner (sólo creé dictamen en `context/interconsultas/`, mío per §5).
- [x] No delegué lateralmente a SOFIA/GEMINI.
- [x] Definí prueba de regresión (fixture del raw real contra el parser).
- [x] Loop breaker aplicado: prior dictamen 20260824-02 existe y el fallo persiste → no redacto la misma solución, elevo a REQUIERE_MAS_CONTEXTO.
- [x] Handoff identifica un único dueño (ATLAS) y una acción concreta.
- [x] Experimento discriminante (§14): caso en fallo (6+ formatos no cubiertos) vs. control (comas finales cubiertas), entrada/condición aislada, sin batería extensa.
