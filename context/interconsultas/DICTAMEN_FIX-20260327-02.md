# DICTAMEN TÉCNICO: Lectura UX forense breve del workspace IA con desperdicio vertical
- **ID:** FIX-20260327-02
- **Fecha:** 2026-03-27
- **Solicitante:** HUMANO
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz
El síntoma descrito es un workspace que ya ganó densidad horizontal, pero sigue perdiendo eficiencia vertical por acumulación de jerarquías persistentes. La causa raíz más probable no es el grid de dos columnas, sino la suma de cuatro capas que compiten por altura útil: header global del evento, cabecera interna del worker con progreso, sidebar persistente y separación vertical generosa entre bloques. El resultado es que el viewport útil para revisar archivo, extracción y prediagnóstico queda comprimido, obligando a scroll antes de entrar al trabajo real.

### B. Justificación de la Solución
No se aplicaron cambios de código. La recomendación forense es atacar primero densidad y jerarquía visual antes que rediseñar componentes: consolidar cabeceras, adelgazar sidebar y recortar gaps/espaciados verticales. Eso devuelve altura útil sin alterar el flujo clínico ni el modelo mental del usuario.

### C. Instrucciones de Handoff para INTEGRA
1. Priorizar una sola franja superior dominante por viewport y degradar la otra a subbarra compacta o estado inline.
2. Revisar si la sidebar de estudios debe permanecer siempre expandida o puede pasar a modo más estrecho/colapsable durante lectura documental.
3. Validar que los primeros ajustes sean de spacing, sticky behavior y alturas mínimas antes de tocar estructura funcional.