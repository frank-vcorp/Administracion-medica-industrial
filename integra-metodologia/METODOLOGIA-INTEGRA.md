# 🧬 METODOLOGÍA INTEGRA v2.4.0

**Versión:** 2.4.0  
**Autor:** Frank Saavedra  
**Última actualización:** 2026-01-26

---

## 1. ¿Qué es INTEGRA?

INTEGRA (Inteligencia Técnica y Gobernanza para Resultados Ágiles) es una metodología de desarrollo de software diseñada para equipos híbridos humano-IA. Define cómo múltiples agentes de IA especializados colaboran entre sí y con un director humano para entregar software de alta calidad con trazabilidad completa.

### Filosofía Central
> "Cada decisión documentada, cada cambio trazable, cada agente responsable."

---

## 2. Principios Fundamentales

### 2.1 Trazabilidad Total
Todo cambio en el proyecto debe ser identificable y rastreable:
- Cada intervención tiene un **ID único**
- Cada archivo modificado tiene una **marca de agua**
- Cada decisión queda documentada en un **artefacto**

### 2.2 Fuente de Verdad Única
`PROYECTO.md` es el documento central que refleja el estado real del proyecto:
- Estados de tareas actualizados
- Deuda técnica registrada
- Decisiones pendientes visibles

### 2.3 Soft Gates de Calidad
Ninguna tarea se marca como completada sin pasar 4 validaciones:
1. ✅ **Compilación** - Sin errores de build
2. ✅ **Testing** - Tests pasando
3. ✅ **Revisión** - Código auditado
4. ✅ **Documentación** - Checkpoint generado

### 2.4 Principio del Cañón y la Mosca 🪰💣
> "Usa la herramienta más simple que resuelva el problema eficientemente."

- Si basta con JSON, no uses base de datos
- Si basta con script, no crees microservicio
- Si basta con CSS, no añadas librería

### 2.5 Especialización con Colaboración
Cada agente tiene un rol específico pero pueden apoyarse mutuamente:
- Roles definidos, no silos
- Interconsultas formales para problemas complejos
- Handoffs estructurados entre agentes

---

## 3. Sistema de Identificación

### 3.1 IDs de Intervención
Formato: `[PREFIJO]-YYYYMMDD-NN`

| Prefijo | Uso | Agente Principal |
|---------|-----|------------------|
| `ARCH` | Decisiones arquitectónicas, SPECs | INTEGRA |
| `IMPL` | Implementación de código | SOFIA |
| `FIX` | Debugging, correcciones | Deby |
| `INFRA` | Configuración de infraestructura | GEMINI |
| `DOC` | Documentación, estados | CRONISTA |

**Ejemplo:** `IMPL-20260126-01` = Primera implementación del 26 de enero de 2026

### 3.2 Marca de Agua en Código
Todo código modificado debe incluir referencia al ID y documento de respaldo:

```typescript
/**
 * @intervention IMPL-20260126-01
 * @see context/interconsultas/DICTAMEN_FIX-20260126-01.md
 */
```

---

## 4. Flujo de Estados

```
[ ] Pendiente
     │
     ▼
[/] En Progreso ──────────────────┐
     │                            │
     ▼                            │
[✓] Completado (Soft Gates OK)   │
     │                            │
     ▼                            │
[X] Aprobado (por humano) ◄──────┘ (rollback si falla)
```

### Estados Especiales
- `[~]` Planificado - SPEC creada, lista para implementar
- `[!]` Bloqueado - Esperando dependencia externa
- `[↩]` Rollback - Revertido por fallo

---

## 5. Ecosistema de Agentes

### 5.1 Roles

| Agente | Rol | Responsabilidades |
|--------|-----|-------------------|
| **INTEGRA** | Arquitecto / Product Owner | Define qué se construye, crea SPECs, toma decisiones arquitectónicas |
| **SOFIA** | Constructora Principal | Implementa código, escribe tests, genera checkpoints |
| **GEMINI** | QA / Infraestructura | Audita calidad, configura hosting, valida Soft Gates |
| **Deby** | Lead Debugger | Análisis forense de errores, genera dictámenes técnicos |
| **CRONISTA** | Administrador de Estados | Mantiene PROYECTO.md, detecta incoherencias |

### 5.2 Mapa de Interconsultas

```
       ┌──────────┐
 ┌────►│  DEBY    │◄────┐  (Consultor - Solo recibe)
 │     │(Forense) │     │
 │     └──────────┘     │
 │                      │
┌┴─────────────┐  ┌─────┴────────┐
│   INTEGRA    │◄►│    SOFIA     │  (Bidireccional)
│ (Arquitecto) │  │  (Builder)   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       │  ┌──────────┐   │
       └─►│  GEMINI  │◄──┘  (Ambos pueden llamar)
          │(QA/Infra)│
          └────┬─────┘
               │
          ┌────▼─────┐
          │ CRONISTA │  (Cualquiera puede llamar)
          │(Estados) │
          └──────────┘
```

### 5.3 Triggers de Escalamiento

