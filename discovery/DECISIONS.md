# Decisions

## DEC-20260819-01 — Dictámenes por prueba antes del consolidado

- **Estado:** confirmed
- **Fecha:** 2026-08-19
- **Pregunta:** ¿Cómo debe presentar Impresión y Aptitud los resultados de una atención con una o varias pruebas?
- **Opciones consideradas:**
  1. Un único texto de impresión diagnóstica que mezcle todo.
  2. Un dictamen independiente por prueba y un dictamen general consolidado.
- **Decisión de Frank:** Cada prueba conserva un dictamen independiente, un resumen pequeño y su descargable. Al final existe un dictamen general consolidado, sin importar cuántas pruebas se realizaron.
- **Razón:** El médico necesita consultar toda la evidencia individual antes de determinar la aptitud laboral, sin perder trazabilidad clínica.
- **Consecuencias:**
  - Impresión y Aptitud debe mostrar tarjetas por prueba.
  - El Examen Médico es una prueba independiente.
  - El dictamen integrado no reemplaza ni mezcla los dictámenes individuales.
  - Debe existir descarga individual por prueba y ZIP final con todo el lote disponible.
- **Confirmación:** Frank, 2026-08-19.
- **Referencias:** BR-20260819-01, FLOW-20260819-01, FND-20260819-01.

## DEC-20260819-02 — Mantener Impresión y Aptitud anidada bajo Examen Médico hasta revisión AMI

- **Estado:** confirmed
- **Fecha:** 2026-08-19
- **Pregunta:** ¿Debe moverse ahora Impresión y Aptitud a nivel de atención para soportar perfiles sin Examen Médico?
- **Decisión de Frank:** No cambiar la ubicación actual. Mantener Impresión y Aptitud bajo Examen Médico y esperar la revisión clínica con AMI.
- **Razón:** La política clínica para perfiles sin Examen Médico aún no está confirmada.
- **Consecuencias:**
  - No se implementa navegación global de Resultados y Dictamen.
  - FND-20260819-02 queda sin resolución técnica.
  - OQ-20260819-04 se difiere hasta revisión AMI.
- **Confirmación:** Frank, 2026-08-19.
- **Referencias:** FND-20260819-02, OQ-20260819-04.

## DEC-20260819-03 — Validar tarjetas por prueba con papeletas de muestra antes de cerrar entregables

- **Estado:** confirmed
- **Fecha:** 2026-08-19
- **Decisión de Frank:** Antes de definir definitivamente los entregables de Audiometría y Espirometría desde extracción, mostrar dentro de Impresión y Aptitud tres tarjetas: Examen Médico, Audiometría y Espirometría.
- **Uso de muestras:** Las papeletas disponibles sirven como referencia de layout, resumen y dictamen individual; no se persisten como información clínica del paciente ni se descargan como documentos finales.
- **Razón:** Frank revisará la interfaz visual y pedirá correcciones antes de conectar resultados reales, extracción y descargables definitivos.
- **Consecuencias:**
  - El consolidado final y ZIP quedan en espera de esa revisión visual.
  - Cada tarjeta debe identificar claramente si es una vista de muestra.
  - La implementación requiere SPEC técnica y prototipo UI antes de derivar datos clínicos reales.
- **Confirmación:** Frank, 2026-08-19.
- **Referencias:** DEC-20260819-01, FND-20260819-01.

## DEC-20260820-01 — Calibración como fuente única de comportamiento por prueba

- **Estado:** confirmed
- **Fecha:** 2026-08-20
- **Decisión de Frank:** Toda configuración de extracción, interpretación clínica y presentación de una prueba debe ajustarse y verificarse dentro del módulo de Calibración. Events debe consumir esa configuración sin reglas clínicas duplicadas o hardcodeadas que la contradigan.
- **Resultado esperado:** Lo aprobado en Calibración debe producir en Events la misma extracción, el mismo prediagnóstico y la misma presentación clínica.
- **Razón:** Evitar redeploys y cambios de código para ajustar qué datos se extraen, qué información se muestra y qué resultado clínico se sugiere por cada prueba.
- **Consecuencias:**
  - Calibración debe gobernar activación, tipo canónico, campos esperados, criterios mínimos, prompts, umbrales y presentación.
  - El modo de prueba debe reproducir la experiencia real de Events.
  - Events debe consumir una versión publicada de calibración y conservar trazabilidad de la versión utilizada.
  - Los fallbacks hardcodeados solo pueden existir como contingencia explícita y visible, no como fuente primaria silenciosa.
  - La UI estructural de Events no se rediseña: navegación, tabs y flujo permanecen iguales. Solo cambia la visualización de resultados cuando la calibración publicada define otro contenido, orden o sección.
  - El preview de Calibración debe usar el mismo renderer clínico y el mismo contrato de presentación que Events.
