# HANDOFF ARCH-20260516-11 -> SOFIA

## Contexto
El usuario sigue reportando que “no está poniendo nada” porque, aunque ya existe un panel RAW clínico homologado visualmente, el componente actual desaparece completo cuando `input_debug` no está presente en el snapshot. Eso rompe la descubrilidad y hace parecer que el panel no existe.

## Objetivo
Hacer que el panel `RAW de entrada clínica` sea siempre visible, usando el mismo lenguaje visual del `RAW de extracción`, con estado vacío explícito cuando falte `input_debug`.

## Fuente de Verdad
- `context/SPECs/SPEC_ARCH-20260516-11-RAW-PREDIAGNOSTICO-SIEMPRE-VISIBLE.md`

## Alcance mínimo
- Ajustar `frontend/src/components/clinical/StudyPrediagnosisRawPanel.tsx`.
- Eliminar el retorno silencioso `null` cuando falte `inputDebug`.
- Mostrar el mismo contenedor técnico oscuro con un estado vacío honesto y breve.

## Restricciones
- No tocar backend ni persistencia.
- No alterar el contenido técnico cuando sí exista `input_debug`.
- No mover el panel fuera del card salvo que sea estrictamente necesario.

## Validación pedida
- Verificar un caso con `input_debug` presente.
- Verificar un caso sin `input_debug` para confirmar que el panel sigue visible con mensaje de ausencia histórica.
- Correr validación de errores del archivo tocado y generar checkpoint.