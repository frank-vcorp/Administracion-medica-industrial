# SPEC-CODIGO: Convenciones y Estándares de Código

**Versión:** 1.0  
**Metodología:** INTEGRA v2.1.1

---

## I. Principios Rectores

### 1. Código Auto-Documentado > Comentarios
> "El mejor comentario es el que no necesitas escribir porque el código habla por sí mismo."

### 2. Principio del Cañón y la Mosca 🪰💣
> "Usa la herramienta más simple que resuelva el problema eficientemente."

### 3. Claridad > Brevedad
> "Prefiere nombres largos y claros sobre abreviaciones crípticas."

### 4. Consistencia > Preferencia Personal
> "El equipo sigue un estándar, no opiniones individuales."

---

## II. Convenciones de Nombres

### TypeScript/JavaScript

#### Variables y Funciones
```typescript
// ✅ BIEN: Descriptivo, camelCase
const clientRentalHistory = await getRentalsByClient(clientId);
const hasActiveRentals = rentals.some(r => r.status === 'active');

// ❌ MAL: Abreviado, confuso
const clRH = await getRByC(cId);
const hasAR = rentals.some(r => r.s === 'a');
```

#### Interfaces y Tipos
```typescript
// ✅ BIEN: PascalCase, nombre claro
interface Cliente {
  id: string;
  razonSocial: string;
}

type RentaEstatus = 'activa' | 'completada' | 'cancelada';

// ❌ MAL: prefijo I, nombre vago
interface IClient { }
type Status = string;
```

#### Constantes
```typescript
// ✅ BIEN: UPPER_SNAKE_CASE para constantes globales
const MAX_RENTAL_DURATION_DAYS = 365;
const FIREBASE_COLLECTION_CLIENTS = 'clientes';

// ✅ BIEN: camelCase para constantes locales
const defaultPageSize = 20;
```

#### Archivos
```
// ✅ BIEN: kebab-case para archivos
src/lib/firebase-config.ts
src/components/client-list.tsx
src/hooks/use-rentals.ts

// ❌ MAL: camelCase o PascalCase en nombres de archivo
src/lib/firebaseConfig.ts
src/components/ClientList.tsx
```

---

## III. Política de Comentarios

### SÍ Comentar

#### 1. Decisiones Técnicas No Obvias
```typescript
// Firebase tiene límite de 1 write/segundo en plan gratuito
// Usamos debounce de 300ms para evitar throttling
const debouncedSave = debounce(saveToFirestore, 300);
```

#### 2. Workarounds Temporales
```typescript
// TODO(FIX-20260126-01): Workaround para bug en lucide-react
// Remover cuando actualicen a v0.300+
React.createElement(Icon as unknown as React.FC, { className });
```

#### 3. Referencias a Documentación
```typescript
/**
 * @see context/interconsultas/DICTAMEN_FIX-20260126-01.md
 */
```

### NO Comentar

```typescript
// ❌ MAL: Parafrasea el código
// Incrementa el contador
counter++;

// ❌ MAL: Código muerto comentado
// const oldFunction = () => { ... }

// ❌ MAL: Obvio por el nombre
// Obtiene el cliente por ID
const getClientById = (id: string) => { ... }
```

---

## IV. Estructura de Archivos

### Componentes React
```typescript
// 1. Imports (externos primero, internos después)
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Cliente } from '@/types';

// 2. Tipos locales
interface Props {
  clientId: string;
}

// 3. Componente
export function ClientCard({ clientId }: Props) {
  // 3a. Hooks
  const { data, isLoading } = useQuery(...);
  
  // 3b. Handlers
  const handleClick = () => { ... };
  
  // 3c. Early returns
  if (isLoading) return <Skeleton />;
  
  // 3d. Render
  return <div>...</div>;
}
```

---

## V. TypeScript

### Tipado Obligatorio
- ✅ Parámetros de funciones públicas
- ✅ Valores de retorno de funciones públicas
- ✅ Props de componentes
- ❌ Variables locales con inferencia clara

### Evitar
- `any` - usar `unknown` y type guards
- `as` innecesarios - preferir type guards
- `!` non-null assertion - validar primero

---

## VI. Manejo de Errores

```typescript
// ✅ BIEN: Error específico con contexto
throw new Error(`[ClientService] Cliente ${id} no encontrado`);

// ✅ BIEN: Try-catch con logging
try {
  await saveClient(data);
} catch (error) {
  console.error('[ClientService] Error guardando cliente:', error);
  throw error; // Re-throw si es necesario
}
```

---

## VII. Imports

### Orden
1. Dependencias externas (`react`, `next`, etc.)
2. Dependencias del proyecto (`@/lib`, `@/components`)
3. Tipos
4. Estilos

### Alias
Usar siempre `@/` para imports internos:
```typescript
// ✅ BIEN
import { db } from '@/lib/firebase-admin';

// ❌ MAL
import { db } from '../../../lib/firebase-admin';
```

---

## VIII. Checklist Pre-Commit

- [ ] ESLint pasa sin errores
- [ ] TypeScript compila sin errores
- [ ] No hay `console.log` de debug
- [ ] No hay código comentado
- [ ] Nombres descriptivos
- [ ] Imports ordenados
