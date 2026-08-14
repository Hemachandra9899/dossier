import type { ObjectStorage } from "./object-storage";
import { buildSignedArtifactKey } from "./storage-keys";
import { buildContentDisposition, safeSlugify } from "@/lib/utils";

export interface SignedArtifactStorage {
  upload(input: {
    teamId: string;
    requestId: string;
    fileName: string;
    body: Buffer;
  }): Promise<{ storageKey: string }>;
}

export class ObjectStorageSignedArtifactAdapter implements SignedArtifactStorage {
  constructor(private storage: ObjectStorage) {}

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

    return this.storage.put({
      teamId: input.teamId,
      storageKey,
      body: input.body,
      contentType: "application/pdf",
      contentDisposition: buildContentDisposition(safeName, safeName),
    });
  }
}