| Situación | Agente a Invocar | Trigger |
|-----------|------------------|---------|
| Error no resuelto en 2 intentos | `Deby` | Automático |
| Decisión arquitectónica necesaria | `INTEGRA - Arquitecto` | Explícito |
| SPEC lista para implementar | `SOFIA - Builder` | Al crear SPEC |
| Implementación completada | `GEMINI-CLOUD-QA` | Al terminar IMPL |
| Cambio de estado de tarea | `CRONISTA-Estados-Notas` | Automático |

### 5.4 Sintaxis de Interconsulta

```javascript
runSubagent(
  agentName='[NOMBRE-EXACTO]', 
  prompt='ID:[tu-ID] Contexto:[descripción] Problema:[qué resolver] Expectativa:[qué esperas]'
)
```

---

## 6. Sistema de Handoff

### 6.1 Definición
Un **Handoff** es la transferencia formal de responsabilidad de un agente a otro, incluyendo todo el contexto necesario para continuar el trabajo.

### 6.2 Tipos de Handoff

| Tipo | Origen | Destino | Artefacto |
|------|--------|---------|-----------|
| Delegación | INTEGRA | SOFIA | `context/HANDOFF-[FEATURE].md` |
| Dictamen | Deby | Solicitante | `context/interconsultas/DICTAMEN_FIX-[ID].md` |
| Auditoría | GEMINI | SOFIA | Comentarios en PR o Checkpoint |
| Sincronización | Cualquiera | CRONISTA | Actualización de PROYECTO.md |

### 6.3 Contenido Obligatorio de Handoff
1. **ID de origen** - Quién lo genera
2. **Agente destino** - Quién lo recibe
3. **Contexto** - Estado actual y archivos relevantes
4. **Instrucciones** - Pasos específicos a seguir
5. **Criterios de éxito** - Cómo saber que está completo

---

## 7. Protocolo de Rollback

### 7.1 Cuándo Aplicar
- Deploy falla en producción
- Bug crítico introducido
- Performance degradada significativamente
- Seguridad comprometida

### 7.2 Autoridad
Solo **GEMINI** o **INTEGRA** pueden ordenar un rollback.

### 7.3 Procedimiento
1. Ejecutar `git revert [commit]`
2. Crear Checkpoint explicando la razón
3. Invocar `CRONISTA` para actualizar estados en PROYECTO.md
4. Documentar en `context/interconsultas/` el análisis post-mortem
5. Marcar tarea original con `[↩]`

---

## 8. Control de Versiones (Git)

### 8.1 Filosofía de Commits

> **"Commit temprano, commit frecuente, con mensajes que cuenten la historia."**

Cada commit debe ser:
- **Atómico** - Un cambio lógico por commit
- **Compilable** - El proyecto debe compilar después del commit
- **Descriptivo** - El mensaje explica el "qué" y el "por qué"

### 8.2 Cuándo Hacer Commit

| Evento | Acción | Ejemplo |
|--------|--------|---------|
| **Tarea completada** | Commit + Push | `feat(clientes): agregar tabla con paginación` |
| **Subtarea significativa** | Commit (sin push) | `feat(clientes): crear endpoint GET /api/clientes` |
| **Antes de cambio riesgoso** | Commit con `[WIP]` | `[WIP] feat(auth): inicio de migración a OAuth` |
| **Fix de bug** | Commit + Push | `fix(facturas): corregir cálculo de IVA` |
| **Fin de Micro-Sprint** | Commit + Push + Tag (opcional) | `feat(facturación): módulo completo de facturas` |
| **Refactor** | Commit separado | `refactor(api): extraer lógica a servicios` |

### 8.3 Cuándo Hacer Push

| Situación | Push? | Razón |
|-----------|-------|-------|
| ✅ Tarea completada y funcional | **Sí** | Código listo para revisión |
| ✅ Fin de sesión/Micro-Sprint | **Sí** | Backup y visibilidad |
| ✅ Fix crítico en producción | **Sí, inmediato** | Urgencia |
| ⚠️ Trabajo en progreso (WIP) | **Depende** | Solo si necesitas backup o colaboración |
| ❌ Código que no compila | **No** | Nunca push de código roto |
| ❌ Tests fallando | **No** | Arreglar primero |
| ❌ Secretos/credenciales | **NUNCA** | Seguridad |

### 8.4 Formato de Mensajes de Commit

> **🇪🇸 OBLIGATORIO: Todos los mensajes de commit deben estar en ESPAÑOL**

Seguir **Conventional Commits** en español:

```
<tipo>(<alcance>): <título claro y descriptivo>

<cuerpo detallado explicando:>
- Qué se hizo exactamente
- Por qué se hizo (contexto de negocio)
- Cómo afecta al usuario/sistema

<footer con ID de intervención>
```

**Tipos permitidos (en español):**
| Tipo | Uso | Ejemplo de Título |
|------|-----|-------------------|
| `feat` | Nueva funcionalidad | `feat(clientes): agregar filtro por rango de fechas en tabla de clientes` |
| `fix` | Corrección de bug | `fix(facturas): corregir cálculo de IVA que mostraba decimales incorrectos` |
| `refactor` | Reestructuración | `refactor(hooks): extraer lógica de paginación a hook reutilizable` |
| `docs` | Documentación | `docs(api): documentar endpoints de autenticación con ejemplos` |
| `style` | Formato | `style(componentes): aplicar formato Prettier a todos los archivos TSX` |
| `test` | Tests | `test(clientes): agregar tests unitarios para validación de RUT` |
| `chore` | Mantenimiento | `chore(deps): actualizar Next.js de 14.0 a 14.1 por vulnerabilidad` |
| `perf` | Rendimiento | `perf(dashboard): optimizar consulta que tardaba 3s a 200ms` |

