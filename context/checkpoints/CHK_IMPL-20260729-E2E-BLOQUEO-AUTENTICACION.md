# CHK_IMPL-20260729-E2E-BLOQUEO-AUTENTICACION — Bloqueo crítico en login para tests E2E

**ID:** `CHK-20260729-E2E-AUTH`  
**Fecha:** 2026-07-29 01:02 CST  
**Tipo:** Bloqueo técnico  
**Estado:** [!] BLOQUEADO  

---

## 1. Contexto

Se intentó ejecutar el test E2E del flujo completo (`frontend/tests/flujo-completo.spec.ts`) contra la URL de producción de Vercel para identificar bloqueos reales del sistema.

**Comando ejecutado:**
```bash
cd /home/frank/repos/Administracion-medica-industrial/frontend
BASE_URL="https://administracion-medica-industrial.vercel.app" \
npx playwright test flujo-completo.spec.ts --timeout=300000
```

---

## 2. Bloqueo detectado

### Error principal: Fallo en autenticación

**Síntoma:** Todos los tests fallan en el hook `beforeAll` durante el login.

**Mensaje de error:**
```
"beforeAll" hook timeout of 300000ms exceeded.

Error: locator.fill: Test ended.
Call log:
  - waiting for getByLabel('Email')
```

**Causa raíz:** El test no puede encontrar los elementos del formulario de login en `/login`. Esto indica que:

1. **Opción A:** La página de login no carga (error de red, redirect, o caída)
2. **Opción B:** Los selectores `getByLabel('Email')` y `getByLabel('Contraseña')` no coinciden con los labels reales del formulario
3. **Opción C:** El login requiere algún paso adicional (CAPTCHA, MFA, etc.)

---

## 3. Diagnóstico preliminar

### Verificación de URL accesible
La URL base es accesible desde navegador:
```
https://administracion-medica-industrial.vercel.app/login
```

### Problemas identificados en el test

1. **Selectores frágiles:** El test usa `getByLabel('Email')` pero el formulario real puede usar labels diferentes como "Correo electrónico", "Usuario", etc.

2. **Sin espera explícita de carga:** El `page.waitForLoadState('networkidle')` puede no ser suficiente si hay redirects de auth.

3. **Credenciales hardcodeadas:** Las env vars `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` pueden no estar configuradas o las credenciales pueden haber cambiado.

4. **NextAuth.js behavior:** El login con NextAuth puede tener comportamientos asíncronos que el test no maneja (redirects, tokens, cookies).

---

## 4. Impacto

**Alcance:** Todos los 36 tests del flujo completo están bloqueados.

**Tests afectados:**
- TC-01 a TC-12 (flujo empresa → trabajador → cita → papeleta → dictamen)
- Validaciones de uploads de IA
- Validaciones de laboratorio LIS
- Validaciones de dictamen final

**Progreso:** 0/36 tests ejecutados exitosamente.

---

## 5. Acciones requeridas para desbloquear

### Acción 1: Inspeccionar formulario de login real

**Responsable:** @SOFIA  
**Prioridad:** P0  

**Tareas:**
1. Navegar manualmente a `https://administracion-medica-industrial.vercel.app/login`
2. Abrir DevTools → Elements inspector
3. Identificar selectores correctos para:
   - Campo de email/usuario
   - Campo de contraseña
   - Botón de submit
4. Documentar estructura HTML del formulario

**Entregable:** Screenshot + snippet HTML del formulario de login

### Acción 2: Actualizar selectores en test E2E

**Archivo:** `frontend/tests/flujo-completo.spec.ts`

**Cambios necesarios:**
```typescript
// ANTES (incorrecto)
await page.getByLabel('Email').fill(TEST_EMAIL);
await page.getByLabel('Contraseña', { exact: true }).fill(TEST_PASSWORD);

// DESPUÉS (ejemplo, ajustar según HTML real)
await page.getByPlaceholder('correo@empresa.com').fill(TEST_EMAIL);
await page.locator('input[type="password"]').fill(TEST_PASSWORD);
await page.getByRole('button', { name: 'Ingresar' }).click();
```

