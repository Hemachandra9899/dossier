-- CreateIndex
CREATE INDEX "SignatureRequest_teamId_documentId_status_idx" ON "SignatureRequest"("teamId", "documentId", "status");

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

