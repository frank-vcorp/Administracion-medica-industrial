---
id: GUIA_PRUEBA_IMPL-20260225-02
titulo: Guía de Prueba - Firma Digital y Reportes
fecha: 2026-02-25
---

# 🧪 Guía de Prueba: Firma Digital y Motor de Reportes

## Inicio Rápido

### 1. Iniciar el Backend

```bash
cd backend
docker-compose up -d  # o
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

El servicio estará disponible en `http://localhost:8000`

Health check:
```bash
curl http://localhost:8000/
```

---

## 🔐 Pruebas de Firma Digital

### Test 1: Crear un PDF de Prueba

```bash
# Crear un PDF simple para pruebas
python3 << 'EOF'
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

c = canvas.Canvas("/tmp/test_document.pdf", pagesize=letter)
c.drawString(100, 750, "Documento de Prueba - Firma Digital")
c.drawString(100, 700, "Fecha: 2026-02-25")
c.drawString(100, 650, "Paciente: Juan Pérez García")
c.drawString(100, 600, "Diagnóstico: Apto para labores")
c.save()
print("✓ PDF creado: /tmp/test_document.pdf")
EOF
```

### Test 2: Firmar un PDF

```bash
curl -X POST http://localhost:8000/api/v1/sign-pdf \
  -H "Content-Type: application/json" \
  -d '{
    "input_pdf": "test_document.pdf",
    "output_pdf": "test_document_signed.pdf",
    "reason": "Certificado Médico AMI",
    "password": "test1234"
  }' | python3 -m json.tool
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "message": "PDF firmado correctamente",
  "output_pdf": "/app/uploads/test_document_signed.pdf",
  "signed_at": "2026-02-25T14:35:22.123456",
  "signer": "AMI Test Signer",
  "reason": "Certificado Médico AMI"
}
```

### Test 3: Verificar Firma

```bash
curl -X POST "http://localhost:8000/api/v1/verify-signature?file_path=test_document_signed.pdf" \
  | python3 -m json.tool
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "is_signed": true,
  "signatures_found": 1,
  "method": "basic_check"
}
```

---

## 📊 Pruebas de Reportes

### Test 4: Generar Reporte en Excel

```bash
curl -X POST http://localhost:8000/api/v1/generate-excel-report \
  -H "Content-Type: application/json" \
  -d '{
    "data_list": [
      {
        "id": 1,
        "paciente": "Juan Pérez García",
        "fecha": "2026-02-20",
        "tipo": "Audiometría",
        "resultado": "Normal",
        "doctor": "Dr. López"
      },
      {
        "id": 2,
        "paciente": "María García López",
        "fecha": "2026-02-21",
        "tipo": "Laboratorio",
        "resultado": "Anormal",
        "doctor": "Dra. Martínez"
      },
      {
        "id": 3,
        "paciente": "Roberto Sánchez",
        "fecha": "2026-02-22",
        "tipo": "Radiología",
        "resultado": "Normal",
        "doctor": "Dr. García"
      }
    ]
  }' | python3 -m json.tool
```

**Respuesta:**
```json
{
  "status": "success",
  "message": "Reporte Excel generado correctamente",
  "output_file": "/app/reports/reporte_20260225_143530.xlsx",
  "records_count": 3,
  "format": "xlsx",
  "generated_at": "2026-02-25T14:35:30.123456",
  "filename": "reporte_20260225_143530.xlsx"
}
```

### Test 5: Generar Reporte en JSON

```bash
curl -X POST http://localhost:8000/api/v1/generate-json-report \
  -H "Content-Type: application/json" \
  -d '{
    "data_list": [
      {"id": 1, "paciente": "Juan Pérez", "resultado": "Apto"},
      {"id": 2, "paciente": "María García", "resultado": "No Apto"}
    ]
  }' | python3 -m json.tool
```

### Test 6: Batch de Todos los Formatos

