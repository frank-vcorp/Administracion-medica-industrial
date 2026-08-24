/**
 * @file SPEC-FIX-20260824-01: redacción de resultNotes para STUDY_TYPE_MISMATCH.
 *
 * Helper compartido (no `'use server'`) que redacta el texto que se persiste
 * en `EventTest.resultNotes` cuando el backend clasificó el rechazo del
 * proveedor extractivo como STUDY_TYPE_MISMATCH.
 *
 * Garantías:
 *  - `EventTest.resultNotes` NUNCA contiene HTML, prompt del proveedor,
 *    respuesta cruda del modelo, stack, PII ni secretos del paciente.
 *  - El texto es la versión redactada user-friendly producida por
 *    `build_user_facing_message` en el backend. Los detalles técnicos
 *    sólo quedan en el log de servidor (NO en Prisma).
 *
 * Este helper se importa desde `event-test.actions.ts` (`'use server'`)
 * — Next.js exige que los archivos `'use server'` sólo exporten funciones
 * async; lo mantenemos aquí como utility sincronizable y testeable.
 *
 * @id IMPL-20260824-01-UI-NOTES-BUILDER
 * @spec context/SPECs/SPEC-FIX-20260824-01-STUDY-MISMATCH.md
 */
export interface MismatchResultNoteInput {
  selectedStudyType: string | null
  detectedStudyType: string | null
  message: string | null
}

export function buildMismatchResultNote(input: MismatchResultNoteInput): string {
  const sel = input.selectedStudyType ?? 'el estudio seleccionado'
  const det = input.detectedStudyType
  if (det && det !== sel) {
    return (
      `Documento incompatible: el operador seleccionó ${sel}, pero el ` +
      `documento parece ser ${det}. Acción: abrir el estudio ${det} y ` +
      `volver a cargar el archivo. Detalle técnico sólo en auditoría.`
    )
  }
  return (
    `Documento incompatible: el archivo no parece corresponder a ${sel}. ` +
    `Verifica el archivo y vuelve a intentarlo. Detalle técnico sólo en auditoría.`
  )
}