-- CreateEnum
CREATE TYPE "SignatureProvider" AS ENUM ('DOCUMENSO');

-- CreateEnum
CREATE TYPE "SignatureTemplateStatus" AS ENUM ('PREPARING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('DRAFT', 'PREPARING', 'READY', 'SENT', 'VIEWED', 'SIGNING', 'PARTIALLY_SIGNED', 'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignatureRecipientStatus" AS ENUM ('PENDING', 'VIEWED', 'SIGNING', 'SIGNED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "SignatureTemplate" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'DOCUMENSO',
    "providerExternalId" TEXT NOT NULL,
    "providerTemplateId" TEXT,
    "providerEnvelopeId" TEXT,
    "status" "SignatureTemplateStatus" NOT NULL DEFAULT 'PREPARING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "linkId" TEXT,
    "provider" "SignatureProvider" NOT NULL DEFAULT 'DOCUMENSO',
    "providerExternalId" TEXT NOT NULL,
    "providerEnvelopeId" TEXT,
    "providerDocumentId" INTEGER,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRecipient" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "signingOrder" INTEGER NOT NULL DEFAULT 1,
    "providerRecipientId" TEXT,
    "status" "SignatureRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureArtifact" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sha256" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" "SignatureProvider" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "providerDocumentId" INTEGER,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignatureTemplate_providerExternalId_key" ON "SignatureTemplate"("providerExternalId");

-- CreateIndex
CREATE INDEX "SignatureTemplate_teamId_createdAt_idx" ON "SignatureTemplate"("teamId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SignatureTemplate_documentId_idx" ON "SignatureTemplate"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureTemplate_provider_providerEnvelopeId_key" ON "SignatureTemplate"("provider", "providerEnvelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_providerExternalId_key" ON "SignatureRequest"("providerExternalId");

-- CreateIndex
CREATE INDEX "SignatureRequest_teamId_status_createdAt_idx" ON "SignatureRequest"("teamId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SignatureRequest_documentId_createdAt_idx" ON "SignatureRequest"("documentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SignatureRequest_linkId_idx" ON "SignatureRequest"("linkId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_provider_providerEnvelopeId_key" ON "SignatureRequest"("provider", "providerEnvelopeId");

-- CreateIndex
CREATE INDEX "SignatureRecipient_signatureRequestId_status_idx" ON "SignatureRecipient"("signatureRequestId", "status");

-- CreateIndex
CREATE INDEX "SignatureRecipient_email_idx" ON "SignatureRecipient"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureArtifact_signatureRequestId_key" ON "SignatureArtifact"("signatureRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SigningProviderEvent_dedupeKey_key" ON "SigningProviderEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "SigningProviderEvent_provider_createdAt_idx" ON "SigningProviderEvent"("provider", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SigningProviderEvent_processedAt_idx" ON "SigningProviderEvent"("processedAt");

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureTemplate" ADD CONSTRAINT "SignatureTemplate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SignatureTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRecipient" ADD CONSTRAINT "SignatureRecipient_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