- **Confirmación:** Frank, 2026-08-20.
- **Referencias:** FND-20260820-01, FND-20260820-02, FND-20260820-03, BR-20260820-01.

## DEC-20260820-02 — Solo las pruebas que lo necesitan tienen calibración IA

- **Estado:** confirmed
- **Fecha:** 2026-08-20
- **Decisión de Frank:** Las pruebas o servicios que no requieren extracción documental, operaciones clínicas ni prediagnóstico IA no deben tener configuración de Calibración IA. Ejemplo: ambulancias y servicios operativos.
- **Clasificación funcional:**
  1. `manual_service`: captura operativa/manual, sin calibración IA.
  2. `document_extraction`: requiere extracción configurable, con calibración básica.
  3. `clinical_interpretation`: requiere extracción, criterios, operaciones, prediagnóstico y presentación; con calibración completa.
- **Consecuencias:**
  - Ambulancias, consultas, vacunas y servicios similares no muestran editor de calibración IA.
  - No se debe usar ningún default silencioso como `Audiometria` para una prueba sin calibración.
  - El catálogo debe mostrar claramente el modo operativo de cada entrada.
  - La calibración completa se reserva para Audiometría, Espirometría, Examen Médico, ECG, laboratorios interpretables e imagen cuando aplique.
- **Confirmación:** Frank, 2026-08-20.

## DEC-20260824-02 — Orden clínico del Prediagnóstico IA de Espirometría

- **Estado:** confirmed
- **Fecha:** 2026-08-24
- **Decisión de Frank:** En `Prediagnóstico IA`, mostrar primero el hallazgo sugerido y las recomendaciones sugeridas para el paciente, contextualizadas con el patrón, la calidad y el entorno ocupacional. Después mantener Justificación clínica y Fuentes clínicas desplegadas.
- **Orden:** `Hallazgo sugerido → Recomendaciones sugeridas → Limitaciones → Justificación clínica → Fuentes clínicas`.
- **Límites:** Las recomendaciones son sugerencias de apoyo; no sustituyen indicación médica, diagnóstico definitivo ni dictamen de aptitud. La impresión escrita por el médico permanece como fuente independiente.
- **Razón:** El médico necesita primero una orientación accionable y después la evidencia que permite revisarla y validarla.
- **Referencias:** DEC-20260820-01, BR-20260824-01, BR-20260824-02.

## DEC-20260824-03 — Cuestionario de Espirometría mínimo y predominantemente seleccionable

- **Estado:** confirmed
- **Fecha:** 2026-08-24
- **Decisión de Frank:** El cuestionario no duplicará datos personales ni laborales que ya existen en la papeleta del paciente. Se asociará al estudio de Espirometría y reutilizará esos datos como contexto.
- **Interacción:** Las preguntas deben resolverse principalmente con controles de selección (`No`, `Sí`, `No aplica`, rangos o catálogos). La escritura libre se limitará a `Otro` y observaciones opcionales.
- **Objetivo:** Reducir errores de captura y carga operativa del usuario.
- **Regla:** Las preguntas condicionales sólo muestran sus campos complementarios cuando la respuesta lo requiere; los campos no aplicables se guardan como `null`/no aplicable, no como texto ambiguo.
- **Referencias:** imagen `context/datos AMI/informacion para revision/CUESTIONARIO PARA AUDIOMETRIA Y ESPIROMETRIA.xls` y `DEC-20260824-02`.
- **Referencias:** DEC-20260820-01, FND-20260820-04.

## DEC-20260820-03 — Publicación V3 visible desde Calibración

