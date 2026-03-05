# 🎨 Handoff para Walkthrough UI & Refinamiento (Antigravity)
**ID:** HANDOFF-UI-20260305
**Objetivo:** Pruebas E2E, Capturas de Pantalla y Refinamiento Estético del Circuito Clínico.

## 🤖 Contexto para Agente Antigravity (Sugerencia: Haiku)
Hola agente de la Fase 2 (The Studio). Somos la Fase 1 (The Workshop). Hemos terminado de construir la arquitectura backend completa (NextJS + Prisma + PostgreSQL) del circuito del expediente clínico.

Las pantallas son funcionalmente perfectas pero visualmente muy rústicas (HTML plano/botones simples). Tu misión es **recorrerlas, documentar el antes/después con capturas y aplicar estilos Tailwind/Shadcn.**

Claude 3.5 Haiku es rapidísimo para recorrer código frontend repetitivo (estilar 30 inputs) y ajustar UI rápidamente.

## 📸 Rutas a Recorrer y Capturar (Sugerir a usuario)
Pide al humano (Frank/Leticia) que navegue en la URL de Vercel (o localhost) y brinde capturas de los siguientes momentos:

1. **Ruta:** `/workers` -> Perfil del trabajador.
   - *Misión:* Estilizar los botones de "Crear Cita". 
2. **Ruta:** `/history/[workerId]` -> Historial Médico del paciente.
   - *Misión:* Arreglar los espaciados en los inmensos formularios de antecedentes (Heredofamiliares, Quirúrgicos, Alergias).
3. **Ruta:** `/reception` ó `/events` -> Cita en estado `CHECKED_IN`.
   - *Misión:* Validar el botón visual para "Pasar a la Sala" (Paso de Recepción a Enfermera).
4. **Ruta:** `/events/[eventId]` -> (Estado: `CHECKED_IN`).
   - *Misión UI:* Poner hermoso el componente `TriageForm.tsx`. Hacer que el texto calculado de "IMC: XX (OBESIDAD)" se vea como un "badge" dinámico y alertador (rojo/verde).
5. **Ruta:** `/events/[eventId]` -> (Estado: `IN_PROGRESS`).
   - *Misión UI:* Aquí entra en acción el `DoctorExamForm.tsx` (God Mode). Ajustar el diseño de "Tabs" (Agudeza Visual vs Exploración Física). Dividir los 30+ campos de exploración en columnas de 3 (CSS Grid) para que no parezca un formulario infinito hacia abajo.

## 🛠️ Archivos Frontend Clave a Modificar (Solo UI, no tocar lógica Zod / Prisma):
- `frontend/src/components/clinical/TriageForm.tsx`
- `frontend/src/components/clinical/DoctorExamForm.tsx`
- `frontend/src/app/events/[id]/page.tsx`

> **Nota:** La estructura de Prisma JSON y las Server Actions ya funciona a la perfección. Enfócate estrictamente en clases de Tailwind, interactividad, paddings, íconos y layout responsivo (especialmente optimizado para Tablets/iPad que es lo que usarán médicos/enfermeras).
