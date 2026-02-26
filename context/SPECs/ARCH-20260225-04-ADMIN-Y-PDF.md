# SPEC: Administración AMI y Motor de Dictámenes (Fase 4)

- **ID:** ARCH-20260225-04
- **Autor:** INTEGRA
- **Estado:** ✅ COMPLETADO

## 📌 Contexto
Las Fases 1 a 3 nos permitieron construir el flujo de captura médica, el "Cableado Completo" (integridad referencial), la lectura con Inteligencia Artificial (Gemini) y un Portal B2B Empresarial. Ahora, el sistema necesita cerrar la brecha hacia la operabilidad real de la clínica.

El personal que administra AMI no tiene actualmente un panel central para agregar nuevos médicos, recepcionistas, o definir el Catálogo de Servicios (Estudios de Laboratorio, RX, etc.). Asimismo, aunque el médico validador firma un "Dictamen", este no genera un documento legal en PDF que la empresa pueda descargar.

## 🎯 Objetivos del Sprint 4

### 1. Panel de Control Administrativo (Internal Backoffice)
Construir las pantallas bajo el layout principal (perfil `ADMIN`) para:
- **Gestión de Usuarios (Personal AMI):** CRUD para registrar Doctores (Generales y Validadores), Recepcionistas, y Capturistas.
- **Catálogo de Servicios:** CRUD para los estudios que ofrece la clínica (ej. `Audiometría`, `Biometría Hemática`), incluyendo código interno y categoría.
- **Perfiles de Servicio (Baterías):** Capacidad de agrupar servicios en "Paquetes" que se le vendan a las Empresas Cliente.

### 2. Motor de Generación de Dictámenes (Documentos Oficiales en PDF)
Crear un micro-servicio o action interno (usando librerías como `pdfmake`, `jspdf`, `react-pdf`, o conversión HTML-to-PDF de Vercel/Playwright) que:
- Tome la data de un `MedicalVerdict` recién firmado.
- Inserte los datos del Trabajador, Empresa y Resultados en una plantilla corporativa estandarizada.
- Genere el archivo PDF y guarde su ruta en `MedicalVerdict.pdfUrl`.
- Habilite el botón "Descargar PDF" que quedó como placeholder en el Portal B2B (`/portal/events`).

## 🧱 Arquitectura de la Solución
- **Rutas Frontend (App Router):**
  - `/admin/users`
  - `/admin/services`
  - `/admin/profiles`
- **Generación PDF:** 
  - Se recomienda crear un endpoint tipo API Route (`/api/generate-pdf/[eventId]`) que reciba la petición tras la firma del médico validador, construya el PDF en memoria y lo sirva/guarde. Para no depender de almacenamientos complejos de terceros temporalmente (S3), el PDF podría enviarse directamente al flujo de respuesta base64 o almacenarse temporalmente.

## 🚦 Gate Conditions (Criterios de Éxito)
1. [x] El Administrador puede dar de alta un nuevo `Médico Validador` en la interfaz.
2. [x] El Administrador puede crear 2 nuevos Servicios y meterlos en un Perfil de Servicio.
3. [x] Al aprobar un expediente (Medical Board), el sistema crea y provee un PDF oficial del Dictamen Médico.
4. [x] Un cliente logueado en el Portal B2B puede descargar dicho PDF.
