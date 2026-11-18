ALTER TYPE "ReviewAction" ADD VALUE 'SUPERVISOR_REVIEWED';

CREATE TABLE "SupervisorAssignment" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupervisorAssignment_contentId_key" ON "SupervisorAssignment"("contentId");
CREATE INDEX "SupervisorAssignment_supervisorId_createdAt_idx" ON "SupervisorAssignment"("supervisorId", "createdAt");
CREATE INDEX "SupervisorAssignment_assignedById_createdAt_idx" ON "SupervisorAssignment"("assignedById", "createdAt");

ALTER TABLE "SupervisorAssignment" ADD CONSTRAINT "SupervisorAssignment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupervisorAssignment" ADD CONSTRAINT "SupervisorAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupervisorAssignment" ADD CONSTRAINT "SupervisorAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
