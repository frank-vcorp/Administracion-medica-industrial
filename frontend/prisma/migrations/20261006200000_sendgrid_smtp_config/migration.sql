-- SendGrid SMTP configuration (UI / Configuración)
CREATE TABLE "sendgrid_smtp_config" (
    "id" TEXT NOT NULL DEFAULT 'sendgrid',
    "host" TEXT NOT NULL DEFAULT 'smtp.sendgrid.net',
    "port" INTEGER NOT NULL DEFAULT 465,
    "username" TEXT NOT NULL DEFAULT 'apikey',
    "apiKeyCiphertext" BYTEA,
    "apiKeyNonce" BYTEA,
    "apiKeyTag" BYTEA,
    "apiKeySuffix" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fromAddress" TEXT,
    "fromPortalAccess" TEXT,
    "fromResults" TEXT,
    "fromReceipts" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sendgrid_smtp_config_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "sendgrid_smtp_config" ADD CONSTRAINT "sendgrid_smtp_config_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
