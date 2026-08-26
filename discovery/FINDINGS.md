# Findings

## FND-20260819-01 — Impresión y Aptitud presenta evidencia consolidada sin paneles por prueba

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** Captura de pantalla de Frank, 2026-08-19. La pantalla muestra resumen ejecutivo y aptitud, pero no tarjetas de resultado/dictamen/descargable por prueba.
- **Impacto:** El médico no puede revisar de forma explícita el dictamen individual de Examen Médico, Audiometría, Espirometría u otras pruebas antes de elegir la aptitud consolidada.
- **Artefactos afectados:** Impresión y Aptitud; reporte integrado; descargables; ZIP final.
- **Relación:** DEC-20260819-01, BR-20260819-01, FLOW-20260819-01.

## FND-20260819-02 — Impresión y Aptitud está anidada bajo Examen Médico aunque el perfil puede no incluirlo

- **Estado:** candidate
- **Severidad:** P1
- **Evidencia:** El administrador configura perfiles mediante checkboxes de pruebas sin requisito visible de Examen Médico (`MedicalProfilesManager.tsx:666-695`). La vista actual ubica Impresión y Aptitud dentro de Examen Médico.
- **Impacto:** Una atención solo con Audiometría, Espirometría u otras pruebas podría no tener una ubicación coherente para mostrar resultados individuales, descargables y un posible consolidado.
- **Artefactos afectados:** Navegación de atención, Resultados por prueba, Dictamen integrado, descargables y ZIP final.
- **Relación:** DEC-20260819-01, OQ-20260819-04.

## FND-20260820-01 — Calibración conecta solo prompts, no gobierna el pipeline completo de Events

- **Estado:** confirmed
- **Severidad:** P0
- **Evidencia:** Auditoría de código 2026-08-20. Events recibe `aiCalibration` para prompts/proveedor, pero decide el tipo por heurística hardcodeada (`frontend/src/lib/study-ai.ts`) y no respeta `aiCalibration.enabled`. `fieldDefinitions` no tiene consumidores runtime en backend.
- **Impacto:** Lo configurado en Calibración puede no coincidir con la extracción real, el routing XML, la validación mínima o el comportamiento visible de Events.
- **Artefactos afectados:** Calibración IA, carga de EventTest, pipeline V2, XML Audiometría, prediagnóstico.
- **Relación:** DEC-20260820-01, BR-20260820-01.

## FND-20260820-02 — El modo de prueba de Calibración no reproduce la presentación de Events

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** `CalibrationTestResults.tsx` presenta JSON; `PresentationSchemaPanel.tsx` es visor de solo lectura. Events usa `ClinicalExtractionRenderer` y, al no existir un schema persistido editable, cae en schemas hardcodeados de Audiometría/Espirometría.
- **Impacto:** El usuario puede aprobar una extracción en Calibración sin verificar cómo la verá el médico en la papeleta real.
- **Artefactos afectados:** Tabs Pruebas/Presentación de Calibración, renderer de Events.
- **Relación:** DEC-20260820-01, BR-20260820-01.

## FND-20260820-03 — Versionado incompleto y representación histórica mutable

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** Cambios de prompt, proveedor y tipo canónico se guardan por la acción V1 sin incrementar versión. Los snapshots de Events no congelan el schema de presentación usado y se renderizan con la calibración vigente actual.
- **Impacto:** Un resultado histórico puede cambiar de apariencia al editar Calibración y la versión reportada puede no representar el prompt/configuración efectivamente usada.
- **Artefactos afectados:** Historial de calibración, StudyExtractionSnapshot, trazabilidad clínica y auditoría.
- **Relación:** DEC-20260820-01, BR-20260820-01.

## FND-20260820-04 — El catálogo AMI requiere calibración generalizada por familias, paneles y analitos, no configuración manual desde cero por prueba

