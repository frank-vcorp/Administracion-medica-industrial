/**
 * @file Reglas de visibilidad del `EventFlowController` en la página de
 *   detalle del expediente médico (`/events/[id]`).
 *
 *   Concentrar la lógica en un helper puro permite:
 *     - Test focal sin DOM/Next runtime (vitest directo).
 *     - Evitar regresiones del FIX post-firma (pantalla blanca).
 *     - Documentar el contrato en un solo lugar.
 *
 * @id IMPL-20260826-03 (FIX pantalla blanca post-firma, Frank 2026-08-26)
 * @finding Pantalla blanca tras firmar: `event.status === 'COMPLETED'`
 *   pero la URL conserva `?view=VALIDATING`; el check antiguo
 *   `activeView === event.status` ocultaba el `EventFlowController` para
 *   COMPLETED. La action de firma no navega, así que el URL queda
 *   desincronizado del status.
 * @decision Ampliar la condición de render para aceptar el caso
 *   `status=COMPLETED + activeView=VALIDATING` SIN tocar el resto del
 *   flujo (workspace se sigue mostrando para CHECKED_IN/IN_PROGRESS,
 *   IN_PROGRESS sigue ocultando el Flow Controller, etc).
 */

export type EventStatus =
  | 'SCHEDULED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'VALIDATING'
  | 'COMPLETED'
  | string

/**
 * Determina si el `EventFlowController` debe renderizarse en
 * `frontend/src/app/events/[id]/page.tsx`.
 *
 * Reglas (contrato vigente, IMPL-20260826-03):
 *   - `IN_PROGRESS` → NUNCA (el workspace `PapeletaWorkspace` ocupa el
 *     área; el Flow Controller aparecería duplicado).
 *   - `CHECKED_IN` y cualquier otro status → sólo cuando
 *     `activeView === event.status` (comportamiento legacy preservado).
 *   - `COMPLETED` (post-firma) → se renderiza si `activeView` es el
 *     status O si la URL todavía conserva `?view=VALIDATING` (FIX
 *     pantalla blanca). Cualquier otro `activeView` para COMPLETED
 *     (e.g. `CHECKED_IN`, `IN_PROGRESS`, `SCHEDULED`) NO renderiza el
 *     Flow Controller — el usuario navegó deliberadamente hacia atrás
 *     y debe seguir viendo la papeleta/workspace correspondiente.
 *
 * @param activeView `view` parseado de la URL (o fallback a `event.status`).
 * @param status `event.status` persistido en BD.
 * @returns `true` si el `EventFlowController` debe renderizarse.
 */
export function shouldRenderEventFlowController(
  activeView: string | undefined,
  status: EventStatus,
): boolean {
  if (status === 'IN_PROGRESS') return false
  if (activeView === status) return true
  if (status === 'COMPLETED' && activeView === 'VALIDATING') return true
  return false
}
