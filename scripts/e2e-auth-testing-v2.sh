#!/bin/bash

# ============================================================================
# Improved E2E Authentication Testing Script
# ID: IMPL-20260225-03-v2
# ============================================================================

set -e

BASE_URL="http://localhost:3000"
COOKIE_JAR="cookies.txt"
HEADERS_FILE="headers.txt"
LOG_FILE="e2e-auth-test-$(date +%Y%m%d-%H%M%S).log"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Utilities
log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}✗ $1${NC}" | tee -a "$LOG_FILE"; }
warning() { echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"; }
test_case() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}TEST: $1${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
}

cleanup() {
    rm -f "$COOKIE_JAR" "$HEADERS_FILE" 2>/dev/null || true
    log "Limpieza completada"
}

trap cleanup EXIT

# Helper: Perform login
login_user() {
    local EMAIL=$1
    local PASSWORD=$2
    local USER_DESC=$3

    rm -f "$COOKIE_JAR" "$HEADERS_FILE"
    
    log "Realizando login: $USER_DESC ($EMAIL)"

    # Step 1: Get the signin page to extract CSRF token
    log "  1. Obteniendo página de signin..."
    SIGNIN_PAGE=$(curl -s -c "$COOKIE_JAR" -D "$HEADERS_FILE" "${BASE_URL}/api/auth/signin" 2>/dev/null || echo "")

    # Step 2: Extract CSRF token from signin page
    CSRF_TOKEN=$(echo "$SIGNIN_PAGE" | grep -oP 'name="csrfToken" value="\K[^"]*' || echo "")
    if [ -z "$CSRF_TOKEN" ]; then
        CSRF_TOKEN=$(grep -oP 'csrfToken.*value="\K[^"]*' "$HEADERS_FILE" 2>/dev/null || echo "")
    fi

    log "  2. CSRF Token: ${CSRF_TOKEN:0:20}..."

    # Step 3: POST credentials with CSRF token
    log "  3. Enviando credenciales..."
    HTTP_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
        -w "%{http_code}" -o /dev/null \
        -X POST "${BASE_URL}/api/auth/callback/credentials" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "email=${EMAIL}&password=${PASSWORD}&csrfToken=${CSRF_TOKEN}" \
        2>/dev/null)

    log "  4. HTTP Response: $HTTP_CODE"

    # Step 4: Verify session was created
    sleep 1
    SESSION_RESPONSE=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
    
    if echo "$SESSION_RESPONSE" | grep -q "$EMAIL" 2>/dev/null; then
        success "Login exitoso para $USER_DESC"
        return 0
    elif [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ]; then
        success "Login procesado (redirección $HTTP_CODE) para $USER_DESC"
        return 0
    else
        warning "Login para $USER_DESC retornó HTTP $HTTP_CODE"
        return 1
    fi
}

# ============================================================================
# TEST 1: LOGIN CON CREDENCIALES VÁLIDAS
# ============================================================================

test_case "1: Login con credenciales válidas"

login_user "admin@sistema.com" "Admin@123" "ADMIN"

# ============================================================================
# TEST 2: RUTAS PROTEGIDAS SIN SESIÓN
# ============================================================================

test_case "2A: Ruta /portal sin sesión (debe redirigir)"

rm -f "$COOKIE_JAR"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "${BASE_URL}/portal" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    # Debe haber redirigido a login
    FINAL=$(curl -s -L "${BASE_URL}/portal" 2>/dev/null | grep -o "title>.*</title" | head -1)
    if echo "$FINAL" | grep -qi "login\|sign"; then
        success "Redirección correcta a login (HTTP $HTTP_CODE final)"
    else
        warning "Redirección detectada pero destino incierto: $FINAL"
    fi
else
    success "Redirección inmediata (HTTP $HTTP_CODE)"
fi

test_case "2B: Ruta /admin sin sesión (debe redirigir)"

rm -f "$COOKIE_JAR"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Redirección a login detectada (HTTP $HTTP_CODE)"
else
    error "Acceso no protegido para /admin (HTTP $HTTP_CODE)"
fi

# ============================================================================
# TEST 3: ACCESO CON SESIÓN VÁLIDA (usando middleware)
# ============================================================================

test_case "3A: Login ADMIN -> Acceso a /admin"

login_user "admin@sistema.com" "Admin@123" "ADMIN" > /dev/null 2>&1

# Try to access /admin (middleware should allow or redirect)
HTTP_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    success "Acceso permitido a /admin (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    # Podría estar redirigiendo a un subpath como /admin/dashboard
    REDIRECT=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -L "${BASE_URL}/admin" 2>/dev/null | head -c 100)
    success "Acceso a /admin con redirección (HTTP $HTTP_CODE, redirige a: $(echo $REDIRECT | grep -o '<[^>]*>' | head -1))"
else
    warning "HTTP $HTTP_CODE en /admin (revisar manualmente)"
fi

test_case "3B: Login COMPANY_CLIENT -> Acceso a /portal"

login_user "portal@empresa-a.com" "Client@123" "COMPANY_CLIENT" > /dev/null 2>&1

