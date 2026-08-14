-- CreateEnum
CREATE TYPE "DossierCompletionRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DossierCompletionArtifactKind" AS ENUM ('REQUIREMENT_DOCUMENT', 'SIGNED_DOCUMENT');

-- CreateTable
CREATE TABLE "DossierCompletionRun" (
    "id" TEXT NOT NULL,
    "dossierFileId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "DossierCompletionRunStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierCompletionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierCompletionRecord" (
    "id" TEXT NOT NULL,
    "dossierFileId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "completedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierCompletionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierCompletionArtifact" (
    "id" TEXT NOT NULL,
    "completionRecordId" TEXT NOT NULL,
    "kind" "DossierCompletionArtifactKind" NOT NULL,
    "sourceDocumentId" TEXT,
    "sourceDocumentVersionId" TEXT,
    "sourceSignatureArtifactId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageType" "DocumentStorageType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierCompletionArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DossierCompletionRun_idempotencyKey_key" ON "DossierCompletionRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DossierCompletionRun_dossierFileId_createdAt_idx" ON "DossierCompletionRun"("dossierFileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DossierCompletionRun_status_createdAt_idx" ON "DossierCompletionRun"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DossierCompletionRecord_runId_key" ON "DossierCompletionRecord"("runId");

-- CreateIndex
CREATE INDEX "DossierCompletionRecord_dossierFileId_completedAt_idx" ON "DossierCompletionRecord"("dossierFileId", "completedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DossierCompletionRecord_dossierFileId_version_key" ON "DossierCompletionRecord"("dossierFileId", "version");

-- CreateIndex
CREATE INDEX "DossierCompletionArtifact_completionRecordId_idx" ON "DossierCompletionArtifact"("completionRecordId");

-- CreateIndex
CREATE INDEX "DossierCompletionArtifact_sha256_idx" ON "DossierCompletionArtifact"("sha256");

-- AddForeignKey
ALTER TABLE "DossierCompletionRun" ADD CONSTRAINT "DossierCompletionRun_dossierFileId_fkey" FOREIGN KEY ("dossierFileId") REFERENCES "DossierFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierCompletionRun" ADD CONSTRAINT "DossierCompletionRun_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierCompletionRecord" ADD CONSTRAINT "DossierCompletionRecord_dossierFileId_fkey" FOREIGN KEY ("dossierFileId") REFERENCES "DossierFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierCompletionRecord" ADD CONSTRAINT "DossierCompletionRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DossierCompletionRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierCompletionRecord" ADD CONSTRAINT "DossierCompletionRecord_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierCompletionArtifact" ADD CONSTRAINT "DossierCompletionArtifact_completionRecordId_fkey" FOREIGN KEY ("completionRecordId") REFERENCES "DossierCompletionRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
