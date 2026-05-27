# SPEC_ARCH-20260527-04

## Título
Perfiles médicos dentro de la ficha de Empresa Cliente y asignación a puestos de trabajo.

## Objetivo
Cerrar el flujo operativo natural dentro de `/companies/[id]` para que el administrador pueda crear perfiles médicos específicos de la empresa y luego asignarlos a los puestos de trabajo sin salir de la ficha.

## Decisión de producto
- La ficha de Empresa Cliente será la superficie operativa natural para preparar la estructura clínica de una empresa.
- El orden preferente del flujo es: empresa -> perfil médico -> puesto de trabajo.
- La asignación del perfil al puesto seguirá ocurriendo en el modal existente de Puestos de Trabajo mediante `defaultProfileId`.
- Los perfiles globales seguirán disponibles como opciones de asignación, pero la gestión local de la ficha debe enfocarse solo en perfiles propios de la empresa actual.

## Datos existentes a reutilizar
- `frontend/src/app/companies/[id]/page.tsx` ya carga empresa, sucursales, puestos y perfiles con `getMedicalProfilesForCompany(id)`.
- `frontend/src/app/companies/[id]/JobPositionsPanel.tsx` ya permite asignar `defaultProfileId` al crear o editar un puesto.
- `frontend/src/actions/medical-profiles.ts` ya expone `getMedicalTests`, `createMedicalProfile`, `updateMedicalProfile` y `deleteMedicalProfile`.
- `frontend/prisma/schema.prisma` ya soporta `MedicalProfile.companyId` y `JobPosition.defaultProfileId`; no se requiere cambio de esquema.

## Datos faltantes a crear
- Un panel cliente específico para la ficha de empresa que liste y gestione perfiles médicos propios de la empresa actual.
- Revalidación explícita de `/companies/[id]` dentro de las server actions de perfiles cuando exista `companyId`.
- Copys de UX actualizados en Puestos de Trabajo para apuntar al flujo local de la empresa y no solo a `/admin/profiles`.

## Comportamiento funcional requerido

### 1. Panel nuevo en ficha de empresa
- Insertar un bloque `Perfiles Médicos` en `/companies/[id]`, antes del bloque `Puestos de Trabajo`.
- El panel debe listar solo perfiles con `companyId === id`.
- Debe permitir crear, editar y eliminar perfiles de esa empresa.
- Cada perfil debe mostrar nombre y resumen de pruebas seleccionadas.

### 2. Alta y edición de perfil
- El modal del panel debe reutilizar el patrón actual de `/admin/profiles`.
- El formulario debe capturar:
  - nombre del perfil;
  - selección múltiple de pruebas agrupadas por categoría;
  - `companyId` oculto fijado a la empresa actual.
- La validación sigue siendo la de `MedicalProfileSchema`: nombre obligatorio y al menos una prueba.

### 3. Eliminación acotada
- Solo deben eliminarse perfiles propios de la empresa actual desde este panel.
- La UI no debe presentar perfiles globales como eliminables o editables desde `/companies/[id]`.

### 4. Integración con Puestos de Trabajo
- El panel actual de puestos mantiene el selector de `Perfil Médico por Defecto`.
- Los perfiles creados en la misma ficha deben aparecer en ese selector tras la revalidación de la ruta.
- El mensaje vacío o de advertencia en Puestos de Trabajo debe orientar al usuario a crear el perfil en la misma ficha de empresa.

### 5. Compatibilidad con perfiles globales
- `getMedicalProfilesForCompany(id)` debe seguir entregando perfiles de empresa y globales para el selector de puestos.
- El nuevo panel de perfiles de empresa no debe mostrar perfiles globales como si fueran propios.

## Scope exacto para Sofia

### Archivo ancla inicial
- `frontend/src/app/companies/[id]/page.tsx`

### Archivos exactos a modificar o crear
- Modificar `frontend/src/app/companies/[id]/page.tsx`
- Crear `frontend/src/app/companies/[id]/CompanyMedicalProfilesPanel.tsx`
- Modificar `frontend/src/app/companies/[id]/JobPositionsPanel.tsx`
- Modificar `frontend/src/actions/medical-profiles.ts`