- **Estado:** confirmed
- **Fecha:** 2026-08-20
- **Decisión de Frank:** Continuar con el cableado del editor V3 en la pantalla de Calibración para que un administrador pueda guardar `draft/tested` y publicar explícitamente una versión `published`.
- **Alcance funcional:** Mantener la ruta y tabs actuales; añadir el flujo visible de edición/publicación V3 sin eliminar el fallback legacy V1/V2. `manual_service` no muestra editor IA. Publicar requiere el rol definido por el contrato vigente.
- **Resultado esperado:** Desde `Admin → Servicios → Calibración IA`, el usuario puede identificar el estado V3, guardar el draft/test y publicar; Events consume esa versión publicada.
- **Fuera de alcance:** No cambiar la navegación de Events, no eliminar hardcodeos restantes, no crear catálogo FamilyTemplate y no aplicar migraciones adicionales.
- **Confirmación:** Frank, 2026-08-20.
- **Referencias:** DEC-20260820-01, DEC-20260820-02, SPEC_ARCH-20260820-01 §14 Fase 2/3.

## DEC-20260820-04 — Lote nocturno de validación Audio-Espiro

- **Estado:** confirmed
- **Fecha:** 2026-08-20
- **Decisión de Frank:** Autorizar un lote nocturno para preparar y validar Audiometría y Espirometría contra los documentos reales AMI y los valores de referencia proporcionados, usando Playwright y evidencias reproducibles.
- **Alcance:** calibraciones V3 en `draft/tested`, ejecución de casos reales, revisión de valores extraídos, calidad/completitud, prelectura asistida, renderer clínico y trazabilidad; documentar gaps y evidencia QA.
- **Límite:** no publicar cambios clínicos en producción automáticamente; la IA no emite diagnóstico final ni aptitud.
- **Pendiente operativo:** registrar en `PROYECTO.md` el `loteId`, permisos, inicio y expiración antes de iniciar el lote nocturno.
- **Referencias:** DEC-20260820-01, DEC-20260820-03, FND-20260820-05, SPEC_ARCH-20260513-01, SPEC_ARCH-20260516-07, SPEC_ARCH-20260516-12, FIX-20260812-20.

## DEC-20260824-01 — Mensaje claro ante documento de estudio incorrecto

- **Estado:** confirmed
- **Fecha:** 2026-08-24
- **Decisión de Frank:** Sustituir el error técnico crudo de MiniMax/M3 por un mensaje clínico-operativo claro cuando el archivo no corresponde al estudio seleccionado.
- **Resultado esperado:** indicar el estudio seleccionado, el tipo detectado si es confiable y la acción concreta; por ejemplo: “Seleccionaste Audiometría, pero el documento parece ser Espirometría. Abre Espirometría y vuelve a cargar el archivo.” No mostrar HTML, prompt, respuesta del modelo ni stack técnico.
- **Límite:** no ocultar errores de proveedor no relacionados; conservar trazabilidad técnica en auditoría/log seguro sin PII ni secretos.
- **Referencia:** FND-20260824-02 (documento incorrecto en estudio), FND-20260821-03.

## DEC-20260825-01 — Posponer la persistencia definitiva de documentos

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión de Frank:** La persistencia durable de los PDFs generados queda para una fase posterior. Esa fase deberá incluir también la conservación fija del PDF fuente utilizado por cada Event.
- **Alcance diferido:** almacenamiento persistente del documento original, PDF validado por prueba, relación entre ambos, retención, acceso y recuperación histórica.
- **Alcance actual:** Espirometría puede generar y descargar el PDF validado mediante el mecanismo temporal vigente; no se amplía ahora la infraestructura de documentos.
- **Razón:** La solución definitiva debe resolver conjuntamente fuente y entregable, evitando conservar sólo el PDF final y perder el archivo clínico que lo originó.
- **Referencia:** BR-20260825-02, FND-20260825-03.

