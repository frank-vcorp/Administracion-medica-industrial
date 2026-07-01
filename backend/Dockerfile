FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN apt-get update && apt-get install -y tesseract-ocr libtesseract-dev poppler-utils && rm -rf /var/lib/apt/lists/*
# IMPL-20260701-06: Instalar prisma==0.15.0 (cliente Python) ANTES de generar
# el cliente; el comando 'prisma generate' necesita el binario de prisma CLI.
RUN pip install --no-cache-dir -r requirements.txt

# Crear directorios necesarios para uploads, certificados y reportes
RUN mkdir -p /uploads /app/certs /app/reports

COPY . .

# IMPL-20260701-06: Generar el cliente Prisma Python desde el schema espejo
# backend/prisma/schema.prisma (NO se usa frontend/prisma/ porque el contexto
# de build de Railway es backend/, no la raíz del repo). El cliente generado
# se escribe DENTRO del paquete prisma instalado en site-packages, lo cual
# es el comportamiento por defecto de prisma-client-py.
# --generator pyclient: solo genera el cliente Python (no intenta usar el
# CLI de Node, que tampoco está instalado en la imagen slim).
RUN prisma generate --schema=prisma/schema.prisma --generator pyclient

# PYTHONPATH: los módulos services/ y schemas/ viven dentro de /app/app/
ENV PYTHONPATH="/app/app"

# Railway asigna un puerto dinámico via $PORT; shell form permite la expansión
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