### 8.5 Ejemplos de Buenos Commits (EN ESPAÑOL)

❌ **MAL - Vago e incompleto:**
```
fix: arreglar bug
```

❌ **MAL - En inglés:**
```
feat(clients): add pagination to table
```

✅ **BIEN - Descriptivo y en español:**
```
feat(clientes): implementar paginación en tabla de clientes con 10 registros por página

Se agregó paginación del lado del servidor para mejorar el rendimiento
cuando hay más de 100 clientes. Incluye:
- Botones de navegación (anterior/siguiente)
- Selector de cantidad por página (10, 25, 50)
- Indicador de "Mostrando X de Y resultados"

El usuario ahora puede navegar grandes listas sin que la página se congele.

IMPL-20260126-01
```

✅ **BIEN - Fix descriptivo:**
```
fix(facturas): corregir error que impedía exportar facturas con caracteres especiales

El botón "Exportar a Excel" fallaba silenciosamente cuando una factura
contenía caracteres como ñ, tildes o símbolos en el nombre del cliente.

Causa raíz: La librería xlsx no manejaba UTF-8 correctamente.
Solución: Agregar encoding UTF-8 explícito en la configuración de exportación.

Afectaba a ~15% de los clientes con nombres como "Muñoz", "García", etc.

FIX-20260126-01
```

✅ **BIEN - Refactor explicativo:**
```
refactor(api): separar lógica de negocio de controladores a servicios

Antes: Toda la lógica estaba en los archivos de rutas API (route.ts)
Ahora: Lógica extraída a /services con funciones puras y testeables

Archivos creados:
- src/services/clienteService.ts
- src/services/facturaService.ts

Motivación: Facilitar testing unitario y reutilización de lógica.
No hay cambios funcionales para el usuario.

IMPL-20260126-02
```

### 8.6 Reglas para Títulos de Commit

| Regla | ❌ Mal | ✅ Bien |
|-------|--------|---------|
| Usar verbos en infinitivo | "agregado filtro" | "agregar filtro" |
| Ser específico | "mejorar rendimiento" | "reducir tiempo de carga de 3s a 500ms" |
| Mencionar el contexto | "fix bug" | "corregir validación de email que aceptaba formatos inválidos" |
| Evitar jerga técnica innecesaria | "refactor HOC a hooks" | "modernizar componentes usando hooks en lugar de clases" |
| Máximo 72 caracteres en título | Título de 100+ chars | Título conciso, detalles en cuerpo |

### 8.7 Flujo de Trabajo Git

```
main ────●────●────●────●────●────●─── (producción)
          \                   /
           \   feature/xyz   /
            ●────●────●────●
            │    │    │    │
          commit │  commit push+PR
                 │
              [WIP] commit
              (backup)
```

**Reglas:**
1. **Nunca commit directo a `main`** en proyectos con equipo
2. **Feature branches** para cambios significativos
3. **PRs** para revisión (GEMINI puede auditar)
4. **Squash** commits WIP antes de merge (opcional)

### 8.8 Commits de los Agentes

Los agentes deben seguir estas reglas adicionales:

| Agente | Prefijo típico | Ejemplo |
|--------|---------------|---------|
| SOFIA | `feat`, `fix`, `refactor` | `feat(clientes): IMPL-20260126-01` |
| Deby | `fix` | `fix(api): FIX-20260126-01 - resolver timeout` |
| GEMINI | `chore`, `docs`, `ci` | `chore(infra): configurar Vercel` |
| INTEGRA | `docs`, `feat` | `docs: crear SPEC de facturación` |

### 8.9 Checklist Pre-Push

Antes de hacer push, verificar:

```markdown
## Pre-Push Checklist
- [ ] El código compila (`pnpm build`)
- [ ] Los tests pasan (`pnpm test`)
- [ ] No hay console.log de debug
- [ ] No hay secretos/credenciales hardcodeados
- [ ] El mensaje de commit es descriptivo
- [ ] Se incluye el ID de intervención
- [ ] Se actualizó documentación si aplica
```

### 8.10 Recuperación de Errores

| Situación | Comando | Cuándo usar |
|-----------|---------|-------------|
| Deshacer último commit (mantener cambios) | `git reset --soft HEAD~1` | Commit prematuro |
| Deshacer último commit (descartar cambios) | `git reset --hard HEAD~1` | Commit erróneo |
| Revertir commit ya pusheado | `git revert <hash>` | Fix en main |
| Enmendar último commit | `git commit --amend` | Olvidé algo |
| Descartar cambios locales | `git checkout -- <archivo>` | Experimento fallido |

⚠️ **NUNCA usar `--force` en `main` sin autorización del humano.**

---

