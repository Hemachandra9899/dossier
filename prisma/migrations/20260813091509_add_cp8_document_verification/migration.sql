-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'NEEDS_REVIEW', 'ISSUE');

-- CreateEnum
CREATE TYPE "VerificationSeverity" AS ENUM ('WARNING', 'ERROR');

-- AlterTable
ALTER TABLE "DossierFileTemplateRequirement" ADD COLUMN     "expectedKind" TEXT,
ADD COLUMN     "verificationRules" JSONB;

-- CreateTable
CREATE TABLE "DossierRequirementPolicy" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "expectedKind" TEXT NOT NULL,
    "verificationRules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierRequirementPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAnalysis" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "extractedKind" TEXT,
    "extractedData" JSONB,
    "checks" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationIssue" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "checkCode" TEXT NOT NULL,
    "severity" "VerificationSeverity" NOT NULL DEFAULT 'ERROR',
    "message" TEXT NOT NULL,
    "evidence" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedByUserId" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DossierRequirementPolicy_taskId_key" ON "DossierRequirementPolicy"("taskId");

-- CreateIndex
CREATE INDEX "DossierRequirementPolicy_taskId_idx" ON "DossierRequirementPolicy"("taskId");

-- CreateIndex
CREATE INDEX "DocumentAnalysis_documentVersionId_idx" ON "DocumentAnalysis"("documentVersionId");

-- CreateIndex
CREATE INDEX "DocumentAnalysis_taskId_idx" ON "DocumentAnalysis"("taskId");

-- CreateIndex
CREATE INDEX "VerificationIssue_analysisId_idx" ON "VerificationIssue"("analysisId");

-- CreateIndex
CREATE INDEX "VerificationIssue_dismissedByUserId_idx" ON "VerificationIssue"("dismissedByUserId");

-- AddForeignKey
ALTER TABLE "DossierRequirementPolicy" ADD CONSTRAINT "DossierRequirementPolicy_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysis" ADD CONSTRAINT "DocumentAnalysis_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysis" ADD CONSTRAINT "DocumentAnalysis_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationIssue" ADD CONSTRAINT "VerificationIssue_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "DocumentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationIssue" ADD CONSTRAINT "VerificationIssue_dismissedByUserId_fkey" FOREIGN KEY ("dismissedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
