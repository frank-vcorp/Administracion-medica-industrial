# SPEC-HANDOFF — FEATURE-20260825-03 Examen Médico

Origen: ATLAS
Raíz / stack: Next.js 16.1.6 + TypeScript + Prisma/PostgreSQL + React PDF + Zod
ID incremento y prioridad: FEATURE-20260825-03 / P1
SPEC / ADR activas: `context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md`; `context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md`; SPEC base `context/SPECs/SPEC_ARCH-20260819-01-ESPECIFICACION-ENTREGABLE-EXAMEN-MEDICO.md`
Decisiones y reglas funcionales: `DEC-20260825-13`, `BR-20260825-14`; perfil clínico + Event son fuente; cada estudio mantiene slot independiente; aptitud/impresión/recomendaciones finales son decisión médica.
Alcance incluido / excluido: completar mapeo de perfil/Event/physicalExamData/slots, resumen auto-poblado, recomendaciones editables, aptitud y PDF AMI firmado. Excluir rediseño de perfil, persistencia documental nueva, cambios Audiometría/Espirometría y aptitud automática.
Resultado técnico esperado: PDF consolidado de Examen Médico con estructura AMI y descarga protegida por Event/paciente/sesión.
Contratos afectados / protegidos: `ExamenMedicoCompletoSchema`, `physicalExamData`, `MedicalVerdict`, slots `*_texto`, `ExamenMedicoEstudio`, `MedicalDictamenPDF`/ruta PDF existente. Proteger compatibilidad legacy y no mezclar pacientes.
Criterios verificables: AC-1..AC-10 de la SPEC; resumen sin duplicar captura, slots independientes, cuatro secciones, faltantes visibles, recomendaciones editables, aptitud médica, firma/cédula/membrete y autorización de descarga.
Archivos o módulos permitidos: `ExamenMedicoEstudio`, actions/schema de examen, helpers de resumen/recomendaciones/aptitud, componente/ruta PDF existente y tests focales. No tocar Audiometría/Espirometría salvo integración de slots ya prevista.
Validaciones V1 / V2 / V3: V1 schema/mapeo/aptitud/PDF; V2 suite completa una vez; V3 Playwright con Event desechable, perfil, estudios, firma, descarga y permisos.
Dependencias y probes reales: reutilizar slots actuales, `LiveSummaryPreview`, `buildExamSummary`, `MedicalDictamenPDF`, `isNoCumple` y perfil clínico existente; no crear almacenamiento nuevo.
Riesgos / rollback / gates: faltantes deben quedar visibles; no auto-decidir aptitud; rollback limitado a archivos del incremento; no commit/push/deploy sin autorización de ATLAS/Frank.
Estado: READY_FOR_SOFIA
Prohibido inferir: datos de paciente, aptitud, firma, resultados clínicos, recomendaciones no trazables o slots cruzados.