## 9. Gestión de Deuda Técnica

### 9.1 Definición
Deuda técnica = decisiones de diseño subóptimas tomadas por restricciones de tiempo o recursos.

### 9.2 Registro Obligatorio
Toda deuda técnica se registra en `PROYECTO.md`:

```markdown
## Deuda Técnica
| ID | Descripción | Impacto | Sprint Target | Estado |
|----|-------------|---------|---------------|--------|
| DT-001 | Falta validación Zod en API | Medio | Sprint 4 | [ ] |
```

### 9.3 Ciclo de Vida
1. **Identificación** - Cualquier agente puede registrar
2. **Priorización** - INTEGRA asigna Sprint Target
3. **Resolución** - SOFIA implementa fix
4. **Validación** - GEMINI audita
5. **Cierre** - CRONISTA marca como [✓]

---

## 10. Fórmula de Priorización

Para ordenar tareas del backlog:

$$Puntaje = (Valor \times 3) + (Urgencia \times 2) - (Complejidad \times 0.5)$$

| Factor | Escala | Descripción |
|--------|--------|-------------|
| Valor | 1-5 | Impacto en el negocio/usuario |
| Urgencia | 1-5 | Qué tan pronto se necesita |
| Complejidad | 1-5 | Esfuerzo técnico estimado |

**Ejemplo:**
- Valor: 5, Urgencia: 4, Complejidad: 3
- Puntaje = (5×3) + (4×2) - (3×0.5) = 15 + 8 - 1.5 = **21.5**

---

## 11. Sistema de Checkpoints

### 11.1 ¿Qué es un Checkpoint?
Un **Checkpoint** es un documento de registro que captura el estado del proyecto en un momento específico. Funciona como:
- 📸 **Snapshot** - Foto del estado actual
- 📝 **Bitácora** - Registro de decisiones tomadas
- 🔗 **Trazabilidad** - Enlace entre cambios y razones
- 🤝 **Handoff** - Contexto para el siguiente agente

### 11.2 Cuándo Crear un Checkpoint

| Evento | Tipo de Checkpoint | Responsable |
|--------|-------------------|-------------|
| Tarea completada | `CHK_YYYY-MM-DD_HHMM.md` | SOFIA |
| Decisión arquitectónica importante | `CHK_YYYY-MM-DD_[TEMA].md` | INTEGRA |
| Fix de bug crítico | `CHK_YYYY-MM-DD_FIX-[ID].md` | Deby |
| Fin de sprint | `CHK_RETRO_YYYY-MM-DD.md` | CRONISTA |
| Rollback | `CHK_YYYY-MM-DD_ROLLBACK.md` | GEMINI/INTEGRA |

### 11.3 Nomenclatura
```
CHK_YYYY-MM-DD_HHMM.md          # Estándar (por hora)
CHK_YYYY-MM-DD_[TEMA].md        # Por tema específico
CHK_RETRO_YYYY-MM-DD.md         # Retrospectiva
CHK_YYYY-MM-DD_ROLLBACK.md      # Después de rollback
```

**Ejemplos:**
- `CHK_2026-01-26_1430.md` - Checkpoint de las 14:30
- `CHK_2026-01-26_AUTH-FIREBASE.md` - Checkpoint temático
- `CHK_RETRO_2026-01-26.md` - Retrospectiva de sprint

### 11.4 Checkpoint Enriquecido
Un **Checkpoint Enriquecido** va más allá del registro básico e incluye:

1. **Contexto de Negocio** - Por qué se hizo este cambio
2. **Decisiones Técnicas** - Opciones consideradas y justificación
3. **Código Relevante** - Snippets de los cambios clave
4. **Riesgos Identificados** - Qué podría salir mal
5. **Próximos Pasos** - Qué sigue y quién lo hace
6. **Soft Gates** - Estado de los 4 gates de calidad

### 11.5 Estructura del Checkpoint
Ver plantilla completa en: `meta/plantilla_control.md`

```markdown
# Checkpoint: [Título]

**Fecha:** YYYY-MM-DD HH:MM  
**Agente:** [SOFIA/INTEGRA/GEMINI/Deby]  
**ID:** [IMPL/ARCH/FIX]-YYYYMMDD-NN  

## Tarea(s) Abordada(s)
## Cambios Realizados
## Decisiones Técnicas
## Soft Gates
## Próximos Pasos
```

### 11.6 Buenas Prácticas

✅ **Hacer:**
- Crear checkpoint ANTES de marcar tarea como [✓]
- Incluir el "por qué", no solo el "qué"
- Listar TODOS los archivos modificados
- Documentar decisiones controversiales

❌ **Evitar:**
- Checkpoints genéricos sin contexto
- Omitir riesgos conocidos
- Dejar próximos pasos sin asignar
- Checkpoints sin ID de intervención

---

## 12. Sistema de Micro-Sprints

### 12.1 Filosofía: Entregables Demostrables

> **🎯 Regla de Oro:** "Si no lo puedo ver funcionando, no está terminado."

Cada sesión de trabajo debe producir algo **TANGIBLE** y **DEMOSTRABLE** - no solo "código que completa más código". El usuario debe poder:
- **Ver** la funcionalidad en pantalla
- **Interactuar** con ella
- **Validar** que resuelve lo que necesita

