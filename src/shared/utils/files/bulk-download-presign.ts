export async function presignBulkDownload(..._args: any[]) { return "/api/storage/download"; }
export function parseS3PresignedUrl(..._args: any[]) { return { bucket: "dossier", key: "key", region: "us-east-1" }; }
export async function generateFreshPresignedUrl(..._args: any[]) { return "/api/storage/download"; }
