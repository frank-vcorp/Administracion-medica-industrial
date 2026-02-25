# HANDOFF: [Nombre de la Feature]

**Fecha:** YYYY-MM-DD  
**Owner:** [INTEGRA/CODEX]  
**Implementación:** SOFIA  
**Revisión:** GEMINI  

---

## Objetivo
[Descripción clara de qué se va a implementar]

---

## Decisión Técnica
[Tecnología/enfoque elegido y por qué]

---

## Variables de Entorno
| Variable | Descripción | Entorno |
|----------|-------------|---------|
| `NOMBRE_VAR` | [Descripción] | Production |

**Notas:**
- NO usar `NEXT_PUBLIC_` para secretos
- Configurar en Vercel/Render Project Settings

---

## Seguridad
- [ ] Endpoint accesible solo para roles: [roles]
- [ ] Validación de input con Zod
- [ ] No loggear datos sensibles

---

## Endpoints / Cambios

### `POST /api/recurso`
**Request:**
```json
{
  "campo": "valor"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {}
}
```

**Errores:**
- `401`: No autenticado
- `403`: Rol no permitido
- `422`: Body inválido

---

## UI/UX
- Mostrar componente solo si: [condiciones]
- Estados: idle / loading / error / success
- Al completar: [acción]

---

## Criterios de Aceptación
- [ ] CA-01: [Criterio verificable]
- [ ] CA-02: [Criterio verificable]

---

## Fase 2 (posterior)
- [Mejora futura 1]
- [Mejora futura 2]

---

## Referencias
- SPEC: `context/SPEC-[NOMBRE].md`
- ADR: `context/decisions/ADR-XXX.md`

---

*Handoff generado bajo Metodología INTEGRA v2.1.1*
