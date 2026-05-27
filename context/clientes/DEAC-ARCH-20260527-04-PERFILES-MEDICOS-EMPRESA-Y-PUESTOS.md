# DEAC-ARCH-20260527-04

## Nombre del corte
Perfiles médicos dentro de Empresa Cliente y asignación natural a puestos de trabajo.

## Problema operativo
La ficha de Empresa Cliente ya permite administrar sucursales permitidas y puestos de trabajo, pero no permite crear ahí mismo los perfiles médicos de esa empresa. El usuario debe salir a una ruta administrativa separada para crear el perfil y luego volver a la empresa para asignarlo al puesto. Ese salto rompe el flujo natural de alta: empresa, perfil médico, puesto de trabajo.

## Objetivo
Habilitar desde la ficha de Empresa Cliente la creación y edición de perfiles médicos propios de esa empresa, de forma que luego puedan asignarse a los puestos de trabajo usando el selector ya existente.

## Resultado esperado
- La ficha de empresa muestra un panel de Perfiles Médicos de la empresa.
- Desde ese panel se puede crear y editar perfiles con selección de pruebas.
- Los perfiles creados quedan ligados a la empresa actual.
- El panel de Puestos de Trabajo sigue permitiendo asignar el perfil por defecto al crear o editar un puesto.
- El flujo natural queda cerrado sin salir de la ficha de empresa.

## Usuarios impactados
- Administrador del sistema.
- Operación administrativa que arma empresas, perfiles y puestos antes de agendar citas.

## Flujo aprobado
1. Crear o abrir Empresa Cliente.
2. Dar de alta uno o más perfiles médicos propios de esa empresa dentro de la misma ficha.
3. Crear o editar un puesto de trabajo.
4. Asignar uno de los perfiles de la empresa como perfil médico por defecto del puesto.
5. Mantener compatibilidad con perfiles globales existentes cuando aplique.

## Alcance aprobado
- Exponer CRUD acotado de perfiles médicos empresa-específicos dentro de `/companies/[id]`.
- Reutilizar `createMedicalProfile`, `updateMedicalProfile`, `deleteMedicalProfile` y `getMedicalTests`.
- Mantener la asignación de perfil a puesto sobre `defaultProfileId`.
- Ajustar mensajes UX para dejar de mandar al usuario a `/admin/profiles` como único camino.

## Exclusiones explícitas
- No modificar Prisma ni relaciones de base de datos.
- No rediseñar el módulo global `/admin/profiles`.
- No crear permisos nuevos ni auth granular en esta iteración.
- No cambiar el flujo de citas, check-in o papeleta.
- No crear auditoría nueva ni historial de cambios para perfiles.

## Riesgos controlados
- No permitir edición ni eliminación de perfiles globales desde la ficha de empresa.
- No duplicar lógica de pruebas médicas fuera del action existente.
- No romper el selector de perfil ya usado por Puestos de Trabajo.

## Prompt visual de validación
"Validar una ficha de Empresa Cliente con tres bloques en este orden: datos base, sucursales permitidas, perfiles médicos de la empresa, puestos de trabajo. El bloque de perfiles debe verse operativo y administrativo, coherente con la estética actual de tarjetas blancas, bordes suaves y modales compactos. El alta de perfil debe priorizar claridad sobre espectacularidad: nombre del perfil, contador de pruebas seleccionadas, grupos por categoría y feedback directo." 

## Gate de salida de arquitectura
La SPEC puede cerrarse sin migración ni investigación adicional porque el modelo existente ya resuelve empresa, perfil y puesto; el hueco es únicamente de superficie operativa y revalidación de ruta.