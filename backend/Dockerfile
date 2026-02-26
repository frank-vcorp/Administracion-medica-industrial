FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN apt-get update && apt-get install -y tesseract-ocr libtesseract-dev poppler-utils && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

# Crear directorios necesarios para uploads, certificados y reportes
RUN mkdir -p /uploads /app/certs /app/reports

COPY . .

# PYTHONPATH: los módulos services/ y schemas/ viven dentro de /app/app/
ENV PYTHONPATH="/app/app"

# Railway asigna un puerto dinámico via $PORT; shell form permite la expansión
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

