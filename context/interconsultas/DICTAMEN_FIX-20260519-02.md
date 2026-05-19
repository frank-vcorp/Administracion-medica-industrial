# DICTAMEN TÉCNICO: Corrimiento tabular residual en extracción de Audiometría
- **ID:** FIX-20260519-02
- **Fecha:** 2026-05-19
- **Solicitante:** SOFIA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz

Síntoma reportado:

- PDF real, oído izquierdo, fila VA: `125` vacío, `250=10`, `500=10`, `1000=10`, `2000=5`, `3000=10`, `4000=5`, `6000=5`, `8000=5`.
- JSON revalidado actual: `125=10`, `250=10`, `500=null`, `1000=10`, `2000=5`, `3000=10`, `4000=5`, `6000=5`, `8000=5`.

Hipótesis raíz falsable:

> El corrimiento ya viene en el `result` crudo devuelto por `call_gemini(...)` durante la extracción tabular de Audiometría; el backend actual no lo corrige, solo lo conserva, elimina nulos y añade una advertencia de sospecha cuando aparece una frecuencia no canónica como `125`.

Por qué esta hipótesis es la más fuerte:

1. El punto de control actual está en `backend/app/services/ai/extractor.py`.
2. La función `_normalize_audiometria_result()` hace solo cuatro cosas: normaliza claves/valores, omite entradas `null`, deriva `frecuencias_detectadas`, deriva `completitud_documental` y agrega `SOSPECHA_CORRIMIENTO` si detecta frecuencias fuera del conjunto canónico.
3. Esa función no contiene ninguna lógica de re-alineación por columnas, ni compara contra headers visibles, ni reubica valores cuando aparece un patrón `125` + hueco interior.
4. El esquema `AudiometriaData` acepta `Dict[str, int]` y no valida que las claves pertenezcan estrictamente al set canónico; por tanto, `125` puede pasar al objeto final sin bloqueo.
5. La prueba existente `test_audiometria_sospecha_corrimiento_125hz` codifica exactamente el comportamiento vigente: acepta un payload con `125` en ambos oídos y solo exige que quede trazado en `notas_calidad`. Eso confirma que hoy el sistema trata `125` como señal de sospecha, no como error recuperable ni como caso de realineación.

Qué falsaría esta hipótesis:

- Si al inspeccionar el `result` inmediatamente después de `call_gemini(...)` para ese PDF real los valores ya vienen correctos (`250=10`, `500=10`, sin `125=10`) y el corrimiento aparece solo después de `_normalize_audiometria_result()`, entonces la causa raíz no está en la extracción del modelo sino en el postproceso backend.

Conclusión forense:

- Con la evidencia actual, el defecto no parece estar en frontend ni en serialización posterior.
- El problema se controla hoy en backend, pero solo a nivel de guardrail declarativo y anotación de sospecha; no existe una defensa correctiva contra corrimiento residual de una columna.

Limitaciones de validación ejecutable en este análisis:

- `qodo` no está disponible en el entorno (`qodo: command not found`).
- `pytest` no está disponible en el entorno (`pytest: command not found`).
- Una comprobación puntual con `python` quedó bloqueada por dependencias faltantes del backend (`ModuleNotFoundError: pdf2image`).

### B. Justificación de la Solución

#### 1. Capa y archivo exacto donde hoy se controla

Control principal actual:

- `backend/app/services/ai/extractor.py`
  - `_build_audiometria_extraction_prompt(...)`: inyecta guardrails textuales para pedir al modelo que no desplace columnas.
  - `_normalize_audiometria_result(...)`: normaliza y etiqueta sospechas, pero no corrige corrimientos.
  - `extract_by_type(...)`: aplica la normalización antes de construir `AudiometriaData`.

Control secundario relevante:

- `backend/app/schemas/medical.py`
  - `AudiometriaData` permite claves libres `Dict[str, int]`; no impone canonicidad estricta de frecuencias.

Cobertura de pruebas relevante:

- `backend/tests/test_ai_pipeline.py`
  - `test_audiometria_sospecha_corrimiento_125hz`: verifica advertencia, no corrección.
  - `test_audiometria_null_values_omitidos_en_normalizacion`: verifica omisión de `null`, lo cual además puede ocultar visualmente el hueco sin resolver la causa.

#### 2. Check discriminante más barato

Check recomendado, mínimo y decisivo:

1. Capturar el payload crudo de `result = self.call_gemini(file_path, prompt)` para el PDF real antes de llamar a `_normalize_audiometria_result(...)`.
2. Compararlo contra la salida post-normalización para ese mismo oído.

Interpretación del check:

- Si el crudo ya trae `125=10` y `500=null`, la hipótesis queda confirmada: el corrimiento nace en la extracción tabular del modelo y el backend solo lo deja pasar.
- Si el crudo viene correcto y el postproceso lo altera, la hipótesis queda falsada y el foco debe moverse a `_normalize_audiometria_result(...)`.

Alternativa barata si no se puede correr el PDF real:

- Crear una prueba unitaria de regresión que alimente `_normalize_audiometria_result(...)` con exactamente el caso reportado. Si la salida conserva `125=10` y elimina solo el `null`, queda demostrado que la normalización no resuelve el corrimiento.

#### 3. Recomendación mínima de corrección

La corrección mínima debe ir en backend, no en frontend.

Recomendación concreta y de menor invasión:

1. Añadir una prueba de regresión con el caso real exacto del oído izquierdo.
2. Endurecer `backend/app/services/ai/extractor.py` con una validación correctiva muy acotada antes de instanciar `AudiometriaData`.

Regla mínima sugerida:

- Cuando en un oído aparezca `125` como frecuencia no canónica y simultáneamente exista un hueco interior en la secuencia canónica (`250` a `8000`) compatible con corrimiento de una columna, el backend no debe limitarse a anotar sospecha.
- Debe marcar el payload como inconsistente y aplicar una de estas dos políticas explícitas:
  - `fail-closed`: rechazar la alineación de ese oído como no confiable y dejar trazabilidad fuerte para revisión humana.
  - `auto-realign` muy restringido: realinear solo si el patrón es inequívoco y repetible contra la cabecera/frecuencias esperadas.

Recomendación práctica:

- Para este sistema, la opción mínima y más segura es primero `fail-closed` con test de regresión, porque evita inventar desplazamientos nuevos sin evidencia suficiente.
- Si negocio exige autocorrección, hacerlo solo con una heurística explícita en backend y no depender del renderer para maquillar el resultado.

### C. Instrucciones de Handoff para SOFIA

1. Inspeccionar `backend/app/services/ai/extractor.py` como única superficie primaria del fix.
2. No tocar frontend para este incidente; el síntoma descrito corresponde a integridad de extracción, no de presentación.
3. Añadir primero una prueba que reproduzca exactamente el caso real: `125` vacío en PDF pero `125=10` en JSON y un `null` desplazado dentro de la secuencia.
4. Decidir entre rechazo explícito del oído inconsistente o heurística de realineación backend. Si no hay señal robusta para realinear, preferir rechazo trazable.
5. Mantener la advertencia `SOSPECHA_CORRIMIENTO`, pero dejar de tratarla como condición suficiente cuando el patrón indique desalineación efectiva.