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

# FIX-20260810-09: bumpear cache de Docker para forzar re-generación de cliente
# Prisma cuando schema.prisma cambia. Sin esto, Railway puede usar el cliente
# cacheado del layer anterior (sin CalibrationSnapshot) y los inserts fallan
# con DataError: GraphQL parse error.
ARG PRISMA_GENERATE_BUST=20260811-2
RUN echo "Cache bust: $PRISMA_GENERATE_BUST" && \
    prisma generate --schema=prisma/schema.prisma --generator pyclient 2>&1 | tail -20

# PYTHONPATH: los módulos services/ y schemas/ viven dentro de /app/app/
ENV PYTHONPATH="/app/app"

# Railway asigna un puerto dinámico via $PORT; shell form permite la expansión
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

