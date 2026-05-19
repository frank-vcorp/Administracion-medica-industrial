# TODO de Seguimiento

- ID: ARCH-20260513-04
- Fecha: 2026-05-13
- Estado general: avance alto; falta cerrar integracion MedGemma y salida comercial demostrable
- Objetivo: seguir el frente MEDGEMMA APIS con una lista corta y verificable

## Lectura rapida

Sí: gran parte de la base ya existe en el repo.

Ya esta encaminado o implementado:

1. pipeline V2 de upload + extraccion + prediagnostico por estudio
2. snapshots de extraccion y prediagnostico
3. panel clinico de revision medica en modo sombra
4. guardrails para que la IA no cierre dictamen ni aptitud
5. contratos de datos y prompts por estudio
6. paquete comercial MEDGEMMA APIS ya documentado

Lo que falta es corto y puntual:

1. integrar MedGemma real como proveedor clinico configurable
2. cerrar demo comercial simple
3. conectar WhatsApp real en la landing
4. validar el piloto en Audiometria y Espirometria

## Superficie reutilizable ya existente en el repo

Para este frente no debemos pensar solo en Audiometria y Espirometria. El repo ya tiene una superficie mas amplia que si puede alimentar MEDGEMMA APIS, siempre separando lo que entra al piloto inmediato de lo que entra como expansion comercial posterior.

### Estudios y examenes que ya existen y si aplican al producto

1. Audiometria
2. Espirometria
3. Laboratorio
4. Rayos X
5. Electrocardiograma
6. Somatometria
7. Agudeza Visual
8. Examen Medico

### Estudios existentes pero no prioritarios para este frente comercial inicial

1. Campimetria
2. Riesgo Cardiovascular

Motivo del recorte inicial:

1. el producto comercial necesita cerrar primero un demo simple y muy demostrable
2. no conviene meter demasiadas variantes desde el primer piloto
3. el repo ya soporta mas superficie, pero no toda debe entrar a la primera oferta vendible

## Checklist maestra

### A. Base tecnica ya resuelta

- [x] Existe endpoint V2 de upload y analisis por estudio en backend
- [x] Existe separacion entre extraccion documental y prediagnostico clinico
- [x] Existe fallback actual con proveedor generalista para capa clinica
- [x] Existe panel frontend para mostrar prediagnostico IA por estudio
- [x] Existe persistencia de snapshots y trazabilidad de revision medica
- [x] Existen prompts y contratos para Audiometria y Espirometria
- [x] Existen prompts o contratos reutilizables para Laboratorio, Rayos X, Electrocardiograma, Somatometria, Agudeza Visual y Examen Medico

### A1. Portafolio aplicable desde el repo actual

- [x] Audiometria esta soportada y es prioritaria para el piloto
- [x] Espirometria esta soportada y es prioritaria para el piloto
- [x] Laboratorio ya tiene clasificacion, extraccion y prediagnostico aplicable
- [x] Rayos X ya tiene clasificacion, extraccion y prediagnostico aplicable
- [x] Electrocardiograma ya tiene clasificacion, extraccion y prediagnostico aplicable
- [x] Somatometria ya existe como formulario interno con prediagnostico aplicable
- [x] Agudeza Visual ya existe como formulario interno con prediagnostico aplicable
- [x] Examen Medico ya existe como formulario interno con prediagnostico aplicable
- [~] Campimetria existe en el repo, pero no conviene meterla al frente comercial inicial
- [~] Riesgo Cardiovascular existe en el repo, pero no conviene meterlo al frente comercial inicial

### B. Integracion MedGemma para el piloto

- [ ] Implementar llamada real a MedGemma via Featherless en la capa clinica
- [ ] Registrar `clinical_provider` y `clinical_model_used` cuando MedGemma responda
- [ ] Mantener fallback operativo si MedGemma falla o esta deshabilitado
- [ ] Validar variables de entorno del piloto
- [ ] Probar flujo real sobre Audiometria
- [ ] Probar flujo real sobre Espirometria

### B1. Expansion sobre estudios ya soportados en repo

- [ ] Definir segunda ola comercial con Laboratorio y Examen Medico
- [ ] Definir tercera ola comercial con Somatometria y Agudeza Visual
- [ ] Evaluar si Rayos X y Electrocardiograma entran como add-on o como paquete Pro
- [ ] Mantener Campimetria y Riesgo Cardiovascular fuera del frente comercial inicial salvo decision expresa

### C. Demo vendible

- [ ] Definir si el demo se construira dentro del repo actual o como micrositio separado
- [ ] Armar flujo minimo: subir 2 estudios -> ver resultados por estudio -> ver consolidado final
- [ ] Dejar claro en UI el mensaje de apoyo clinico, no sustitucion medica
- [ ] Preparar 1 caso demostrable limpio para ventas
- [ ] Preparar variante de demo con Examen Medico + Laboratorio para venta a clinicas
- [ ] Preparar variante de demo con Examen Medico + Audiometria para salud ocupacional clasica

### D. Salida comercial inmediata

- [x] Existe pricing base documentado
- [x] Existe brief de landing con enfoque de conversion
- [x] Existe onboarding y FAQ comercial
- [ ] Reemplazar el placeholder de WhatsApp por el numero real
- [ ] Convertir el brief de landing en pagina real
- [ ] Preparar guion corto de demo comercial de 30 a 60 segundos

### E. Decision de cierre del piloto

- [ ] Comparar MedGemma vs fallback actual en utilidad clinica percibida
- [ ] Confirmar latencia aceptable para uso asistido
- [ ] Confirmar que Featherless Premium alcanza para el piloto
- [ ] Decidir continuidad: seguir con Featherless, cambiar proveedor o pausar

## Orden recomendado de ejecucion

1. Integrar MedGemma real en backend
2. Validar Audiometria y Espirometria de punta a punta
3. Construir demo simple visible
4. Publicar landing con WhatsApp real
5. Hacer primera ronda comercial

## Orden recomendado de expansion por estudios

1. Piloto inmediato: Audiometria + Espirometria
2. Demo comercial alterna: Examen Medico + Laboratorio
3. Expansion V1.1: Somatometria + Agudeza Visual
4. Expansion V1.2: Rayos X + Electrocardiograma
5. Diferidos: Campimetria y Riesgo Cardiovascular

## Estado resumido por frentes

1. Backend IA: 80% a 85%
2. Integracion MedGemma real: pendiente
3. Demo comercial: pendiente corto
4. Documentacion comercial: 90%+
5. Salida a mercado: bloqueada solo por demo y contacto final

## Bloqueadores reales hoy

1. MedGemma sigue documentado como `pending_integration`
2. el numero real de WhatsApp no esta conectado
3. la landing aun es brief, no pagina implementada
4. aun no esta definido cuales estudios entran solo al piloto y cuales entran a la primera oferta comercial

## Criterio practico de terminado

Este frente puede considerarse listo para vender cuando se cumplan estas 4 condiciones:

1. MedGemma responda en el flujo clinico real
2. exista un demo funcional con dos estudios y consolidado
3. la landing este publicada o al menos renderizada localmente
4. el CTA contacte al WhatsApp real

## Decision arquitectonica vigente para no confundir alcance

1. el repo ya soporta mas estudios de los que usaremos en el piloto inmediato
2. el piloto tecnico sigue concentrado en Audiometria y Espirometria
3. la oferta comercial puede reutilizar tambien Examen Medico, Laboratorio, Somatometria, Agudeza Visual, Rayos X y Electrocardiograma cuando convenga por caso de venta
4. Campimetria y Riesgo Cardiovascular quedan fuera del frente inicial salvo nueva decision de producto