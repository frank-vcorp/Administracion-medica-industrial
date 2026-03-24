# DICTAMEN TÉCNICO: Evaluación UX del Paso 3 como Workspace Dedicado
- **ID:** FIX-20260324-05
- **Fecha:** 2026-03-24
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
El problema que se quiere resolver es real: si el Paso 3 mezcla todos los estudios en una sola página expandible, el flujo se vuelve largo, ambiguo y difícil de operar. Para un entorno clínico con estudios heterogéneos, un workspace dedicado por estudio reduce ruido y separa mejor responsabilidades.

Riesgos principales del patrón propuesto:
1. **Pérdida de contexto operativo:** si al entrar al workspace desaparece demasiado la navegación global, el usuario puede sentir que “salió” del expediente o no saber cómo volver al flujo principal.
2. **Desorientación entre resumen y detalle:** si la lista inicial no muestra estados claros, responsable, tipo de estudio y siguiente acción, el usuario no entenderá por qué debe entrar a cada vista dedicada.
3. **Confusión por doble jerarquía:** si conviven menú global, sidebar de estudios, tabs internas y acciones secundarias, el workspace deja de simplificar y pasa a competir por atención.
4. **Sobrecarga móvil y multirol:** laboratorio, rayos X y médico no recorren el paso igual; en móvil o pantallas estrechas, un patrón lateral mal resuelto puede volver lento el cambio entre estudios.

### B. Justificación de la Solución
Qué evitar:
1. No mostrar dos sidebars completos al mismo tiempo.
2. No mezclar en el mismo patrón lista expandible + workspace dedicado; eso duplica mentalmente el modelo de interacción.
3. No ocultar el contexto del evento: trabajador, empresa, cita y estado general de la papeleta deben permanecer visibles.
4. No dejar estudios sin semáforo operativo claro: pendiente, en captura, muestra tomada, archivo cargado, completado.
5. No hacer que el usuario vuelva siempre al resumen para cambiar de estudio en escritorio; el cambio lateral directo sí aporta valor.
6. No trasladar al Paso 3 elementos clínicos base que ya quedaron asignados al Paso 2, porque reintroduce ambigüedad funcional.

### C. Instrucciones de Handoff para INTEGRA
Recomendación final: **sí, el patrón workspace es correcto**, pero debe implementarse como un **workspace controlado**, no como una subapp aislada.

Ajuste recomendado:
1. Mantener una **vista resumen inicial** fuerte como punto de entrada.
2. Al abrir un estudio, dejar visible una sola capa de navegación activa: estudios de la papeleta.
3. Conservar un **header persistente del evento** y una salida explícita al flujo superior.
4. En escritorio, usar navegación lateral de estudios; en móvil, reemplazarla por selector compacto o drawer.
5. Tratar el menú global como chrome secundario colapsado o fuera de foco, pero no hacerlo desaparecer de forma irreversible.

Conclusión forense: el riesgo no está en adoptar el workspace, sino en implementarlo sin contexto persistente ni estados visibles. Si se respetan esas guardas, el workspace dedicado es el patrón más limpio para Paso 3 y es preferible a una lista expandida.

### Nota Forense
Se intentó obtener segunda opinión con Qodo CLI en modo de solo lectura, pero la herramienta ya no está disponible en este entorno.