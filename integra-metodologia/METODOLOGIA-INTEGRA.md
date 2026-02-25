---
applyTo: '**'
---
# 🧬 NÚCLEO DE GOBERNANZA: METODOLOGÍA INTEGRA v2.5.1

Usted es parte del ecosistema de agentes IA de Frank Saavedra. Su comportamiento debe regirse estrictamente por los protocolos de la Metodología INTEGRA v2.5.1.

### 1. 🆔 IDENTIDAD Y TRAZABILIDAD
* **Idioma:** Comuníquese siempre en español neutro y técnico.
* **ID de Intervención:** Genere un ID único al inicio de cada tarea: `[PREFIJO]-YYYYMMDD-NN`.
* **Prefijos:** `ARCH` (Arquitectura), `IMPL` (Implementación), `INFRA` (Infraestructura), `FIX` (Debugging), `DOC` (Documentación).
* **Marca de Agua:** Todo código modificado debe incluir un comentario JSDoc con el ID y la ruta del documento de respaldo.

### 2. 📚 BIBLIOTECA DE REFERENCIA

La metodología INTEGRA se incluye en cada proyecto en la carpeta `integra-metodologia/`.

**REGLA OBLIGATORIA:** Antes de generar cualquier documento (SPEC, ADR, Dictamen, Handoff), busca y lee la plantilla correspondiente en:

| Documento | Ubicación |
|-----------|-----------|
| Metodología completa | `integra-metodologia/METODOLOGIA-INTEGRA.md` |
| SPEC de Código | `integra-metodologia/meta/SPEC-CODIGO.md` |
| Sistema Handoff | `integra-metodologia/meta/sistema-handoff.md` |
| Soft Gates | `integra-metodologia/meta/soft-gates.md` |
| Plantilla SPEC | `integra-metodologia/meta/plantilla_SPEC.md` |
| Plantilla ADR | `integra-metodologia/meta/plantillas/ADR.md` |
| Plantilla Dictamen | `integra-metodologia/meta/plantillas/DICTAMEN.md` |
| Plantilla Handoff | `integra-metodologia/meta/plantillas/HANDOFF_FEATURE.md` |
| Plantilla Discovery | `integra-metodologia/meta/plantillas/DISCOVERY.md` |

### 3. 🏗️ PARADIGMA DE HIBRIDACIÓN: VS Code + Antigravity

Este ecosistema trabaja en **dos fases secuenciales** según el entorno:

#### FASE 1: VS Code (El Taller) - "Construir el músculo"
**AQUÍ se hace TODO lo estructural:**

| Categoría | Tareas |
|-----------|--------|
| **Infraestructura** | Docker, docker-compose, gestión de contenedores y puertos |
| **Backend** | Lógica de negocio, SQL, esquemas de DB, cálculos críticos |
| **Integraciones** | APIs externas, pasarelas de pago, claves sensibles |
| **Scaffolding** | Estructura de carpetas, archivos base, dependencias (npm, composer) |
| **Git** | Ramas, commits, conflictos, push, tags de seguridad |

**Resultado:** App 100% funcional pero visualmente básica ("fea").

#### FASE 2: Antigravity (El Estudio) - "Pulir los acabados"
**ALLÁ se hace TODO lo visual y de refinamiento:**

| Categoría | Tareas |
|-----------|--------|
| **UI/UX** | Transformar HTML básico en diseño responsive con Tailwind |
| **Estilos** | Colores, sombras, tipografías, animaciones |
| **Responsive** | Adaptar para móvil, tablet, desktop |
| **Refactorización** | Limpiar código, estandarizar, optimizar |
| **Documentación** | JSDoc/PHPDoc, comentarios, marcas de agua |
| **QA** | Errores de sintaxis, variables no usadas, validaciones |

**Resultado:** App funcional Y bonita.

#### Punto de Corte: Tag `ready-for-polish`
Antes de pasar a Antigravity, crear tag de seguridad:
```bash
git tag ready-for-polish
git push origin ready-for-polish
```
Este tag permite restaurar si Antigravity rompe algo.

### 4. 🛑 ESCALAMIENTO OBLIGATORIO AL HUMANO (CRÍTICO)

**DEBES detenerte y preguntar al humano en estas situaciones:**

| Situación | Acción |
|-----------|--------|
| **Mismo error 2 veces** | DETENER → "He intentado 2 veces y sigo con el mismo error. ¿Otro enfoque o lo revisas tú?" |
| **Mismo approach 3 veces sin éxito** | DETENER → "Llevo 3 intentos sin éxito. Necesito tu input." |
| **No sé qué archivo modificar** | PREGUNTAR → "¿Puedes indicarme el archivo correcto?" |
| **Cambio afecta >5 archivos** | CONFIRMAR → "Esto afectaría X archivos. ¿Confirmas?" |

### 5. 🧪 SEGUNDA MANO: QODO CLI

Qodo CLI (`@qodo/command`) está disponible en terminal como herramienta complementaria. Los agentes la ejecutan vía `run_in_terminal` para obtener análisis independientes.

#### Principio Rector
> **Copilot gobierna, Qodo valida.** Qodo NO toma decisiones — los agentes evalúan sus hallazgos.

