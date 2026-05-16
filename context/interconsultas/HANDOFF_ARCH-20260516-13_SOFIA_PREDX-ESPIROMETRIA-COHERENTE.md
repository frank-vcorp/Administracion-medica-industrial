# HANDOFF ARCH-20260516-13 -> SOFIA

## Contexto

El siguiente frente después de ampliar la extracción de Espirometría es evitar que el prediagnóstico cierre con etiquetas clínicas que contradigan la tabla fuente o su propia justificación numérica.

## Objetivo

Hacer que el prediagnóstico de Espirometría sea clínicamente coherente con la tabla extraída, con degradación prudente a no concluyente cuando la evidencia no soporte un cierre firme.

## Fuente de Verdad

- `context/SPECs/SPEC_ARCH-20260516-13-ESPIROMETRIA-PREDIAGNOSTICO-COHERENTE.md`

## Alcance mínimo

1. Ajustar el prompt de Espirometría en `backend/app/services/ai/prediagnostic.py`.
2. Consumir la nueva estructura extractiva exhaustiva sin romper compatibilidad hacia atrás.
3. Añadir o ajustar pruebas que cubran conflicto típico: `ratio` conservado + `FVC` reducida.
4. Agregar `recommendation` prudente y útil cuando proceda.

## Restricciones

1. No mezclar dictamen final ni aptitud laboral.
2. No asumir que todo estudio con FVC baja es restrictivo definitivo.
3. Si hay conflicto interno o calidad baja, degradar a `AI_NON_CONCLUSIVE`.

## Validación pedida

1. Probar al menos un caso con FVC reducida y ratio conservado.
2. Verificar que la salida no contradiga la justificación.
3. Generar checkpoint técnico.