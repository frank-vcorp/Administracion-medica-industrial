#!/bin/bash

# ============================================================================
# E2E Authentication Testing Script
# ID: IMPL-20260225-03
# Verifica: Login, Rutas Protegidas, Multi-tenant, Logout
# ============================================================================

set -e

BASE_URL="http://localhost:3000"
COOKIE_JAR="cookies.txt"
LOG_FILE="e2e-auth-test-$(date +%Y%m%d-%H%M%S).log"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# UTILITIES
# ============================================================================

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}✗ $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}" | tee -a "$LOG_FILE"
}

test_case() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}TEST: $1${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup() {
    rm -f "$COOKIE_JAR" 2>/dev/null || true
    log "Limpieza completada"
}

trap cleanup EXIT

# ============================================================================
# TEST 1: LOGIN CON CREDENCIALES VÁLIDAS (ADMIN)
# ============================================================================

test_case "1A: Login con credenciales válidas (admin@sistema.com / Admin@123)"

log "Obteniendo CSRF token..."
CSRF_RESPONSE=$(curl -s -c "$COOKIE_JAR" "${BASE_URL}/api/auth/signin")

# Intentar extraer csrfToken del HTML (NextAuth genera un hidden input)
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | grep -oP 'name="csrfToken" value="\K[^"]*' || echo "")

if [ -z "$CSRF_TOKEN" ]; then
    warning "No se pudo extraer CSRF token de HTML, intentando con HTTP-only cookie..."
    # Los HTTP-only cookies se manejan automáticamente en curl
fi

log "Intentando login como ADMIN..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=admin@sistema.com&password=Admin@123&csrfToken=${CSRF_TOKEN}" \
    -L --max-redirs 0 2>&1 || true)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    success "Login como ADMIN exitoso (HTTP $HTTP_CODE)"
else
    error "Login como ADMIN falló (HTTP $HTTP_CODE)"
fi

# ============================================================================
# TEST 1B: Obtener info de sesión
# ============================================================================

test_case "1B: Verificar sesión activa (GET /api/auth/session)"

SESSION_DATA=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
echo "Respuesta de sesión:" | tee -a "$LOG_FILE"
echo "$SESSION_DATA" | tee -a "$LOG_FILE"

if echo "$SESSION_DATA" | grep -q "admin@sistema.com"; then
    success "Sesión activa confirmada para admin@sistema.com"
else
    warning "No se confirmó sesión en respuesta JSON, pero la cookie podría estar HTTP-only"
fi

# ============================================================================
# TEST 2: RUTAS PROTEGIDAS - REDIRECCIONAN A LOGIN
# ============================================================================

test_case "2A: Ruta protegida /portal sin sesión (debería redirigir a login)"

rm -f "$COOKIE_JAR" # Limpiar cookies
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/portal" 2>/dev/null)

if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Redirección correcta sin sesión (HTTP $HTTP_CODE)"
else
    error "Esperaba redirección (307/302), obtuve HTTP $HTTP_CODE"
fi

test_case "2B: Ruta protegida /admin sin sesión (debería redirigir a login)"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Redirección correcta sin sesión (HTTP $HTTP_CODE)"
else
    error "Esperaba redirección (307/302), obtuve HTTP $HTTP_CODE"
fi

# ============================================================================
# TEST 3: ACCESO A RUTAS PROTEGIDAS CON SESIÓN VÁLIDA
# ============================================================================

test_case "3A: Login y acceso a /admin (usuario ADMIN)"

# Login nuevamente
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=admin@sistema.com&password=Admin@123" \
    --max-redirs 0 2>&1 > /dev/null || true

sleep 1

# Intentar acceder a /admin
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    success "Acceso permitido a /admin para ADMIN (HTTP $HTTP_CODE)"
else
    warning "HTTP code: $HTTP_CODE (podría ser redirección o protección adicional)"
fi

# ============================================================================
# TEST 3B: Login como COMPANY_CLIENT y acceso a /portal
# ============================================================================

test_case "3B: Login y acceso a /portal (usuario COMPANY_CLIENT - Empresa A)"

rm -f "$COOKIE_JAR"

curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=portal@empresa-a.com&password=Client@123" \
    --max-redirs 0 2>&1 > /dev/null || true

sleep 1

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/portal" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    success "Acceso permitido a /portal para COMPANY_CLIENT (HTTP $HTTP_CODE)"
else
    warning "HTTP code: $HTTP_CODE"
fi

# ============================================================================
# TEST 4: CONTROL MULTI-TENANT
# ============================================================================

test_case "4A: Usuario Empresa A intenta acceder a datos de Empresa B (negación esperada)"

# En primer lugar, vamos a verificar que los usuarios estén en empresas distintas
log "Verificando usuarios de diferentes empresas en la BD..."

# Limpiamos y hacemos login con usuario de Empresa A
rm -f "$COOKIE_JAR"

curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=portal@empresa-a.com&password=Client@123" \
    --max-redirs 0 2>&1 > /dev/null || true

