# SPEC: [Nombre de la Funcionalidad]

**ID:** ARCH-YYYYMMDD-NN  
**Autor:** INTEGRA  
**Fecha:** YYYY-MM-DD  
**Estado:** [Borrador/En Revisión/Aprobado]

---

## 1. Resumen Ejecutivo
[Descripción breve de qué se va a construir y por qué]

---

## 2. Contexto y Problema
### 2.1 Situación Actual
[Cómo funciona actualmente o por qué no existe]

### 2.2 Problema a Resolver
[Pain points específicos]

### 2.3 Usuarios Afectados
[Quiénes se benefician]

---

## 3. Solución Propuesta

### 3.1 Descripción General
[Qué se va a construir]

### 3.2 Flujo de Usuario
1. [Paso 1]
2. [Paso 2]
3. [Paso 3]

### 3.3 Arquitectura
```
[Diagrama ASCII o descripción de componentes]
```

---

## 4. Requisitos

### 4.1 Funcionales
- [ ] RF-01: [Requisito]
- [ ] RF-02: [Requisito]

### 4.2 No Funcionales
- [ ] RNF-01: Performance - [Métrica]
- [ ] RNF-02: Seguridad - [Requisito]

---

## 5. Diseño Técnico

### 5.1 Modelo de Datos
```typescript
interface NuevaEntidad {
  id: string;
  // ...
}
```

### 5.2 Endpoints (si aplica)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/recurso | Crear recurso |
| GET | /api/recurso/:id | Obtener recurso |

### 5.3 Componentes UI (si aplica)
- `NuevoComponente.tsx` - [Propósito]

---

## 6. Plan de Implementación

### 6.1 Tareas
| # | Tarea | Estimación | Asignado |
|---|-------|------------|----------|
| 1 | [Tarea] | 2h | SOFIA |
| 2 | [Tarea] | 4h | SOFIA |

### 6.2 Dependencias
- [Dependencia 1]

### 6.3 Riesgos
| Riesgo | Mitigación |
|--------|------------|
| [Riesgo] | [Estrategia] |

---

## 7. Criterios de Aceptación
- [ ] CA-01: [Criterio verificable]
- [ ] CA-02: [Criterio verificable]

---

## 8. Testing
- [ ] Tests unitarios para [componente]
- [ ] Test E2E para [flujo]

---

## 9. Rollout
- [ ] Feature flag: `FEATURE_NOMBRE_ENABLED`
- [ ] Documentación actualizada
- [ ] Comunicación a usuarios

---

## 10. Referencias
- [ADR relacionado](context/decisions/ADR-XXX.md)
- [Documentación externa]

---

*SPEC generado bajo Metodología INTEGRA v2.1.1*