```bash
curl -X POST http://localhost:8000/api/v1/generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "data_list": [
      {
        "id": 1,
        "nombre": "Juan Pérez",
        "empresa": "Constructora XYZ",
        "resultado": "Apto",
        "fecha": "2026-02-25"
      },
      {
        "id": 2,
        "nombre": "María García",
        "empresa": "Transportes ABC",
        "resultado": "No Apto",
        "fecha": "2026-02-25"
      }
    ],
    "formats": ["excel", "json", "html"],
    "title": "Reporte de Aptitud - Febrero 2026"
  }' | python3 -m json.tool
```

**Respuesta:**
```json
{
  "status": "success",
  "generated_files": {
    "excel": "/app/reports/batch_20260225_143600.xlsx",
    "json": "/app/reports/batch_20260225_143600.json",
    "html": "/app/reports/batch_20260225_143600.html"
  },
  "batch_id": "batch_20260225_143600",
  "timestamp": "2026-02-25T14:36:00.123456",
  "errors": []
}
```

---

## 🧪 Ejecución de Tests Unitarios

### Instalar Dependencias de Test
```bash
pip install pytest pytest-cov
```

### Ejecutar Tests
```bash
cd backend
pytest tests/test_pdf_services.py -v
```

### Esperado
```
test_init... PASSED
test_certificate_generation... PASSED
test_sign_pdf_success... PASSED
test_generate_excel_report... PASSED
test_generate_json_report... PASSED
test_batch_process... PASSED
...
============ 18 passed in 2.34s ============
```

---

## 📁 Archivos Generados

Los archivos se crean en:

### Certificados (Firma)
```
/app/certs/
├── test_cert.p12        (Certificado PKCS#12)
└── test_key.pem         (Clave privada, si fallback a PEM)
```

### Reportes
```
/app/reports/
├── reporte_20260225_143530.xlsx
├── reporte_20260225_143530.json
├── reporte_20260225_143530.html
└── batch_20260225_143600_*  (Múltiples formatos)
```

### PDFs Firmados
```
/app/uploads/
├── documento_original.pdf
└── documento_original_signed.pdf
```

---

## 🎯 Casos de Uso Reales

### Escenario 1: Generar Reporte Mensual Completo

```python
import requests

# Datos de múltiples evaluaciones
evaluaciones = [
    {"id": i, "paciente": f"Paciente {i}", "resultado": "Apto"}
    for i in range(1, 101)  # 100 registros
]

# Generar en todos los formatos
response = requests.post(
    "http://localhost:8000/api/v1/generate-report",
    json={
        "data_list": evaluaciones,
        "formats": ["excel", "json"],
        "title": "Reporte Mensual Febrero 2026"
    }
)

print(response.json())
```

### Escenario 2: Firmar y Descargar Certificado

```python
import requests

# 1. Generar reporte HTML
report_response = requests.post(
    "http://localhost:8000/api/v1/generate-report",
    json={"data_list": [...], "formats": ["html"]}
)

# 2. Convertir HTML a PDF (future step)
# 3. Firmar el PDF
sign_response = requests.post(
    "http://localhost:8000/api/v1/sign-pdf",
    json={
        "input_pdf": "reporte.pdf",
        "reason": "Validación Oficial AMI",
    }
)

# 4. Descargar desde /app/uploads/
```

---

## 🔍 Troubleshooting

### Problema: "pyhanko module not found"
**Solución:**
```bash
pip install pyhanko cryptography
```

### Problema: "pandas not installed"
**Solución:**
```bash
pip install pandas openpyxl
```

### Problema: Certificado no se genera automáticamente
**Solución:** Verificar permisos de `/app/certs/`:
```bash
mkdir -p /app/certs
chmod 755 /app/certs
```

### Problema: PDFs no se firman en Mac/Windows
**Solución:** pyHanko requiere librerías del sistema. Usar Docker:
```bash
docker-compose up backend
```

---

## 📞 Contato y Soporte

Para reportar issues o sugerencias de mejora:
- **GitHub Issues:** [Repositorio]
- **Slack:** #backend-team
- **Email:** dev@ami-clinica.mx

---

**Última actualización:** 2026-02-25  
**Versión:** 1.0 (IMPL-20260225-02)
