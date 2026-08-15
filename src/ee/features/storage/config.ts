export const storageConfig = { bucket: "dossier", region: "us-east-1" };
export type StorageConfig = typeof storageConfig;
export function getTeamStorageConfigById(_id: string) { return storageConfig; }
