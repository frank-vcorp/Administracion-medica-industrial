# Roles — acumulador (pendiente de implementación)

Esta carpeta reúne requisitos de **visibilidad por rol** mientras se terminan las pantallas.
**No implementar roles aquí todavía** hasta que el renombrado visual y la estructura de UI estén cerrados.

## Enfoque acordado

1. **Primero:** cambios de etiquetas y layout (mayoría son solo texto en pantalla).
2. **Después:** aplicar permisos / visibilidad por rol sobre pantallas ya estables.
3. **Este folder:** ir documentando qué ve cada rol en cada módulo, sin tocar código de auth todavía.

## Roles mencionados en documentación de negocio

| Nombre en docs | Rol técnico probable (a confirmar) | Notas |
|---|---|---|
| Recepción | `RECEPTIONIST` | Ya existe en `UserRole` |
| Coordinador Médico | *sin enum hoy* | ¿`ADMIN`? ¿nuevo rol? ¿`DOCTOR_GENERAL`? |
| Médico / Validador | `DOCTOR_GENERAL`, `DOCTOR_VALIDATOR` | Parcialmente usados en nav |
| Admin / Superadmin | `ADMIN`, `SUPERADMIN` | Acceso amplio hoy |

## Archivos en esta carpeta

| Archivo | Contenido |
|---|---|
| [renombramiento-catalogos-roles.md](./renombramiento-catalogos-roles.md) | Visibilidad por rol del Word *Renombramiento de catálogos 2* |
| [etiquetas-sin-rol.md](./etiquetas-sin-rol.md) | Renombramientos que son solo label (no dependen de rol) |

## Cuándo implementar

- [ ] Pantallas de citas / agenda con labels finales
- [ ] Listados combinados definidos (pacientes + expedientes)
- [ ] Estatus clínicos acordados (resultados, interpretación, envío)
- [ ] Matriz rol × pantalla × acción revisada con negocio

## Referencia técnica actual

Enum `UserRole` en `frontend/prisma/schema.prisma`:  
`ADMIN`, `RECEPTIONIST`, `DOCTOR_GENERAL`, `DOCTOR_VALIDATOR`, `CAPTURIST`, `COMPANY_CLIENT`, `VENDEDOR`, `SUPERADMIN`.
