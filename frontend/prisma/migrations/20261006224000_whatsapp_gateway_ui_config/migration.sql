ALTER TABLE "whatsapp_baileys_config" ADD COLUMN "gatewayUrl" TEXT;
ALTER TABLE "whatsapp_baileys_config" ADD COLUMN "gatewaySecretCiphertext" BYTEA;
ALTER TABLE "whatsapp_baileys_config" ADD COLUMN "gatewaySecretNonce" BYTEA;
ALTER TABLE "whatsapp_baileys_config" ADD COLUMN "gatewaySecretTag" BYTEA;
ALTER TABLE "whatsapp_baileys_config" ADD COLUMN "gatewaySecretSuffix" TEXT;
