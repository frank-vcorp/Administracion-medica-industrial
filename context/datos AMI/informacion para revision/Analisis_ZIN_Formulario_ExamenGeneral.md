# Análisis ZIN — Campos abiertos susceptibles a combos

**Origen:** `https://devcami.azurewebsites.net/Examenes/ExamenGral.aspx?Id_Persona=en1g53WdxTA=`
**Sucursal:** CEM QUERETARO | **Usuario:** DEMO / 123456
**Elaborado:** 2026-08-17 (Atlas M3)
**Método:** curl autenticado contra el sitio ZIN actual (sistema legacy AMI)

---

## Resumen ejecutivo

Del **formulario completo de Examen General** del ZIN actual:

| Categoría | Conteo | Acción propuesta |
|---|---|---|
| `<input type="text">` (campos abiertos) | **95** | — |
| `<input type="radio">` (Sí/No) | 76 | mantener |
| `<select>` (combos ya existentes) | **57** | **usar como referencia** |
| `<textarea>` | 2 | mantener |

**De los 95 inputs text:**

| Clasificación | # | Acción |
|---|---|---|
| **Numéricos** (signos vitales, somatometría) | 30 | mantener `<input type="number">` |
| **Texto libre legítimo** (datos personales, historia laboral) | 17 | mantener abierto |
| **🔴 Candidatos a `<select>`** | **28** | convertir a combo con opciones fijas |
| **🔴 Acordeón / combo + texto libre** | **7** | patrón acordeón "Sí/No + campo condicional" |
| **Texto clínico con plantilla** | 16 | prellenar con plantilla ZIN (estilo "lo copia igualito") |
| Pendiente revisar caso a caso | — | confirmar con Jaqueline |

**Total accionable: ~51 campos** que pueden reducir errores de dedo y mejorar consistencia.

---

## Los 57 `<select>` del ZIN — ORO para nuestra implementación

El ZIN ya tiene los combos exactos que necesitamos. Estos son la **fuente de verdad** para poblar nuestros selects:

### Agudeza visual (T-5.2 — COMPLETOS en ZIN)

| Select | Opciones |
|---|---|
| `ddlVisionLejana` (OD) | `20/200, 20/100, 20/70, 20/50, 20/40, 20/30, 20/25, 20/20, 20/15, 20/10` |
| `ddlLejanaOi` (OI) | mismas |
| `ddlVisionCercana` (OD) | mismas |
| `ddlCercanaOI` (OI) | mismas |
| `ddlCorregida` (OD corregida) | mismas |
| `DDLCorregidaOi` (OI corregida) | mismas |
| `ddlCercanaCorregida` (OD cercana corregida) | mismas |
| `ddlCercanaCorregidaOi` (OI cercana corregida) | mismas |

**Acción:** copiar tal cual los `<select>` existentes al componente `AgudezaVisualStudy.tsx`. La junta especificó "20/20, 20/15, 0.75" como ejemplos — coincide con este set.

### Heredo familiares (T-5.7 — COMPLETOS en ZIN)

**Patrón reutilizable en 7 selects idénticos:**

```
ddlAHFDiabetes, ddlAHTAHeredo, ddlAHFEpilepsia, ddlAHFCardio,
ddlAHFRenalesHeredo, ddlAHFAsma, ddlAHFCancer

Opciones: NEGADOS, PADRE, MADRE, AMBOS, HERMANOS, AB PATERNO, AB MATERNO, OTROS
```

`ddlAHFMentales` usa 3 opciones: `NEGADO, SI, NO APLICA`.

**Acción:** Adoptar el patrón. Hoy en AMI (`exam.schema.ts:149 antecedentes_medico`) está como texto libre — convertir al patrón ZIN.

### Patológicos antecedentes (T-5.6 — parcial en ZIN)

| Select | Opciones |
|---|---|
| `ddlAPTAlcoholismo` | `0, 1, 2, 3, 4, 5...` (frecuencia) |
| `ddlAPTEdadComienzo` | `DIARIO, SEMANAL, QUINCENAL, MENSUAL, ANUAL, N/A` |
| `ddlAPTFrecuencia` | `SI, NO` |
| `ddlAPTAlcoholSusp` | `NEGADO, SI, NO APLICA` |
| `ddlAPTTabaquismo` | (frecuencia) |
| `ddlAPTEdadComienzoTwo` | (frecuencia tabaquismo) |
| `ddlAPTFrecuenciatwo` | `SI, NO` |
| `ddlAPTTabaqSusp` | `NEGADO, SI` |
| `ddlAPTDrogas` | `NEGADO, SI` |
| `ddlAPTEjercicio` | `MALA, REGULAR, BUENA, EXCELENTE` |
| `ddlAPTAlimentacion` | `A+, A-, B+, B-, O+, O-, AB+, AB-` (grupo sanguíneo) |
| `ddlAPTGrupoRh` | `NEGADO, SI` |
| `ddlAPTTatuajes` | (numérico 0-11) |