❌ **NO cuenta como entregable:**
- "Refactoricé el hook"
- "Optimicé el query"
- "Preparé la estructura"
- "Agregué los tipos"

✅ **SÍ cuenta como entregable:**
- "Ahora puedes ver la lista de clientes con paginación"
- "El botón de exportar ya genera el Excel"
- "La pantalla de login valida el correo y muestra errores"
- "El dashboard muestra el gráfico de consumo mensual"

### 12.2 Estructura de 3 Niveles

```
🗓️ SPRINT (1-2 semanas)
│   Objetivo: Feature completa o conjunto de features relacionadas
│   Ejemplo: "Módulo de Facturación Completo"
│
└── 📅 MICRO-SPRINT (1 sesión = 2-4 horas)
    │   Objetivo: UN entregable demostrable
    │   Ejemplo: "Lista de facturas con filtros funcionando"
    │
    └── ✅ TAREAS (componentes técnicos)
            Ejemplo: API endpoint, componente UI, tests
```

### 12.3 Gestión Multi-Proyecto

Puedes distribuir Micro-Sprints entre proyectos según prioridad:

```
Semana 4:
├── Proyecto A (FariEnergy)
│   ├── Lunes: Micro-Sprint 1 → "Pantalla de clientes con CRUD"
│   ├── Martes: Micro-Sprint 2 → "Exportación a Excel funcionando"
│   └── Jueves: Micro-Sprint 3 → "Dashboard con métricas reales"
│
└── Proyecto B (PortafolioWeb)
    └── Miércoles: Micro-Sprint 1 → "Landing page responsive"
```

### 12.4 Ritual de Inicio de Sesión

**INTEGRA** ejecuta este ritual al comenzar cada sesión:

```markdown
## 📋 MICRO-SPRINT: [Nombre Descriptivo]
**Fecha:** YYYY-MM-DD  
**Proyecto:** [Nombre del proyecto]  
**Duración estimada:** 2-4 horas  

### 🎯 Entregable Demostrable
> [Descripción en UNA frase de lo que el usuario VERÁ funcionando]
> Ejemplo: "El usuario podrá ver la lista de facturas, filtrar por fecha y exportar a PDF"

### ✅ Tareas Técnicas
- [ ] Tarea 1 (componente técnico)
- [ ] Tarea 2 (componente técnico)
- [ ] Tarea 3 (componente técnico)

### ⚠️ Criterio de Corte
Si alguna tarea no cabe en esta sesión → pasa al siguiente Micro-Sprint.
NO se entrega funcionalidad a medias.

### 🧪 Cómo Demostrar
1. Ir a [URL/pantalla]
2. Hacer [acción]
3. Verificar que [resultado esperado]
```

### 12.5 Ritual de Cierre de Sesión

Al finalizar cada Micro-Sprint:

1. **Mini-Demo** - Mostrar el entregable funcionando
2. **Checkpoint** - Documentar lo logrado (ver Sección 10)
3. **Actualizar PROYECTO.md** - Marcar tareas completadas
4. **Próximo Micro-Sprint** - Definir qué sigue (si aplica)

```markdown
## 🏁 CIERRE MICRO-SPRINT: [Nombre]
**Resultado:** ✅ Completado | ⚠️ Parcial | ❌ Bloqueado

### Mini-Demo
- [x] Funcionalidad demostrada al usuario
- [x] Usuario validó que funciona

### Notas
> [Qué quedó pendiente, por qué, qué sigue]
```

### 12.6 Sistema de Budget Points (Opcional)

Para estimar capacidad por sesión:

| Puntos | Complejidad | Ejemplo |
|--------|-------------|---------|
| 1 | Trivial | Fix de CSS, ajuste de texto |
| 2 | Simple | Componente UI básico |
| 3 | Moderada | CRUD simple con API |
| 5 | Compleja | Feature con múltiples integraciones |

**Budget por Micro-Sprint:** 4-6 puntos máximo

**Ejemplo:**
```markdown
### Budget: 5/6 puntos
- [ ] (3) Tabla de facturas con paginación
- [ ] (2) Filtros por fecha y estado
```

### 12.7 La Regla del "No a Medias"

> **Si no cabe completo, no entra.**

Si durante el Micro-Sprint descubres que una tarea es más grande de lo esperado:
1. **DETENTE** - No intentes "terminar a medias"
2. **PIVOTEA** - Reduce el alcance a algo demostrable
3. **DOCUMENTA** - Lo que queda va al siguiente Micro-Sprint

**Ejemplo:**
- Planeado: "CRUD completo de clientes"
- Realidad: Solo da tiempo para crear y listar
- Decisión: Entregar "Lista de clientes con creación" → Editar/Eliminar va al siguiente

---

## 13. Escalamiento Obligatorio al Humano

### 13.1 Principio Fundamental

> **🛑 Cuando el agente está girando en círculos, DEBE DETENERSE y preguntar.**

Los agentes NO deben seguir intentando infinitamente. El humano tiene contexto que el agente no tiene.

### 13.2 Triggers de Escalamiento Inmediato

