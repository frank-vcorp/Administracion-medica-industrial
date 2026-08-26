# Business Rules

## BR-20260819-01 — Separación y consolidación de dictámenes

- **Actor:** Médico evaluador.
- **Precondición:** La atención tiene una o más pruebas aplicables definidas por el perfil médico.
- **Evento:** El médico abre Impresión y Aptitud.
- **Resultado:** El sistema muestra un resumen y dictamen independiente por cada prueba aplicable, seguido del consolidado de aptitud laboral.
- **Excepción:** Una prueba marcada como no aplica no bloquea el consolidado y se identifica explícitamente como tal.
- **Reglas asociadas:**
  1. Cada dictamen independiente conserva su identidad y descargable.
  2. El dictamen general integra evidencia; no destruye ni reescribe el resultado de una prueba.
  3. La aptitud laboral es una decisión del médico, no un cálculo automático.
  4. El ZIP final contiene solo resultados individuales disponibles y el dictamen integrado cuando éste fue emitido.
  5. El dictamen integrado solo puede emitirse cuando las pruebas aplicables estén validadas o explícitamente marcadas no aplicables.
- **Evidencia:** Propuesta confirmada por Frank, 2026-08-19.
- **Escenario asociado:** SCN-20260819-01.

## BR-20260820-01 — Paridad obligatoria entre Calibración y Events

- **Actor:** Administrador/calibrador clínico y médico evaluador.
- **Precondición:** Existe una calibración publicada para el tipo de prueba.
- **Evento:** Se procesa un archivo de prueba en Calibración o un EventTest real.
- **Resultado:** Ambos flujos usan el mismo tipo canónico, campos esperados, criterios, prompts, umbrales y schema de presentación de la misma versión publicada.
- **Excepciones:**
  1. Si no existe calibración publicada, el sistema debe informar que la prueba requiere configuración o revisión manual; no debe aplicar silenciosamente reglas hardcodeadas de otra prueba.
  2. Un fallback de contingencia debe quedar identificado en trazabilidad y visible para el médico.
- **Reglas asociadas:**
  1. Desactivar calibración impide que esa calibración dispare IA en Events.
  2. Una prueba en modo calibración no genera EventTest ni datos clínicos del paciente.
  3. Publicar una versión nueva no cambia la representación histórica de snapshots ya emitidos.
  4. El calibrador debe poder verificar la misma vista clínica que verá Events antes de publicar.
- **Evidencia:** DEC-20260820-01 y auditoría FND-20260820-01/02/03.

## BR-20260824-01 — Repetibilidad de Espirometría calculada desde los dos mejores valores

- **Actor:** Sistema, para apoyo de revisión del médico ocupacional.
- **Precondición:** El reporte contiene valores FVC y FEV1 de al menos dos maniobras M1/M2/M3.
- **Evento:** Se carga y normaliza un reporte de Espirometría en Events.
- **Resultado:** El sistema ordena los valores de cada parámetro, toma los dos mayores y calcula su diferencia absoluta en ml.
- **Umbral:** La repetibilidad cumple cuando la diferencia es **menor o igual a 150 ml (0.15 L)**, conforme al criterio comunicado por AMI.
- **Salida para el PDF de prueba:** FVC `30 ml`, FEV1 `40 ml`, ambos cumplen repetibilidad.
- **Regla de seguridad:** No calcular con menos de dos valores válidos ni inventar criterios cualitativos no presentes en la fuente.
- **Evidencia:** Correo AMI “CRITERIOS DE REPETIBILIDAD”, imagen `context/datos AMI/informacion para revision/criterios repetitibilidad-espirometria.png`, confirmado por Frank el 2026-08-24.

## BR-20260825-01 — Entregable común con contenido particular por Event

- **Actor:** Sistema, administrador/calibrador clínico y médico evaluador.
- **Precondición:** Existe un tipo de estudio/Event con su información clínica, criterios y formato aplicables.
- **Evento:** Se procesa, valida y descarga el resultado de un Event.
- **Resultado:** El flujo común ofrece el mismo ciclo operativo —resultado, revisión médica, validación, trazabilidad y descargable— pero cada prueba aporta sus propios campos, reglas clínicas, presentación y contenido documental.
- **Aplicación:** La regla debe cubrir casi todos los Events; Audiometría es un ejemplo explícito además de Espirometría.
- **Restricciones:** No mezclar criterios entre estudios, no usar defaults silenciosos de otra prueba y no convertir los campos particulares de Espirometría en contrato universal.
- **Estado:** confirmed por instrucción de Frank, 2026-08-25.

