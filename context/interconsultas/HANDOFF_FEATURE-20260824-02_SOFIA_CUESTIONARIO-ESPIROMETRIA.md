# SPEC-HANDOFF — FEATURE-20260824-02

Origen: ATLAS
Raíz/stack: `/home/frank/repos/Administracion-medica-industrial`; Next.js 16.1.6, TypeScript, Prisma/PostgreSQL, Zod.
ID/prioridad: `FEATURE-20260824-02`, P1.
SPEC activa: `context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md`.
Decisiones: `DEC-20260824-03`; Frank autorizó migración Prisma para `EventTest.clinicalContext Json`.
Resultado esperado: modal emergente `Completar cuestionario`/`Editar cuestionario` dentro del Event de Espirometría, antes del upload; resumen compacto después de guardar.
Persistencia: migración `event_tests.clinicalContext`; payload versionado `espirometria-questionnaire-v1`; Zod server-side y server action/API atómica por `eventTestId`.
Contenido: antecedentes respiratorios y exploración física del XLS AMI; principalmente No/Sí/No aplica/rangos/catálogos; texto libre sólo Otro/observaciones; no duplicar PII de papeleta.
IA: enviar clinicalContext estructurado a MedGemma/DR7 cuando exista; ausentes no se inventan; no tocar M3/extracción ni criterios AMI.
Archivos permitidos: componentes Event/Papeleta, actions/API de EventTest, schemas Zod, Prisma schema/migration, prompt/context builder de prediagnóstico y tests focales.
Contratos protegidos: otros estudios, repetibilidad, extracción M3 v7, prediagnóstico AMI v3, modo sombra y revisión médica.
Validación: V1 typecheck/Zod/actions; V2 suite; V3 Playwright modal→selección condicional→guardar→editar→payload/request y contexto IA.
Riesgo/rollback: migración reversible/aditiva; rollback elimina UI/acción y deja clinicalContext nullable; no deploy ni commit/push durante implementación SOFIA.
Estado: READY_FOR_SOFIA.
