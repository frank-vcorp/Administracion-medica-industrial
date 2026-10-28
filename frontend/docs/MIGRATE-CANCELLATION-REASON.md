# Migración `20261028170000_cancellation_reason`

La app puede cargar expedientes **sin** esta migración (fallback en `getEventById`), pero **cancelar papeletas/citas con motivo** y persistir el motivo requieren las columnas en PostgreSQL.

## Aplicar en producción (Vercel / Railway)

Desde el directorio `frontend`, con `DATABASE_URL` apuntando a la base de producción:

```bash
cd frontend
npx prisma migrate deploy
```

Migración SQL:

- `appointments.cancellationReason`, `appointments.cancelledAt`
- `medical_events.cancellationReason`, `medical_events.cancelledAt`

Archivo: `prisma/migrations/20261028170000_cancellation_reason/migration.sql`

## Verificación

```bash
npx prisma migrate status
```

Debe listar `20261028170000_cancellation_reason` como aplicada.
