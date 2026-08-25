# SPEC-HANDOFF — FEATURE-20260825-02 Audiometría

Origen: ATLAS
Raíz / stack: Next.js 16.1.6 + TypeScript + Prisma/PostgreSQL + FastAPI/Python + Zod
ID incremento y prioridad: FEATURE-20260825-02 / P1
SPEC / ADR activas: `context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md`; `context/decisions/ADR-20260825-01-AUDIOMETRIA-ENTREGABLE-COMUN.md`
Decisiones y reglas funcionales: `DEC-20260825-03` a `DEC-20260825-07`; `BR-20260825-03` a `BR-20260825-08`. TA=vía aérea; VO=vía ósea; normalidad AMI ≤25 dB; PTA3=(TA500+TA1000+TA2000)/3; conservar PTA fuente; mostrar ecuación y capas NOM/AMI/fuente.
Alcance incluido / excluido: cuestionario auditivo en EventTest, extracción/presentación bilateral, interpretación derivada, revisión médica, PDF validado y descarga protegida. Excluir persistencia documental definitiva, publicación V3 prematura, cambios de Espirometría y aptitud automática.
Resultado técnico esperado: entregar Audiometría con el mismo ciclo operativo de Espirometría, parametrizado por estudio, usando campos y criterios propios.
Contratos afectados / protegidos: `EventTest.clinicalContext`; calibración Audiometría; renderer/extractor/prediagnóstico; acciones de revisión/PDF. Proteger calibración Espirometría y no inventar frecuencias ausentes.
Criterios verificables: AC-1..AC-11 de la SPEC; incluir cuestionario, contexto IA, 4 frecuencias parciales sin invención, TA/VO, PTA calculado+fuente, revisión/aceptación/edición, PDF firmado y autorización de descarga.
Archivos o módulos permitidos: módulos Audiometría existentes, componentes clinical/calibration, acciones y rutas PDF asociadas, Prisma sólo si el contrato vigente lo exige, tests focales. No tocar módulos Espirometría salvo abstracción estrictamente compatible y necesaria.
Validaciones V1 / V2 / V3: V1 typecheck/tests focales tras cada corte; V2 suite frontend/backend una vez al cierre; V3 Playwright real del Event, revisión, PDF y permisos.
Dependencias y probes reales: reutilizar parser XML Audiometría, calibración V3 `tested`, perfil médico/firma y patrón PDF de Espirometría; no publicar calibración sin gate.
Riesgos / rollback / gates: diferencias PTA fuente/calculado se muestran, no se corrigen; datos ausentes quedan null; rollback por revertir sólo archivos del incremento; no desplegar ni publicar sin autorización posterior.
Estado: READY_FOR_SOFIA
Prohibido inferir: valores/frecuencias ausentes, diagnóstico final desde el PDF AMI, fórmula distinta de PTA3, identidad del médico fuera de sesión, criterios AMI como si fueran NOM.
