# CHK_IMPL-20260729-CREDENCIALES-INVALIDAS — Bloqueo por credenciales de test inválidas

**ID:** `CHK-20260729-CREDENCIALES`  
**Fecha:** 2026-07-29 01:15 CST  
**Tipo:** Bloqueo crítico  
**Estado:** [!] BLOQUEADO  

---

## 1. Problema

Las credenciales proporcionadas para tests E2E (`admin@sistema.com` / `Admin@123`) **no son válidas** en el entorno de producción de Vercel.

**Mensaje de error visible:** "Credenciales inválidas"

---

## 2. Verificación realizada

### Login manual exitoso (selectores correctos)
- ✅ Navegación a `/login` funciona
- ✅ Campos de formulario encontrados correctamente
- ✅ Botón "Iniciar Sesión" clickeable
- ❌ Credenciales rechazadas por el backend

### Tests E2E
- ✅ Selectores corregidos y funcionando
- ❌ Todos los 12 tests fallan en fase de autenticación

---

## 3. Acción requerida

**Frank debe proporcionar:**
1. Email y password de un usuario real que exista en producción con rol ADMIN o DOCTOR_GENERAL
2. O indicar cómo consultar la BD Railway para obtener usuarios válidos

**Comando para consultar usuarios en Railway:**
```bash
railway run --service 'Administracion-medica-industrial' \
  npx prisma db execute --stdin <<< "SELECT email, role FROM users WHERE \"isActive\" = true LIMIT 10;"
```

---

## 4. Impacto

- **Tests bloqueados:** 12/12 (0% ejecutado)
- **Validación de flujo:** 0% completada
- **Gaps funcionales:** Sin identificar hasta resolver login

---

**Estado:** [!] **BLOQUEADO TOTAL** - Pendiente credenciales válidas
