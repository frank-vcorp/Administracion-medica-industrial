# HANDOFF ARCH-20260516-12 -> SOFIA

## Contexto

Se revisó un layout real de Espirometría y quedó claro que el contrato actual es demasiado corto. Hoy solo capturamos un núcleo mínimo, pero el documento trae muchos más datos visibles y útiles para calibración.

## Objetivo

Implementar extracción exhaustiva de Espirometría basada en tabla numérica, preservando todos los datos fuente visibles del layout real.

## Fuente de Verdad

- `context/SPECs/SPEC_ARCH-20260516-12-ESPIROMETRIA-EXTRACCION-EXHAUSTIVA.md`

## Alcance mínimo

1. Ampliar el prompt de `Espirometria` en `backend/app/services/ai/extractor.py`.
2. Ampliar el schema en `backend/app/schemas/medical.py` para soportar los bloques:
   - `paciente`
   - `estudio`
   - `condiciones`
   - `parametros`
   - `calidad`
   - `graficas`
3. Ajustar pruebas del slice en backend.
4. Mantener la capa estrictamente extractiva, sin interpretación clínica.

## Restricciones

1. No mezclar diagnóstico ni prediagnóstico dentro de la extracción.
2. No perder filas no reconocidas del cuadro.
3. Priorizar siempre tabla sobre gráfica.
4. No rediseñar otras pruebas médicas en esta entrega.

## Validación pedida

1. Validar el schema y el prompt sin errores.
2. Dejar al menos una prueba dirigida para el layout real de referencia.
3. Generar checkpoint técnico de implementación.