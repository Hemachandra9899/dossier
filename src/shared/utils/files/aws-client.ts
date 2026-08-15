import storage from "@/platform/storage";

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
  const bucket = process.env.S3_BUCKET_NAME || "dossier";
  return {
    client: storage,
    config: { bucket, region: process.env.AWS_REGION || "us-east-1" },
    s3: storage,
    bucket,
    advancedBucket: bucket,
    lambdaFunctionName: "bulk-download",
  } as any;
}
