# SPEC-HANDOFF — FEATURE-20260824-01

Origen: ATLAS
Raíz / stack: `/home/frank/repos/Administracion-medica-industrial`; Next.js 16.1.6, TypeScript, React, renderer clínico de Events.
ID incremento y prioridad: `FEATURE-20260824-01`, P1.
SPEC / ADR activas: `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md`; arquitectura protegida por `ARCH-20260820-01` y `DEC-20260820-01`.
Decisiones y reglas funcionales: Events debe mostrar la evidencia clínica extractiva antes del prediagnóstico; Justificación, Limitaciones y Fuentes clínicas deben iniciar desplegadas; no convertir texto del médico en diagnóstico IA.
Alcance incluido / excluido: UI de Events para Espirometría y tests focales. Excluidos schema Prisma, migraciones, backend, calibración publicada, deploy, otros estudios.
Resultado técnico esperado: bloque de criterios clínicos en la columna derecha entre visor y `StudyAIPrediagnosisPanel`; panel IA con sus tres secciones abiertas inicialmente.
Contratos afectados / protegidos: sólo presentación del snapshot existente; proteger `extractedData`, `fuente_texto_crudo` si está disponible, modo sombra clínica, revisión médica y renderer de Audiometría.
Criterios verificables: AC-1..AC-7 de la SPEC; probar con `context/RD2026/ESPIROMETRIA.pdf`, verificando FVC 30 ml, FEV1 40 ml, 3 pruebas, calidad A y criterios SI.
Archivos o módulos permitidos: `PapeletaWorkspace.tsx`, `StudyAIPrediagnosisPanel.tsx`, `extraction-presentation-schemas.ts` sólo si es necesario, nuevo componente UI acotado y tests focales.
Validaciones V1 / V2 / V3: V1 typecheck/tests focales; V2 suite frontend completa una vez; V3 Playwright del Event real con el PDF y consola/network.
Dependencias y probes reales: snapshot de extracción existente para `context/RD2026/ESPIROMETRIA.pdf`; no invocar APIs nuevas.
Riesgos / rollback / gates: riesgo presentacional bajo; rollback del bloque UI; detenerse ante cambio de contrato, persistencia o datos.
Estado: READY_FOR_SOFIA
Prohibido inferir: valores ausentes, diagnóstico IA desde texto fuente, fórmulas nuevas, aptitud, cambios de calibración o despliegue.

Entrega esperada: implementar, ejecutar V1/V2 si están disponibles, reportar diff, comandos y resultados. No crear commit/push.