- **Estado:** candidate
- **Severidad:** P1
- **Evidencia:** `Nombres de pruebas en perfiles.xlsx` contiene aproximadamente 130 entradas agrupadas en Laboratorio, Generales, Imagen y Ambulancia. `laboratorio/CATÁLOGO DE SERVICIOS DE LAB SME.xlsx` contiene aproximadamente 174 estudios de laboratorio con tipo de muestra, tiempo de entrega, laboratorio procesador, indicaciones y observaciones.
- **Impacto:** Un editor que obligue a definir manualmente campos, prompts, fórmulas y presentación para cada entrada sería costoso, inconsistente y difícil de mantener.
- **Propuesta funcional:** contrato general reutilizable + plantillas por familia + catálogo de paneles/analitos de laboratorio + ajustes específicos solo para pruebas complejas (Audiometría, Espirometría, Examen Médico y algunas pruebas de imagen/laboratorio).
- **Relación:** DEC-20260820-01, BR-20260820-01, OQ-20260820-01.

## FND-20260820-05 — Audiometría y Espirometría requieren cierre nocturno con evidencia real

- **Estado:** candidate
- **Severidad:** P1
- **Evidencia:** Frank solicita dejar listas ambas pruebas durante una sesión nocturna, con resultados útiles para médicos y alineados con la documentación AMI.
- **Contrato funcional documentado:** Audiometría debe entregar umbrales OD/OI por frecuencia canónica, calidad/completitud y campos fuente opcionales del formato; Espirometría debe entregar identificación, condiciones, tabla exhaustiva M1/M2/M3/%REF/REF/LLN, FEV1/FVC/ratio, calidad y repetibilidad cuando estén visibles.
- **Criterio clínico:** la IA sólo produce prelectura asistida y trazable; no emite diagnóstico final ni aptitud. Los mínimos faltantes deben producir `AI_NON_CONCLUSIVE` con limitaciones visibles.
- **Riesgo:** “Bien calibrado” no puede confirmarse sólo con tests unitarios; requiere ejecutar casos reales AMI, revisar snapshots y aceptación funcional de los valores visibles.
- **Relación:** DEC-20260820-01, DEC-20260820-02, SPEC_ARCH-20260513-01, SPEC_ARCH-20260516-07, SPEC_ARCH-20260516-12, FIX-20260812-20.

## FND-20260821-02 — Existe PDF real de Espirometría fuera de la carpeta revisada

- **Estado:** confirmed
- **Severidad:** P1 → resuelto para DG-1
- **Evidencia:** `context/RD2026/ESPIROMETRIA.pdf` contiene un informe Sibelmed W20s real con paciente, condiciones, tabla M1/M2/M3/%REF/REF/LLN, repetibilidad ATS/ERS y calidad A.
- **Impacto:** La conclusión previa “AMI sólo entrega PNG” era incompleta por limitar la búsqueda a `context/datos AMI/informacion para revision/`. La Espirometría sí puede validarse contra PDF real; debe repetirse el fixture y la evidencia sin inventar ni usar el PNG como fuente principal.
- **Supersede:** DG-1 del `LOTE-20260820-01` sólo en lo relativo a disponibilidad del PDF; DG-3 (XLSX sin hoja espirometría) permanece abierto.
- **Siguiente paso:** validar extracción real sobre este PDF y comparar las 9+ filas/columnas contra la fuente; mantener la calibración sin publicar hasta QA.

## FND-20260821-03 — E2E real de Espirometría extrae datos pero no activa Minimax ni prediagnóstico

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** Playwright sobre el expediente `8af728bf-f572-47c3-94b7-31aa9916a4b8`, usando `context/RD2026/ESPIROMETRIA.pdf`. La extracción real terminó y mostró referencia, paciente, condiciones, 10 filas y M1/M2/M3/%REF; la UI reportó “Extrayendo datos con Gemini”, no MiniMax. El prediagnóstico terminó `AI_NON_CONCLUSIVE` con “Parámetros mínimos faltantes: fev1, fvc”, aunque el snapshot visual contiene filas `FEV1` y `FVC`.
- **Hallazgo:** el expediente consume la configuración legacy/no publicada y el contrato runtime de criterios no está mapeando las claves extractivas (`fev1_l`/`fvc_l` o `parametros[]`) a los mínimos clínicos `fev1`/`fvc`.
- **Impacto:** la extracción documental funciona, pero no se prueba MiniMax ni se genera prediagnóstico clínico para Espirometría; publicar V3 sin corregir esta paridad produciría una experiencia incompleta.
- **Relación:** DEC-20260820-01/03/04, FND-20260820-05, SPEC_ARCH-20260516-12, FIX-20260812-20.
- **Siguiente paso:** DEBY/INTEGRA deben aislar provider efectivo y corregir el mapeo de criterios; después repetir E2E en entorno de prueba antes de publicar V3.

