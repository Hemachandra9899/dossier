import type { ObjectStorage } from "./object-storage";
import { s3ObjectStorage } from "./s3-object-storage";

export * from "./object-storage";
export * from "./storage-key";

export const storage: ObjectStorage = s3ObjectStorage;
export default storage;
