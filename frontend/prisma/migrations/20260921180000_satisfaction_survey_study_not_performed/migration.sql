-- CreateEnum
CREATE TYPE "SatisfactionChannel" AS ENUM ('TABLET', 'WHATSAPP_LINK', 'DIRECT');

-- AlterEnum
ALTER TYPE "TimelineEntryType" ADD VALUE 'STUDY_NOT_PERFORMED';

-- CreateTable
CREATE TABLE "satisfaction_surveys" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "turno" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "qTrato" INTEGER NOT NULL,
    "qEscucha" INTEGER NOT NULL,
    "qResolucion" INTEGER NOT NULL,
    "qEspera" INTEGER NOT NULL,
    "qLimpieza" INTEGER NOT NULL,
    "qPrivacidad" INTEGER NOT NULL,
    "recomienda" INTEGER NOT NULL,
    "comentario" TEXT,
    "channel" "SatisfactionChannel" NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaction_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "satisfaction_surveys_eventId_key" ON "satisfaction_surveys"("eventId");

-- CreateIndex
CREATE INDEX "satisfaction_surveys_workerId_idx" ON "satisfaction_surveys"("workerId");

-- CreateIndex
CREATE INDEX "satisfaction_surveys_submittedAt_idx" ON "satisfaction_surveys"("submittedAt");

-- AddForeignKey
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