## BR-20260825-02 — Persistencia futura conjunta de fuente y entregable

- **Regla:** Cuando se implemente la persistencia documental definitiva, cada Event deberá conservar el PDF fuente utilizado y el entregable PDF generado/validado asociado.
- **Estado actual:** Diferida; no bloquea el cierre funcional de Espirometría.
- **Restricción futura:** El entregable no debe quedar archivado sin su fuente clínica ni la fuente sin trazabilidad hacia el resultado generado.
- **Referencia:** DEC-20260825-01.

## BR-20260825-03 — Audiometría comparte proceso, no contenido clínico

- **Regla:** Audiometría utilizará el mismo ciclo operativo general validado en Espirometría —resultado, contexto, revisión médica, validación, trazabilidad y entregable— con documentos, cuestionario, valores de referencia, criterios y contenido propios.
- **Insumos requeridos:** documento de salida del audiómetro, documento final AMI, cuestionario de Audiometría y tabla/documento de valores de acuerdo.
- **Restricción:** no trasladar automáticamente campos, umbrales, criterios ni texto de Espirometría a Audiometría.
- **Estado:** confirmada por instrucción de Frank, 2026-08-25.

## BR-20260825-04 — Clasificación prudente según patrón, PTA y huecos AMI

- **Regla:** La severidad y clasificación audiométrica combinarán el patrón por grupos de frecuencias con PTA/criterio AMI; el algoritmo exacto deberá quedar explicitado en la SPEC.
- **Huecos:** Un umbral en un intervalo no definido por AMI (`41–44`, `56–59`, `71–74` o `91–94 dB`) produce estado no concluyente y requiere revisión médica.
- **Frontera:** `1000 Hz` es frontera entre graves y agudos; puede considerarse en ambos análisis, pero no duplicarse en ningún promedio.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-05 — Normalidad AMI hasta 25 dB y vías TA/VO

- **Regla:** La escala AMI considera audición normal hasta `25 dB`; los rangos superiores se interpretan conforme a la escala visual y al patrón clínico.
- **Nomenclatura:** `TA` = vía aérea; `VO` = vía ósea.
- **Norma:** La NOM-011-STPS-2001 se usará como referencia de frecuencias mínimas de exploración, no como fuente de una fórmula PTA no explícita en su texto.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-06 — PTA calculado y PTA fuente separados

- **Regla:** El sistema calculará por oído `PTA3 = (TA500 + TA1000 + TA2000) / 3` y conservará el PTA declarado por el equipo o documento final como `ptaFuente`.
- **Presentación:** ambos valores deben identificarse claramente; una diferencia no se corrige automáticamente y pasa a trazabilidad/revisión.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-07 — Etiquetado explícito de fuentes normativas y AMI

- **Regla:** Nunca mezclar ni presentar como equivalentes los criterios de NOM-011, los criterios operativos AMI y los valores documentales del audiómetro.
- **Salida mínima:** cada interpretación debe indicar `fuente_normativa`, `criterio_ami`, `valores_fuente` y `pta_fuente`; el cálculo interno debe indicar su fórmula y origen.
- **NOM:** aporta frecuencias mínimas y marco normativo aplicable; no se le atribuye una fórmula PTA que no esté expresamente en el texto oficial consultado.
- **AMI:** aporta escala de normalidad, rangos, diagnóstico operativo y reglas locales de interpretación.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-08 — Trazabilidad visible de la ecuación PTA

- **Regla:** El cálculo PTA debe mostrar su ecuación, entradas, resultado y fuente, siguiendo el patrón de transparencia usado en Espirometría.
- **Contenido mínimo:** frecuencias y valores utilizados por oído, fórmula `PTA3 = (TA500 + TA1000 + TA2000) / 3`, resultado, identificación como cálculo clínico adoptado y PTA original separado.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-09 — No duplicar metadatos administrativos en cuestionarios clínicos

