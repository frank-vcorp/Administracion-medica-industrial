-- Teléfono/WhatsApp de contacto para vendedores y staff (portal B2B)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
