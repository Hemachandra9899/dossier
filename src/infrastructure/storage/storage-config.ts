export interface StorageConfig {
  transport: "s3" | "local";
  endpoint?: string;
  region: string;
  bucket: string;
  archiveBucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  distributionHost?: string;
  distributionKeyId?: string;
  distributionKeyContents?: string;
}

export function getStorageConfig(): StorageConfig {
  const endpoint =
    process.env.NEXT_PRIVATE_UPLOAD_ENDPOINT ||
    process.env.AWS_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    undefined;

  const region =
    process.env.NEXT_PRIVATE_UPLOAD_REGION ||
    process.env.AWS_REGION ||
    "ca-toronto-1";

  const bucket =
    process.env.NEXT_PRIVATE_UPLOAD_BUCKET ||
    process.env.S3_BUCKET_NAME ||
    "dossier";

  const archiveBucket =
    process.env.NEXT_PRIVATE_ARCHIVE_BUCKET ||
    bucket;

  const accessKeyId =
    process.env.NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    undefined;

  const secretAccessKey =
    process.env.NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    undefined;

  const transport =
    (process.env.NEXT_PUBLIC_UPLOAD_TRANSPORT as "s3" | "local") || "s3";

  return {
    transport,
    endpoint,
    region,
    bucket,
    archiveBucket,
    accessKeyId,
    secretAccessKey,
    distributionHost: process.env.NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST || undefined,
    distributionKeyId: process.env.NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_ID || undefined,
    distributionKeyContents: process.env.NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_CONTENTS || undefined,
  };
}