- **Regla:** El cuestionario de Audiometría sólo captura antecedentes, exploración física y observaciones clínicas. No muestra ni persiste Patient ID manual, consentimiento ni nombres de responsables.
- **Fuente de identidad:** paciente/Event desde la papeleta; médico y usuario desde la sesión autenticada; datos documentales desde el archivo fuente.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-10 — Smoke de Vercel posterior al push

- **Regla:** Todo push autorizado debe ir seguido de una comprobación rápida del build de Vercel.
- **Objetivo:** detectar inmediatamente errores de compilación, tipos, rutas o Server Actions introducidos por el commit.
- **Límite:** un build verde no confirma el comportamiento funcional; V3 y la validación de usuario permanecen separadas.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-11 — PDF breve, panel AMI consultable

- **Regla:** La referencia completa de criterios AMI se muestra en el panel clínico, pero no se incluye en el PDF validado.
- **PDF conserva:** evidencia audiométrica, PTA calculado y fuente, interpretación, revisión médica, recomendación validada, identidad/firma y trazabilidad necesaria.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-12 — PDF sin criterios derivados

- **Regla:** El PTA3, PTA fuente y patrón audiométrico derivados permanecen en el panel clínico y no se incluyen en el PDF validado.
- **PDF conserva:** datos del estudio, evidencia documental fuente, impresión diagnóstica, recomendaciones validadas, notas e identidad/firma.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-14 — Perfil clínico como fuente de datos del Examen Médico

- **Regla:** El entregable de Examen Médico debe combinar datos del perfil clínico del paciente, datos del Event, resultados de estudios y revisión médica, sin solicitar nuevamente información ya disponible.
- **Trazabilidad:** cada bloque del PDF debe conservar su origen: perfil clínico, Event/estudio, exploración, cálculo, documento fuente o decisión médica.
- **Privacidad:** sólo se incorporan datos del paciente autenticado/autorizado; no se mezclan perfiles ni se permiten valores por defecto silenciosos.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-15 — Separación de dictamen corporativo y PDF clínico

- **Regla:** `COMPANY_CLIENT` sólo recibe la clasificación/resultado de aptitud autorizado por el portal; no recibe el PDF clínico completo.
- **Roles clínicos:** `SUPERADMIN`, `DOCTOR_GENERAL` y `DOCTOR_VALIDATOR` pueden descargar el PDF completo dentro de su autorización de sesión.
- **Ruta legacy:** cualquier endpoint histórico de PDF debe mantener autenticación y scope; no se acepta una ruta pública como excepción.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-16 — Gate humano previo a persistencias

- **Regla:** La persistencia definitiva de documentos y snapshots sólo comienza después de una verificación funcional del Examen Médico realizada y confirmada por Frank.
- **Estado actual:** en espera de confirmación; no bloquea la revisión manual del entregable.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-17 — Dictamen general como salida principal

- **Regla:** Al completar y validar el Examen Médico se consolida un dictamen general AMI con resumen por estudio, aptitud, observaciones/recomendaciones, médico, cédula y firma.
- **Fuentes:** cada estudio conserva su dictamen independiente; el consolidado no inventa resultados faltantes y marca pendientes cuando aplique.
- **Privacidad:** el dictamen general reducido se separa del PDF clínico completo; el acceso depende del rol y autorización.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-18 — ZIP de cierre con dictámenes y fuentes

- **Regla:** El paquete de cierre de un Event contiene: `dictamen-general.pdf`; un dictamen por cada estudio aplicable; y el documento fuente original utilizado por cada estudio.
- **Trazabilidad:** cada archivo debe conservar asociación explícita con Event, estudio y paciente; una fuente ausente se marca como no disponible, no se reemplaza por un archivo inventado.
- **Integridad:** la generación debe evitar mezclar archivos de otro paciente/Event y debe producir nombres deterministas y legibles.
- **Estado:** confirmada por Frank, 2026-08-25; permisos, faltantes y estructura interna quedan por cerrar.

## BR-20260825-19 — ZIP clínico restringido y trazable

- **Permisos:** sólo roles clínicos autorizados descargan el paquete completo; `COMPANY_CLIENT` no recibe fuentes ni PDF clínico completo.
- **Faltantes:** `manifest.txt` debe listar Event, estudio, tipo de archivo, estado `NO_DISPONIBLE` y razón conocida.
- **Estructura mínima:** `01_Dictamen_General/dictamen-general.pdf`; `02_Audiometria/dictamen-audiometria.pdf` + fuente original si existe; `03_Espirometria/dictamen-espirometria.pdf` + fuente original si existe; y carpetas análogas para otros estudios aplicables.
- **Estado:** confirmada por Frank, 2026-08-25.

