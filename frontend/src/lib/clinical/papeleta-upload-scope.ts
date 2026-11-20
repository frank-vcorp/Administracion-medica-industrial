/**
 * El progreso de carga de un estudio no debe pintarse en los demás
 * de la misma papeleta. El candado evita un segundo upload mientras
 * el primero sigue en curso.
 */
export function scopedStudyBusy(
  activeTestId: string,
  busyTestId: string | null,
  busy: boolean,
): { showHere: boolean; lockOthers: boolean } {
  const showHere = busy && busyTestId === activeTestId
  return {
    showHere,
    lockOthers: busy && !showHere,
  }
}