| Situación | Acción | Mensaje Sugerido |
|-----------|--------|------------------|
| **Mismo error 2 veces** | DETENER → Consultar humano | "He intentado 2 veces y sigo con el mismo error. ¿Quieres que pruebe otro enfoque o prefieres revisarlo tú?" |
| **Mismo approach 3 veces** | DETENER → Consultar humano | "Llevo 3 intentos con el mismo enfoque sin éxito. Necesito tu input." |
| **No sé qué archivo modificar** | PREGUNTAR antes de tocar | "No estoy seguro de dónde hacer este cambio. ¿Puedes indicarme el archivo?" |
| **Cambio afecta múltiples archivos (>5)** | CONFIRMAR alcance | "Este cambio afectaría X archivos. ¿Confirmas que proceda?" |

### 13.3 Decisiones que SIEMPRE requieren aprobación

❌ **NUNCA hacer sin preguntar:**

1. **Eliminar archivos o funcionalidad existente**
   > "Veo que X ya no se usa. ¿Confirmas que lo elimine?"

2. **Cambiar dependencias principales**
   > "Para esto necesitaría agregar/actualizar [librería]. ¿Procedo?"

3. **Modificar esquemas de base de datos**
   > "Esto requiere cambiar el modelo de datos. ¿Revisamos el impacto juntos?"

4. **Cambios de seguridad/autenticación**
   > "Esto toca el sistema de auth. Prefiero que lo revises antes de aplicar."

5. **Configuración de producción**
   > "Este cambio afecta el ambiente de producción. ¿Confirmas?"

6. **Rollback o revert de commits**
   > "¿Confirmas que revierta el commit [hash]?"

### 13.4 Formato de Escalamiento

Cuando un agente escala, debe usar este formato:

```markdown
## 🛑 ESCALAMIENTO AL HUMANO

**Agente:** [SOFIA/Deby/GEMINI]  
**ID:** [IMPL/FIX-YYYYMMDD-NN]  
**Intentos realizados:** [número]

### Situación
[Descripción breve del problema]

### Lo que intenté
1. [Intento 1] → [Resultado]
2. [Intento 2] → [Resultado]

### Opciones que veo
- **Opción A:** [descripción]
- **Opción B:** [descripción]

### Mi recomendación
[Cuál opción prefiero y por qué]

### ¿Qué necesito de ti?
[Pregunta específica]
```

### 13.5 Regla del "No Adivinar"

> **Si no estoy 80% seguro, pregunto.**

Los agentes NO deben:
- Asumir la intención del usuario
- Inventar requerimientos no especificados
- "Mejorar" código sin que se lo pidan
- Cambiar estilo/arquitectura por preferencia propia

### 13.6 Manejo de Secretos

⚠️ **PROHIBIDO para todos los agentes:**
- Loggear API keys, tokens o passwords
- Hardcodear credenciales en código
- Mostrar contenido de archivos `.env` en outputs
- Subir secretos a repositorios

✅ **Correcto:**
- Usar variables de entorno
- Referenciar `.env.example` (sin valores reales)
- Pedir al humano que configure secretos manualmente

---

## 14. Discovery de Proyecto Nuevo

### 14.1 ¿Cuándo aplicar?

Cuando INTEGRA entra por **primera vez** a un proyecto que:
- No tiene `PROYECTO.md`
- No tiene `context/00_ARQUITECTURA.md`
- Es desconocido para el agente

### 14.2 Protocolo de Discovery

**INTEGRA** ejecuta estos pasos ANTES de cualquier tarea:

```markdown
## 🔍 DISCOVERY: [Nombre del Proyecto]
**Fecha:** YYYY-MM-DD  
**Agente:** INTEGRA  
**ID:** ARCH-YYYYMMDD-01

### 1. Estructura del Proyecto
- Carpetas principales: [listar]
- Tipo de proyecto: [monorepo/single-app/library]
- Frameworks detectados: [Next.js, React, Express, etc.]

### 2. Stack Tecnológico
| Capa | Tecnología | Versión |
|------|------------|---------|
| Frontend | | |
| Backend | | |
| Base de datos | | |
| Hosting | | |

### 3. Archivos Clave Identificados
- Configuración: [package.json, tsconfig.json, etc.]
- Entry points: [src/index.ts, pages/, etc.]
- Documentación existente: [README, docs/, etc.]

### 4. Estado Actual
- [ ] Compila sin errores
- [ ] Tests existentes pasan
- [ ] Documentación actualizada

### 5. Preguntas para el Humano
1. ¿Cuál es el objetivo principal de este proyecto?
2. ¿Hay features en progreso que deba conocer?
3. ¿Hay deuda técnica conocida?
4. ¿Quién más trabaja en esto?
```

### 14.3 Artefactos a Generar

Después del Discovery, INTEGRA debe crear:

1. **`PROYECTO.md`** - Backlog inicial basado en lo encontrado
2. **`context/00_ARQUITECTURA.md`** - Documentación del stack detectado
3. **`context/INDICE.md`** - Mapa de archivos clave (opcional pero útil)

### 14.4 Ejemplo de INDICE.md

