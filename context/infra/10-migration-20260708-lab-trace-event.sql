-- ============================================================================
-- IMPL-20260707-18: Fase 2 NOVA absorción — D Trazabilidad
-- Ref: context/SPECs/SPEC_IMPL-20260707-SLICES-D-G-FINAL.md §2 (FASE 2)
--
-- 1 modelo nuevo: lab_trace_events (muestra→proceso→entrega).
-- Sin enums (event es string libre por flexibilidad de evolución).
-- ============================================================================

-- CreateTable: lab_trace_events
CREATE TABLE "lab_trace_events" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "notes" TEXT,
    "location" TEXT,

    CONSTRAINT "lab_trace_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_trace_events_labOrderId_idx" ON "lab_trace_events"("labOrderId");
CREATE INDEX "lab_trace_events_event_idx" ON "lab_trace_events"("event");
CREATE INDEX "lab_trace_events_timestamp_idx" ON "lab_trace_events"("timestamp");

-- AddForeignKey
ALTER TABLE "lab_trace_events" ADD CONSTRAINT "lab_trace_events_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_trace_events" ADD CONSTRAINT "lab_trace_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO _prisma_migrations (id, migration_name, checksum, finished_at, applied_steps_count)
VALUES (
  gen_random_uuid()::text,
  '20260708000000_add_lab_trace_event',
  md5('20260708000000_add_lab_trace_event') || md5('20260708000000_add_lab_trace_event'),
  NOW(),
  1
)
ON CONFLICT (migration_name) DO UPDATE SET
  finished_at = NOW(),
  applied_steps_count = 1;

SELECT migration_name, finished_at IS NOT NULL AS finished
FROM _prisma_migrations
WHERE migration_name = '20260708000000_add_lab_trace_event';
