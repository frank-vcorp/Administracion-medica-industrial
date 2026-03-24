-- ARCH-20260324-01
-- Respaldo: context/SPECs/local-auth-bootstrap-fix.md

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'password'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'hashedPassword'
    ) THEN
        ALTER TABLE "users" RENAME COLUMN "password" TO "hashedPassword";
    END IF;
END $$;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "companyId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_companyId_fkey'
    ) THEN
        ALTER TABLE "users"
        ADD CONSTRAINT "users_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_companyId_idx" ON "users"("companyId");