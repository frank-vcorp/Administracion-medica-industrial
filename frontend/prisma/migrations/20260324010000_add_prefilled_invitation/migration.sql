-- IMPL-20260324-07: Portal de Prellenado Temporal (SPEC ARCH-20260324-09)
-- Corte A1 Backend-Safe: modelo de datos para invitación temporal y guardado parcial del Módulo 1

-- Enum de estados del prellenado
CREATE TYPE "PrefilledStatus" AS ENUM (
    'NOT_GENERATED',
    'INVITATION_ACTIVE',
    'OPENED',
    'PARTIAL',
    'SUBMITTED',
    'EXPIRED',
    'CANCELLED'
);

-- Tabla de invitaciones temporales para el portal de prellenado
CREATE TABLE "prefilled_invitations" (
    "id"            TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "tokenHash"     TEXT NOT NULL,
    "expiresAt"     TIMESTAMP(3) NOT NULL,
    "status"        "PrefilledStatus" NOT NULL DEFAULT 'INVITATION_ACTIVE',
    "module1Data"   JSONB,
    "channel"       TEXT,
    "generatedById" TEXT,
    "openedCount"   INTEGER NOT NULL DEFAULT 0,
    "submittedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prefilled_invitations_pkey" PRIMARY KEY ("id")
);

-- Índices únicos de seguridad
CREATE UNIQUE INDEX "prefilled_invitations_appointmentId_key" ON "prefilled_invitations"("appointmentId");
CREATE UNIQUE INDEX "prefilled_invitations_tokenHash_key"     ON "prefilled_invitations"("tokenHash");

-- FK a citas
ALTER TABLE "prefilled_invitations"
    ADD CONSTRAINT "prefilled_invitations_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK al usuario staff que generó la invitación
ALTER TABLE "prefilled_invitations"
    ADD CONSTRAINT "prefilled_invitations_generatedById_fkey"
    FOREIGN KEY ("generatedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
