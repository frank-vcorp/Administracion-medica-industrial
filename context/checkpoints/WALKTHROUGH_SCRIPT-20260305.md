# 🎥 Guión de Navegación y Capturas - Paseo de Flujo Clínico Activo
**Objetivo para el Agente Antigravity (SOFIA):** Usando tu herramienta nativa de navegación (Browser / Act), debes realizar un recorrido E2E (End-to-End) en `localhost:3000` simulando el proceso de un paciente nuevo.

En cada uno de estos hitos, debes detenerte y **tomar una captura de pantalla visible** para que el HUMANO las recolecte y arme una presentación para Lety de AMI. El recorrido es así:

### Parte 1: Creación de Bases (La Secretaria)
1. **Crear Empresa:** Navega al módulo de Empresas y registra "Industrias Ford SA de CV". *(Toma Captura)*.
2. **Crear Trabajador:** Navega a Trabajadores y registra a "Juan Mendoza" asignado a Ford. *(Toma Captura)*.
3. **Agendar Cita:** Navega a Citas, agenda un Examen General de Ingreso para Juan Mendoza el día de hoy. *(Toma Captura)*.

### Parte 2: Piso 1 - La Sala de Espera (El Paciente)
1. **Ingreso a Clínica:** Ve a Recepción (`/reception` o en Eventos) y cambia la Cita al estado `CHECKED_IN` (En Sala). *(Toma Captura del Dashboard)*.
2. **Historia Clínica de Vida:** Navega al perfil del usuario `Juan Mendoza` y entra a la sección "Historial Clínico".
3. **Llenado Inicial:** Escribe algunos datos de prueba (P.ej. Alergias: Penicilina, Cirugías: Apendicitis) y presiona "Guardar". *(Toma Captura)*.

### Parte 3: Piso 2 - El Triaje (La Enfermera)
1. **Atención:** En la lista de Recepción/Eventos, dale click al Expediente del paciente que actualmente debe decir `CHECKED_IN`.
2. **Somatometría:** Ingresa al recuadro "TriageForm" los siguientes datos fijos:
   - **Peso_kg:** 95
   - **Talla_m:** 1.65
   - Comprueba visualmente que el IMC se autocalcula y marca "OBESIDAD". 
3. **Guardar:** *(Toma Captura del IMC)* y luego da clic en "Guardar Somatometría".

### Parte 4: Piso 3 - God Mode (El Médico)
1. **Transición Exitosa:** Al guardar el Triaje, la UI cambiará mágicamente para mostrar los formularios del médico. El estado ahora es `IN_PROGRESS` (Estudios).
2. **Agudeza Visual:** Muestra la pestaña de Agudeza Visual *(Toma Captura)*. Modifica un solo campo (Ej. Visión de colores) y guárdala.
3. **Exploración Física:** Muestra la pestaña de Exploración física *(Toma Captura larga si aplica, son +30 campos)*. Llena 2 campos (Ej. "Neurológico: Íntegro") y oprime "Guardar Exploración".

> **Misión SOFIA:** Completa el flujo y provee al humano todo el compendio de capturas resultante en formato visual comprobando que la arquitectura construida sea robusta.