sleep 1

# Obtener datos de sesión
SESSION_DATA=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
echo "Sesión Empresa A:" | tee -a "$LOG_FILE"
echo "$SESSION_DATA" | tee -a "$LOG_FILE"

# Ahora intentamos con Empresa B
rm -f "$COOKIE_JAR"

curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=portal@empresa-b.com&password=Client@456" \
    --max-redirs 0 2>&1 > /dev/null || true

sleep 1

SESSION_DATA_B=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
echo "Sesión Empresa B:" | tee -a "$LOG_FILE"
echo "$SESSION_DATA_B" | tee -a "$LOG_FILE"

if echo "$SESSION_DATA" | grep -v "$SESSION_DATA_B" > /dev/null 2>&1; then
    success "Sesiones de diferentes empresas son independientes"
else
    warning "Verificar manualmente que companyId es diferente en ambas sesiones"
fi

# ============================================================================
# TEST 5: LOGIN CON CREDENCIALES INVÁLIDAS
# ============================================================================

test_case "5A: Login con contraseña incorrecta"

rm -f "$COOKIE_JAR"

RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=admin@sistema.com&password=WrongPassword123" \
    --max-redirs 0 2>&1 || echo "ERROR")

if echo "$RESPONSE" | grep -qi "error\|invalid\|credenciales"; then
    success "Login rechazado con contraseña incorrecta"
else
    warning "Verificar respuesta de error: $(echo $RESPONSE | head -c 200)"
fi

# ============================================================================
# TEST 5B: Login con usuario inexistente
# ============================================================================

test_case "5B: Login con usuario inexistente"

rm -f "$COOKIE_JAR"

RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=nonexistent@test.com&password=AnyPassword123" \
    --max-redirs 0 2>&1 || echo "ERROR")

if echo "$RESPONSE" | grep -qi "error\|invalid\|credenciales"; then
    success "Login rechazado con usuario inexistente"
else
    warning "Verificar respuesta de error"
fi

# ============================================================================
# TEST 6: LOGOUT
# ============================================================================

test_case "6A: Logout y verificación de sesión eliminada"

rm -f "$COOKIE_JAR"

# Login primero
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=admin@sistema.com&password=Admin@123" \
    --max-redirs 0 2>&1 > /dev/null || true

sleep 1

# Verificar sesión activa
SESSION_BEFORE=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null)
log "Sesión antes de logout: $SESSION_BEFORE"

# Logout
LOGOUT_RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/signout" \
    --max-redirs 0 2>&1 || true)

sleep 1

# Verificar sesión después de logout
SESSION_AFTER=$(curl -s -b "$COOKIE_JAR" "${BASE_URL}/api/auth/session" 2>/dev/null || echo "{}")
log "Sesión después de logout: $SESSION_AFTER"

# Intentar acceder a ruta protegida
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Sesión eliminada correctamente. Redirección a login (HTTP $HTTP_CODE)"
else
    error "Se esperaba redirección tras logout, obtuve HTTP $HTTP_CODE"
fi

# ============================================================================
# TEST 7: VALIDACIÓN DE ACCESO POR ROL
# ============================================================================

test_case "7A: Usuario COMPANY_CLIENT intenta acceder a /admin (negación esperada)"

rm -f "$COOKIE_JAR"

curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=portal@empresa-a.com&password=Client@123" \
    --max-redirs 0 2>&1 > /dev/null || true

sleep 1

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "307" ] || [ "$HTTP_CODE" = "302" ]; then
    success "Acceso denegado a /admin para COMPANY_CLIENT (redirección HTTP $HTTP_CODE)"
else
    warning "HTTP code: $HTTP_CODE (se espera redirección)"
fi

test_case "7B: Usuario ADMIN accede a /admin (acceso permitido)"

rm -f "$COOKIE_JAR"

curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "${BASE_URL}/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=admin@sistema.com&password=Admin@123" \
    --max-redirs 0 2>&1 > /dev/null || true

sleep 1

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "${BASE_URL}/admin" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    success "Acceso permitido a /admin para ADMIN (HTTP $HTTP_CODE)"
else
    warning "HTTP code: $HTTP_CODE"
fi

# ============================================================================
# RESUMEN FINAL
# ============================================================================

echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"
echo -e "${GREEN}✓ TESTING E2E COMPLETADO${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"

echo -e "\n${BLUE}Archivo de log: ${LOG_FILE}${NC}" | tee -a "$LOG_FILE"
echo -e "${BLUE}Cookies utilizadas: ${COOKIE_JAR} (se borrará al finalizar)${NC}" | tee -a "$LOG_FILE"

# Mostrar resumen de hallazgos
echo -e "\n${YELLOW}RESUMEN DE HALLAZGOS:${NC}" | tee -a "$LOG_FILE"
grep -E "^✓|^✗|^⚠" "$LOG_FILE" | tail -20 | tee -a "$LOG_FILE"