### Máximo de archivos permitidos
- 4 archivos.
- Si Sofia detecta que necesita un quinto archivo, debe detenerse y devolver `BLOQUEO DE CONTEXTO` con la justificación exacta.

## Diseño técnico aprobado

### A. `page.tsx`
- Agregar `getMedicalTests()` al `Promise.all`.
- Mantener `getMedicalProfilesForCompany(id)` para alimentar Puestos de Trabajo.
- Pasar al nuevo panel:
  - `companyId`
  - `companyName`
  - `companyProfiles` filtrados localmente por `companyId === id`
  - `availableTests`

### B. `CompanyMedicalProfilesPanel.tsx`
- Crear un client component nuevo con patrón similar a `MedicalProfilesManager`, pero acotado al contexto empresa.
- Debe incluir:
  - feedback success/error;
  - listado en tarjetas o tabla compacta;
  - modal de crear;
  - modal de editar;
  - confirmación para eliminar.
- Debe usar `createMedicalProfile`, `updateMedicalProfile`, `deleteMedicalProfile`.
- En crear y editar, serializar `testIds` como JSON en `FormData` igual que el módulo admin existente.
- Debe fijar `companyId` en hidden input y no ofrecer selector de empresa.

### C. `JobPositionsPanel.tsx`
- Mantener intacta la lógica del selector de perfiles por defecto.
- Cambiar el banner de ausencia de perfiles para que indique que el usuario puede crear el perfil en el bloque de `Perfiles Médicos` dentro de la misma ficha.
- No introducir nuevo modal ni segundo flujo oculto dentro de Puestos de Trabajo en esta iteración.

### D. `medical-profiles.ts`
- Mantener el contrato Zod actual.
- En `createMedicalProfile`, `updateMedicalProfile` y `deleteMedicalProfile`, además de `/admin/profiles`, revalidar `/companies/[companyId]` cuando el perfil sea empresa-específico.
- Para `deleteMedicalProfile`, resolver el `companyId` antes de borrar para poder revalidar correctamente la ruta de empresa.
- No cambiar firma pública de `updateMedicalProfile` ni agregar dependencias nuevas.

## Fuera de alcance
- Compartir el modal entre admin global y ficha de empresa mediante refactor transversal.
- Crear alta inline de perfil dentro del modal de puestos.
- Tocar `frontend/prisma/schema.prisma`.
- Tocar workers, appointments, check-in o eventos.
- Modificar `/admin/profiles` más allá de compatibilidad indirecta por retorno del action.

## Validación exacta esperada
- Comando de lint acotado:
  - `pnpm lint src/app/companies/[id]/page.tsx src/app/companies/[id]/CompanyMedicalProfilesPanel.tsx src/app/companies/[id]/JobPositionsPanel.tsx src/actions/medical-profiles.ts`
- Validación funcional mínima manual:
  1. Abrir una empresa cliente.
  2. Crear un perfil médico propio de esa empresa desde la misma ficha.
  3. Confirmar que el perfil aparece en el panel de perfiles de la empresa.
  4. Crear o editar un puesto y verificar que el perfil nuevo aparece como opción asignable.
  5. Guardar el puesto con ese perfil por defecto.

## Criterios de aceptación
- La ficha `/companies/[id]` muestra un panel de perfiles médicos empresa-específicos.
- El usuario puede crear un perfil sin salir a `/admin/profiles`.
- El formulario exige al menos una prueba.
- El panel de puestos sigue funcionando y puede asignar el perfil creado.
- Los perfiles globales siguen apareciendo como opción en el selector de puestos.
- No hay cambios de esquema Prisma.

## Condición de detención
- Si durante la implementación Sofia descubre que el panel nuevo no puede refrescar la lista de perfiles y la asignación de puestos sin tocar más de 4 archivos, debe detenerse y reportar `BLOQUEO DE CONTEXTO` indicando exactamente qué archivo adicional sería necesario y por qué.

## Handoff operativo previsto
Tras implementar, Sofia debe entregar código listo para revisión y derivación a Val con el mismo comando de lint acotado y una nota breve del flujo validado manualmente.