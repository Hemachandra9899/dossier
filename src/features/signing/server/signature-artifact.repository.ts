import prisma from "@/platform/db";

// Signed-artifact persistence. Exactly one artifact may exist per request;
// the finalizer writes it once the request reaches COMPLETED and the mirror
// job copies it into long-term storage.
export class SignatureArtifactRepository {
  async findByRequestId(requestId: string) {
    return prisma.signatureArtifact.findUnique({
      where: { signatureRequestId: requestId },
    });
  }

  async create(data: {
    signatureRequestId: string;
    storageKey: string;
    fileName: string;
    mimeType?: string;
    sha256: string;
    sizeBytes: bigint;
  }) {
    return prisma.signatureArtifact.create({
      data: {
        signatureRequestId: data.signatureRequestId,
        storageKey: data.storageKey,
        fileName: data.fileName,
        mimeType: data.mimeType ?? "application/pdf",
        sha256: data.sha256,
        sizeBytes: data.sizeBytes,
      },
    });
  }
}