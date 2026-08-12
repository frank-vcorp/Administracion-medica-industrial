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

# FIX-20260810-09h: bumpear cache de Docker para forzar re-generación de cliente
# Prisma cuando schema.prisma cambia. Sin esto, Railway puede usar el cliente
# cacheado del layer anterior (sin CalibrationSnapshot).
ARG PRISMA_GENERATE_BUST=20260811-4
RUN echo "Cache bust: $PRISMA_GENERATE_BUST" && \
    prisma generate --schema=prisma/schema.prisma --generator pyclient 2>&1 | tail -10

# PYTHONPATH: los módulos services/ y schemas/ viven dentro de /app/app/
ENV PYTHONPATH="/app/app"

# FIX-20260810-09h: ejecutar prisma generate EN EL STARTUP del container para
# garantizar que el cliente en site-packages incluya todos los modelos del
# schema.prisma actual (incluido CalibrationSnapshot). Si falla, el proceso
# falla rápido con stderr visible en logs.
RUN echo "Container startup will run prisma generate before uvicorn"
# Railway asigna un puerto dinámico via $PORT; shell form permite la expansión
CMD sh -c "prisma generate --schema=prisma/schema.prisma --generator pyclient 2>&1 | tail -5 && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"