## FND-20260824-01 — El expediente de prueba usado no corresponde al PDF cargado

- **Estado:** confirmed
- **Severidad:** P1
- **Evidencia:** El expediente `8af728bf-f572-47c3-94b7-31aa9916a4b8` pertenece a Olvera/Jorge, mientras `context/RD2026/ESPIROMETRIA.pdf` corresponde a Peña Patricia Marbella. El E2E técnico cargó ese PDF en el expediente de Olvera.
- **Impacto:** La prueba técnica de MiniMax es válida como smoke de pipeline, pero el resultado no debe considerarse clínico ni permanecer asociado a ese expediente.
- **Acción requerida:** retirar/limpiar el archivo y análisis de prueba del expediente, con autorización explícita por tratarse de una eliminación de datos de producción; repetir la validación sólo con un documento cuyo paciente corresponda al expediente o en entorno de prueba.

## FND-20260824-02 — La UI muestra el error técnico crudo ante tipo de estudio incorrecto

- **Estado:** confirmed
- **Severidad:** P1 UX/operativa
- **Evidencia:** Al cargar `ESPIROMETRIA.pdf` dentro de `AUDIOMETRIA`, la pantalla muestra “Respuesta de M3 no es JSON válido” y el contenido del rechazo del modelo, aunque el sistema sí detectó el conflicto de modalidad.
- **Impacto:** El usuario no recibe una instrucción accionable y se expone detalle técnico/prompt del proveedor.
- **Acción:** clasificar el error como `STUDY_TYPE_MISMATCH` y mostrar estudio seleccionado, tipo detectado y acción para corregir; conservar detalle sólo en auditoría segura.
- **Relación:** DEC-20260824-01, FND-20260824-01, FND-20260821-03.

## FND-20260824-03 — Events extrae criterios clínicos de Espirometría pero no los presenta antes del prediagnóstico

- **Estado:** candidate
- **Severidad:** P1 UX/funcional
- **Evidencia:** `context/lote-nocturno-20260820-01/extraction-espirometria-rd2026.json` contiene en `extracted_data.calidad` los criterios `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`, `tiempo`, repetibilidad menor a 200 ml, `pruebas_aceptables`, `criterios_para_dx`, `calidad` y repetibilidad numérica FVC/FEV1. El renderer vigente (`frontend/src/components/clinical/extraction-presentation-schemas.ts`) sólo presenta parte de `calidad` y no presenta esos campos ni `fuente_texto_crudo`.
- **Impacto:** el médico no ve en Events la información posterior a las gráficas que sí aparece en el PDF clínico de AMI; debe consultar el archivo original y el prediagnóstico queda visualmente separado de la evidencia clínica fuente.
- **Solicitud funcional de Frank:** mostrar esos valores calculados/transcritos en una sección inmediatamente encima de “Prediagnóstico IA” y mantener siempre desplegados “Justificación”, “Limitaciones” y “Fuentes clínicas”.
- **Límite:** no promover la impresión diagnóstica ni recomendaciones del médico como diagnóstico IA; deben conservar su carácter de texto fuente y revisión médica.
- **Archivos afectados preliminares:** `frontend/src/components/clinical/PapeletaWorkspace.tsx`, `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`, `frontend/src/components/clinical/extraction-presentation-schemas.ts`, contrato de extracción/presentación de Espirometría.
- **Relación:** FND-20260821-02, FND-20260821-03, DEC-20260820-01, SPEC_ARCH-20260820-01.

## FND-20260825-01 — El entregable validado debe reutilizarse para casi todos los Events

- **Estado:** confirmed
- **Severidad:** P1 arquitectura funcional
- **Evidencia:** Frank indicó que el entregable actual, una vez probado, se aplicará a casi todos los Events; citó Audiometría como siguiente ejemplo.
- **Hallazgo:** El patrón no debe quedar diseñado como una solución exclusiva de Espirometría. Debe existir un entregable común por estudio/evento, con información, criterios, presentación y documento final particulares de cada tipo de prueba.
- **Impacto:** Una implementación acoplada a campos o componentes exclusivos de Espirometría generaría duplicación y dificultaría extender el flujo a Audiometría, Examen Médico, laboratorios, imagen y otros estudios.
- **Relación:** FND-20260820-04, BR-20260820-01, BR-20260819-01.

