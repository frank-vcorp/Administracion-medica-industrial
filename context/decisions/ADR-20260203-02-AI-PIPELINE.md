# ADR-20260203-02: Flujo de Procesamiento IA (Lector)

## Contexto
El sistema requiere extraer información automáticamente de archivos PDF/Imágenes (Estudios médicos) subidos por los capturistas.

## 🏗️ Arquitectura Propuesta (Asíncrona / Híbrida)

El flujo funciona mediante un modelo de "Volumen Compartido" para evitar mover archivos pesados por HTTP.

### Diagrama de Flujo

```mermaid
sequenceDiagram
    participant User as Capturista
    participant Next as Next.js (Frontend)
    participant FS as Shared Volume (/uploads)
    participant Python as Python API (IA)
    participant DB as PostgreSQL

    User->>Next: Subir PDF (Audiometría.pdf)
    Next->>FS: Guardar archivo físico
    Next->>DB: Crear registro StudyRecord (Status: PENDING)
    
    Next->>Python: POST /extract { path: "/uploads/file.pdf" }
    activate Python
    
    Note over Python: 1. Leer archivo desde FS
    Note over Python: 2. OCR (Extraer texto)
    Note over Python: 3. LLM/Regex (Estructurar JSON)
    
    Python-->>Next: Retornar JSON { "oido_izq": 20, "oido_der": 15 }
    deactivate Python

    Next->>DB: Actualizar StudyRecord (Data + Status: COMPLETE)
    Next-->>User: Mostrar Datos Extraídos
```

### 🧠 ¿Cómo funciona el "Lector"?

#### 1. Ingesta (Lo que ya hicimos)
El frontend recibe el archivo y lo deja en una carpeta que **ambos sistemas ven**.

#### 2. Extracción (Python)
Usaremos un pipeline en Python. En esta fase inicial (MVP), será un **Stub** (Simulador), pero el diseño final contempla:
*   **Librería OCR**: `PyMuPDF` o `Tesseract` para convertir la imagen/PDF a texto plano.
*   **Parser Inteligente**: 
    -   *Opción A (Reglas)*: Regex si el formato es fijo.
    -   *Opción B (LLM)*: Enviar el texto a un modelo (Gemini/OpenAI) con un prompt: "Extrae los valores de dB por frecuencia".

#### 3. Consumo (Next.js)
El frontend recibe la respuesta JSON estructurada y la guarda en la base de datos.
El médico ve los valores ya "tecleados" automáticamente, solo tiene que validar.

## Decisiones
- Se usa **Comunicación Síncrona** (HTTP POST) para el MVP para simplificar (el usuario espera unos segundos).
- En el futuro, si el proceso tarda >10s, se moverá a **Colas (Redis/Celery)**.