## BR-20260825-20 — Gate de emisión para descargas

- **Regla:** Guardar/completar el formulario no equivale a emitir el dictamen. La emisión ocurre después de revisión y firma médica explícita.
- **Descargas:** PDF general, PDF clínico y ZIP devuelven estado pendiente/no disponible mientras no exista `MedicalVerdict` emitido; la interfaz no debe mostrar CTAs accionables antes de ese estado.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-21 — Validación visible después de completar

- **Regla:** El cambio a `VALIDATING` debe reflejarse en la vista activa inmediatamente; la UI debe mostrar el panel de revisión/firma y no un estado de expediente cerrado sin acción disponible.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260825-22 — No usar filesystem local de Vercel para firma

- **Regla:** Los PDFs de entrada/salida del firmador deben viajar por el contrato oficial de upload/archivos del backend; nunca depender de `/var/task`, `process.cwd()/uploads` u otro disco efímero de Vercel.
- **Trazabilidad:** conservar nombres seguros, `pdfUrl`/key y relación con Event/MedicalVerdict.
- **Estado:** confirmado por operación observada, 2026-08-25.

## BR-20260825-13 — Cambios visuales menores por ruta rápida

- **Regla:** Un cambio visual local y reversible, sin lógica de negocio ni contrato técnico, se resuelve con edición mínima y validación dirigida; no requiere SPEC nueva, worker ni auditoría completa.
- **Validación mínima:** lint/test focal; si se publica, smoke rápido de Vercel posterior al push.
- **Escalamiento:** si durante el cambio aparece lógica clínica, datos, auth, API, schema, infraestructura o impacto transversal, se detiene la ruta rápida y se enruta por el flujo normal.
- **Estado:** confirmado por Frank, 2026-08-25.

## BR-20260824-02 — Inferencia visual de criterios de calidad desde las gráficas

- **Actor:** Sistema extractivo, como apoyo para revisión del médico ocupacional.
- **Precondición:** El reporte del espirómetro contiene curvas flujo-volumen y volumen-tiempo legibles, con las maniobras identificables.
- **Regla:** El sistema puede inferir visualmente pico máximo, forma triangular, ausencia de artefactos, meseta, tiempo, criterios para Dx y calidad a partir de las gráficas claras.
- **Límite:** La inferencia debe etiquetarse como criterio derivado de la gráfica, no como texto escrito por el médico ni como diagnóstico IA. Si una curva o criterio no es legible, devolver `null`.
- **Protección:** Repetibilidad FVC/FEV1 continúa calculándose únicamente desde los dos valores numéricos más altos y el umbral AMI de 150 ml.
- **Confirmación:** Frank confirmó el 2026-08-24 que las gráficas mostradas son suficientemente claras para inferir esos criterios.

## BR-20260826-01 — Cierre documental por atención/cita

- **Regla:** El dictamen general y el ZIP de cierre deben incluir todos los Events del trabajador ligados a la misma atención o cita.
- **Dictamen general:** debe usar el formato visual AMI de referencia e integrar los hallazgos disponibles de esos Events, sin inventar resultados ausentes.
- **ZIP:** debe contener el dictamen general y una carpeta por cada Event/estudio aplicable, con su PDF/dictamen y la fuente original disponible; los faltantes se declaran en `manifest.txt`.
- **Exclusiones:** no incluir Events históricos fuera de la atención/cita ni datos de otro trabajador.
- **Confirmación:** Frank, 2026-08-26.

## BR-20260826-02 — Events múltiples por atención/cita

- **Regla técnica derivada:** una `Appointment` puede agrupar múltiples `MedicalEvent`; cada Event conserva su identidad, trabajador, estudios y trazabilidad.
- **Consolidación:** el cierre por atención/cita selecciona sólo Events del mismo trabajador y Appointment, sin incluir histórico ajeno ni otros pacientes.
- **Migración:** debe ser aditiva/no destructiva, conservar datos existentes y validarse antes de habilitar el consolidado.
- **Confirmación:** Frank autorizó la migración 1:N, 2026-08-26.