**Falta en ZIN (candidatos a acordeón "Sí/No + Especifique"):**
- `txtAPOtrasPato` ("OTRAS")
- `txtAPEspecificacion` ("Especifique")

### Ginecológicos (G — para mujeres)

| Select | Opciones |
|---|---|
| `ddlAGMenarca` | (numérico años) |
| `ddlAGIvs` | `N/A, ACTIVA, NO ACTIVA` |
| `ddlAGVsa` | métodos anticonceptivos: `NINGUNO, DE BARRERA, HORMONAL, DIU, OTB, RITMO` |
| `ddlAGMpf` | (numérico) |
| `ddlAGGesta`, `ddlAGParto`, `ddlAGCesarea` | (numérico) |
| `ddlAGAborto` | `SI, NO` |

### Pruebas especiales (exploración física)

| Select | Opciones | Patrón |
|---|---|---|
| `ddlEFBoca` | `CARIES, SARRO, CARIES Y SARRO, SIN DATOS` | **T-5.1: Salud bucal** |
| `ddlEFCirculacion` | `C0: SIN SIGNOS VISIBLES NI PALPABLES, C1: TELANGIECTASIAS O VENAS RETICULARES, C2: VARICES, ...` | Insuficiencia venosa |
| `ddlEFPruebaFinke` | `NEGATIVO, POSITIVO BILATERAL, POSITIVO DERECHO, POSITIVO IZQUIERDO` | **Patrón a copiar para Ishihara/Campimetría** |
| `ddlEFSignoTinel` | mismo patrón | — |
| `ddlEFPruebaPhanel` | mismo patrón | — |
| `ddlEFRomberg` | mismo patrón | — |
| `ddlEFPruebaLasage` | mismo patrón | — |
| `ddlEFSignoBraggard` | `NEGATIVO, POSITIVO` | — |
| `ddlEFPresenciaQuiste` | `NORMAL, DISMINUIDA, DISMINUIDA CORREGIDA, ...` | — |
| `ddlComplexion` | (numérico 0.5-1.75 — complexión) | — |

### Signos vitales al integrar dictamen (T-5.14)

| Select | Opciones |
|---|---|
| `ddlIDAgudezaNormal` | `BAJA AL MOMENTO DE LA TOMA, NORMAL AL MOMENTO DE LA TOMA, NORMAL ALTA AL MOMENTO DE LA TOMA` |
| `dllIDPresionArt` | `NORMAL AL MOMENTO DE LA TOMA, ALTA, BAJA` |
| `ddlARMPF` (complexión) | `NORMAL, SOBREPESO, OBESIDAD G1, OBESIDAD G2, OBESIDAD G3, BAJO` |

### Médicos realizadores (no aplica a combos)

`ddlRRealizoEM`, `ddlRRealizoEM` — listas de médicos con cédulas.

---

## Los 28 inputs text → combos

Estos son los campos que **hoy son `<input>` libre** y **deberían ser `<select>`**:

### A. Exploración física (T-5.1 — convertir a combos con plantilla ZIN)

| name (ZIN) | label | Opciones sugeridas |
|---|---|---|
| `txtReflejos` | REFLEJOS | Presentes y Normorreflecticos / Disminuidos / Ausentes / No Aplica |
| `txtCampimtria` | CAMPIMETRIA | Campos visuales dentro de parámetros normales / Alterados / No Aplica / Ver estudio anexo |
| `txtDaltomismo` | TEST DE ISHIHARA | Normal (lee 12,8,6,29,57,45) / Alterado / No Aplica |
| `txtTestAdam` | TEST DE ADAM (escoliosis) | Negativo / Positivo |
| `txtEFArcoMovilidad` | ARCO DE MOVILIDAD | Presentes y normales / Limitados / Ausentes |
| `txtEFTonoMuscular` | TONO MUSCULAR | Normal / Hipotrofia / Hipertrofia |
| `txtCoordinacion` | COORDINACION | Normal / Alterada |
| `txtENEstadoNutricional` | ESTADO NUTRICIONAL | Bajo peso / Normal / Sobrepeso / Obesidad |
| `txtIDSaludBucal` | SALUD BUCAL | Caries / Sarro / Caries y sarro / Sin datos |

