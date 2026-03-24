## 📋 SPEC HIJA: Formulario de Examen Médico dentro de la Papeleta
**ID:** `ARCH-20260324-04`
**Padre:** `ARCH-20260324-03`
**Objetivo:** Definir el comportamiento funcional y técnico del estudio "Examen Médico" como una prueba especial dentro de la papeleta, resuelta mediante formulario estructurado y no mediante carga de archivo.

### 🎯 Resultado Esperado
Dentro del Paso 3 "Gabinete y Papeleta", la fila de "Examen Médico" debe comportarse como un estudio de la papeleta, pero al interactuar con ella debe abrir un formulario clínico específico para capturar su resultado estructurado.

### ✅ Criterios de Aceptación

#### 1. Ubicación Funcional
- "Examen Médico" aparece listado como una prueba más dentro de la papeleta del evento.
- No se captura en el Paso 2.
- No depende de cajas globales SIM/NOVA.
- Debe convivir con otras pruebas que sí usan archivo o estados operativos.

#### 2. Interacción de la Fila
- La fila de "Examen Médico" debe mostrar una acción principal orientada a abrir o editar el formulario.
- La UI no debe sugerir que este estudio se resuelve subiendo PDF o imagen.
- Si el formulario aún no ha sido llenado, la fila debe indicar estado pendiente.
- Si el formulario ya fue completado, la fila debe indicar estado capturado o completado.

#### 3. Naturaleza del Resultado
- El resultado de "Examen Médico" se guarda como datos estructurados.
- No se modela como archivo adjunto principal.
- Debe existir posibilidad futura de generar un documento derivado a partir de esos datos, pero esa generación no forma parte de esta SPEC.

#### 4. Alcance Funcional del Formulario
- El formulario del Examen Médico se construirá posteriormente.
- Esta SPEC define el contrato funcional para integrarlo a la papeleta.
- El formulario debe poder abrirse desde la fila del estudio sin romper el flujo del Paso 3.
- Debe permitir modo creación y modo edición.

#### 5. Estado Operativo en la Papeleta
- La fila de "Examen Médico" participa del seguimiento general de la papeleta.
- Debe poder distinguirse visualmente de pruebas basadas en archivo.
- El sistema debe soportar que la papeleta contenga simultáneamente:
  - estudios con upload
  - estudios con visor de archivo
  - estudios con toma de muestra
  - estudios con formulario estructurado

### 🧩 Decisiones de Diseño
- "Examen Médico" es una prueba especial de tipo formulario.
- El Paso 2 conserva únicamente la captura clínica base: somatometría, agudeza visual y exploración física.
- La responsabilidad de completar este estudio vive en el flujo de papeleta, no en la captura clínica base.

### 📂 Scope Estimado
- `frontend/src/app/events/[id]/page.tsx`
- Componente de fila o detalle de estudio dentro de papeleta.
- Modelo o action layer para persistir estado de formulario del estudio.
- Integración futura con formulario dedicado de Examen Médico.

### 🚫 Fuera de Alcance
- Diseño final de campos clínicos del formulario.
- Generación de PDF final del Examen Médico.
- Firma electrónica o sellado documental.
- Reglas médicas de validación clínica específicas.

### 🔗 Relación con la SPEC Padre
Esta SPEC no reemplaza la reestructuración de la papeleta. La complementa y fija la regla especial para "Examen Médico", evitando que se trate erróneamente como un estudio de upload.