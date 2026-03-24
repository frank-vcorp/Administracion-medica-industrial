-- ARCH-20260324-02
-- Respaldo: context/checkpoints/CHK_FIX-20260306-03-FULL-REVIEW.md

ALTER TABLE "services"
ADD COLUMN IF NOT EXISTS "category" TEXT;