### B. Exploración física — texto clínico con plantilla prellenada (T-5.1)

Estos son `<input>` que **deben quedar con texto libre**, pero con **valor por defecto plantilla ZIN** (estilo "lo copia igualito"):

| name (ZIN) | label | Plantilla ZIN (extraída de `NOTA MEDICA EJEMPLO.pdf`) |
|---|---|---|
| `txtEFNeuro` | NEUROLOGICO | "Alerta, orientado en tiempo, lugar y persona. Cooperador." |
| `txtEFCraneo` | CABEZA | "Cráneo normocéfalo, sin hundimientos ni exostosis." |
| `txtEFPielyFaneras` | PIEL Y FANERAS | "Sin datos de palidez, ictericia o cianosis." |
| `txtEFOidos` | OIDOS C.A.D | "Permeable, MT íntegra, cono luminoso permeable." |
| `txtEFCai` | C.A.I | "Permeable, MT íntegra, cono luminoso permeable." |
| `txtEFOjos` | OJOS | "Pupilas isocóricas, normorrefléxicas." |
| `txtEFNariz` | NARIZ | "Alineada, septum alineado." |
| `txtEFFaringe` | FARINGE | "Sin datos patológicos." |
| `txtEFCuello` | CUELLO | "Cilíndrico, tráquea central." |
| `txtEFTorax` | TORAX | "Mesomórfico, movimientos de amplexión y amplexación normales." |
| `txtEFCorazon` | CORAZON | "Ruidos cardíacos rítmicos, sin soplos." |
| `txtEFCamposPulmonares` | CAMPOS PULMONARES | "Bien ventilados, sin ruidos agregados." |
| `txtEFAbdomen` | ABDOMEN | "Globoso, blando, depresible, sin dolor." |
| `txtEFGen` | GENITOURINARIO | "Giordano negativo bilateral." |
| `txtEFColumnaVer` | COLUMNA VERTEBRAL | "Clínicamente alineada." |
| `txtEFSuperiores` | Ms SUPERIORES | "Íntegros, fuerza y sensibilidad conservada." |
| `txtInferiores` | Ms INFERIORES | "Íntegros, sensibilidad conservada." |

### C. Vacunas (Sí/No + condicional — T-5.6 patrón acordeón)

| name (ZIN) | label | Tipo |
|---|---|---|
| `txtITexoideTetanico` | TOXOIDE TETANICO | combo Sí/No + dosis/fecha |
| `txtIInfluenza` | INFLUENZA | combo Sí/No + fecha |
| `txtIRubeola` | RUBEOLA | combo Sí/No + dosis |
| `txtISarampeon` | SARAMPION | combo Sí/No + dosis |
| `txtINeumococo` | NEUMOCOCO | combo Sí/No + dosis |
| `txtIHepatisB` | HEPATITIS B | combo Sí/No + dosis |
| `txtIOtra` | OTRA (vacuna) | combo Sí/No + texto libre |

---

## Acordeones Sí/No + "Especifique" (T-5.6, T-5.7)

Patrón: `ddl...` con `NEGADO/SI/NO APLICA` + input text que aparece solo si la respuesta es "SÍ" o "OTROS":

| name (ZIN) | label | Trigger |
|---|---|---|
| `txtHLPEspecificar` | ESPECIFICAR (Factor de riesgo laboral) | aparece si HLP Factor = OTROS |
| `txtAHFOtras` | OTRAS (heredo familiares) | aparece si AHF = OTROS |
| `txtAPTDrogasEspec` | SI ESPECIFIQUE (drogas) | aparece si APTDrogas = SI |
| `txtAPTEjercicioEsp` | SI ESPECIFIQUE (ejercicio) | aparece si APTEjercicio = alguno |
| `txtAPTTatuajesEsp` | SI ESPECIFIQUE (tatuajes) | aparece si APTTatuajes > 0 |
| `txtAPOtrasPato` | OTRAS (patológicos) | aparece si APP = OTROS |
| `txtAPEspecificacion` | Especifique (patológicos) | aparece si APP = OTROS |
| `txtEFEspecificar` | POSITIVO ESPECIFICAR | aparece si alguna prueba = POSITIVO |

