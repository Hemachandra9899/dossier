import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";
import { getStorageConfig } from "./storage-config";

export function createS3Client(customConfig?: Partial<S3ClientConfig>): S3Client {
  const config = getStorageConfig();
  const endpoint = config.endpoint;

  const isOracle =
    !!endpoint &&
    (endpoint.includes(".compat.objectstorage.") ||
      endpoint.includes("oraclecloud.com"));

  const isCustomEndpoint =
    !!endpoint &&
    (isOracle ||
      endpoint.includes("localhost") ||
      endpoint.includes("127.0.0.1") ||
      endpoint.includes("minio") ||
      endpoint.includes("r2.cloudflarestorage.com"));

  const clientConfig: S3ClientConfig = {
    endpoint: endpoint || undefined,
    region: config.region,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
    // Oracle Object Storage S3 compatibility uses path-style URLs
    // (https://<namespace>.compat.objectstorage.<region>.oraclecloud.com/<bucket>/<key>)
    forcePathStyle: isCustomEndpoint,
    // Oracle S3 compatibility interface recommends WHEN_REQUIRED for checksums
    // to prevent AWS SDK v3.729+ from generating incompatible chunked trailers
    requestChecksumCalculation: "WHEN_REQUIRED",
    ...customConfig,
  };

  return new S3Client(clientConfig);
}

let _cachedClient: S3Client | null = null;

export function getSharedS3Client(): S3Client {
  if (!_cachedClient) {
    _cachedClient = createS3Client();
  }
  return _cachedClient;
}
