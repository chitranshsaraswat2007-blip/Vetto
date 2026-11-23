ALTER TYPE "ReviewAction" ADD VALUE 'ESCALATED' BEFORE 'SUPERVISOR_REVIEWED';

CREATE TYPE "SupervisorEscalationStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "SupervisorEscalation" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "openContentId" TEXT,
    "analysisRunId" TEXT,
    "raisedById" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "resolution" TEXT,
    "status" "SupervisorEscalationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "SupervisorEscalation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupervisorEscalation_contentId_status_createdAt_idx" ON "SupervisorEscalation"("contentId", "status", "createdAt");
CREATE INDEX "SupervisorEscalation_supervisorId_status_createdAt_idx" ON "SupervisorEscalation"("supervisorId", "status", "createdAt");
CREATE INDEX "SupervisorEscalation_raisedById_createdAt_idx" ON "SupervisorEscalation"("raisedById", "createdAt");
CREATE UNIQUE INDEX "SupervisorEscalation_openContentId_key" ON "SupervisorEscalation"("openContentId");

ALTER TABLE "SupervisorEscalation" ADD CONSTRAINT "SupervisorEscalation_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupervisorEscalation" ADD CONSTRAINT "SupervisorEscalation_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupervisorEscalation" ADD CONSTRAINT "SupervisorEscalation_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupervisorEscalation" ADD CONSTRAINT "SupervisorEscalation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupervisorEscalation" ADD CONSTRAINT "SupervisorEscalation_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