### Acción 3: Verificar credenciales de test

**Verificar:**
1. Usuario de prueba existe en producción
2. Credenciales son válidas
3. Usuario tiene permisos ADMIN o DOCTOR_GENERAL
4. Cuenta no está bloqueada

**Comando para verificar usuario en BD:**
```sql
SELECT id, email, "fullName", role, "isActive"
FROM users
WHERE email = 'admin@ami.com';
```

### Acción 4: Agregar manejo de errores robusto

**Mejoras al test:**
```typescript
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  
  // Esperar explícitamente el formulario
  const emailField = page.locator('input[type="email"], input[placeholder*="correo"], input[name="email"]');
  await emailField.waitFor({ state: 'visible', timeout: 10000 });
  
  // Debug: imprimir título de página
  console.log('Page title:', await page.title());
  
  await emailField.fill(TEST_EMAIL);
  // ... resto del login
}
```

---

## 6. Bloqueos secundarios detectados

### 6.1 Firefox y Webkit no instalados

**Error:**
```
Error: browserType.launch: Executable doesn't exist at /home/frank/.cache/ms-playwright/firefox-1532/firefox/firefox
```

**Solución:** Ejecutar `npx playwright install` para instalar todos los navegadores.

**Impacto:** Bajo - por ahora solo necesitamos Chromium para validar el flujo.

---

## 7. Recomendación de enfoque alternativo

Si el login sigue siendo problemático, considerar:

### Opción A: Usar API bypass para tests
Crear endpoint especial para tests que genere sesión sin necesidad de login interactivo:
```python
# backend/app/api/v1/test_auth.py
@app.post("/api/v1/test-auth/bypass")
async def test_auth_bypass(user_email: str):
    user = db.query(User).filter(email=user_email).first()
    token = create_access_token(data={"sub": user.id})
    return {"access_token": token}
```

### Opción B: Tests con usuario ya autenticado
Usar `storageState` de Playwright para reutilizar sesión guardada:
```typescript
// playwright.config.ts
use: {
  storageState: 'playwright/.auth/user.json',
}
```

### Opción C: Tests end-to-end reales con UI de login
Requiere primero fixear selectores (Acción 1-2 arriba).

---

## 8. Estado actual

| Aspecto | Estado | Observaciones |
|---|---|---|
| Test E2E creado | ✅ Completo | 450+ líneas, 12 test cases |
| Configuración Playwright | ✅ Lista | BASE_URL configurable |
| Ejecución contra producción | ❌ Fallida | Bloqueo en login |
| Identificación de selectores | ⏸️ Pendiente | Requiere inspección manual |
| Credenciales de test | ❓ Desconocido | Verificar existencia de usuario |

---

## 9. Próximos pasos para SOFIA

1. **Inspeccionar formulario de login real** en producción (manual o con script)
2. **Actualizar selectores** en `flujo-completo.spec.ts` función `login()`
3. **Verificar credenciales** de usuario de test en BD
4. **Re-ejecutar tests** con fixes aplicados
5. **Documentar resultados** de cada fase del flujo
6. **Reportar bloqueos funcionales** encontrados durante ejecución

---

## 10. Archivos relacionados

- `frontend/tests/flujo-completo.spec.ts` - Test E2E completo (450 líneas)
- `frontend/playwright.config.ts` - Configuración de Playwright
- `context/SPECs/SPEC_IMPL-20260729-FLUJO-END-TO-END.md` - SPEC original
- `context/interconsultas/HANDOFF_IMPL-20260729-FLUJO-E2E_SOFIA.md` - Handoff a SOFIA

---

**Estado:** [!] **BLOQUEADO** - Pendiente fix de autenticación para continuar validación E2E

**Escalado a:** @SOFIA para resolución de selectores de login
