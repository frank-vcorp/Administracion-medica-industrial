# Checkpoint IMPL-20260518-14 — Renderer Clínico: Audiometría

**Fecha:** 2026-05-18
**ID:** IMPL-20260518-14
**Agente:** SOFIA - Builder
**SPEC de respaldo:** context/SPECs/SPEC_ARCH-20260518-14-RENDERER-CLINICO-AUDIOMETRIA.md

---

## Resumen

Extensión del renderer clínico general para soportar **Audiometría** como segundo estudio real, junto a Espirometría.

---

## Archivos Tocados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/clinical/extraction-presentation-schemas.ts` | +tipo `BilateralFrequencyTableSection`, unión `ClinicalPresentationSection` actualizada, `audiometriaSchema`, registro en `STUDY_PRESENTATION_SCHEMAS` |
| `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` | +import `BilateralFrequencyTableSection`, +`BilateralFrequencyTableBlock`, case `bilateralFrequency` en `SectionBlock` |

**Backend:** sin cambios.  
**Fallback genérico:** sin cambios, sigue activo para estudios sin schema.

---

## Qué se implementó

### Nuevo tipo en schemas

```typescript
export type BilateralFrequencyTableSection = {
  kind: "bilateralFrequency"
  title: string
  rightKey: string   // oido_derecho
  leftKey: string    // oido_izquierdo
  preferredOrder?: number[]
}
```

Unión `ClinicalPresentationSection` extendida con el nuevo tipo.

### Schema Audiometría

Secciones en orden:
1. **Resumen del estudio** — `paciente`, `fecha_estudio`, `completitud_documental`, `notas_calidad`
2. **Umbrales audiométricos por frecuencia** — tabla `bilateralFrequency` con `preferredOrder: [250, 500, 1000, 2000, 3000, 4000, 6000, 8000]`
3. **Campos fuente del formato** — `faringe`, `cad`, `cai`, `mtd`, `mti`

### BilateralFrequencyTableBlock

- Fusiona `oido_derecho` y `oido_izquierdo` por frecuencia
- Columnas: **Frecuencia (Hz) / Oído derecho / Oído izquierdo**
- Orden: preferredOrder primero, luego frecuencias extra ordenadas numéricamente
- Celdas vacías (`—`) si una frecuencia sólo está en un oído
- `overflow-x-auto` para scroll horizontal en móvil

---

## Soft Gates

| Gate | Estado | Evidencia |
|------|--------|-----------|
| 1. Compilación | ✅ | `tsc --noEmit` salida vacía (0 errores) + IDE sin errores |
| 2. Testing | ⚠️ Pendiente | No hay test unitario dedicado al nuevo bloque |
| 3. Revisión | ✅ | Código revisado: no inventa campos, fallback intacto |
| 4. Documentación | ✅ | JSDoc en archivo, checkpoint generado |

---

## Riesgos Residuales

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| Backend puede enviar frecuencias como string `"250"` o número `250` | Bajo | `BilateralFrequencyTableBlock` normaliza todas las claves con `Number(key)` para el set, y busca con `String(freq)` — cubre ambos casos |
| `oido_derecho` / `oido_izquierdo` llegan vacíos o null | Bajo | Guarda defensivo: si el mapa está vacío, el bloque retorna `null` sin romper |
| Frecuencias fuera del preferredOrder estándar | Bajo | Se muestran al final ordenadas numéricamente, sin perder datos |
| Gate 2 sin cobertura unitaria | Medio | Queda pendiente test para `BilateralFrequencyTableBlock` con mock de datos |

---

## Próximo paso recomendado

- Invocar GEMINI para auditoría QA / prueba visual con datos reales
- Agregar test unitario para el bloque bilateral (cobertura Gate 2)
