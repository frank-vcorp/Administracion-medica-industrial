/**
 * Script para actualizar el prompt de extracción de Espirometría a v6
 * (IMPL-FIX-20260824-04 — dictamen FIX-20260824-04 sobre regresión FEV1=0;
 * prohíbe duplicar celdas, exige usar Mejor X como referencia de fila estándar,
 * exige validación cruzada).
 *
 * USO:
 *   DATABASE_URL=<railway_url> npx tsx scripts/update-espirometria-extraction-prompt.ts
 *
 * EFECTO:
 *   - Busca el MedicalTest cuyo `name` sea "ESPIROMETRIA" (case-insensitive).
 *   - Actualiza únicamente `options.aiCalibration.extraction.prompt` y
 *     `options.aiCalibration.extraction.version` → 'espirometria-sibelmed-v6'.
 *   - Preserva intactos los demás campos de `options`, incluyendo:
 *       * `aiCalibration.enabled`
 *       * `aiCalibration.canonicalStudyType`
 *       * `aiCalibration.diagnosis`
 *       * `aiCalibration.extraction.{model, provider, schemaVersion}`
 *     Sin crear/modificar `aiCalibration.prediagnostico` ni
 *     `aiCalibration.normalization`.
 *
 * CONTRATO INTACTO:
 *   - El cálculo numérico de repetibilidad FVC/FEV1 (ml) sigue siendo
 *     responsabilidad del panel, que toma los dos valores más altos de
 *     `parametros[].m1/m2/m3` y aplica `(max − second) × 1000`.
 *     Umbral AMI ≤ 150 ml (BR-20260824-01). El extractor NO debe multiplicar
 *     ni convertir unidades.
 *   - `repetibilidad_fvc_menor_150` y `repetibilidad_fev1_menor_150` NO se
 *     infieren como fuente de verdad. Son DERIVADAS por el panel desde
 *     `repetibilidadFvcMl`/`repetibilidadFev1Ml` con umbral AMI ≤ 150 ml.
 *     El extractor debe dejarlas en `null` salvo cuando el reporte declare
 *     EXPLÍCITAMENTE "Repetibilidad FVC: SI/NO" como valor textual del
 *     reporte (no derivado del flag ATS/ERS de la imagen embebida).
 *   - `tiempo`: sólo si el reporte declara EXPLÍCITAMENTE un indicador
 *     cualitativo (p.ej. "FET: cumple criterio"). NO derivarlo sólo porque
 *     la curva dure X segundos.
 *   - `criterios_para_dx`: sólo si el reporte declara EXPLÍCITAMENTE
 *     "Criterios para Dx: SI/NO" o equivalente. NO derivarlo de ATS/ERS ni
 *     de una heurística del modelo. Si no está visible → null.
 *   - `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`:
 *     inferencia visual clara SI/NO sólo si la evidencia gráfica es
 *     clara; en otro caso null.
 *   - `calidad`: sólo si el documento declara una letra/código explícito
 *     (A/B/C/D/F); no inventar.
 *   - Aliases para texto fuente del médico: el panel lee
 *     `impresion_diagnostica_texto` y `recomendaciones_texto`; el prompt
 *     acepta ambos nombres. Sin invención.
 *
 * CAMBIOS vs v5 (FIX-20260824-04):
 *   - PROHIBICIÓN ABSOLUTA explícita: NO DUPLICAR UNA CELDA EN OTRA. Si M1
 *     está vacía, usa null — NUNCA copies el valor de M2 ni de M3. La
 *     duplicación produce cálculos de repetibilidad espurios (ej. FEV1
 *     m1=2.11 + m2=2.11 ⇒ (2.11−2.11)×1000 = 0 ml).
 *   - PROHIBICIÓN ABSOLUTA explícita: NO usar la fila "Mejor FEV1" /
 *     "Mejor FVC" como sustituto de la fila estándar FEV1 / FVC. Son
 *     filas DISTINTAS del layout Sibelmed:
 *       * "Mejor FEV1" CONSOLIDA la mejor maniobra (m1=m2=m3 = el mejor
 *         valor entre las 3 maniobras separadas de la fila FEV1).
 *       * "FEV1" contiene las 3 maniobras SEPARADAS (m1, m2, m3 pueden
 *         diferir).
 *   - VALIDACIÓN CRUZADA OBLIGATORIA antes de cerrar el JSON:
 *       Para cada par (Mejor X, fila estándar X), verificar que el valor
 *       consolidado en la fila Mejor X es <= max(m1, m2, m3) de la fila
 *       estándar X. Si NO se cumple, NO rellenar m1 — transcribir
 *       literalmente las celdas visibles y dejar que la normalización
 *       defensiva backend marque `SOSPECHA_INCONSISTENCIA_MEJOR_FEV1` /
 *       `_FVC` + `completitud_documental = no_concluyente` para que el
 *       cálculo de repetibilidad downstream se invalide (no muestre 0 ml).
 *   - Apartado "PROHIBICIONES ABSOLUTAS" renumerado y reforzado con las
 *     nuevas prohibiciones 9 (no usar Mejor X como fila estándar) y 10
 *     (no copiar valores de M2 a M1 ni a %REF adyacente).
 *   - Sin cambio en extracción `criterios_para_dx`, `tiempo`, `calidad`,
 *     `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta` —
 *     reglas de v5 preservadas.
 *   - Sin cambio en repetibilidad `<150` ni `<200` (siguen SIEMPRE null
 *     en extractor; los deriva el panel con umbral AMI ≤ 150 ml).
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'node:url'

// Constantes exportadas para que los tests focales del prompt (V1) puedan
// inspeccionarlas sin tener que leer el archivo fuente ni ejecutarlo contra
// la BD. NO son parte del contrato público: son internas al script de
// mantenimiento del prompt de extracción de Espirometría.
export const EXTRACTION_VERSION = 'espirometria-sibelmed-v6'

export const NEW_EXTRACTION_PROMPT = `REGLAS ESPECÍFICAS PARA EXTRACCIÓN DE ESPIROMETRÍA (v6 — IMPL-FIX-20260824-04, BR-20260824-01 + BR-20260824-02)

El documento contiene un estudio de función pulmonar. Devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto adicional y sin bloques <think>.

FUENTE PRIMARIA (DATOS NUMÉRICOS)

1. La tabla "INFORME DE FVC" es la fuente primaria de los datos numéricos.
2. Cada fila tiene exactamente estas columnas: PARÁMETRO | M1 | %REF | M2 | %REF | M3 | %REF | REF | LLN.
3. Conserva cada celda en su columna correspondiente. Nunca desplaces M1 a M2 ni mezcles un %REF con otra maniobra.
4. Si una celda está vacía, usa null. Nunca inventes ni completes valores.
5. Extrae las filas FVC y FEV1 con sus valores absolutos M1/M2/M3 y sus porcentajes %REF.
6. También extrae Mejor FVC, Mejor FEV1, FEV1/FVC, FEF25%-75%, FET100%, Vext. y Edad del pulmón cuando estén visibles.
7. Extrae los datos del paciente, estudio, condiciones técnicas y de las gráficas.

PROHIBICIONES ABSOLUTAS (FIX-20260824-04 — duplicación de celdas)

8. NO DUPLIQUES UNA CELDA EN OTRA. Específicamente:
   - NO rellenes \`m1\` con el valor de \`m2\` ni de \`m3\` (ni viceversa).
   - NO rellenes \`m1_pct_ref\` con \`m2_pct_ref\` ni con \`m3_pct_ref\`.
   - Si la celda M1 está vacía en la fuente, usa \`null\` para \`m1\` y para
     \`m1_pct_ref\` — NUNCA copies el valor de M2 ni de M3.
   - Cada celda conserva su propio valor (transcripción literal).

   Síntoma de duplicación: si extraes m1 = m2 (par absoluto) con
   porcentajes %REF iguales y la fila "Mejor X" trae un valor mayor,
   la fórmula downstream \`(m1 − m2) × 1000 = 0 ml\` es un artefacto de
   la duplicación, NO una repetibilidad real.

9. NO USES la fila "Mejor FEV1" / "Mejor FVC" como sustituto de la fila
   estándar FEV1 / FVC. Son filas DISTINTAS del layout Sibelmed:
   - "Mejor FEV1" CONSOLIDA la mejor maniobra (\`m1 = m2 = m3\` = el
     mejor valor entre las 3 maniobras separadas de la fila FEV1).
   - "FEV1" contiene las 3 maniobras SEPARADAS (\`m1\`, \`m2\`, \`m3\`
     pueden diferir).
   Si la fila estándar FEV1/FVC no está visible, emite \`null\` para esas
   celdas — NO rellenes la fila estándar copiando la fila "Mejor X".

VALIDACIÓN CRUZADA OBLIGATORIA (FIX-20260824-04)

10. ANTES de cerrar el JSON, para cada par (Mejor X, fila estándar X) presente
    en \`parametros[]\`, valida la consistencia:

    a. Identifica la fila "Mejor FEV1" (\`mejor_fev1_l\` o \`mejor_fev1\`)
       y la fila estándar "FEV1" (\`fev1_l\` o \`fev1\`). El valor consolidado
       de la fila "Mejor FEV1" es \`mejor_fev1_max = mejor_fev1.m1\`
       (las 3 celdas \`m1/m2/m3\` son iguales en Sibelmed).
    b. Identifica las 3 maniobras de la fila estándar FEV1 y calcula
       \`fev1_std_max = max(fev1.m1, fev1.m2, fev1.m3)\`.
    c. Verifica que \`mejor_fev1_max <= fev1_std_max\`. Si NO se cumple
       (\`mejor_fev1_max > fev1_std_max + epsilon\`), hay un error de
       extracción: probablemente duplicaste M2 como M1, perdiste M1, o
       confundiste el orden de las maniobras.
    d. Si detectas la inconsistencia, NO rellenes m1 desde "Mejor X" —
       transcribe literalmente las celdas que veas y deja \`null\` si la
       celda está vacía. La normalización defensiva backend anotará
       \`SOSPECHA_INCONSISTENCIA_MEJOR_FEV1\` y forzará
       \`completitud_documental = "no_concluyente"\` para que el cálculo
       de repetibilidad downstream se invalide (no muestre 0 ml espurio).
    e. Aplica el mismo procedimiento al par (Mejor FVC, fila estándar FVC).

EJEMPLO CANÓNICO (FIX-20260824-04 — bit-a-bit)

Para FEV1 (Sibelmed W20s, layout canónico de 9 columnas), la fila tiene
exactamente esta serie de 6 celdas en orden: \`m1 = 2.15\`,
\`m1_pct_ref = 77\`, \`m2 = 2.11\`, \`m2_pct_ref = 76\`, \`m3 = 2.09\`,
\`m3_pct_ref = 75\`. La operación downstream esperada es
\`max(2.15, 2.11, 2.09) − segundo = (2.15 − 2.11) × 1000 = 40 ml\` —
NO 0 ml. Si al transcribir te encuentras escribiendo m1 = m2 = 2.11,
STOP: estás duplicando. Revisa la columna M1 en el PDF.

Para FVC (mismo layout), la fila tiene \`m1 = 2.30\`, \`m1_pct_ref = 69\`,
\`m2 = 2.33\`, \`m2_pct_ref = 70\`, \`m3 = 2.26\`, \`m3_pct_ref = 68\`.
Operación esperada: \`(2.33 − 2.30) × 1000 = 30 ml\`. Si el resultado
te da 0 ml, es porque duplicaste M2 como M1.

La fila "Mejor FEV1" del mismo reporte lleva \`m1 = m2 = m3 = 2.15\`
(la mejor maniobra consolidada) y la fila "Mejor FVC" lleva
\`m1 = m2 = m3 = 2.33\`. Estas filas resumen la mejor maniobra — NO
las uses como sustituto de la fila estándar FEV1/FVC.

INFERENCIA VISUAL DE CRITERIOS DE CALIDAD (BR-20260824-02)

Las gráficas flujo-volumen y volumen-tiempo del reporte, cuando sean legibles y las maniobras identificables, permiten INFERIR VISUALMENTE los siguientes criterios. Devuelve SI/NO sólo cuando la evidencia gráfica sea CLARA. Si una curva no es legible, está cortada, no distingue las maniobras, o el criterio es ambiguo, devuelve \`null\`. NUNCA inventes.

Claves dentro de \`calidad\`:

- \`pico_maximo\`       : "SI" | "NO" | null
- \`forma_triangular\`  : "SI" | "NO" | null
- \`libre_artefactos\`  : "SI" | "NO" | null
- \`meseta\`            : "SI" | "NO" | null

REFERENCIA VISUAL (criterios ATS/ERS inferidos de las curvas):
- \`pico_maximo\`: el flujo espiratorio pico (PEF) aparece claro en el vértice de la curva flujo-volumen sin truncamiento ni amputación.
- \`forma_triangular\`: la curva flujo-volumen describe aproximadamente un triángulo isósceles desde PEF hasta el cruce con el eje de volumen (sin concavidades marcadas).
- \`libre_artefactos\`: no se observan tos al inicio, cierre de glotis, fuga, terminación prematura por esfuerzo variable ni obstrucción extratorácica variable.
- \`meseta\`: la curva volumen-tiempo muestra una meseta final (plateau) ≥ 1 segundo antes del término de la maniobra.

ETIQUETA OBLIGATORIA (BR-20260824-02):

Estos valores son \`CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS\`. NO son texto escrito por el médico, NO son diagnóstico IA, NO sustituyen la revisión médica ocupacional. La inferencia visual es una ayuda al médico; cuando una curva no es clara, devuelve \`null\` y deja que el médico lo determine.

CRITERIOS EXPLÍCITOS DEL DOCUMENTO (NO inferir) — IMPL-20260824-05

Estos criterios se devuelven SOLO cuando el reporte los declara de manera EXPLÍCITA como texto estructurado del documento (etiqueta visible). NO se infieren de la duración de la curva, de heurísticas internas, ni de la combinación de los visuales anteriores. Si no hay un enunciado textual claro del reporte, devuelve \`null\`.

- \`tiempo\`: "SI" | "NO" | null
   Devuelve "SI" sólo si el reporte declara EXPLÍCITAMENTE un indicador
   textual de aceptabilidad del tiempo espiratorio (p.ej. "FET: cumple
   criterio ATS/ERS", "Tiempo espiratorio: válido", "Tiempo: ≥ 6 s
   cumplido"). Devuelve "NO" sólo si el reporte lo declara EXPLÍCITAMENTE
   como no cumplido. NO infieras \`tiempo\` a partir de la duración de la
   curva ni de la duración de la maniobra: una curva de 7 segundos sin
   etiqueta textual → \`null\`. Sin etiqueta textual → \`null\`.

- \`criterios_para_dx\`: "SI" | "NO" | null
   Devuelve "SI" sólo si el reporte declara EXPLÍCITAMENTE
   "Criterios para Dx: SI" (o equivalente textual inequívoco: "Cumple
   criterios diagnósticos", "Patrón diagnóstico aplicable"). Devuelve
   "NO" sólo si el reporte lo declara EXPLÍCITAMENTE como "Criterios
   para Dx: NO" (o equivalente). NO derives \`criterios_para_dx\` del
   flag ATS/ERS embebido, ni de la combinación de los visuales, ni
   de una heurística del modelo. Si el reporte no tiene esa etiqueta
   textual → \`null\`.

- \`calidad\`: "A" | "B" | "C" | "D" | "F" | null
   Devuelve la letra/código SOLO si el reporte la declara EXPLÍCITAMENTE
   (p.ej. "Calidad de la prueba: A", "Grado: B"). NO calcules \`calidad\`
   desde los visuales; NO asumas A por defecto. Si el reporte no trae
   letra/código → \`null\`.

REPETIBILIDAD (NO fuente de verdad — IMPL-20260824-05)

- \`repetibilidad_fvc_menor_150\`: SIEMPRE \`null\`.
- \`repetibilidad_fev1_menor_150\`: SIEMPRE \`null\`.

Estos dos flags los DERIVA el panel frontend desde \`repetibilidad_fvc_ml\` y
\`repetibilidad_fev1_ml\` aplicando el umbral AMI ≤ 150 ml (BR-20260824-01).
NO copies aquí el flag ATS/ERS ("Repetibilidad ATS/ERS: FVC: No/SI") del
equipo: ese es un criterio distinto (ya visible en el renderer vía
\`repetibilidad_ats_ers_fvc\` / \`repetibilidad_ats_ers_fev1\`) y NO debe
sobrescribir el criterio AMI del panel.

PROHIBICIONES ABSOLUTAS (BR-20260824-02 + IMPL-20260824-05):

1. NUNCA devuelvas SI/NO para \`pico_maximo\`, \`forma_triangular\`,
   \`libre_artefactos\`, \`meseta\` si la curva no permite inferencia clara.
   Si la curva está borrosa, cortada, con leyendas no visibles, o las
   maniobras no se distinguen → \`null\`.
2. NUNCA derives \`pico_maximo\`, \`forma_triangular\`, \`libre_artefactos\`,
   \`meseta\` desde la tabla numérica. Sólo desde las curvas legibles.
3. NUNCA infieras \`tiempo\` desde la duración de la curva. Sólo si el
   reporte lo declara EXPLÍCITAMENTE como texto.
4. NUNCA infieras \`criterios_para_dx\` desde ATS/ERS ni desde los visuales.
   Sólo si el reporte lo declara EXPLÍCITAMENTE como "Criterios para Dx:
   SI/NO" (o equivalente).
5. NUNCA infieras \`calidad\` desde los visuales. Sólo letra/código
   explícito del reporte.
6. NUNCA copies "Repetibilidad ATS/ERS: FVC: No/SI" o
   "Repetibilidad ATS/ERS: FEV1: No/SI" en \`repetibilidad_fvc_menor_150\`
   o \`repetibilidad_fev1_menor_150\`: esos flags los calcula el panel.
7. NUNCA inventes \`impresion_diagnostica\`/\`recomendaciones\`. Esos campos
   son TEXTO FUENTE del documento médico (transcríbelo literalmente sólo
   si está visible); NO son salida IA ni diagnóstico generado por el
   modelo.
8. NO modifiques el cálculo numérico de repetibilidad FVC/FEV1 en ml.
   Eso lo calcula el panel desde \`parametros[]\` (top-2 sobre m1/m2/m3
   × 1000) con umbral AMI ≤ 150 ml (BR-20260824-01). Tu trabajo aquí es
   transcribir M1/M2/M3 y, si están visibles en el reporte como texto
   nativo, \`repetibilidad_fvc_ml\`/\`repetibilidad_fev1_ml\` (en ml).
   El flag Sí/No ≤150 NO lo produces tú.
9. NUNCA dupliques M2 como M1 (IMPL-20260824-06). Cada celda
   M1/M2/M3/%REF debe transcribirse literalmente de su columna. Si la
   celda M1 está vacía en la fuente, usa null para m1 y m1_pct_ref —
   no copies el valor de M2. El síntoma "(m1 − m2) × 1000 = 0 ml"
   revela que duplicaste M2 como M1; evítalo transcribiendo cada celda
   en su columna.
10. NUNCA uses la fila "Mejor FEV1"/"Mejor FVC" como fila FEV1/FVC
    estándar (IMPL-20260824-06). Son filas DISTINTAS del layout
    Sibelmed: "Mejor X" consolida la mejor maniobra (m1=m2=m3); la fila
    estándar contiene las 3 maniobras separadas. Si la fila estándar no
    está visible, emite null para esas celdas — no la rellenes con la
    fila "Mejor X". El valor de "Mejor FEV1" debe coincidir con el
    máximo de las maniobras de la fila "FEV1".

ALIASES PARA REPETIBILIDAD Y ACEPTABILIDAD (compatibilidad con el esquema existente)

- \`repetibilidad_fvc_ml\` / \`repetibilidad_fev1_ml\`: número en ml
   SOLO si el reporte lo trae explícitamente como texto nativo (p.ej.
   "Repetibilidad FVC: 30.00 ml" en el PDF vectorial). Si no está
   visible como número en el documento, \`null\`. El panel también puede
   calcularlo desde \`parametros[]\` cuando esté ausente, así que \`null\`
   aquí NO es un error.
- \`pruebas_aceptables\`: entero con el número de maniobras válidas listadas
   (típicamente 3 cuando M1/M2/M3 están presentes); null si no es visible.

TEXTO FUENTE DEL MÉDICO (no IA; sólo transcripción literal cuando esté visible)

- \`impresion_diagnostica_texto\` y/o \`impresion_diagnostica\`: transcripción
   literal del texto que el médico escribió como impresión diagnóstica, si
   está visible. Si no, null. POBLAR AMBOS con el mismo valor cuando lo
   transcribas (el panel lee cualquiera de los dos nombres).
- \`recomendaciones_texto\` y/o \`recomendaciones\`: idem para las
   recomendaciones del médico. POBLAR AMBOS con el mismo valor.
   NO son salida IA.

COMPATIBILIDAD HISTÓRICA (no romper esquema existente)

- \`repetibilidad_ats_ers_fvc\`, \`repetibilidad_ats_ers_fev1\`,
   \`es_interpretable\`, \`completitud_documental\`,
   \`notas_calidad\`: mantener como antes. \`repetibilidad_ats_ers_fvc\`
   y \`repetibilidad_ats_ers_fev1\` SÍ reciben el flag binario del equipo
   ("Repetibilidad ATS/ERS: FVC: No/SI") porque es un criterio distinto
   que el panel renderiza por separado. \`notas_calidad\` puede contener
   una explicación textual libre del documento.

REGLAS CRÍTICAS (resumen)

1. Los 4 visuales puros (\`pico_maximo\`, \`forma_triangular\`,
   \`libre_artefactos\`, \`meseta\`) son INFERIDOS VISUALMENTE de las
   curvas. Si la curva no es legible → null.
2. \`tiempo\`, \`criterios_para_dx\`, \`calidad\` son del documento
   EXPLÍCITO: sólo si el reporte los declara como texto/letra visible.
   No inferir.
3. \`repetibilidad_fvc_menor_150\`/\`repetibilidad_fev1_menor_150\` los
   calcula SIEMPRE el panel desde el numérico (regla AMI ≤ 150 ml). Tú
   siempre devuelves \`null\`.
4. \`repetibilidad_ats_ers_fvc\`/\`repetibilidad_ats_ers_fev1\` sí
   reciben el flag binario del equipo (criterio distinto).
5. \`impresion_diagnostica*\`/\`recomendaciones*\` son TEXTO FUENTE del
   documento. NUNCA los promociones como salida IA ni los inventes.
6. Si una clave aparece tanto en una bandera Sí/No como en texto
   narrativo, transcribe sólo la bandera estructurada; deja el texto
   narrativo dentro de \`notas_calidad\` cuando aplique.

SALIDA JSON MÍNIMA

{
  "paciente_detalle": {"nombre_completo": null, "sexo": null, "edad_anios": null, "talla_cm": null, "peso_kg": null, "imc": null, "fuma": null, "motivo": null, "procedencia": null},
  "estudio": {"referencia": null, "fecha_estudio": null, "hora_estudio": null, "tipo_reporte": null, "equipo_modelo": null, "version_software": null},
  "condiciones": {"temperatura_c": null, "presion_mmhg": null, "humedad_pct": null, "tecnico": null, "transductor": null, "referencia_ecuacion": null, "factor_etnico": null, "factor_btps": null},
  "parametros": [{"label": "FVC", "key": "fvc_l", "unidad": "L", "m1": null, "m1_pct_ref": null, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": null, "lln": null}, {"label": "FEV1", "key": "fev1_l", "unidad": "L", "m1": null, "m1_pct_ref": null, "m2": null, "m2_pct_ref": null, "m3": null, "m3_pct_ref": null, "ref": null, "lln": null}],
  "calidad": {
    "pico_maximo": null,
    "forma_triangular": null,
    "libre_artefactos": null,
    "meseta": null,
    "tiempo": null,
    "criterios_para_dx": null,
    "calidad": null,
    "repetibilidad_fvc_menor_150": null,
    "repetibilidad_fev1_menor_150": null,
    "pruebas_aceptables": null,
    "impresion_diagnostica_texto": null,
    "impresion_diagnostica": null,
    "recomendaciones_texto": null,
    "recomendaciones": null,
    "repetibilidad_ats_ers_fvc": null,
    "repetibilidad_ats_ers_fev1": null,
    "es_interpretable": null,
    "completitud_documental": null,
    "repetibilidad_fvc_ml": null,
    "repetibilidad_fev1_ml": null,
    "notas_calidad": null
  },
  "graficas": {"curva_flujo_volumen_presente": null, "curva_volumen_tiempo_presente": null, "maniobras_graficadas": null, "observaciones_grafica": null}
}

No copies diagnósticos ni recomendaciones médicas como diagnóstico IA. Devuelve sólo JSON.`

// Cliente Prisma instanciado lazy (no se conecta hasta el primer uso; la
// conexión ocurre al ejecutar el script con DATABASE_URL).
const prisma = new PrismaClient()

async function main() {
  console.log(
    '=== IMPL-20260824-05 (BR-20260824-01 + IMPL-20260824-05 — Espirometría v5, separación AMI vs ATS/ERS) ===\n'
  )

  const test = await prisma.medicalTest.findFirst({
    where: { name: { equals: 'ESPIROMETRIA', mode: 'insensitive' } },
  })
  if (!test) {
    console.error('No se encontró MedicalTest con name ESPIROMETRIA.')
    process.exitCode = 1
    return
  }

  console.log(`Encontrado: "${test.name}" (ID: ${test.id})`)

  const currentOptions = (test.options as Record<string, unknown> | null) ?? {}
  const currentAiCalibration =
    (currentOptions.aiCalibration as Record<string, unknown> | null) ?? {}
  const currentExtraction =
    (currentAiCalibration.extraction as Record<string, unknown> | null) ?? {}

  const previousVersion =
    typeof currentExtraction.version === 'string'
      ? currentExtraction.version
      : '(sin versión previa)'

  const previousPromptChars =
    typeof currentExtraction.prompt === 'string'
      ? currentExtraction.prompt.length
      : 0

  // --- Preservar TODO lo demás intacto ---
  const updatedExtraction: Record<string, unknown> = {
    ...currentExtraction,
    prompt: NEW_EXTRACTION_PROMPT,
    version: EXTRACTION_VERSION,
  }

  const updatedAiCalibration: Record<string, unknown> = {
    ...currentAiCalibration,
    extraction: updatedExtraction,
  }

  const updatedOptions: Record<string, unknown> = {
    ...currentOptions,
    aiCalibration: updatedAiCalibration,
  }

  // --- Reporte pre-update ---
  console.log(`Versión previa extraction.version: ${previousVersion}`)
  console.log(`Nueva versión extraction.version:  ${EXTRACTION_VERSION}`)
  console.log(`Tamaño prompt previo:  ${previousPromptChars} chars`)
  console.log(`Tamaño prompt nuevo:   ${NEW_EXTRACTION_PROMPT.length} chars`)
  console.log(
    `Claves preservadas en aiCalibration (top-level): [${Object.keys(
      updatedAiCalibration
    ).join(', ')}]`
  )
  console.log(
    `Claves preservadas en aiCalibration.extraction:  [${Object.keys(
      updatedExtraction
    ).join(', ')}]`
  )
  const prediagnosticoKeys = Object.keys(
    (updatedAiCalibration.prediagnostico as object | undefined) ?? {}
  )
  const normalizationKeys = Object.keys(
    (updatedAiCalibration.normalization as object | undefined) ?? {}
  )
  console.log(
    `Claves en aiCalibration.prediagnostico: [${prediagnosticoKeys.join(', ') || '∅'}] (preservadas, sin creación)`
  )
  console.log(
    `Claves en aiCalibration.normalization:  [${normalizationKeys.join(', ') || '�'}] (preservadas, sin creación)`
  )

  // --- Persistir ---
  await prisma.medicalTest.update({
    where: { id: test.id },
    data: { options: updatedOptions as Prisma.InputJsonValue },
  })

  console.log('\nPrompt de extracción actualizado correctamente.')
  console.log(`   → medical_test.id:        ${test.id}`)
  console.log(`   → extraction.version:     ${EXTRACTION_VERSION}`)
  console.log(`   → extraction.prompt size: ${NEW_EXTRACTION_PROMPT.length} chars`)
}

// Guardia entry-point: sólo ejecuta `main()` cuando el archivo se ejecuta
// directamente (no cuando se importa desde los tests focales V1).
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith('update-espirometria-extraction-prompt.ts'))

if (isMainModule) {
  main()
    .catch((e: unknown) => {
      console.error('Error durante la actualización:', e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
