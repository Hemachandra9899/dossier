-- CreateEnum
CREATE TYPE "DossierFileStatus" AS ENUM ('NEW', 'COLLECTING', 'WAITING_ON_CLIENT', 'REVIEWING', 'NEEDS_CORRECTION', 'READY_TO_SIGN', 'SIGNING', 'COMPLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DossierFilePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DossierFileActivityType" AS ENUM ('FILE_CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'OWNER_CHANGED', 'DUE_DATE_CHANGED', 'CLIENT_SHARE_CREATED', 'REQUIREMENT_CREATED', 'REQUIREMENT_SUBMITTED', 'REQUIREMENT_COMPLETED', 'CORRECTION_REQUESTED', 'DOCUMENT_ADDED', 'SIGNATURE_REQUEST_LINKED', 'SIGNATURE_COMPLETED', 'FILE_COMPLETED', 'NOTE_ADDED', 'FILE_ARCHIVED');

-- CreateEnum
CREATE TYPE "SignatureDeliveryType" AS ENUM ('INVITATION', 'REMINDER', 'COMPLETION');

-- CreateEnum
CREATE TYPE "SignatureDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SignatureActivityType" AS ENUM ('REQUEST_CREATED', 'INVITATION_SENT', 'INVITATION_FAILED', 'RECIPIENT_VIEWED', 'SIGNING_STARTED', 'REMINDER_SENT', 'REQUEST_CANCELLED', 'RECIPIENT_SIGNED', 'REQUEST_COMPLETED', 'ARTIFACT_READY');

-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "dossierFileId" TEXT;

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "plan" SET DEFAULT 'business';

-- CreateTable
CREATE TABLE "DossierFile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dataroomId" TEXT NOT NULL,
    "requirementsTaskListId" TEXT,
    "title" TEXT NOT NULL,
    "clientName" TEXT,
    "clientEmail" TEXT,
    "reference" TEXT,
    "caseType" TEXT,
    "status" "DossierFileStatus" NOT NULL DEFAULT 'NEW',
    "priority" "DossierFilePriority" NOT NULL DEFAULT 'NORMAL',
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierFileActivity" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "DossierFileActivityType" NOT NULL,
    "actorUserId" TEXT,
    "dedupeKey" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierFileActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierFileNote" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierFileNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierFileTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierFileTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierFileTemplateRequirement" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'UPLOAD',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DossierFileTemplateRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureDelivery" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "recipientId" TEXT,
    "type" "SignatureDeliveryType" NOT NULL,
    "status" "SignatureDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureActivity" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "recipientId" TEXT,
    "type" "SignatureActivityType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SignatureActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DossierFile_dataroomId_key" ON "DossierFile"("dataroomId");

-- CreateIndex
CREATE UNIQUE INDEX "DossierFile_requirementsTaskListId_key" ON "DossierFile"("requirementsTaskListId");

-- CreateIndex
CREATE INDEX "DossierFile_teamId_status_position_idx" ON "DossierFile"("teamId", "status", "position");

-- CreateIndex
CREATE INDEX "DossierFile_teamId_updatedAt_idx" ON "DossierFile"("teamId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "DossierFile_ownerId_idx" ON "DossierFile"("ownerId");

-- CreateIndex
CREATE INDEX "DossierFile_dueAt_idx" ON "DossierFile"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "DossierFileActivity_dedupeKey_key" ON "DossierFileActivity"("dedupeKey");

-- CreateIndex
CREATE INDEX "DossierFileActivity_fileId_occurredAt_idx" ON "DossierFileActivity"("fileId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "DossierFileNote_fileId_createdAt_idx" ON "DossierFileNote"("fileId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DossierFileTemplate_key_key" ON "DossierFileTemplate"("key");

-- CreateIndex
CREATE INDEX "DossierFileTemplate_teamId_idx" ON "DossierFileTemplate"("teamId");

-- CreateIndex
CREATE INDEX "DossierFileTemplateRequirement_templateId_idx" ON "DossierFileTemplateRequirement"("templateId");

-- CreateIndex
CREATE INDEX "SignatureDelivery_signatureRequestId_status_idx" ON "SignatureDelivery"("signatureRequestId", "status");

-- CreateIndex
CREATE INDEX "SignatureDelivery_recipientId_idx" ON "SignatureDelivery"("recipientId");

-- CreateIndex
CREATE INDEX "SignatureActivity_signatureRequestId_timestamp_idx" ON "SignatureActivity"("signatureRequestId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "SignatureActivity_recipientId_idx" ON "SignatureActivity"("recipientId");

-- CreateIndex
CREATE INDEX "SignatureRequest_dossierFileId_idx" ON "SignatureRequest"("dossierFileId");

-- AddForeignKey
ALTER TABLE "DossierFile" ADD CONSTRAINT "DossierFile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierFile" ADD CONSTRAINT "DossierFile_dataroomId_fkey" FOREIGN KEY ("dataroomId") REFERENCES "Dataroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierFile" ADD CONSTRAINT "DossierFile_requirementsTaskListId_fkey" FOREIGN KEY ("requirementsTaskListId") REFERENCES "TaskList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierFile" ADD CONSTRAINT "DossierFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierFileActivity" ADD CONSTRAINT "DossierFileActivity_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DossierFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierFileNote" ADD CONSTRAINT "DossierFileNote_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "DossierFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierFileTemplate" ADD CONSTRAINT "DossierFileTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierFileTemplateRequirement" ADD CONSTRAINT "DossierFileTemplateRequirement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DossierFileTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_dossierFileId_fkey" FOREIGN KEY ("dossierFileId") REFERENCES "DossierFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureDelivery" ADD CONSTRAINT "SignatureDelivery_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureDelivery" ADD CONSTRAINT "SignatureDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SignatureRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureActivity" ADD CONSTRAINT "SignatureActivity_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureActivity" ADD CONSTRAINT "SignatureActivity_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SignatureRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
