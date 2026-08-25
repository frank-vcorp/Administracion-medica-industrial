# ADR-20260825-01 — Entregable común para Audiometría con contrato clínico propio

- **Estado:** ACCEPTED / listo para implementación conforme a SPEC
- **Fecha:** 2026-08-25
- **Origen:** `DEC-20260825-02`, `BR-20260825-03`, `FND-20260825-05` a `FND-20260825-09`

## Contexto

Espirometría validó un ciclo de entrega compuesto por contexto clínico, documento fuente, extracción, prediagnóstico asistido, revisión médica, aceptación y PDF validado. Audiometría debe reutilizar ese ciclo, pero sus documentos, cuestionario, frecuencias, criterios de interpretación y contenido final son diferentes.

Los insumos AMI recibidos son: salida gráfica del audiómetro, PDF final con tabla/diagnóstico/recomendación, cuestionario auditivo y programa de criterios de interpretación.

## Decisión

Se reutiliza el flujo operativo y de trazabilidad de Espirometría, parametrizado por tipo de Event. Audiometría tendrá un contrato propio para:

- antecedentes y exploración física;
- tabla de umbrales por oído/frecuencia;
- vía aérea/vía ósea cuando el documento lo exponga;
- PTA y porcentajes cuando sean fuente documental;
- diagnóstico nosológico y etiológico como evidencia fuente separada;
- interpretación derivada y recomendación prudente;
- revisión y aceptación médica;
- PDF final validado.

## Reglas y límites

1. La tabla numérica y los símbolos visibles son la fuente primaria de valores; no se inventan frecuencias ausentes.
2. El documento final AMI se conserva conceptualmente como fuente documental distinta de la interpretación generada.
3. La clasificación combinará patrón por frecuencias y PTA/criterio AMI.
4. Rangos no definidos por AMI son no concluyentes y requieren revisión.
5. `1000 Hz` es frontera entre graves y agudos, sin duplicación en promedios.
6. Diagnóstico y recomendación del PDF AMI no se copian como conclusión de IA.
7. La persistencia definitiva de fuente y entregable queda fuera de este incremento.
8. No se implementa hasta completar la SPEC y cerrar cualquier gap clínico restante.

## Alternativas descartadas

- Copiar el contrato de Espirometría sin adaptar criterios.
- Inferir 250/4000/6000/8000 Hz cuando el documento sólo contiene 500/1000/2000/3000 Hz.
- Usar únicamente PTA o únicamente el peor umbral.
- Promover automáticamente el diagnóstico textual de AMI a diagnóstico del sistema.

## Consecuencia

El flujo común puede convertirse después en una capacidad multi-Event; el contrato de Audiometría queda encapsulado en su SPEC y calibración.
