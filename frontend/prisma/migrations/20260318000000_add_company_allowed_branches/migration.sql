-- CreateTable
CREATE TABLE IF NOT EXISTS "_CompanyAllowedBranches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_CompanyAllowedBranches_A_fkey" FOREIGN KEY ("A") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CompanyAllowedBranches_B_fkey" FOREIGN KEY ("B") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_CompanyAllowedBranches_AB_unique" ON "_CompanyAllowedBranches"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_CompanyAllowedBranches_B_index" ON "_CompanyAllowedBranches"("B");
