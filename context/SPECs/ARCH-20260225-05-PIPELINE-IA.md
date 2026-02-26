# SPEC: Refinamiento de Pipeline IA y Ofimática (Fase 6)

**ID:** ARCH-20260225-05-PIPELINE-IA
**Autor:** INTEGRA (Arquitecto)
**Fecha:** 2026-02-25
**Estado:** ✅ COMPLETADO
**Version:** 1.0

---

## 1. Resumen Ejecutivo
Esta especificación define la arquitectura para la Fase 6 del proyecto "Residente Digital", enfocada en potenciar las capacidades de Inteligencia Artificial para el procesamiento de documentos médicos y la generación automatizada de entregables ofimáticos con validez legal (firma digital). Se busca pasar de un "OCR genérico" a una "Comprensión Estructurada" por tipo de estudio, y habilitar la generación masiva de reportes para empresas.

---

## 2. Contexto y Problema

### 2.1 Situación Actual
- El sistema utiliza Gemini 1.5 Flash para leer documentos, pero usa un prompt genérico o basado en palabras clave del nombre del archivo.
- La extracción de datos es "plana" (texto libre o JSON básico) y no valida reglas de negocio específicas por estudio (ej: rangos de audiometría).
- No existe mecanismo para firmar digitalmente los dictámenes generados, lo cual es requisito legal para validez en medicina ocupacional.
- Los reportes se generan uno a uno; no hay capacidad de consolidar resultados de 100 trabajadores en un solo entregable (Reporte Epidemiológico).

### 2.2 Problema a Resolver
1. **Clasificación Débil:** Si el archivo no dice "audiometria", el sistema falla en aplicar la lógica correcta.
2. **Datos No Estructurados:** Dificulta el análisis estadístico posterior (ej: "¿Cuántos trabajadores tienen hipoacusia?").
3. **Falta de Validez Legal:** Los PDFs generados carecen de firma criptográfica.
4. **Ineficiencia Administrativa:** Generar reportes individuales para una empresa con 500 empleados es inviable.

### 2.3 Usuarios Afectados
- **Personal Médico:** Requiere pre-llenado preciso de formatos específicos.
- **Administrativos:** Necesitan reportes masivos para facturación y entrega a clientes.
- **Empresas Clientes:** Requieren documentos legales válidos (firmados).

---

## 3. Solución Propuesta

### 3.1 Descripción General
Se implementará un "Pipeline Inteligente de Documentos" en el backend Python (FastAPI) que actúe como motor de clasificación y extracción especializado. Simultáneamente, se desarrollará un módulo de "Ofimática Avanzada" para la generación de PDFs firmados y reportes masivos.

### 3.2 Arquitectura del Pipeline IA
El procesamiento se dividirá en 2 etapas:
1. **Clasificación (Router):** Gemini Vision analiza la imagen/PDF y determina el tipo documental (Audiometría, Espirometría, Laboratorio, Rayos X, Otro).
2. **Extracción Especializada (Extractors):** Según el tipo, se aplica un esquema Pydantic estricto y un prompt optimizado para extraer variables clave.

### 3.3 Arquitectura de Ofimática
- **Motor de Reportes:** Servicio en Python (usando `ReportLab` o `WeasyPrint`) expuesto vía API para generar PDFs complejos.
- **Firma Digital:** Módulo criptográfico (`pyHanko` o `cryptography`) para firmar PDFs usando certificados X.509 (.cer/.key) almacenados de forma segura (Vault o variables de entorno en MVP).

---

## 4. Requisitos

### 4.1 Funcionales (Pipeline IA)
- [x] **RF-IA-01:** Clasificación automática de documentos sin depender del nombre del archivo.
- [x] **RF-IA-02:** Extracción estructurada para **Audiometría** (Hz por oído, promedios).
- [x] **RF-IA-03:** Extracción estructurada para **Laboratorio** (tabla de analitos fuera de rango).
- [x] **RF-IA-04:** Extracción estructurada para **Espirometría** (FEV1, FVC, % predicho).
- [x] **RF-IA-05:** Detección de anomalías (highlighting) en los valores extraídos.

