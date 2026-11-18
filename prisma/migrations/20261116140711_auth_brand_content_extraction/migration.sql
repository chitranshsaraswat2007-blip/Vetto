-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BrandAsset" ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'local';

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'local';

-- CreateTable
CREATE TABLE "Extraction" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "sourceType" "ContentKind" NOT NULL,
    "text" TEXT,
    "data" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Extraction_contentId_key" ON "Extraction"("contentId");

-- CreateIndex
CREATE INDEX "Extraction_status_idx" ON "Extraction"("status");

-- AddForeignKey
ALTER TABLE "Extraction" ADD CONSTRAINT "Extraction_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
