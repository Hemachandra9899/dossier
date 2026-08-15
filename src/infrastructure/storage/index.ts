import { s3Storage } from "./s3.storage";
import { ObjectStorageSignedArtifactAdapter } from "./signed-artifact-storage";

export * from "./storage-config";
export * from "./s3-client";
export * from "./object-storage";
export * from "./s3.storage";
export * from "./storage-keys";
export * from "./signed-artifact-storage";

export const storage = s3Storage;
export const signedArtifactStorage = new ObjectStorageSignedArtifactAdapter(s3Storage);
export default storage;