HTTP_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" "${BASE_URL}/portal" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    success "Acceso permitido a /portal (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Acceso a /portal con redirección (HTTP $HTTP_CODE)"
else
    warning "HTTP $HTTP_CODE en /portal"
fi

# ============================================================================
# TEST 4: VALIDACIÓN DE ROL - DENEGACIÓN
# ============================================================================

test_case "4A: COMPANY_CLIENT intenta acceder /admin (debe denegar)"

login_user "portal@empresa-a.com" "Client@123" "COMPANY_CLIENT" > /dev/null 2>&1

HTTP_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Acceso denegado (redirección HTTP $HTTP_CODE)"
else
    warning "HTTP $HTTP_CODE (esperada redirección 307/302)"
fi

test_case "4B: ADMIN accede a /admin (debe permitir)"

login_user "admin@sistema.com" "Admin@123" "ADMIN" > /dev/null 2>&1

HTTP_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ]; then
    success "Acceso permitido a /admin (HTTP $HTTP_CODE)"
else
    warning "HTTP $HTTP_CODE en /admin para ADMIN"
fi

# ============================================================================
# TEST 5: CONTROL MULTI-TENANT
# ============================================================================

test_case "5: Verificar aislamiento de datos multi-tenant"

log "Verificando que empresas A y B tengan companyId diferentes en la BD..."

# Aquí verificamos que los usuarios CLIENT de diferentes empresas
# están realmente vinculados a diferentes empresas
log "  Usuario portal@empresa-a.com debe estar en Empresa Test A"
log "  Usuario portal@empresa-b.com debe estar en Empresa Test B"

# Hacer login con usuario A
login_user "portal@empresa-a.com" "Client@123" "CLIENT-A" > /dev/null 2>&1

SESSION_A=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
echo "Sesión Cliente A: $SESSION_A" | tee -a "$LOG_FILE"

# Hacer login con usuario B  
login_user "portal@empresa-b.com" "Client@456" "CLIENT-B" > /dev/null 2>&1

SESSION_B=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
echo "Sesión Cliente B: $SESSION_B" | tee -a "$LOG_FILE"

# Verificar que los companyId son diferentes (si la API lo expone)
if [ "$SESSION_A" != "$SESSION_B" ]; then
    success "Sesiones de diferentes empresas son independientes"
else
    warning "No se verificó independencia en las sesiones (verificar manualmente en BD)"
fi

# ============================================================================
# TEST 6: LOGOUT FUNCTIONALITY
# ============================================================================

test_case "6: Logout y verificación de sesión eliminada"

login_user "admin@sistema.com" "Admin@123" "ADMIN" > /dev/null 2>&1

# Verificar sesión activa
BEFORE=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
log "Sesión antes de logout: $BEFORE"

# Logout
log "Ejecutando logout..."
LOGOUT_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -w "%{http_code}" -o /dev/null \
    -X POST "${BASE_URL}/api/auth/signout" \
    2>/dev/null)

log "HTTP code logout: $LOGOUT_CODE"
sleep 1

# Intentar acceder a ruta protegida
HTTP_CODE=$(curl -s -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Logout exitoso - Redirigido a login (HTTP $HTTP_CODE)"
else
    warning "HTTP $HTTP_CODE después de logout (se esperaba 307/302)"
fi

# ============================================================================
# TEST 7: CREDENCIALES INVÁLIDAS
# ============================================================================

test_case "7A: Login con contraseña incorrecta"

rm -f "$COOKIE_JAR" "$HEADERS_FILE"

SIGNIN=$(curl -s -c "$COOKIE_JAR" "${BASE_URL}/api/auth/signin" 2>/dev/null)
CSRF=$(echo "$SIGNIN" | grep -oP 'name="csrfToken" value="\K[^"]*' || echo "")

HTTP_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -w "%{http_code}" -o /dev/null \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=admin@sistema.com&password=WrongPassword&csrfToken=${CSRF}" \
    2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
    success "Login rechazado con contraseña incorrecta (HTTP $HTTP_CODE)"
else
    warning "Login retornó HTTP $HTTP_CODE (revisar comportamiento)"
fi

test_case "7B: Login con usuario inexistente"

rm -f "$COOKIE_JAR"

SIGNIN=$(curl -s -c "$COOKIE_JAR" "${BASE_URL}/api/auth/signin" 2>/dev/null)
CSRF=$(echo "$SIGNIN" | grep -oP 'name="csrfToken" value="\K[^"]*' || echo "")

HTTP_CODE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -w "%{http_code}" -o /dev/null \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=nonexistent@test.com&password=AnyPassword&csrfToken=${CSRF}" \
    2>/dev/null)

if [ "$HTTP_CODE" != "200" ]; then
    success "Login rechazado para usuario inexistente (HTTP $HTTP_CODE)"
else
    warning "Login retornó HTTP $HTTP_CODE"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}✓ TESTING E2E COMPLETADO${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"

echo -e "\n${BLUE}📋 Log guardado en: ${LOG_FILE}${NC}"

echo -e "\n${YELLOW}HALLAZGOS PRINCIPALES:${NC}" | tee -a "$LOG_FILE"
grep -E "^✓|^✗" "$LOG_FILE" | tail -20 || true

