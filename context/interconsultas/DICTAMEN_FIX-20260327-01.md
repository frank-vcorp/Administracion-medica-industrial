# DICTAMEN TÉCNICO: Revisión forense breve de micro-ajustes ergonómicos en workspace IA doble columna
- **ID:** FIX-20260327-01
- **Fecha:** 2026-03-27
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
1. El ajuste de ancho en la vista del evento mejora la ergonomía real del workspace documental porque el contenedor principal ahora usa `max-w-[1500px]` con padding lateral en [frontend/src/app/events/[id]/page.tsx](frontend/src/app/events/[id]/page.tsx#L209). Esto reduce compresión horizontal del layout doble columna y da más aire al visor y al panel clínico en desktop.
2. El sticky no quedó aplicado sobre la columna derecha de evidencia documental, sino sobre la columna izquierda operativa en [frontend/src/components/clinical/PapeletaWorkspace.tsx](frontend/src/components/clinical/PapeletaWorkspace.tsx#L755). La columna derecha de evidencia permanece sin sticky en [frontend/src/components/clinical/PapeletaWorkspace.tsx](frontend/src/components/clinical/PapeletaWorkspace.tsx#L898).
3. Como resultado, el beneficio ergonómico del sticky es parcial y potencialmente invertido respecto al objetivo declarado. Hoy se mantiene visible la columna de operación clínica, pero el visor documental y el raw panel pueden perderse durante el scroll, que era precisamente el caso de uso más valioso para revisión comparativa.
4. No se observan riesgos severos de responsive por el mero aumento de ancho, porque el layout sigue colapsando a una sola columna en `grid-cols-1` antes de `lg` en [frontend/src/components/clinical/PapeletaWorkspace.tsx](frontend/src/components/clinical/PapeletaWorkspace.tsx#L752). El padding lateral adicional también ayuda a evitar que el contenido quede pegado al viewport.

### B. Justificación de la Solución
No se aplicaron cambios de código. La revisión se limitó a contraste entre intención declarada y resultado efectivo en layout.

Conclusión forense breve:
- El ensanche del canvas sí mejora legibilidad y respiración visual del flujo.
- El sticky, tal como está implementado, no materializa el objetivo descrito de mantener fija la evidencia documental.
- El riesgo principal no es de rotura técnica, sino de falsa sensación de mejora: la UX puede parecer "más estable" en desktop, pero el operador sigue perdiendo de vista la evidencia durante scroll largo.

### C. Instrucciones de Handoff para INTEGRA
1. Mantener el aumento de ancho del canvas: aporta valor ergonómico y el riesgo es bajo.
2. Antes de QA manual, validar si el sticky debe vivir en la columna derecha documental. Si la intención era fijar evidencia, el ajuste actual quedó en la columna equivocada.
3. En QA manual, revisar específicamente desktop entre 1024px y 1366px para detectar si el sticky actual produce sensación de desbalance visual o deja demasiado protagonismo a la columna operativa.