```markdown
# Índice de Archivos Clave

## Configuración
- `package.json` - Dependencias y scripts
- `tsconfig.json` - Configuración TypeScript
- `.env.example` - Variables de entorno requeridas

## Entry Points
- `src/app/page.tsx` - Página principal
- `src/app/api/` - Endpoints de API

## Componentes Core
- `src/components/ui/` - Componentes de UI reutilizables
- `src/lib/` - Utilidades y helpers

## Datos
- `prisma/schema.prisma` - Esquema de base de datos
- `src/types/` - Tipos TypeScript
```

### 14.5 Cuándo Actualizar el Discovery

- Cada vez que se agregue un nuevo módulo/feature grande
- Al cambiar el stack tecnológico
- Al inicio de cada Sprint (validar que sigue vigente)

---

## 15. Artefactos del Sistema

### 15.1 Documentos Vivos
| Artefacto | Ubicación | Responsable |
|-----------|-----------|-------------|
| Backlog y Estados | `PROYECTO.md` | CRONISTA |
| Bitácora Técnica | `context/dossier_tecnico.md` | INTEGRA |
| Arquitectura | `context/00_ARQUITECTURA.md` | INTEGRA |

### 15.2 Documentos por Evento
| Artefacto | Ubicación | Trigger |
|-----------|-----------|---------|
| Checkpoint | `Checkpoints/CHK_YYYY-MM-DD_HHMM.md` | Al completar tarea |
| Dictamen | `context/interconsultas/DICTAMEN_FIX-[ID].md` | Al resolver bug |
| ADR | `context/decisions/ADR-NNN-[titulo].md` | Al tomar decisión arquitectónica |
| Handoff | `context/HANDOFF-[FEATURE].md` | Al delegar feature |
| Retrospectiva | `Checkpoints/CHK_RETRO_YYYY-MM-DD.md` | Al cerrar sprint |

---

## 16. Herramientas Complementarias: Qodo CLI

### 16.1 ¿Qué es Qodo CLI?
Qodo CLI (`@qodo/command`) es una herramienta de línea de comandos que permite ejecutar agentes IA desde la terminal. Los agentes de Copilot la invocan vía `run_in_terminal` como una "segunda mano" para obtener análisis independientes de testing, revisión y debugging.

> **Principio:** Copilot gobierna, Qodo valida. Qodo NO toma decisiones — reporta hallazgos que los agentes INTEGRA evalúan e incorporan.

### 16.2 Instalación y Autenticación
```bash
npm install -g @qodo/command
qodo login    # Genera API key guardada en ~/.qodo
```

### 16.3 Rol en los Soft Gates

| Soft Gate | Sin Qodo | Con Qodo CLI |
|-----------|----------|-------------|
| Gate 1: Compilación | `pnpm build` | Sin cambio |
| Gate 2: Testing | Tests manuales por SOFIA | `qodo "Genera tests para [archivo]" --act -y -q` |
| Gate 3: Revisión | GEMINI audita manualmente | `qodo self-review` + `qodo "Revisa [archivo]" --permissions=r` |
| Gate 4: Documentación | Checkpoints manuales | Sin cambio |

### 16.4 Comandos por Agente

| Agente | Momento | Comando Qodo CLI |
|--------|---------|-------------------|
| **SOFIA** | Después de implementar (Gate 2) | `qodo "Genera tests unitarios para [archivo]" --act -y -q --tools=git,filesystem` |
| **SOFIA** | Antes de commit (Gate 3) | `qodo self-review` |
| **GEMINI** | Auditoría post-commit (Gate 3) | `qodo "Revisa los cambios del último commit buscando bugs, seguridad y code smells" --permissions=r -y -q` |
| **GEMINI** | Revisión profunda | `qodo "Audita [módulo] según criterios de calidad: seguridad, performance, mantenibilidad" --plan -y -q --permissions=r` |
| **Deby** | Análisis forense | `qodo "Analiza el error en [archivo]:[línea], identifica causa raíz" --plan --tools=git,filesystem --permissions=r -q` |
| **Deby** | Validar fix pre-commit | `qodo self-review` |

### 16.5 Flags Clave para Automatización

| Flag | Función | Cuándo |
|------|---------|--------|
| `-y, --yes` | Auto-confirma prompts | Siempre (ejecución sin intervención humana) |
| `-q, --silent` | Solo muestra resultado final | Siempre (salida limpia para parsear) |
| `--act` | Ejecuta directo sin planificar | Tareas simples (generar tests) |
| `--plan` | Planifica antes de actuar | Tareas complejas (auditorías, análisis forense) |
| `--permissions=r` | Solo lectura | Revisiones y auditorías (no modifica código) |
| `--tools=lista` | Restringe herramientas | Limitar acceso según necesidad |
| `-m, --model=nombre` | Elige modelo IA | Cuando se necesita modelo específico |

### 16.6 Chains (Encadenamiento de Agentes Qodo)

Qodo permite encadenar tareas secuencialmente o en pipeline:

```bash
# Secuencial: mejora → revisa → abre PR
qodo chain "improve > review > open-pr"

# Pipeline: output de plan alimenta implement que alimenta test
qodo chain "plan | implement | test"
```