## FND-20260825-02 — El bloque de cuenta debe ofrecer acceso directo al perfil

- **Estado:** candidate
- **Severidad:** P2 UX
- **Evidencia:** Frank observó que el nombre del usuario aparece en el bloque `Cuenta` de la sesión, pero el perfil médico sólo está disponible como entrada separada del menú lateral.
- **Impacto:** El usuario puede no encontrar dónde editar nombre, cédula y firma después de iniciar sesión.
- **Propuesta reversible:** convertir el bloque de cuenta en enlace a `/profile` únicamente para `SUPERADMIN`, `DOCTOR_GENERAL` y `DOCTOR_VALIDATOR`, que son los roles autorizados por la página de perfil; conservarlo como bloque no navegable para los demás roles.

## FND-20260825-03 — La persistencia documental debe abarcar fuente y entregable

- **Estado:** confirmed / deferred
- **Severidad:** P2 producto e infraestructura
- **Evidencia:** Frank indicó que la persistencia de PDFs puede resolverse más adelante, pero que la solución deberá conservar también el PDF de la prueba usado por el Event.
- **Hallazgo:** Persistir únicamente el PDF validado sería incompleto; se requiere una relación histórica entre documento fuente, revisión médica y entregable final.
- **Impacto:** La decisión afecta almacenamiento, retención, acceso, trazabilidad e inmutabilidad de documentos.
- **Límite actual:** No diseñar ni provisionar ahora esa infraestructura; queda como incremento posterior.

## FND-20260825-04 — Audiometría requiere análisis de cuatro familias documentales antes de construir

- **Estado:** confirmed / discovery abierto
- **Severidad:** P1 alcance y contrato clínico
- **Evidencia:** Frank indicó que entregará individualmente el documento generado por el audiómetro, el documento final enviado, el cuestionario de Audiometría y el documento/tabla de valores de acuerdo.
- **Hallazgo:** El proceso operativo puede ser común a Espirometría, pero el contrato clínico y documental de Audiometría no está cerrado hasta comparar esos cuatro insumos.
- **Impacto:** Los documentos definirán extracción, presentación, criterios, recomendaciones y contenido del PDF validado.
- **Límite:** No implementar ni construir artefactos hasta recibir y analizar todos los insumos y resolver las dudas necesarias.

## FND-20260825-05 — Documento de salida del audiómetro: audiograma tonal con curvas bilaterales

- **Estado:** confirmed / discovery
- **Fuente:** imagen entregada por Frank el 2026-08-25, identificada visualmente como `Audiograma Tono Puro 18/03/2025`.
- **Observaciones visibles:**
  - Encabezado con paciente `MARBELLA, PERA PATRICIO`, organización `AMI` y texto `NVO ING`.
  - Sección de metadatos con fecha de nacimiento visible `15/09/1990` y fecha de la acción visible `18/03/2025`.
  - Dos audiogramas separados: oído derecho en rojo y oído izquierdo en azul.
  - Eje horizontal de frecuencias y eje vertical de intensidad en dB; las curvas muestran múltiples puntos por oído.
  - Existe una sección lateral de resumen/indicadores del estudio y una gráfica inferior adicional, aparentemente destinada a otro tipo de medición o registro; su semántica exacta no se confirma con esta resolución.
  - Se observa una nota de audiograma hablado con fecha `18/03/2025`.
- **Valor para el contrato:** Este documento es principalmente una fuente gráfica de umbrales por oído/frecuencia, no necesariamente el formato final que recibirá el médico o el cliente.
- **Riesgo de extracción:** La imagen recibida no permite leer con seguridad todas las coordenadas ni textos pequeños de las tablas/resúmenes. No se deben inferir valores exactos desde esta vista; se requiere PDF original, exportación nativa o imagen de mayor resolución para validar frecuencias, símbolos, vía aérea/ósea y PTA.
- **Preguntas abiertas para comparar con los siguientes insumos:** frecuencias canónicas exactas, si incluye vía aérea y vía ósea, significado de la gráfica inferior, reglas de interpretación del software y correspondencia con el documento final AMI.

## FND-20260825-06 — Documento final AMI de Audiometría: resultado clínico y recomendación

