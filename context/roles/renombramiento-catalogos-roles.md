# Roles — Renombramiento de catálogos 2

**Fuente:** `context/datos AMI/Renombramiento de catálogos 2.docx`  
**Estado:** acumulado — **no implementar** hasta cerrar pantallas.

---

## Visibilidad de KPIs en Gestión de citas

El documento asigna las tarjetas de resumen a **Recepción / Coordinador Médico**.

| Métrica (nombre nuevo) | Nombre actual en código | Roles doc | Pantalla |
|---|---|---|---|
| Pacientes citados | `completar con pacientes citados` | Recepción / Coordinador Médico | `/appointments` |
| Pacientes con pruebas pendientes | `Pruebas pendientes` | Recepción / Coordinador Médico | `/appointments` |
| Pacientes con atención completa | `Atención completa` | Recepción / Coordinador Médico | `/appointments` |
| Pacientes en espera | *(no en citas; dashboard: "En Espera / Consulta")* | Recepción / Coordinador Médico | ¿`/appointments` o `/dashboard`? |
| Total del día | *(no existe tarjeta hoy)* | Recepción / Coordinador Médico | ¿`/appointments`? |

### Preguntas abiertas (roles)

- [ ] ¿"Coordinador Médico" es rol nuevo o alias de `ADMIN` / otro existente?
- [ ] ¿Médicos (`DOCTOR_*`) ven estas métricas o solo recepción?
- [ ] ¿Ocultar tarjeta o mostrar read-only según rol?
- [ ] ¿"Total del día" es suma de citas del día o otro criterio?

---

## Otros ítems del doc con posible impacto en roles

Estos ítems **no son solo etiqueta**; cuando se implementen, anotar aquí qué rol accede.

| Ítem doc | Impacto en roles | Pendiente |
|---|---|---|
| Eliminar Agenda y combinar listados | ¿Quién ve el listado unificado? | Definir pantalla |
| Módulo de pruebas clínicas | ¿Recepción vs médico vs lab? | Definir ruta |
| Validación diagnóstica (listado) | Hoy accesible vía nav staff; validadores ya parcialmente filtrados | Confirmar matriz |
| Semáforo expediente completo/incompleto | Probablemente mismo listado unificado | Definir criterio + rol |
| Público general en listado de empresas | ¿Solo admin/recepción crea pacientes PG? | Definir |
| Estatus envío / interpretación | ¿Quién cambia estado vs solo lectura? | Definir workflow |
| Informe mensual | Doc no especifica informe ni rol | Aclarar con negocio |

---

## Plantilla para nuevas entradas

```markdown
### [Pantalla / módulo]

- **Roles que ven:** …
- **Roles que editan:** …
- **Fuente:** …
- **Estado:** pendiente | acordado | implementado
```
