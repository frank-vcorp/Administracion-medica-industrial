# Etiquetas — solo visual (sin rol, implementar ya)

Cambios de **texto en UI** que no requieren permisos ni lógica de negocio.
Implementables mientras se acumulan roles en esta carpeta.

**Fuente:** `context/datos AMI/Renombramiento de catálogos 2.docx`

| Ubicación | Actual | Nuevo | Archivo(s) |
|---|---|---|---|
| Nav lateral | Agenda de Citas | Gestión de citas | `AppShell.tsx`, título `appointments/page.tsx` |
| KPI citas | completar con pacientes citados | Pacientes citados | `appointments/page.tsx` |
| KPI citas | Pruebas pendientes | Pacientes con pruebas pendientes | `appointments/page.tsx` |
| KPI citas | Atención completa | Pacientes con atención completa | `appointments/page.tsx` |
| Dashboard KPI | En Espera / Consulta | Pacientes en espera | `dashboard/page.tsx` *(si aplica)* |

## No son solo etiqueta (esperar aclaración)

| Ítem | Por qué no es solo label |
|---|---|
| Total del día | No existe la tarjeta; hay que definir qué cuenta |
| Realizado / Pendiente / No realizado | Puede implicar nuevos estados en BD |
| Pendiente de interpretación / Prueba interpretada | Puede reemplazar enum o flujo de envío |
| Combinar listados + quitar Agenda | Cambio estructural de navegación |
| Público general dentro de empresas | Cambio de ruta y UX |
| Validación diagnóstica en listado | Cambio de layout (tabla vs cards) |
| Semáforo rojo/verde | Requiere regla de negocio "completo" |
| Informe mensual | Requiere saber qué informe y periodo |
| Bug modal agendar citas | Fix de UI/CSS, no de rol |

## Resumen

- **~6 renombramientos** son seguros como cambio visual.
- **Roles y permisos** van en archivos de esta carpeta hasta que pantallas y estatus estén cerrados.
- **~8 ítems** del Word necesitan aclaración de negocio antes de codear.
