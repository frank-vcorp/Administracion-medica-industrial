#!/bin/bash
# =============================================================================
# Script de Inicialización de Proyecto con Metodología INTEGRA v2.1.1
# =============================================================================
# Uso: ./init-proyecto.sh /ruta/destino "NombreProyecto"
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar argumentos
if [ $# -lt 2 ]; then
    echo -e "${RED}Error: Se requieren 2 argumentos${NC}"
    echo "Uso: $0 /ruta/destino \"NombreProyecto\""
    exit 1
fi

DESTINO="$1"
NOMBRE_PROYECTO="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${GREEN}🧬 Inicializando proyecto con Metodología INTEGRA v2.1.1${NC}"
echo "   Destino: $DESTINO"
echo "   Proyecto: $NOMBRE_PROYECTO"
echo ""

# Crear directorio destino si no existe
mkdir -p "$DESTINO"

# Copiar estructura
echo -e "${YELLOW}📁 Copiando estructura de carpetas...${NC}"
cp -r "$SCRIPT_DIR/meta" "$DESTINO/"
cp -r "$SCRIPT_DIR/context" "$DESTINO/"
cp -r "$SCRIPT_DIR/Checkpoints" "$DESTINO/"
cp "$SCRIPT_DIR/PROYECTO.md" "$DESTINO/"
cp "$SCRIPT_DIR/AGENTS.md" "$DESTINO/"

# Reemplazar placeholder del nombre del proyecto
echo -e "${YELLOW}📝 Configurando nombre del proyecto...${NC}"
sed -i "s/\[Nombre del Proyecto\]/$NOMBRE_PROYECTO/g" "$DESTINO/PROYECTO.md"
sed -i "s/\[Nombre del Proyecto\]/$NOMBRE_PROYECTO/g" "$DESTINO/context/dossier_tecnico.md"
sed -i "s/\[Nombre del Proyecto\]/$NOMBRE_PROYECTO/g" "$DESTINO/context/00_ARQUITECTURA.md"

# Crear .gitignore si no existe
if [ ! -f "$DESTINO/.gitignore" ]; then
    echo -e "${YELLOW}📄 Creando .gitignore...${NC}"
    cat > "$DESTINO/.gitignore" << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Environment
.env
.env.local
.env.*.local

# Build
.next/
dist/
build/
out/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Misc
*.bak
*.tmp
EOF
fi

# Crear .env.example si no existe
if [ ! -f "$DESTINO/.env.example" ]; then
    echo -e "${YELLOW}📄 Creando .env.example...${NC}"
    cat > "$DESTINO/.env.example" << 'EOF'
# =============================================================================
# Variables de Entorno - [Nombre del Proyecto]
# =============================================================================
# Copia este archivo a .env y completa los valores
# NUNCA commitees .env al repositorio
# =============================================================================

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    sed -i "s/\[Nombre del Proyecto\]/$NOMBRE_PROYECTO/g" "$DESTINO/.env.example"
fi

echo ""
echo -e "${GREEN}✅ Proyecto inicializado exitosamente!${NC}"
echo ""
echo "Próximos pasos:"
echo "  1. cd $DESTINO"
echo "  2. git init (si es nuevo)"
echo "  3. Instala los prompts en VS Code:"
echo "     - Abre VS Code"
echo "     - Ctrl+Shift+P → 'Preferences: Open User Prompts Folder'"
echo "     - Copia los archivos de 'prompts/' a esa carpeta"
echo "  4. Edita PROYECTO.md con tus tareas iniciales"
echo "  5. Edita context/dossier_tecnico.md con los detalles de tu stack"
echo ""
echo -e "${GREEN}¡Listo para desarrollar con INTEGRA! 🚀${NC}"