- **Estado:** confirmed / discovery
- **Fuente:** `/context/RD2026/AUDIOMETRIA.pdf`, entregado por Frank el 2026-08-25.
- **Identificación:** `ESTUDIO DE AUDIOMETRIA`; paciente `MARBELLA, PEÑA PATRICIO`; AMI / `NVO ING`; fecha de nacimiento `15/09/1990`; fecha de la acción `18/03/2025`; creado por `PRADO`.
- **Datos cuantitativos de la tabla final:**
  - OD: 500 Hz `0`, 1000 Hz `5`, 2000 Hz `0`, 3000 Hz `10`; pérdida por oído `3.00%`; hipoacusia bilateral combinada `2.1300%`.
  - OI: 500 Hz `0`, 1000 Hz `5`, 2000 Hz `0`, 3000 Hz `5`; pérdida por oído `2.00%`.
  - La tabla final sólo documenta 4 frecuencias por oído: 500/1000/2000/3000 Hz.
- **Datos clínicos documentales:** descripción audiométrica `UMBRAL DE AUDICION BILATERAL DENTRO DE RANGO NORMAL`; faringe `Sin datos patológicos`; CAD y CAI `permeable`; MTD y MTI `íntegra, aspecto normal`.
- **Diagnóstico/recomendación fuente:** diagnóstico nosológico derecho e izquierdo `Audición Normal`; diagnóstico etiológico derecho e izquierdo `Audición Normal`; clasificación de hipoacusia `No Aplica`; recomendación `Audiometría de seguimiento anual`.
- **Profesional fuente:** `ERIKA RODRIGUEZ LOPEZ`, cédula `4039862`, con firma visible.
- **Estructura visual adicional:** incluye dos audiogramas tonales por oído con curvas, PTA visible (`5` OD, `4` OI), audiograma hablado sin valores aparentes y los bloques clínicos/documentales del resultado final.
- **Regla para el futuro entregable:** el sistema debe extraer y presentar la información fuente, pero el diagnóstico y la recomendación generados por IA no deben copiar automáticamente estos textos; deben producirse como interpretación derivada y quedar sujetos a revisión/aceptación médica, igual que Espirometría.
- **Riesgo de comparación:** el documento fuente gráfico anterior y este documento final muestran estructuras distintas; la tabla final contiene 4 frecuencias y debe tratarse como fuente explícita de valores, sin inventar 250/4000/6000/8000 Hz.

## FND-20260825-07 — Cuestionario de antecedentes auditivos y exploración física

- **Estado:** confirmed / discovery
- **Fuente:** imagen entregada por Frank el 2026-08-25.
- **Ubicación funcional prevista:** mismo punto del flujo que el cuestionario de Espirometría: captura de contexto clínico del `EventTest` antes de extracción/prediagnóstico, visible para el médico junto con la evidencia y disponible para alimentar el contexto de interpretación; no sustituye los valores extraídos del audiograma.
- **Bloque Antecedentes Auditivos:**
  1. Audiometría previa: sí/no y cuándo.
  2. Dificultad para oír: sí/no.
  3. Tres últimos lugares donde laboró y tiempo en cada uno.
  4. Pasatiempos/exposición recreativa: cacería, música con audífonos u otros; frecuencia; y, si usa audífonos, volumen habitual.
  5. Exposición a explosión, neumáticos/detonación de arma o golpe en la cabeza: sí/no y cuándo.
  6. Infecciones frecuentes de garganta u oídos: sí/no.
  7. Zumbido de oídos o mareos frecuentes: sí/no.
  8. Medicamentos por más de 15 días —ejemplos visibles: gentamicina, amikacina, aspirina, estreptomicina— y cuál medicamento.
- **Bloque Exploración Física:** faringe; CAD con MT; CAI con MT.
- **Metadatos/consentimiento:** cuestionario elaborado por; audiometría realizada por; Patient ID Symphony; declaración de lectura y entendimiento de la información acerca del sonoaudiograma de la cabina.
- **Impacto:** el modelo de datos debe preservar respuestas estructuradas y texto de seguimiento, diferenciando antecedentes declarados, exploración física y metadatos; no convertir una respuesta afirmativa en diagnóstico.
- **Preguntas abiertas:** confirmar si “neumáticos o detonación de un arma” corresponde literalmente al formato original o si la etiqueta debe normalizarse; confirmar si `Patient ID Symphony` se captura manualmente o se deriva del Event/paciente autenticado.

