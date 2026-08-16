-- CreateEnum
CREATE TYPE "SignatureFieldType" AS ENUM ('SIGNATURE', 'INITIALS', 'NAME', 'EMAIL', 'DATE', 'TEXT', 'NUMBER', 'CHECKBOX', 'RADIO', 'DROPDOWN');

-- AlterEnum
ALTER TYPE "SignatureProvider" ADD VALUE 'NATIVE';

-- AlterTable
ALTER TABLE "SignatureRequest" ADD COLUMN     "documentVersionId" TEXT,
ADD COLUMN     "sourceSha256" TEXT;

-- CreateTable
CREATE TABLE "SignatureField" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "SignatureFieldType" NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "placeholder" TEXT,
    "options" JSONB,
    "value" JSONB,
    "signatureStorageKey" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignatureField_signatureRequestId_pageNumber_idx" ON "SignatureField"("signatureRequestId", "pageNumber");

-- CreateIndex
CREATE INDEX "SignatureField_recipientId_idx" ON "SignatureField"("recipientId");

-- CreateIndex
CREATE INDEX "SignatureRequest_documentVersionId_idx" ON "SignatureRequest"("documentVersionId");

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SignatureRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