### 4.2 Funcionales (Ofimática y Firma)
- [x] **RF-PDF-01:** Generación de "Dictamen Final" en PDF con layout corporativo.
- [x] **RF-PDF-02:** Integración de Firma Digital (e.firma / certificado sello digital) en el PDF final.
- [x] **RF-REP-01:** Generación de Reporte Epidemiológico (Excel/PDF) consolidando datos de N expedientes.

### 4.3 No Funcionales
- [x] **RNF-01:** Tiempo de procesamiento IA < 10 segundos por página.
- [x] **RNF-02:** Seguridad: Las llaves privadas de firma NUNCA deben exponerse ni guardarse en texto plano en DB.

---

## 5. Diseño Técnico

### 5.1 Modelos de Datos (Backend Python)

```python
# Esquemas Pydantic Propuestos para Extracción

class AudiometriaData(BaseModel):
    oido_derecho: dict[int, int] # {500: 10, 1000: 15...}
    oido_izquierdo: dict[int, int]
    diagnostico_ia: str
    recomendaciones: list[str]

class LaboratorioData(BaseModel):
    estudio: str # "Biometría Hemática", "Química Sanguínea"
    valores_anormales: list[dict[str, str]] # [{"parametro": "Glucosa", "valor": "110", "referencia": "70-100"}]
    interpretacion: str

class DocumentClassification(BaseModel):
    tipo: Literal["Audiometria", "Espirometria", "Laboratorio", "Rx", "Otro"]
    confianza: float
```

### 5.2 API Endpoints (Python FastAPI)

| Método | Ruta | Descripción | Request | Response |
|--------|------|-------------|---------|----------|
| POST | `/api/v1/analyze` | Analiza y extrae datos | `file: UploadFile` | JSON Estructurado |
| POST | `/api/v1/sign-pdf` | Firma un PDF existente | `file_path, cert_id` | URL PDF Firmado |
| POST | `/api/v1/reports/batch` | Genera reporte masivo | `event_ids: list[str]` | URL Reporte (PDF/XLSX) |

### 5.3 Cambios en Base de Datos (Prisma)

```prisma
model MedicalStudy {
  // ... campos existentes
  documentType String? // "AUDIOMETRIA", "LAB", etc.
  structuredData Json? // Guardar aquí el JSON extraído por la IA
  signedPdfPath String? // Ruta al PDF firmado si existe
  signedCheckcode String? // Hash de validación de firma
}
```

---

## 6. Plan de Implementación

### 6.1 Fase 6.1: Refactorización Backend IA (Python)
| # | Tarea | Asignado |
|---|-------|----------|
| 1 | Crear estructura de carpetas `app/services/ai/` y `app/schemas/` | SOFIA |
| 2 | Implementar `ClassifierService` con Gemini Vision | SOFIA |
| 3 | Implementar `ExtractorService` con esquemas Pydantic por tipo | SOFIA |
| 4 | Actualizar endpoint `/analyze` para usar el nuevo pipeline | SOFIA |

### 6.2 Fase 6.2: Firma Digital y Reportes
| # | Tarea | Asignado |
|---|-------|----------|
| 1 | Implementar servicio de firma PDF (`SignerService`) con certificados de prueba | SOFIA |
| 2 | Crear endpoint de generación masiva (`ReportService`) | SOFIA |
| 3 | Conectar Frontend: Botón "Firmar Dictamen" y "Descargar Reporte Masivo" | SOFIA |

### 6.3 Dependencias
- Librerías Python: `pydantic`, `google-generativeai`, `reportlab` (o `weasyprint`), `pyhanko` (para firma).
- Certificados de prueba OpenSSL para desarrollo (`openssl req -x509 ...`).

---

## 7. Criterios de Aceptación
- [ ] El sistema identifica correctamente una Audiometría vs un Lab sin pistas en el nombre de archivo.
- [ ] El JSON extraído de una Audiometría contiene las frecuencias 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
- [ ] Se puede generar un PDF que al abrirse en Adobe Reader muestre "Firmado y todas las firmas son válidas".
- [ ] El reporte masivo agrupa diagnósticos de múltiples pacientes correctamente.