## FND-20260825-08 — Programa AMI define criterios de interpretación audiométrica

- **Estado:** confirmed / discovery
- **Fuente:** `context/datos AMI/informacion para revision/PROGRAMA PARA REALIZAR AUDIOMETRÍA.docx`, analizado el 2026-08-25.
- **Flujo operativo fuente:** enfermería realiza la Audiometría, selecciona Audiometría en la papeleta del paciente dentro de SIM, carga el formato, guarda y después se abre la pestaña de interpretación.
- **Lectura gráfica:** rojo = oído derecho; azul = oído izquierdo; vertical = decibeles; horizontal = Hertz. El documento clasifica graves desde 1000 hacia 125 Hz y agudos desde 1000 hacia 8000 Hz.
- **Diagnóstico nosológico:**
  - Conductiva: caída en frecuencias graves 250/500/1000 Hz.
  - Neurosensorial: caída en frecuencias medias/agudas 2000/3000/4000/6000/8000 Hz.
  - Mixta: caída en graves, medias y agudas.
  - También contempla Audición normal y Datos de fatiga auditiva.
- **Diagnóstico etiológico:** Audición normal; secundario a trauma acústico crónico por ruido; secundario a presbiacusia; probable afección de vías respiratorias altas; etiología a determinar.
- **Clasificación de hipoacusia:** No aplica, leve, moderada, moderadamente grave, grave y profunda.
- **Rangos documentados:** leve 30–40 dB; moderada 45–55 dB; moderadamente severa 60–70 dB; severa 75–90 dB; profunda ≥95 dB.
- **Impacto técnico:** estos criterios deben vivir en la calibración/contrato de Audiometría y alimentar una interpretación derivada; el sistema no debe copiar el diagnóstico final del PDF como si fuera resultado propio.
- **Riesgos y preguntas bloqueantes:** el documento no define explícitamente normalidad ni los intervalos 41–44, 56–59, 71–74 y 91–94 dB; “moderadamente grave” y “moderadamente severa” aparecen con nomenclatura distinta; 1000 Hz es frontera compartida entre graves y agudos; falta confirmar si la clasificación se determina por peor umbral, PTA, patrón por grupo de frecuencias u otra regla AMI.
- **Decisiones recibidas de Frank:** combinación de patrón y PTA/criterio AMI; huecos de rangos como no concluyentes; 1000 Hz como frecuencia frontera sin duplicación en cálculos.

## FND-20260825-09 — Segundo ejemplo AMI con PTA y pérdida por oído

- **Estado:** confirmed / discovery
- **Fuente:** imagen entregada por Frank el 2026-08-25, paciente `JOSE EDUARDO, QUINTANAR SANTOS`, puesto/área visible `MACLEAN / PINTURA 3 AÑOS 11 MESES`.
- **Metadatos visibles:** Audiograma Tono Puro `20/04/2026`; nacimiento `11/12/1986`; fecha de acción `20/04/2025` según la imagen; creado por `UMM`.
- **Gráficas:** oído derecho rojo y oído izquierdo azul; el equipo se identifica como `AUDIOMETRÍA AUTOMÁTICA, DD65 V2`; incluye audiograma hablado con fecha `20/04/2026`.
- **Tabla fuente:**
  - OD: 500 Hz `5`, 1000 Hz `5`, 2000 Hz `20`, 3000 Hz `35`; pérdida por oído `13.00%`; hipoacusia bilateral combinada `13.5000%`; PTA visible `14`.
  - OI: 500 Hz `20`, 1000 Hz `10`, 2000 Hz `25`, 3000 Hz `30`; pérdida por oído `17.00%`; PTA visible `21`.
- **Exploración:** faringe sin datos patológicos; CAD/CAI permeables; MTD/MTI íntegras, aspecto normal.
- **Observación:** este ejemplo confirma que la tabla final puede contener sólo 4 frecuencias aunque las gráficas muestren más puntos, y que el documento puede incluir PTA y porcentajes sin mostrar todavía diagnóstico/recomendación en la imagen entregada.
- **Riesgo pendiente:** confirmar si la fecha de acción `20/04/2025` es realmente 2025 o si la imagen debe leerse como 2026; no corregir automáticamente inconsistencias de fecha.
- **TA/VO:** en audiometría normalmente `TA` refiere a tonos/audiometría por vía aérea y `VO` a vía ósea; se debe confirmar con los dos ejemplos adicionales antes de fijar el significado en el contrato.

