/**
 * Catálogos y tipos compartidos del Sprint 1 de Recepción Operativa.
 * @id IMPL-20260519-13
 * @backup context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md
 */

export const IDENTITY_DOCUMENT_TYPES = [
  'INE',
  'PASAPORTE',
  'LICENCIA',
  'OTRA_IDENTIFICACION_OFICIAL',
] as const

export const IDENTITY_EXCEPTION_REASONS = [
  'SIN_DOCUMENTO_PRESENTE',
  'FALLA_CAMARA_O_DISPOSITIVO',
  'EVIDENCIA_NO_LEGIBLE',
  'DISCREPANCIA_DE_IDENTIDAD',
  'OTRO',
] as const

export const IDENTITY_EVIDENCE_MODES = [
  'NEW_CAPTURE',
  'REUSED_PREVIOUS',
  // Nombre técnico interno mantenido para compatibilidad de contrato con el schema.
  // La regla operativa visible al usuario es "comentario operativo obligatorio".
  'EXCEPTION_WITHOUT_CAPTURE',
] as const

export const CORROBORATION_RESULTS = [
  'VERIFIED_WITHOUT_CHANGES',
  'VERIFIED_WITH_NAME_CORRECTION',
  'VERIFIED_WITH_REUSED_EVIDENCE',
  'VERIFIED_WITH_COMMENT',
] as const

export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number]
export type IdentityExceptionReason = (typeof IDENTITY_EXCEPTION_REASONS)[number]
export type IdentityEvidenceMode = (typeof IDENTITY_EVIDENCE_MODES)[number]
export type CorroborationResult = (typeof CORROBORATION_RESULTS)[number]