Los agentes INTEGRA pueden usar chains para flujos complejos de validación.

### 16.7 Agentes Custom (.toml)

Se pueden crear agentes Qodo personalizados en `agent.toml` para flujos repetitivos:

```toml
# agent.toml en la raíz del proyecto
[commands.integra-review]
description = "Review de código estilo INTEGRA"
instructions = """
Revisa el código según los criterios de INTEGRA:
1. Seguridad (no secretos hardcodeados, validaciones)
2. Performance (queries optimizados, no N+1)
3. Mantenibilidad (nombres claros, funciones pequeñas)
4. Convenciones (SPEC-CODIGO.md)
Reporta hallazgos con severidad: CRÍTICO / MEDIO / BAJO.
"""
tools = ["git", "filesystem", "ripgrep"]
```

Ejecutar: `qodo run integra-review`

### 16.8 Reglas de Uso

1. **Qodo NO modifica código sin supervisión** — Usar `--permissions=r` para auditorías.
2. **Hallazgos se documentan** — Issues críticos de Qodo se registran en el Checkpoint Enriquecido.
3. **Principio Cañón y la Mosca** — Si `pnpm test` basta, no usar Qodo.
4. **Modelo independiente** — Qodo usa su propio modelo IA, dando una segunda opinión real.

---

## 17. Ciclo de Mejora Continua

### 17.1 Retrospectiva de Sprint
Al final de cada sprint, CRONISTA facilita una retrospectiva:
1. ✅ Qué funcionó bien
2. ❌ Qué no funcionó
3. 🎯 Acciones de mejora
4. 📝 Ajustes a la metodología

### 17.2 Versionado de la Metodología
Cambios a INTEGRA se documentan en este archivo con:
- Número de versión semántico
- Fecha de cambio
- Descripción del cambio

---

## 18. Historial de Versiones

### v2.5.0 (2026-02-20)
- ✨ **Integración de Qodo CLI** (`@qodo/command`) - Segunda mano para testing y revisión vía terminal
- ✨ **Mapeo Qodo ↔ Soft Gates** - Comandos CLI alineados a Gates 2 y 3
- ✨ **Flags de automatización** - `-y -q --act --plan --permissions` para ejecución por agentes
- ✨ **Chains de Qodo** - Encadenamiento de tareas secuenciales y pipelines
- ✨ **Agentes custom .toml** - Definición de flujos Qodo reutilizables por proyecto
- 🔧 **Regla:** Copilot gobierna, Qodo valida

### v2.4.0 (2026-01-26)
- ✨ **Control de Versiones (Git)** - Guía completa de commits y push
- ✨ **Conventional Commits** - Formato estandarizado de mensajes
- ✨ **Pre-Push Checklist** - Verificaciones antes de push
- ✨ **Recuperación de Errores Git** - Comandos para deshacer/revertir
- 🔧 **Regla:** Nunca push de código que no compila

### v2.3.0 (2026-01-26)
- ✨ **Escalamiento Obligatorio al Humano** - Triggers claros para detenerse y preguntar
- ✨ **Regla del "No Adivinar"** - Si no estoy 80% seguro, pregunto
- ✨ **Discovery de Proyecto Nuevo** - Protocolo de onboarding para proyectos desconocidos
- ✨ **Manejo de Secretos** - Reglas explícitas de seguridad
- 🔧 **Límite de intentos** - Mismo error 2 veces = escalar al humano

### v2.2.0 (2026-01-26)
- ✨ **Sistema de Micro-Sprints** - Trabajo por sesiones con entregables demostrables
- ✨ **Regla de Oro** - "Si no lo puedo ver funcionando, no está terminado"
- ✨ **Ritual de Inicio/Cierre de Sesión** - Templates estandarizados
- ✨ **Budget Points** - Sistema opcional de estimación por puntos
- ✨ **Gestión Multi-Proyecto** - Distribución de micro-sprints entre proyectos
- 🔧 **Regla "No a Medias"** - Si no cabe completo, no entra

### v2.1.1 (2026-01-26)
- ✨ Formalización del Sistema de Handoff con sintaxis `runSubagent`
- ✨ Protocolo de Rollback documentado
- ✨ Gestión de Deuda Técnica estructurada
- ✨ Sistema de Checkpoints documentado (tipos, nomenclatura, enriquecidos)
- ✨ Plantilla de Retrospectiva añadida
- ✨ Script de inicialización de proyectos
- 🔧 Triggers de escalamiento explícitos en cada agente
- 🔧 Deby clarificado como consultor (no escala)

### v2.1.0 (2026-01-01)
- Ecosistema de 5 agentes especializados
- Soft Gates de calidad
- Sistema de IDs y trazabilidad

### v2.0.0 (2025-11-08)
- Integración de SPEC-CODIGO.md
- Checkpoints enriquecidos
- ADRs formalizados

### v1.0.0 (2025-10-01)
- Versión inicial de la metodología
- Roles básicos: CODEX, SOFIA, GEMINI

---

## 18. Licencia

MIT License - Libre para uso personal y comercial.

---

*"Metodología INTEGRA: Donde la IA y el humano colaboran con propósito."*