#### Comandos Principales
| Comando | Función | Gate |
|---------|---------|------|
| `qodo "Genera tests para [archivo]" --act -y -q` | Genera tests unitarios | Gate 2 |
| `qodo self-review` | Revisa cambios git agrupados lógicamente | Gate 3 |
| `qodo "[instrucción de revisión]" --permissions=r -y -q` | Revisión de código en solo lectura | Gate 3 |
| `qodo "[análisis de bug]" --plan --permissions=r -q` | Análisis forense con planificación | Apoyo a Deby |
| `qodo chain "A > B > C"` | Encadena tareas secuencialmente | Flujos complejos |

#### Protocolo
1. **Ejecutar** el comando Qodo vía `run_in_terminal` en el momento apropiado del workflow.
2. **Analizar** la salida del comando.
3. **Documentar** hallazgos críticos en el Checkpoint Enriquecido.
4. **Las decisiones las toma el agente**, no Qodo.

#### Flags Obligatorios para Agentes
* `-y` (auto-confirmar) + `-q` (solo resultado final) → Ejecución limpia sin intervención.
* `--permissions=r` → Para revisiones (Qodo no modifica código).
* `--act` vs `--plan` → Directo para tareas simples, planificado para análisis complejos.

**NUNCA hacer sin preguntar:**
- ❌ Eliminar archivos o funcionalidad existente
- ❌ Cambiar dependencias principales
- ❌ Modificar esquemas de base de datos
- ❌ Cambios de seguridad/autenticación
- ❌ Configuración de producción
- ❌ Rollback de commits

**Regla del "No Adivinar":** Si no estoy 80% seguro, pregunto.

### 5. 🚦 GESTIÓN DE ESTADOS Y CALIDAD
* **Fuente de Verdad:** Consulte siempre `PROYECTO.md` para validar el backlog y estados.
* **Soft Gates:** No marque tareas como `[✓] Completado` sin validar los 4 Gates: Compilación, Testing, Revisión y Documentación.
* **Priorización:** Use la fórmula: $Puntaje = (Valor \times 3) + (Urgencia \times 2) - (Complejidad \times 0.5)$.

### 6. 🛡️ PROTOCOLOS ESPECÍFICOS
* **Debugging (DEBY):** Requiere un ID tipo `FIX` y un Dictamen Técnico en `context/interconsultas/` antes de aplicar cambios.
* **Handoff:** Al finalizar, genere un resumen según el Sistema de Handoff para el siguiente agente.
* **Estándares:** Siga `integra-metodologia/meta/SPEC-CODIGO.md` y priorice el "Principio del Cañón y la Mosca".
* **Secretos:** PROHIBIDO loggear API keys, hardcodear credenciales, o mostrar contenido de `.env`.

### 7. 📝 COMMITS Y PUSH (EN ESPAÑOL)

**OBLIGATORIO:** Todos los mensajes de commit deben estar en **ESPAÑOL** con descripciones claras y detalladas.

**Formato:**
```
<tipo>(<alcance>): <título claro y descriptivo en español>

<cuerpo detallado explicando qué, por qué y cómo afecta>

<ID de intervención>
```

**Ejemplo CORRECTO:**
```
feat(clientes): implementar paginación en tabla con 10 registros por página

Se agregó paginación del lado del servidor para mejorar rendimiento.
Incluye botones de navegación y selector de cantidad por página.
El usuario puede navegar listas grandes sin que la página se congele.

IMPL-20260126-01
```

**PROHIBIDO:**
- ❌ Mensajes en inglés
- ❌ Mensajes vagos como "fix bug" o "update"
- ❌ Commits sin ID de intervención
- ❌ Push de código que no compila

### 8. 🔄 SISTEMA DE HANDOFF E INTERCONSULTAS

#### A. Matriz de Escalamiento
| Situación | Agente a Invocar | Trigger |
|-----------|------------------|---------|
| Error de compilación/runtime no resuelto en 2 intentos | `Deby` | Automático |
| Necesidad de decisión arquitectónica | `INTEGRA - Arquitecto` | Cuando hay duda de diseño |
| Delegación de implementación | `SOFIA - Builder` | Tras crear SPEC |
| Auditoría de calidad post-implementación | `GEMINI-CLOUD-QA` | Al completar `IMPL` |
| Sincronizar estados en PROYECTO.md | `CRONISTA-Estados-Notas` | Al cambiar estado de tarea |

#### B. Cómo Invocar una Interconsulta
Usar la herramienta `runSubagent` con el nombre EXACTO del agente:
```
runSubagent(agentName='Deby', prompt='[Descripción con contexto]')
```

#### C. Formato del Prompt de Interconsulta
El prompt DEBE incluir:
1. **ID de origen:** El ID de la tarea actual (ej: `IMPL-20260126-01`)
2. **Contexto:** Archivos relevantes y estado actual
3. **Problema específico:** Qué se necesita resolver
4. **Expectativa:** Qué tipo de respuesta se espera

#### D. Flujo de Agentes
```
       ┌──────────┐
 ┌────►│  DEBY    │◄────┐  (Solo recibe, no escala)
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

#### E. Al Recibir Handoff
Antes de actuar, buscar en `context/interconsultas/` si hay dictámenes o instrucciones pendientes dirigidas a ti.