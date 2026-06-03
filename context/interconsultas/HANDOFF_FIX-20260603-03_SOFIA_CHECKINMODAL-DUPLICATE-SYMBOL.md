# HANDOFF FIX-20260603-03 a SOFIA — Corrección de símbolo duplicado en CheckInModal

- ID: FIX-20260603-03
- Fecha: 2026-06-03
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_FIX-20260603-03-CHECKINMODAL-DUPLICATE-SYMBOL.md

## Objetivo

Corregir el error de compilación en [frontend/src/components/CheckInModal.tsx](frontend/src/components/CheckInModal.tsx) provocado por la doble definición de `externalCandidates`.

## Hipótesis ya resuelta

1. existe estado `externalCandidates`
2. existe otra constante local con el mismo nombre
3. la colisión rompe Turbopack durante `pnpm run build`

## Punto de entrada real

1. [frontend/src/components/CheckInModal.tsx](frontend/src/components/CheckInModal.tsx)

## Cambio mínimo obligatorio

1. resolver la colisión de nombres con el menor cambio posible
2. preservar la lógica del flujo externo actual
3. validar con build exacta de frontend

## Restricciones

1. tocar solo el archivo ancla si es posible
2. no ampliar el alcance a otros componentes
3. no cambiar reglas de negocio

## Validación obligatoria

```bash
cd /workspaces/Administracion-medica-industrial/frontend && pnpm run build
```

## Entregable esperado

1. fix puntual en `CheckInModal.tsx`
2. build validada
3. reporte breve de qué nombre o bloque se ajustó