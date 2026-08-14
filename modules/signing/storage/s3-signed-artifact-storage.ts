import { storage, buildSignedArtifactKey } from "@/platform/storage";
import { safeSlugify, buildContentDisposition } from "@/lib/utils";

import type { SignedArtifactStorage } from "./signed-artifact-storage";

export { buildSignedArtifactKey };

export class S3SignedArtifactStorage implements SignedArtifactStorage {
  async upload(input: {
    teamId: string;
    requestId: string;
    fileName: string;
    body: Buffer;
  }): Promise<{ storageKey: string }> {
    const storageKey = buildSignedArtifactKey({
      teamId: input.teamId,
      requestId: input.requestId,
    });
    const safeName = safeSlugify(input.fileName).slice(0, 60) || "signed";

    return storage.put({
      teamId: input.teamId,
      storageKey,
      body: input.body,
      contentType: "application/pdf",
      contentDisposition: buildContentDisposition(safeName, safeName),
    });
  }
}

export const s3SignedArtifactStorage: SignedArtifactStorage =
  new S3SignedArtifactStorage();

