-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CREATOR', 'EDITOR', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('LOGO', 'IMAGERY', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RuleCategory" AS ENUM ('BRAND_IDENTITY', 'VISUAL_QUALITY', 'BRAND_VIBE', 'CONTENT', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('FORBIDDEN_PHRASE', 'REQUIRED_PHRASE', 'REQUIRED_DISCLAIMER', 'CLAIM_RESTRICTION', 'KEYWORD', 'TONE', 'VISUAL_COLOR', 'VISUAL_LOGO', 'VISUAL_TYPOGRAPHY', 'OTHER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('IMAGE', 'PDF', 'DOCX', 'DOC');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'UPLOADED', 'PROCESSING', 'ANALYZING', 'REVIEW_READY', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingSource" AS ENUM ('DETERMINISTIC', 'AI');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CREATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "BrandStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "description" TEXT,
    "personality" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" TEXT,
    "visualStyle" TEXT,
    "imageryStyle" TEXT,
    "designDirection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "variant" TEXT,
    "backgroundContext" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandFont" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "usage" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandFont_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandColor" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "name" TEXT,
    "usage" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRule" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "RuleCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "ruleType" "RuleType" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "pattern" TEXT,
    "keyword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "title" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT,
    "kind" "ContentKind" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "engineVersion" TEXT,
    "promptVersion" TEXT,
    "brandIdentityScore" DOUBLE PRECISION,
    "visualQualityScore" DOUBLE PRECISION,
    "brandVibeScore" DOUBLE PRECISION,
    "contentScore" DOUBLE PRECISION,
    "complianceScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "deterministicCompletedAt" TIMESTAMP(3),
    "aiCompletedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "ruleId" TEXT,
    "category" "RuleCategory" NOT NULL,
    "source" "FindingSource" NOT NULL DEFAULT 'DETERMINISTIC',
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "recommendation" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "analysisRunId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "brandId" TEXT,
    "contentId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_status_idx" ON "Brand"("status");

-- CreateIndex
CREATE INDEX "Brand_createdById_idx" ON "Brand"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_brandId_key" ON "BrandProfile"("brandId");

-- CreateIndex
CREATE INDEX "BrandAsset_brandId_kind_idx" ON "BrandAsset"("brandId", "kind");

-- CreateIndex
CREATE INDEX "BrandAsset_brandId_approvalStatus_idx" ON "BrandAsset"("brandId", "approvalStatus");

-- CreateIndex
CREATE INDEX "BrandAsset_uploadedById_idx" ON "BrandAsset"("uploadedById");

-- CreateIndex
CREATE INDEX "BrandFont_brandId_idx" ON "BrandFont"("brandId");

-- CreateIndex
CREATE INDEX "BrandColor_brandId_idx" ON "BrandColor"("brandId");

-- CreateIndex
CREATE INDEX "BrandRule_brandId_category_idx" ON "BrandRule"("brandId", "category");

-- CreateIndex
CREATE INDEX "BrandRule_brandId_isActive_idx" ON "BrandRule"("brandId", "isActive");

-- CreateIndex
CREATE INDEX "Content_brandId_status_idx" ON "Content"("brandId", "status");

-- CreateIndex
CREATE INDEX "Content_uploadedById_idx" ON "Content"("uploadedById");

-- CreateIndex
CREATE INDEX "Content_createdAt_idx" ON "Content"("createdAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_contentId_createdAt_idx" ON "AnalysisRun"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_brandId_idx" ON "AnalysisRun"("brandId");

-- CreateIndex
CREATE INDEX "Finding_analysisRunId_severity_idx" ON "Finding"("analysisRunId", "severity");

-- CreateIndex
CREATE INDEX "Finding_ruleId_idx" ON "Finding"("ruleId");

-- CreateIndex
CREATE INDEX "Review_contentId_createdAt_idx" ON "Review"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_actorId_idx" ON "Review"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_brandId_createdAt_idx" ON "AuditLog"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_contentId_createdAt_idx" ON "AuditLog"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandFont" ADD CONSTRAINT "BrandFont_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandColor" ADD CONSTRAINT "BrandColor_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRule" ADD CONSTRAINT "BrandRule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "BrandRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;