## FND-20260825-10 — Escala visual AMI confirma normalidad hasta 25 dB

- **Estado:** confirmed / discovery
- **Fuente:** captura entregada por Frank el 2026-08-25 con la escala gráfica AMI.
- **Confirmación funcional:** la zona verde del audiograma representa `Audición Normal` hasta 25 dB; después aparecen las zonas de pérdida leve, moderada, moderadamente severa, severa y profunda.
- **Rangos visibles:** leve 30–40 dB; moderada 45–55 dB; moderadamente severa 60–70 dB; severa 75–90 dB; profunda 95–120 dB en la escala mostrada.
- **TA/VO:** Frank confirmó que las etiquetas corresponden a vía aérea y vía ósea, respectivamente.
- **Normativa consultada:** la NOM-011-STPS-2001 exige como mínimo exploración aérea de 125–8000 Hz y ósea de 250–6000 Hz, pero la fuente oficial localizada no establece una fórmula única de PTA ni resuelve todos los huecos de la escala AMI.
- **Implicación:** normalidad `≤25 dB` queda confirmada por AMI; la fórmula de PTA debe documentarse como regla clínica adoptada y no atribuirse automáticamente a la NOM-011 si ésta no la prescribe.
- **Decisión posterior:** se adoptará `PTA3 = (500 + 1000 + 2000) / 3` y se conservará el PTA fuente del audiómetro/AMI por separado.
- **Decisión adicional:** NOM-011, AMI y fuente del audiómetro deberán aparecer como capas explícitamente etiquetadas, sin fusionar sus criterios.

## FND-20260825-11 — El cuestionario renderiza campos administrativos redundantes

- **Estado:** confirmed / IMPLEMENTATION_DEFECT
- **Evidencia:** captura de producción entregada por Frank el 2026-08-25; el modal muestra `Patient ID del formato`, consentimiento, responsable de captura y responsable médico.
- **Hallazgo:** esos campos pertenecen al formato documental de AMI, pero no deben solicitarse nuevamente en el cuestionario clínico del Event porque duplican información de papeleta/sesión y agregan fricción.
- **Corrección requerida:** retirar campos de UI, payload y schema; mantener sólo antecedentes auditivos, exploración física y observaciones.
- **Referencia:** DEC-20260825-08, BR-20260825-09.

## FND-20260825-12 — El panel muestra el umbral AMI pero no el criterio completo visible

- **Estado:** confirmed / IMPLEMENTATION_DEFECT
- **Evidencia:** captura de producción entregada por Frank el 2026-08-25; el panel muestra la etiqueta `AMI criterio audiométrico` y `NORMAL (≤25 dB)`, pero no expone de forma legible el conjunto de criterios AMI del programa (patrones nosológicos, rangos de severidad y categorías etiológicas).
- **Hallazgo:** La lógica parcial existe, pero la referencia clínica que permite auditar por qué se obtuvo el resultado quedó oculta o incompleta en la interfaz.
- **Corrección requerida:** mostrar una sección explícita de `Criterio audiométrico AMI` con normalidad, patrones por frecuencias, rangos de severidad y categorías etiológicas como referencia; separar el resultado derivado de cualquier diagnóstico médico final.
- **Referencia:** FND-20260825-08, BR-20260825-05, SPEC-FEATURE-20260825-02.

## FND-20260825-13 — La referencia AMI debe colapsarse en la interfaz clínica

- **Estado:** candidate / UX
- **Evidencia:** Frank observó que las tablas completas del criterio AMI ocupan demasiado espacio vertical cuando se muestran desplegadas en el panel.
- **Propuesta:** renderizar `Criterio audiométrico AMI (referencia)` dentro de un acordeón cerrado por defecto; conservar el contenido completo disponible al expandir. El PDF mantiene la referencia completa desplegada por trazabilidad documental.

## FND-20260825-14 — La referencia AMI sobra en el PDF validado

- **Estado:** confirmed / UX
- **Evidencia:** Frank confirmó el 2026-08-25 que la sección IV no es necesaria en el PDF.
- **Decisión:** retirarla del PDF, manteniéndola sólo en el panel clínico como referencia consultable.
