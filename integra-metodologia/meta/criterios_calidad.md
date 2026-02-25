# Criterios de Calidad (End-to-end)

Use esta checklist para asegurar calidad transversal en todo el desarrollo.

## Arquitectura y diseño
- [ ] Separación de responsabilidades (dominio / aplicación / infraestructura)
- [ ] Modularidad y principios SOLID; dependencias explícitas
- [ ] Configuración por entorno (12-factor); .env no se commitea
- [ ] Contratos claros entre capas (interfaces/puertos)
- [ ] Decisiones registradas en context/ (ADRs/decisiones técnicas)

## Código y mantenibilidad
- [ ] Tipado fuerte (TypeScript) en superficies públicas
- [ ] Linter y formateo consistentes (ESLint/Prettier)
- [ ] Revisiones de código (PRs) con criterios mínimos aceptados
- [ ] Documentación mínima por módulo (README/Docstrings)

## Pruebas y cobertura
- [ ] Unitarias para lógica crítica (target >= 70%)
- [ ] Integración/contract tests para adaptadores externos
- [ ] E2E en flujos core (cuando aplique)
- [ ] Datos de prueba realistas y no sensibles

## Seguridad
- [ ] Gestión de secretos vía variables de entorno (nunca en repo)
- [ ] Dependabot o escaneo de vulnerabilidades
- [ ] Autenticación/Autorización con principio de menor privilegio
- [ ] Validación y saneamiento de inputs (OWASP Top 10)
- [ ] Logs sin datos sensibles (PII/secretos)

## Rendimiento y confiabilidad
- [ ] Presupuestos de rendimiento (TTFB/LCP en web)
- [ ] Caching, paginación y lazy loading donde aplique
- [ ] Timeouts, reintentos e idempotencia en clientes HTTP
- [ ] Escalabilidad básica considerada (stateless)

## Observabilidad
- [ ] Logging estructurado con niveles
- [ ] Métricas clave (negocio y técnicas)
- [ ] Dashboards y alertas mínimas configuradas

## API (si aplica)
- [ ] Especificación OpenAPI/contrato versionado
- [ ] Modelo de errores consistente
- [ ] Rate limiting y protección contra abuso

## Frontend Web (UI/UX)
- [ ] Accesibilidad: WCAG 2.1 AA, navegación por teclado
- [ ] Responsive (móvil/desktop)
- [ ] Estados de carga/skeletons y manejo de errores visibles

## DevOps / CI-CD
- [ ] Ramas protegidas y revisiones requeridas
- [ ] Pipelines: lint + test + build en PR/main
- [ ] Reproducibilidad del build

## Documentación
- [ ] README con "Primeros pasos"
- [ ] Dossier técnico actualizado (context/dossier_tecnico.md)

---

**Cómo usar:**
- Revise esta lista en cada PR importante y antes de releases.
- Marque explícitamente lo cumplido y registre desviaciones con justificación.
