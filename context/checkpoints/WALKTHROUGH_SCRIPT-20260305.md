# 🎥 Guión y Script de Walkthrough para AMI (Demostración a Cliente)
**Objetivo:** Agente IA (Haiku o Sonnet) en Cursor, tu misión es usar herramientas de testing E2E o Puppeteer/Playwright para navegar de forma autónoma el proyecto, y **tomar capturas de pantalla** de cada paso de este recorrido para armar un PDF/Figma comercial para mostrar a AMI.

## Instrucciones para el Agente (Browser Automation)
Levanta `npm run dev` en localhost:3000 y programa un script que haga esto, tomando un screenshot de página completa en cada paso:

### Pantalla 1: El Paciente (La Espera)
1. Navega a `http://localhost:3000/history/[cualquier-id-de-trabajador]`.
2. Llenar los campos de "Alergias: Penicilina", "Enfermedades: Ninguna".
3. **💥 CAPTURA 1:** "Paciente llenando su historial".
4. Hacer click en guardar.

### Pantalla 2: El Tablero General de Recepción
1. Navegar a `http://localhost:3000/events`.
2. Resaltar visualmente una tarjeta (mock) de un evento en estado `CHECKED_IN` (En Sala).
3. **💥 CAPTURA 2:** "Vista del Dashboard con paciente esperando".

### Pantalla 3: El Triaje (Enfermería)
1. Navegar al evento (Ej: `http://localhost:3000/events/[id-evento-valido]`).
2. En la UI actual (botón "CHECKED_IN"), llenar el recuadro "TriageForm":
   - Peso_kg = 90
   - Talla_m = 1.60
   - Esperar a que el texto muestre "IMC: 35.1 (OBESIDAD)".
3. **💥 CAPTURA 3:** "Enfermera capturando Somatometría, visualizando IMC automático".
4. Click en Guardar.

### Pantalla 4: El Consultorio (Modo Doctor)
1. Inmediatamente el sistema cambia al `DoctorExamForm`.
2. Tomar captura en la Tab de **"Agudeza Visual"**.
3. **💥 CAPTURA 4:** "Pestaña de visión oftalmológica".
4. Hacer click en la Tab **"Exploración Física"**.
5. Rellenar 3 o 4 recuadros aleatorios con "Normal".
6. **💥 CAPTURA 5:** "Pestaña Doctor y Exploración general".
7. Click en Guardar (Aparecerá el toast verde de éxito).

> Humano: Ejecuta este Walkthrough con el Agente en Cursor. No le pidas que cambie código hoy, solo que haga el script para tomar estas 5 screenshots y armar una carpeta `/walkthrough-assets/` con las fotos lista para enviársela a Lety / AMI.
