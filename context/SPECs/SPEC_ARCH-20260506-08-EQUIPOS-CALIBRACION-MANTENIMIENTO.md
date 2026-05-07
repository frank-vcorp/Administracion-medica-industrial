## SPEC: Módulo base de Equipos, Calibración y Mantenimiento AMI

**ID:** ARCH-20260506-08  
**Estado:** Lista para discovery estructurado y siguiente implementación  
**Insumo base:** Programa de mantenimiento 2026 enviado por AMI  
**Relacionado con junta:** necesidad de visibilidad sobre equipos, calendario y unidades moviles.

### Objetivo

Definir la base funcional para un modulo de Equipos que permita a AMI gestionar inventario tecnico, calibracion, mantenimiento preventivo y relacion operativa con sedes y unidades moviles.

## Contexto estrategico

Este modulo tambien funciona como base de gobernanza para la futura capa de IA medica de Google comunicada a AMI, porque la calidad y vigencia de equipos impacta directamente la confiabilidad de los estudios que despues se pretendan interpretar o estructurar.

## Problema a resolver

- Hoy este frente no aparece como modulo productizado en backlog cerrado.
- AMI ya entrego informacion suficiente para abrir el discovery funcional.
- La operacion de equipos impacta directamente continuidad de servicio, calidad de estudios y planeacion de unidades moviles.

## Alcance de esta SPEC

### Sí entra
- Inventario base de equipos.
- Relacion de equipo con sede o unidad movil.
- Frecuencia de calibracion o mantenimiento.
- Estado operativo visible.
- Semaforizacion de vigencia.

### No entra
- CMMS completo.
- Integracion con proveedores o compras.
- Control financiero de activos.

## Entidades mínimas propuestas

### Equipo
- nombre del equipo
- tipo de equipo
- marca
- modelo
- numero de serie
- codigo interno AMI
- ubicacion actual
- responsable operativo

### Programa de calibracion/mantenimiento
- frecuencia
- proxima fecha objetivo
- ultimo evento realizado
- estado
- observaciones

### Ubicacion operativa
- sucursal fija
- unidad movil
- remolque o configuracion especial

## Estados minimos sugeridos

- calibrado
- por calibrar
- en calibracion
- pendiente
- vencido
- fuera de servicio

## Entregables esperados

### A. Mapa funcional
- Catalogo maestro de equipos.
- Vista por sede y por unidad movil.
- Semaforo de vencimientos.

### B. Backlog tecnico derivado
- modelo de datos
- pantallas de inventario
- tablero de vencimientos
- filtros por sede, tipo, estado y fecha

### C. Riesgos operativos cubiertos
- equipo vencido sin visibilidad
- equipo asignado sin trazabilidad
- falta de lectura rapida por sede o unidad

## Criterios de aceptación

1. Existe una definicion clara del modelo minimo de Equipos.
2. La informacion enviada por AMI puede mapearse sin ambiguedad principal a las entidades propuestas.
3. Queda lista una siguiente iteracion para implementacion, sin volver a hacer discovery desde cero.

## Dependencias de informacion AMI

- Confirmacion de inventario vigente.
- Relacion equipo-sede-unidad movil.
- Regla de responsables por equipo.
- Validacion de estados operativos usados realmente por AMI.

## Handoff

- Abrir implementacion solo despues de cerrar el mapeo del Excel real contra estas entidades.
- Mantener esta SPEC como base para siguiente corte de backlog operativo.