## DEC-20260825-02 — Analizar Audiometría completa antes de implementar

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión de Frank:** Audiometría reutilizará el mismo proceso general de Espirometría, pero se analizarán por separado el documento que sale del audiómetro, el documento final enviado, el cuestionario aplicable y la tabla/documento de valores de acuerdo.
- **Secuencia:** Frank entregará los documentos uno por uno; ATLAS analizará cada insumo, registrará hallazgos y aclarará contradicciones o preguntas antes de construir.
- **Restricción:** no escribir código, no publicar calibración y no iniciar implementación hasta contar con el conjunto de insumos y Discovery cerrado.
- **Resultado esperado:** una sola SPEC completa de Audiometría y una única pasada de implementación, con el flujo común separado de los datos, reglas y documento propios del estudio.
- **Referencia:** BR-20260825-03, FND-20260825-04.

## DEC-20260825-03 — Reglas de interpretación pendientes definidas por Frank

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Clasificación:** Audiometría usará una combinación del patrón por frecuencias y PTA/criterio AMI, no una única métrica aislada.
- **Rangos no documentados:** los valores que caigan en huecos entre rangos AMI se marcarán como no concluyentes y pasarán a revisión; no se asignarán silenciosamente al rango superior o inferior.
- **Frecuencia frontera:** 1000 Hz se modelará como frecuencia frontera entre graves y agudos; puede participar en la lectura de ambos grupos sin duplicarse en cálculos.
- **Referencia:** BR-20260825-04, FND-20260825-08.

## DEC-20260825-04 — Normalidad y nomenclatura confirmadas por AMI

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión:** usar `≤25 dB` como zona de audición normal según la escala AMI entregada.
- **Nomenclatura:** `TA` representa vía aérea y `VO` representa vía ósea.
- **Referencia normativa:** consultar NOM-011-STPS-2001 para cobertura mínima de frecuencias; no afirmar que la NOM fija la fórmula PTA mientras no exista evidencia textual oficial.
- **Referencia:** BR-20260825-05, FND-20260825-10.

## DEC-20260825-05 — PTA estándar reproducible más PTA fuente

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión:** calcular un PTA clínico estándar de tres frecuencias por oído: `(500 + 1000 + 2000 Hz) / 3`.
- **Trazabilidad:** conservar y mostrar por separado el PTA reportado por el audiómetro/AMI como dato fuente, sin sustituirlo silenciosamente por el cálculo del sistema.
- **Razón:** la NOM-011-STPS-2001 consultada define frecuencias mínimas de exploración, pero no una fórmula PTA única; esta regla aporta reproducibilidad y mantiene el valor original.
- **Referencia:** BR-20260825-06, FND-20260825-10.

## DEC-20260825-06 — Separar criterios NOM, criterios AMI y valores fuente

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión:** La interpretación de Audiometría mostrará explícitamente tres capas de evidencia:
  1. criterios y frecuencias aplicables de la `NOM-011-STPS-2001`;
  2. criterios operativos de AMI provenientes del programa y escala entregados;
  3. valores reportados por el audiómetro/documento final, incluido su PTA fuente.
- **PTA:** el sistema calculará el PTA3 reproducible usando 500/1000/2000 Hz y lo identificará como cálculo clínico adoptado; no afirmará que la NOM prescribe esa fórmula porque la norma consultada no la define explícitamente.
- **Trazabilidad:** el PTA calculado y el PTA fuente se mostrarán separados, con su origen visible; una diferencia no se corregirá silenciosamente.
- **Referencia:** BR-20260825-06, FND-20260825-10.

## DEC-20260825-07 — Mostrar la ecuación PTA y sus valores de entrada

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión:** Igual que en Espirometría, el entregable de Audiometría mostrará la ecuación del PTA calculado, los valores de 500/1000/2000 Hz utilizados, el resultado y la fuente de la regla.
- **Presentación esperada:** `PTA3 = (TA500 + TA1000 + TA2000) / 3 = resultado`, acompañado de una leyenda que indique que es el cálculo clínico adoptado, separado del `pta_fuente` reportado por el audiómetro/AMI.
- **Referencia:** BR-20260825-08.

