# API REST de tareas

Esta API implementa una lista de tareas con TypeScript estricto, Express 4, Zod y persistencia en un archivo JSON local. El archivo de datos se crea automáticamente en `data/todos.json` cuando se registra la primera tarea.

## Requisitos

Se requiere Node.js 20 o una versión posterior y npm.

## Instalación y ejecución

```bash
npm install
npm run dev
```

El servidor queda disponible en `http://localhost:3000` de forma predeterminada. Se puede cambiar el puerto mediante la variable de entorno `PORT`.

## Endpoints

| Método | Ruta | Cuerpo | Respuesta correcta |
| --- | --- | --- | --- |
| `POST` | `/todos` | `{ "title": "Comprar café" }` | `201 Created` con la tarea creada |
| `GET` | `/todos` | No aplica | `200 OK` con el arreglo de tareas |
| `PATCH` | `/todos/:id` | No aplica | `200 OK` con la tarea marcada como completada |
| `DELETE` | `/todos/:id` | No aplica | `200 OK` con `{ "id": "..." }` |

Los cuerpos de creación y los identificadores se validan con Zod. Los datos inválidos devuelven `400`, una tarea inexistente devuelve `404` y los fallos de almacenamiento devuelven `500`.

## Ejemplos

```bash
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Comprar café"}'

curl http://localhost:3000/todos

curl -X PATCH http://localhost:3000/todos/<id>

curl -X DELETE http://localhost:3000/todos/<id>
```

## Comandos disponibles

```bash
npm run dev
npm test
npm run typecheck
```
