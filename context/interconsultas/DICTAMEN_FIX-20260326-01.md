# DICTAMEN TÉCNICO: Revisión forense y clínico-operativa de la SPEC de prediagnóstico IA estructurado
- **ID:** FIX-20260326-01
- **Fecha:** 2026-03-26
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
1. La SPEC acierta al separar extracción, interpretación IA y validación médica, pero todavía no define la unidad clínica exacta de persistencia ni la cardinalidad entre estudio, versión de extracción, versión de prediagnóstico y revisión médica. El contrato lógico por estudio en [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L77) y el almacenamiento esperado en [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L233) nombran estructuras, pero no fijan si son snapshots inmutables o campos mutables in-place. Eso es un riesgo de auditoría clínica: una corrección posterior podría sobrescribir evidencia previa sin cadena de custodia.
2. El modelo actual del sistema no soporta todavía la separación que la SPEC presupone. Hoy la persistencia operativa sigue concentrada en campos genéricos: [frontend/prisma/schema.prisma](frontend/prisma/schema.prisma#L264) y [frontend/prisma/schema.prisma](frontend/prisma/schema.prisma#L265) guardan extracción y predicción en StudyRecord; [frontend/prisma/schema.prisma](frontend/prisma/schema.prisma#L280) y [frontend/prisma/schema.prisma](frontend/prisma/schema.prisma#L281) hacen lo mismo para LabRecord. No existen todavía entidades explícitas para evidencia clínica versionada, revisión médica del prediagnóstico, consolidado multiestudio ni feedback supervisado. Si se implementa la SPEC sin cerrar ese gap, V1 puede terminar con JSONs crecientes y semántica ambigua en campos heredados, difícil de migrar luego.
3. Hay un riesgo clínico de contaminación entre extracción y conclusión. La SPEC exige que la salida principal sea estructurada y que el prediagnóstico sea otra capa, pero el backend actual mezcla ambas responsabilidades en los esquemas de extracción: [backend/app/schemas/medical.py](backend/app/schemas/medical.py#L17), [backend/app/schemas/medical.py](backend/app/schemas/medical.py#L30), [backend/app/schemas/medical.py](backend/app/schemas/medical.py#L42) y [backend/app/schemas/medical.py](backend/app/schemas/medical.py#L54) incluyen campos como diagnostico_ia o interpretacion dentro de la extracción; además los prompts actuales ya fuerzan conclusiones clínicas en la propia fase extractiva en [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L40), [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L63), [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L86) y [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L105). Si esto no se prohíbe explícitamente en la SPEC de implementación, el sistema arrastrará una capa híbrida donde la “extracción estructurada” ya viene sesgada por interpretación.
4. La SPEC define “modo sombra clínica” y exige no concluir cuando la extracción es incompleta o de baja confianza en [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L35) y [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L204), pero no define umbrales, reglas de bloqueo ni estados clínicos intermedios. Falta especificar al menos: umbral mínimo por tipo de estudio, criterio de “documento ilegible/incompleto”, regla para prohibir consolidado multiestudio si uno de los estudios críticos está no concluyente, y comportamiento UI cuando una sugerencia fue rechazada por el médico.
5. La trazabilidad es todavía insuficiente para cumplimiento médico-legal. La SPEC pide bibliografía/citas controladas y corpus versionado en [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L13), [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L193) y [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L247), pero no exige guardar huella del prompt, modelo, versión del corpus, hash del archivo fuente, fragmentos usados, ni relación entre cita aplicada y parámetro concreto. En el estado actual, el pipeline IA solo registra actividad por prints en [backend/app/services/ai/classifier.py](backend/app/services/ai/classifier.py#L53), [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L127) y [backend/app/services/ai/base.py](backend/app/services/ai/base.py#L96), mientras la auditoría formal existe en [frontend/src/actions/audit.actions.ts](frontend/src/actions/audit.actions.ts#L26) pero no está integrada al flujo de ingestión IA de [frontend/src/actions/upload.actions.ts](frontend/src/actions/upload.actions.ts#L61) y [frontend/src/actions/upload.actions.ts](frontend/src/actions/upload.actions.ts#L71). Eso deja un hueco serio: hay evidencia clínica generada por IA sin bitácora transaccional de quién la disparó, con qué insumo y con qué versión.
6. Existe riesgo de exposición de datos clínicos fuera del mínimo necesario. El PDF oficial actual imprime el JSON crudo de extracción en [frontend/src/components/pdf/MedicalDictamenPDF.tsx](frontend/src/components/pdf/MedicalDictamenPDF.tsx#L74) y [frontend/src/components/pdf/MedicalDictamenPDF.tsx](frontend/src/components/pdf/MedicalDictamenPDF.tsx#L82). Si la V1 agrega prediagnóstico, citas y justificaciones sin separar visibilidad clínica interna de documento oficial, podría terminar filtrando razonamientos auxiliares o datos no validados en un artefacto médico firmado.
7. La medición de feedback médico está conceptualmente bien orientada, pero los campos propuestos siguen siendo ambiguos para analítica supervisada y para defensa regulatoria. Los puntajes numéricos en [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L152) y [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L153) no indican escala, significado clínico, obligatoriedad ni sesgos de captura. “agreement” y “usefulness” no bastan para gobernanza si no se acompañan de taxonomía de error clínico, severidad potencial e impacto operativo.
8. El riesgo de autoaprendizaje está identificado pero no cerrado. La SPEC afirma que no habrá autoaprendizaje automático y que la mejora mensual será supervisada en [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L21) y [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L188), pero no define quién autoriza un cambio de reglas/modelo, cómo se congela un dataset de evaluación, cómo se hace rollback clínico ni qué métricas mínimas permiten promover una versión. Sin ese protocolo, la frase “mejora mensual supervisada” queda demasiado abierta y puede derivar en cambios silenciosos difíciles de auditar.
9. La consolidación multiestudio es clínicamente útil pero ahora mismo está subespecificada. La SPEC la introduce en [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L160) y [context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md](context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md#L161), pero no fija reglas de precedencia, conflicto entre estudios, vigencia temporal, o si todos los estudios pertenecen al mismo episodio clínico. Sin eso, un consolidado puede mezclar datos heterogéneos o contradictorios y proyectar una falsa coherencia diagnóstica.
10. Segunda opinión forense: se intentó ejecutar Qodo CLI en modo solo lectura para corroborar el análisis, pero la herramienta reportó que fue retirada del entorno y no estuvo disponible para esta revisión. No invalida el dictamen, pero deja constancia de que la segunda mano automatizada no pudo emitirse.

### B. Justificación de la Solución
La SPEC va en la dirección correcta, pero antes de V1 debe endurecerse como documento de implementación y compliance. Las correcciones recomendadas son:
1. Definir entidades explícitas y versionadas, no solo blobs JSON. Mínimo: ExtractionSnapshot, AIPrediagnosisSnapshot, DoctorReview, EvidenceCitationSet y ConsolidatedPrediagnosis, todas ligadas a EventTest o al episodio con timestamps, actor y versionado.
2. Declarar inmutabilidad de snapshots clínicos: una nueva corrida de IA o una corrección humana crea una nueva versión; no sobrescribe la previa. El registro activo puede apuntar a la “versión vigente”, pero el histórico debe conservarse intacto.
3. Prohibir en la SPEC que la fase extractiva emita diagnóstico o interpretación clínica final. La extracción debe limitarse a parámetros, calidad, fragmentos fuente y normalización; la interpretación debe ocurrir en una fase posterior y separada.
4. Añadir guardrails cuantitativos y estados formales: DRAFT_EXTRACTED, AI_PENDING_REVIEW, AI_NON_CONCLUSIVE, REVIEWED_ACCEPTED, REVIEWED_EDITED, REVIEWED_REJECTED, SUPERSEDED. También definir umbrales mínimos por estudio y bloqueos de consolidación.
5. Exigir trazabilidad completa por corrida IA: modelo exacto, versión de prompt, versión de corpus, hash del archivo, páginas usadas, fragmentos fuente, timestamp, usuario/servicio que inició el proceso y motivo de regeneración.
6. Separar visibilidad interna vs documento oficial: el dictamen firmado nunca debe incluir JSON crudo, razonamiento auxiliar completo ni feedback médico sobre la IA; esos datos deben quedar en la capa operativa/auditable interna.
7. Redefinir feedback supervisado con taxonomía útil: concordancia global, severidad del error potencial, tipo de omisión/comisión, causa de rechazo y utilidad operativa. Los scores numéricos sin escala definida no son suficientes.
8. Convertir “mejora mensual supervisada” en un procedimiento formal: comité/autorizador, dataset congelado, métricas de aprobación, changelog clínico, rollback documentado y comparación de versión previa vs nueva antes de promoción.
9. Definir consolidación multiestudio solo para estudios del mismo evento y con vigencia compatible. También fijar reglas de conflicto y preferencia cuando un estudio contradice otro o cuando uno está no concluyente.
10. Añadir un criterio de aceptación de auditoría: cada sugerencia IA debe ser reconstruible end-to-end sin depender de logs efímeros del backend.

### C. Instrucciones de Handoff para INTEGRA
1. Convertir esta SPEC draft en una V1 endurecida antes de pasar a implementación. No delegar aún a SOFIA una migración de datos si antes no se define el modelo versionado.
2. Agregar en la SPEC una sección nueva de “Modelo de Persistencia y Versionado” con entidades, relaciones, cardinalidad y política de inmutabilidad.
3. Agregar una sección de “Gobernanza Clínica y de Modelo” con: autorizador, corpus controlado, protocolo de cambio mensual, rollback y criterios de promoción.
4. Agregar una sección de “Guardrails de Documento Oficial” prohibiendo que hallazgos IA no validados o razonamientos auxiliares se filtren al PDF firmado.
5. Pedir a implementación que elimine cualquier diagnóstico embebido en extracción y que reubique esa lógica a una capa posterior. El estado actual en [backend/app/services/ai/extractor.py](backend/app/services/ai/extractor.py#L40) y [backend/app/schemas/medical.py](backend/app/schemas/medical.py#L17) es incompatible con la separación que la SPEC pretende.
6. Exigir desde el inicio integración con auditoría transaccional para creación, regeneración, aceptación, edición, rechazo y consolidación del prediagnóstico. No confiar en logs de consola como evidencia.
7. Antes de cerrar implementación, validar que el PDF clínico oficial deje de exponer JSON crudo de IA en [frontend/src/components/pdf/MedicalDictamenPDF.tsx](frontend/src/components/pdf/MedicalDictamenPDF.tsx#L74).# DICTAMEN TÉCNICO: Enfoques para Prediagnóstico IA por Estudio con Revisión Médica Obligatoria
- **ID:** FIX-20260326-01
- **Fecha:** 2026-03-26
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
El sistema AMI ya tiene casi todas las piezas base para introducir prediagnóstico asistido por estudio sin rediseño mayor: pipeline IA modular en backend con clasificación y extracción especializada, Papeleta operada por `EventTest`, expediente por evento, snapshot longitudinal/prellenado y una etapa de validación médica posterior.

Hallazgos forenses relevantes:
1. El backend ya devuelve campos interpretativos por tipo (`diagnostico_ia`, `interpretacion`, `recomendaciones`), pero esos campos hoy viven mezclados con la extracción y no están modelados como sugerencia clínica auditable ni como entidad con estado de revisión.
2. El flujo operativo de estudios ya existe en la Papeleta, con estados transaccionales del `EventTest` (`PENDING`, `IN_PROGRESS`, `RESULT_REGISTERED`, `COMPLETED`), lo que permite insertar una etapa explícita de “sugerencia lista para revisión” sin alterar el flujo principal.
3. La cola de validación existe, pero hoy está pensada para revisión/diagnóstico/firma a nivel expediente; si el prediagnóstico se muestra sin separar claramente “dato extraído” de “juicio sugerido”, existe riesgo de anclaje cognitivo del médico.
4. El riesgo principal no es técnico sino clínico-operativo: una sugerencia mal presentada puede convertirse de facto en dictamen automático, especialmente en estudios repetitivos de alto volumen.

Fallas posibles si se implementa mal:
1. Confundir extracción OCR/vision con interpretación clínica final.
2. Permitir que una sugerencia de IA se firme o se convierta en aptitud sin aceptación humana explícita.
3. Mostrar resultados aunque la clasificación sea débil o el archivo esté incompleto/corrupto.
4. No distinguir entre hallazgo objetivo, inferencia IA y observación del médico.
5. Reusar contexto longitudinal del trabajador para inferir más de lo debido y contaminar el episodio actual.

### B. Justificación de la Solución
Se recomiendan tres enfoques, en orden de menor a mayor ambición. Los tres conservan al médico como decisor final y usan el pipeline actual como base.

#### Enfoque 1. Borrador estructurado por estudio, visible sólo después de archivo + extracción válida
**Descripción breve**
Generar un borrador de prediagnóstico por cada estudio documental cuando el `EventTest` ya tenga archivo cargado y extracción exitosa. El borrador no se mezcla con el dictamen final: aparece como bloque separado de “Sugerencia IA” dentro del estudio.

**Cómo encaja con el pipeline actual**
- Reusa el flujo actual `upload-and-analyze` del backend.
- A partir del tipo clasificado y la extracción estructurada, se agrega un paso liviano de normalización a un formato común: `hallazgos_clave`, `interpretacion_sugerida`, `nivel_confianza`, `faltantes_detectados`, `banderas_rojas`.
- En frontend, ese bloque se renderiza dentro del `PapeletaWorkspace` en la vista del `EventTest`, no en la portada del expediente ni en el PDF.
- La transición operativa recomendada es: archivo cargado -> extracción válida -> estado derivado “listo para revisión IA” pero sin marcar `COMPLETED` automáticamente.

**Riesgos clínicos/operativos**
- Anclaje del médico al texto sugerido si el bloque se ve demasiado “definitivo”.
- Sobreconfianza cuando la clasificación o extracción venga con campos incompletos.
- Ruido en estudios que requieren más contexto clínico del que el documento trae (por ejemplo radiología o laboratorios complejos).

**Controles o guardrails obligatorios**
1. Etiqueta visible: “Sugerencia IA no diagnóstica. Requiere validación médica”.
2. Nunca autopoblar el dictamen final, aptitud ni PDF firmado.
3. Mostrar confianza y razones de la clasificación/extracción junto a la sugerencia.
4. Umbral mínimo de confianza; si no se cumple, mostrar “IA no concluyente” y sólo extraer datos objetivos.
5. Botones explícitos: “Aceptar como borrador editable”, “Descartar sugerencia”, “Corregir manualmente”.

**Complejidad estimada**
Media.

#### Enfoque 2. Motor híbrido: reglas clínicas determinísticas + redacción IA
**Descripción breve**
Separar el prediagnóstico en dos capas: reglas determinísticas para detectar patrones medibles por estudio y LLM sólo para redactar la explicación clínica en lenguaje natural. La decisión sugerida nace de reglas auditables; la IA redacta y organiza.

**Cómo encaja con el pipeline actual**
- El extractor actual sigue obteniendo datos estructurados por tipo.
- Se agrega una capa server-side de reglas por estudio:
  - Audiometría: umbrales por frecuencia, asimetrías, patrón de ruido ocupacional.
  - Espirometría: relación FEV1/FVC, porcentaje predicho, normal/obstructivo/restrictivo preliminar.
  - Laboratorio: outliers y agrupación por panel.
  - Rayos X: sólo resumen de hallazgos presentes; evitar clasificación patológica fuerte si no hay reporte radiológico explícito.
- Gemini recibe como entrada el resultado de reglas y genera una explicación corta y recomendaciones operativas, no la conclusión desde cero.

**Riesgos clínicos/operativos**
- Reglas pobres o incompletas pueden producir falsos negativos sistemáticos.
- La redacción IA puede sonar más segura de lo que realmente es la regla base.
- Mayor costo de mantenimiento si cambian criterios médicos o perfiles ocupacionales.

**Controles o guardrails obligatorios**
1. Mantener catálogo versionado de reglas por estudio y registrar versión usada en cada sugerencia.
2. Limitar el texto IA a vocabulario prudente: “compatible con”, “sugiere”, “requiere correlación clínica”.
3. Para Rayos X y estudios no plenamente estructurables, prohibir conclusiones de aptitud o patología crítica sin reporte humano visible.
4. Registrar por separado: datos extraídos, resultado de reglas, texto generado y edición médica final.
5. Si una regla detecta inconsistencia o faltan campos clave, bloquear redacción y mandar a revisión manual directa.

**Complejidad estimada**
Media-Alta.

#### Enfoque 3. Bandeja de prevalidación clínica por excepción antes del dictamen final
**Descripción breve**
En lugar de mostrar siempre la sugerencia dentro del estudio, crear una bandeja intermedia de prevalidación donde sólo aparecen los estudios cuyo prediagnóstico tenga valor operativo: discrepancias, banderas rojas, baja confianza o hallazgos relevantes. La IA ayuda a priorizar, no a cerrar.

**Cómo encaja con el pipeline actual**
- Aprovecha que ya existe una cola de validación a nivel expediente.
- Se puede insertar una capa previa por `EventTest`: “requiere revisión IA”, “sin hallazgos relevantes”, “baja confianza”, “bandera roja”.
- La Papeleta sigue siendo el lugar de captura; la bandeja sirve para que médico/validador revise sólo los casos problemáticos antes de firmar el expediente.
- Encaja bien con expediente por evento y con el modelo de validación posterior ya existente.

**Riesgos clínicos/operativos**
- Si la priorización es mala, estudios importantes pueden perderse en “sin hallazgos relevantes”.
- Añade una capa operativa más; puede entorpecer si no se diseña con filtros muy claros.
- Riesgo de que el personal omita revisar estudios no destacados por la IA.

**Controles o guardrails obligatorios**
1. La bandeja debe ser de priorización, no de exclusión: todo expediente sigue requiriendo revisión final humana.
2. Mostrar siempre qué estudios no generaron alerta y por qué.
3. Forzar checklist de cierre del expediente: ningún dictamen firmado si hay estudios con bandera roja o revisión pendiente.
4. Registrar SLA y auditoría: quién revisó, qué aceptó/corrigió y cuándo.
5. Mantener acceso directo al documento original y a los datos extraídos desde la misma tarjeta de revisión.

**Complejidad estimada**
Alta.

### C. Instrucciones de Handoff para INTEGRA
Recomendación pragmática:
1. **Empezar por el Enfoque 1** como primera iteración funcional. Es el menor riesgo para mañana porque reutiliza el pipeline actual, se acopla bien a `EventTest` y deja claro que la IA sugiere pero no decide.
2. **Evolucionar al Enfoque 2** en los estudios con criterios medibles claros (Audiometría, Espirometría, ciertos paneles de Laboratorio). Ahí se gana seguridad clínica porque la inferencia crítica deja de depender sólo del LLM.
3. **Reservar el Enfoque 3** para una segunda o tercera iteración cuando ya tengan métricas reales de precisión, tiempos de revisión y tasas de corrección médica.

Secuencia sugerida de implementación:
1. Crear un objeto persistente de sugerencia por estudio, separado de la extracción cruda y separado del dictamen final.
2. Añadir estados explícitos de revisión humana por estudio (`sin_sugerencia`, `sugerido`, `validado`, `corregido`, `descartado`).
3. Diseñar UI de revisión dentro de la Papeleta con texto prudente, confianza visible y acceso al documento original.
4. Bloquear cualquier propagación automática al dictamen final o a la aptitud laboral.
5. Medir en piloto: tasa de aceptación médica, tasa de corrección, tiempo ahorrado y tipos de error por estudio.

Veredicto forense:
- **Sí conviene arrancar mañana**, pero con un alcance estrecho: sugerencia por estudio, separada del dictamen, editable y auditada.
- **No conviene** lanzar un “prediagnóstico automático” transversal del expediente desde el día 1.
- **La combinación más segura** para AMI es: Enfoque 1 ahora, Enfoque 2 donde haya reglas objetivas, Enfoque 3 después de validar operación real.

### Nota Forense
Se intentó obtener segunda opinión con Qodo CLI en modo de solo lectura, pero en este entorno no devolvió resultado utilizable; por ello el dictamen se sustenta en inspección directa del código y del flujo vigente del repositorio.