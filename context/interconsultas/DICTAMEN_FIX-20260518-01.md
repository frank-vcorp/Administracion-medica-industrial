# DICTAMEN TECNICO: Reemplazo de archivo en Espirometria no refresca Valores capturados
- **ID:** FIX-20260518-01
- **Fecha:** 2026-05-18
- **Solicitante:** SOFIA
- **Estado:** ✅ VALIDADO

### A. Analisis de Causa Raiz
El flujo de reemplazo del archivo en la UI se controla en `handleFileUpload` dentro de `frontend/src/components/clinical/PapeletaWorkspace.tsx`. Tras un upload exitoso, el estado local solo actualiza `fileUrl` y `status` mediante `updateLocalFile`; no injerta el nuevo `extractionSnapshot` en `localTests`. La UI depende entonces de `router.refresh()` para volver a traer el snapshot nuevo desde el servidor.

Ruta confirmada:
1. `handleFileUpload` llama a `uploadEventTestFile(formData)`.
2. Si el upload responde éxito, `updateLocalFile(testId, fileUrl)` solo muta `fileUrl` y `status`.
3. Después se ejecuta `router.refresh()` para forzar que el server component reconstruya `eventTests`.
4. El server component serializa `extractionSnapshot` desde `event.eventTests[].extractionSnapshots[0]`.
5. `CapturedValuesPanel` y `StudyExtractionRawPanel` consumen ambos `test.extractionSnapshot`.

Hallazgo principal:
- El reemplazo NO tiene actualización optimista de `extractionSnapshot`. Si `router.refresh()` no termina, llega tarde, o se interrumpe por navegación/red, la UI puede quedar con el snapshot anterior aunque el backend ya haya persistido uno nuevo.
- Esto es coherente con los logs observados `ERR_NETWORK_CHANGED` y con el parche previo `[FIX-20260516-01][upload] Fallo en upload IA`, porque el código trata explícitamente errores de red alrededor del upload y del refresh implícito posterior.

Hallazgo secundario:
- En servidor, cada nueva corrida crea un `StudyExtractionSnapshot` con `isSuperseded: false`, pero no se marca el anterior como superseded. El loader del evento selecciona el más reciente con `orderBy createdAt desc, take 1`, por lo que normalmente tomará el último, pero la semántica de “vigente” depende solo del orden temporal y no de una desactivación explícita de versiones previas.
- Esto no parece el disparador principal del bug reportado, pero deja fragilidad en escenarios con múltiples corridas o inspección histórica.

Segunda opinion Qodo:
- No disponible. La ejecución fue cancelada al intentar instalar dependencias auxiliares del sandbox.

### B. Justificacion de la Solucion
No se aplicaron cambios de código por instrucción del solicitante.

La hipótesis raíz más probable y falsable es:
- **Hipótesis:** el panel “Valores capturados” queda viejo cuando el upload/reemplazo sí persiste snapshots en backend pero el cliente no recibe el nuevo `eventTests` porque depende exclusivamente de `router.refresh()` después de una actualización local incompleta (`updateLocalFile` no actualiza `extractionSnapshot`).

Por qué esta hipótesis es la más fuerte:
- El render de “Valores capturados” está acoplado a `test.extractionSnapshot.extractedData`.
- El render del RAW también depende de `test.extractionSnapshot.rawPayload`.
- La única vía de actualización del snapshot en cliente es el refresh del árbol server-side, no el optimistic state local.
- Los errores de red reportados impactan exactamente ese punto de sincronización.

Chequeo barato para falsarla:
1. Reproducir un reemplazo exitoso con DevTools abierto.
2. Confirmar en DB o en logs del server action que se creó un nuevo `StudyExtractionSnapshot` y que `revalidatePath('/events/[id]')` corrió.
3. Instrumentar temporalmente o inspeccionar React DevTools para comparar:
   - `localTests.find(t => t.id === activeTestId)?.extractionSnapshot?.version`
   - `eventTests` nuevo entregado al componente tras `router.refresh()`.
4. Si `localTests` conserva la versión previa mientras backend ya tiene una nueva, la hipótesis queda confirmada.
5. Si `eventTests` ya trae la versión nueva y aun así la UI muestra la vieja, entonces la siguiente hipótesis a revisar es identidad/rehidratación del árbol cliente tras `router.refresh()`.

### C. Instrucciones de Handoff para SOFIA
1. Revisar primero `frontend/src/components/clinical/PapeletaWorkspace.tsx` en el bloque `updateLocalFile` + `handleFileUpload`.
2. Revisar luego `frontend/src/app/events/[id]/page.tsx` y `frontend/src/services/medical-event.service.ts` para confirmar que el snapshot más reciente sí llega del servidor.
3. Si se implementa fix, priorizar una de estas dos estrategias:
   - actualización optimista completa del `extractionSnapshot` con el resultado del server action, o
   - bloquear la transición visual hasta que `router.refresh()` confirme el nuevo payload.
4. Como endurecimiento adicional, evaluar supersedear snapshots previos al crear uno nuevo para que “vigente” no dependa solo de `createdAt`.
