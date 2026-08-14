import type { ObjectStorage } from "./object-storage";
import { s3Storage } from "./s3.storage";
import { ObjectStorageSignedArtifactAdapter } from "./signed-artifact-storage";

export * from "./object-storage";
export * from "./storage-keys";
export * from "./signed-artifact-storage";

export const storage: ObjectStorage = s3Storage;
export const signedArtifactStorage = new ObjectStorageSignedArtifactAdapter(s3Storage);
export default storage;
