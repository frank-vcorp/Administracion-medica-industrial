-- IMPL-20260519-14: Entidad Project y ProjectWorker (ARCH-20260519-12)
-- Ref: context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md

-- Enum ProjectStatus
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- Tabla projects
CREATE TABLE "projects" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name"      TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId"  TEXT,
    "unitRef"   TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate"   TIMESTAMP(3) NOT NULL,
    "status"    "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- Tabla project_workers (tabla de unión)
CREATE TABLE "project_workers" (
    "projectId" TEXT NOT NULL,
    "workerId"  TEXT NOT NULL,
    "addedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy"   TEXT,

    CONSTRAINT "project_workers_pkey" PRIMARY KEY ("projectId", "workerId")
);

-- FK de projects → companies
ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK de projects → branches
ALTER TABLE "projects" ADD CONSTRAINT "projects_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK de project_workers → projects
ALTER TABLE "project_workers" ADD CONSTRAINT "project_workers_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK de project_workers → workers
ALTER TABLE "project_workers" ADD CONSTRAINT "project_workers_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