## DEC-20260825-08 — Eliminar metadatos redundantes del cuestionario

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión de Frank:** El cuestionario de Audiometría no debe capturar `Patient ID del formato`, consentimiento, responsable de captura ni responsable médico. Esos datos son redundantes para el flujo actual y no deben duplicarse en el contexto clínico.
- **Alcance:** conservar únicamente antecedentes auditivos, exploración física y observaciones clínicas necesarias; los datos personales/laborales y la identidad de usuarios provienen de la papeleta/sesión.
- **Supersede parcialmente:** `FND-20260825-07` en la sección de metadatos del formato y la versión inicial de la SPEC que incluía esos campos.
- **Referencia:** BR-20260825-09, FND-20260825-11.

## DEC-20260825-09 — Validar build de Vercel después de cada push

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión operativa de Frank:** Después de cada `push`, ejecutar una validación rápida del build/deployment en Vercel para confirmar que el commit no introdujo errores de compilación.
- **Alcance:** esta validación es un smoke técnico del build; no sustituye V3 funcional, Playwright ni la verificación de producto en producción.
- **Resultado esperado:** reportar commit, estado del build y error exacto si falla antes de continuar con otro incremento.
- **Referencia:** BR-20260825-10.

## DEC-20260825-10 — Retirar referencia AMI del PDF

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión de Frank:** La sección `Criterio audiométrico AMI (referencia)` se elimina del PDF validado y se conserva únicamente en el panel clínico, donde permanece disponible en acordeón.
- **Razón:** El PDF debe priorizar el resultado clínico validado y no crecer con tablas administrativas de referencia.
- **Referencia:** BR-20260825-11, FND-20260825-14.

## DEC-20260825-11 — Retirar criterios derivados del PDF

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión de Frank:** La sección III `Criterios audiométricos derivados` —PTA3, PTA fuente y patrón— también se elimina del PDF validado y se conserva en el panel clínico.
- **Razón:** El PDF final debe centrarse en evidencia documental, impresión diagnóstica y recomendación médica validada.
- **Referencia:** BR-20260825-12, FND-20260825-15.

## DEC-20260825-13 — Examen Médico se completa con el perfil clínico del paciente

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión de Frank:** El PDF de Examen Médico puede completarse con la información ya existente en el perfil clínico del paciente y los datos del Event; no se requiere otro documento funcional para cerrar el entregable.
- **Alcance:** reutilizar datos personales, laborales, antecedentes y resultados disponibles en el perfil clínico; agregar exploración, impresión, aptitud y recomendaciones conforme al documento final AMI.
- **Límite:** no duplicar captura de información que ya existe; validar origen, actualidad y pertenencia al paciente antes de incorporarla al PDF.
- **Referencia:** BR-20260825-14, FND-20260825-17.

## DEC-20260825-14 — Company Client no descarga PDF clínico completo

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión:** El PDF completo de Examen Médico sólo queda disponible para roles clínicos/autorizados. `COMPANY_CLIENT` no puede descargarlo; su portal conserva únicamente el dictamen de aptitud permitido.
- **Razón:** El PDF contiene antecedentes, toxicomanías, APP, gineco-obstetricia, exploración, firma y otros datos clínicos protegidos.
- **Referencia:** BR-20260825-15, FND-20260825-18.

## DEC-20260825-15 — Verificación humana antes de persistencias

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión de Frank:** Primero verificará el entregable de Examen Médico en el entorno publicado. Las persistencias definitivas se iniciarán sólo después de que confirme que el flujo funciona correctamente.
- **Secuencia:** verificación funcional de Frank → confirmación explícita → Discovery/SPEC de persistencias → implementación autorizada.
- **Límite:** no diseñar ni implementar persistencia documental adicional antes de esa confirmación.
- **Referencia:** BR-20260825-16.

## DEC-20260825-12 — Ruta rápida para cambios visuales menores

- **Estado:** confirmed
- **Fecha:** 2026-08-25
- **Decisión operativa de Frank:** Los cambios visuales menores, locales, reversibles y sin lógica de negocio, contrato, datos, auth o infraestructura no requieren el ciclo completo de análisis/delegación.
- **Ruta:** aplicar el delta mínimo directamente, ejecutar lint o test focal, y reportar; el build de Vercel se valida sólo después del push autorizado.
- **Exclusiones:** cualquier cambio que toque comportamiento clínico, schema, API, persistencia, permisos o arquitectura conserva el flujo completo.
- **Referencia:** BR-20260825-13.
