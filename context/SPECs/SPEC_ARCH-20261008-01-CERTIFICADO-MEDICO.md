# SPEC — Certificado médico laboral (EventTest independiente)

**ID:** SPEC_ARCH-20261008-01-CERTIFICADO-MEDICO  
**Origen:** `context/datos AMI/informacion para revision/FORMATO CERTIFICADO MEDICO.docx`  
**Estado:** Implementado en frontend (schema `certificado-medico-v1`)

---

## 1. Alcance

- **Prueba de catálogo:** `CERTIFICADO MEDICO` → un **`EventTest` propio** con `clinicalContext` dedicado.
- **Público general:** perfil con solo certificado (no se diseña concurrencia consulta + certificado en el mismo evento).
- **Entregable:** PDF certificado laboral AMI (un documento).
- **Fuera de alcance:** dictamen de aptitud ocupacional (`MedicalVerdict`), nota/receta de consulta, firma X.509 (“certificado digital”).

---

## 2. Decisiones de producto (acordadas)

| # | Decisión |
|---|----------|
| 2 | Consulta y certificado **no concurrentes** en un evento (sin copiar desde consulta). |
| 3 | **Sistema** compone párrafos legales y secciones I–V en PDF; el médico captura lo clínico específico. |
| 4 | Antecedentes → **`ClinicalHistory`** al guardar (igual que consulta). |
| 5 | Datos **al momento** en `clinicalContext` del certificado. |
| 6 | Sección VI **genérica** (sin texto COVID del DOCX legacy). |
| 7 | Dictamen: **select** + **frase editable** prellenada. |
| 8 | Vitales incluyen **SpO₂** y **agudeza** (VL/VLC/VC/VCC). |
| 9 | PDF keyed por **`eventTestId`** (query). |
| 10 | Membrete Soluciones / Medicina Laboral (mismo criterio que consulta). |
| 11 | Borrador laxo / **Cerrar certificado** estricto → PDF en cierre. |
| 12 | Mismos roles que consulta / PDF clínico. |

---

## 3. Modelo `certificado-medico-v1`

Persistido en `EventTest.clinicalContext`.

- **Médico:** `medico_nombre`, `medico_cedula`, `medico_titulo?`, `medico_universidad?`
- **Expedición:** `lugar_expedicion`, `hora_atencion?`
- **Paciente (solo si difiere del worker):** `sexo_atencion?`, `domicilio_atencion?`, `identificacion_tipo?`, `identificacion_folio?`
- **Antecedentes:** `ClinicalHistoryData` (I–III → narrativa en PDF)
- **Signos vitales:** peso, talla, IMC, TA, FC, FR, T°, SpO₂, agudeza VL/VLC/VC/VCC
- **V–VI:** `exploracion_fisica`, `integracion_diagnostica`, `dictamen_laboral`, `dictamen_laboral_texto`
- **Cierre:** `cerrada_at` (ISO) al finalizar

Estados: `IN_PROGRESS` (borrador) → `RESULT_REGISTERED` (cerrado).

---

## 4. UI (papeleta)

Componente `CertificadoMedicoEstudio`: pestañas Antecedentes, Vitales, Exploración, Dictamen, Cierre (médico + PDF).

Rama en `PapeletaWorkspace`: `isCertificadoMedico` → formulario clínico; sin grid documental.

---

## 5. PDF

- Ruta: `GET /api/pdf/certificado-medico/[eventId]?eventTestId=…`
- Loader valida evento, worker, nombre de prueba y contexto parseado.
- Layout alineado al DOCX: párrafo médico, párrafo paciente, romanos I–VI, cierre legal, firma y pie Soluciones.

---

## 6. Cobro

Sin cambio: tarifa sugerida por evento suma `MedicalTest.options.price` de cada `EventTest` (incl. certificado si tiene precio en catálogo).
