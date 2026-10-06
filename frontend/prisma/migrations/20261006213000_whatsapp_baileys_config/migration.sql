CREATE TABLE "whatsapp_baileys_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "linkedPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastError" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_baileys_config_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "whatsapp_baileys_config" ADD CONSTRAINT "whatsapp_baileys_config_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