---

## Texto libre legítimo (mantener abiertos)

| # | Tipo | Ejemplos |
|---|---|---|
| 17 | Datos personales | Nombre, Paterno, Materno, Fecha nacimiento, Dirección, Teléfono, Empresa, Cédula profesional |
| 17 | Historial laboral | Puesto, Área, Último empleo, Antigüedad, Factor de riesgo |
| 7 | Tiempo / frecuencia libre | Tiempo suspendido, Frecuencia, Cigarrillos/día |
| 2 | Textareas | Notas / observaciones |

---

## Numéricos (mantener `<input type="number">`)

Los 30 numéricos ya están identificados por mi clasificador. Ejemplos:
- `txtEdad`, `txtTalla`, `txtPeso`, `txtIMC`, `txtCintura`, `txtCadera`, `txtCinCad`
- `txtTa`, `txtFcMIn`, `txtFrMin`, `txtT` (temperatura)
- `txtAPTCigarrosDia`, `txtAPTEdadComienzo` (numéricos complementarios)

**Acción:** Convertir de `<input type="text">` a `<input type="number">` con `step` y `min/max` apropiados.

---

## Hallazgos cruzados con las juntas AMI (10/ago y 12/ago)

### T-5.2 Agudeza visual (junta 10/ago)

Jaqueline pidió combos con valores predefinidos. **EL ZIN YA LOS TIENE**, con valores 20/200 a 20/10 (10 opciones por select). Es la implementación canónica.

**Tickets cubiertos:** T-5.2, T-5.3, T-5.4 directamente.

### T-5.7 Heredo familiares (junta 10/ago)

Erika pidió combos con opciones (abuelo materno, paterno, padre, madre, otros). **EL ZIN YA LOS TIENE** con patrón `NEGADOS/PADRE/MADRE/AMBOS/HERMANOS/AB PATERNO/AB MATERNO/OTROS`.

### T-5.6 Patológicos acordeón (junta 10/ago)

Erika pidió "que sea como acordeón que se expanda con ver detalles". El ZIN tiene el patrón Sí/No + "Especifique" implementado en `txtHLPEspecificar`, `txtAPEspecificacion`, etc.

**Acción:** Adoptar el patrón ZIN en el componente de antecedentes.

### T-5.1 Exploración física prellenada (junta 10/ago)

Jaqueline: "Lo copia igualito que el ZIN". Las plantillas extraídas del `NOTA MEDICA EJEMPLO.pdf` (texto real capturado por Jaqueline) son la **fuente directa**.

---

## Tareas concretas que produce este análisis

1. **`ARCH-20260817-01-COMBOS-ZIN-MIGRATION`** (SPEC candidata):
   - Adoptar los 9 selects de agudeza visual del ZIN en `AgudezaVisualStudy.tsx`.
   - Adoptar los 7 selects de heredo familiares en `AntecedentesCaptura`.
   - Adoptar los 12 selects de patológicos (`ddlAPT*`).
   - Reemplazar 28 inputs text por `<select>` (exploración física + bucal + nutricional + combos varios).
   - Implementar patrón acordeón en 7 inputs "Especifique".
   - Prellenar 16 inputs de exploración física con plantillas ZIN extraídas.
   - Convertir 30 inputs numéricos a `<input type="number">` con validación.

2. **Esfuerzo estimado:** S-M (1-2 días SOFIA + GEMINI review).

3. **Archivos destino estimados:**
   - `frontend/src/components/clinical/studies/AgudezaVisualStudy.tsx` (cambiar 8 inputs a 8 selects)
   - `frontend/src/components/clinical/AntecedentesCaptura.tsx` o equivalente
   - `frontend/src/schemas/clinical/exam.schema.ts` (nuevas opciones enum)

4. **Validaciones:** typecheck, vitest, lint, QA manual con valores de `ddl*` del ZIN.

5. **Sin cambios de schema Prisma** — solo UI + schema Zod.

---

## Archivos fuente de donde salió esta información

- HTML crudo: `/home/frank/examen_form.html` (200KB)
- Inputs clasificados: `/home/frank/zin_inputs_clasificados.json`
- Selects extraídos: `/home/frank/zin_selects.json`

---

**Conclusión:** Los 25 tickets 🔴 relacionados con combos tienen **solución directa en el ZIN actual**. Solo falta adoptarla.
