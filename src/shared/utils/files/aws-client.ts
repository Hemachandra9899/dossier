import storage, { getStorageConfig } from "@/infrastructure/storage";

export function getS3Client() {
  return storage;
}

export function getLambdaClientForTeam(_teamId?: any) {
  return {
    send: async () => ({}),
    destroy: () => {},
    config: {},
    middlewareStack: { use: () => {}, remove: () => {} },
  } as any;
}

export async function getTeamS3ClientAndConfig(_teamId?: any) {
  const config = getStorageConfig();
  return {
    client: storage,
    config: { bucket: config.bucket, region: config.region },
    s3: storage,
    bucket: config.bucket,
    advancedBucket: config.bucket,
    lambdaFunctionName: "bulk-download",
  } as any;
}
