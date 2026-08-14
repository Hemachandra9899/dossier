export interface PutOptions {
  teamId: string;
  storageKey: string;
  body: Buffer;
  contentType?: string;
  contentDisposition?: string;
}

export interface GetBufferOptions {
  teamId: string;
  storageKey: string;
}

export interface GetDownloadUrlOptions {
  teamId: string;
  storageKey: string;
  fileName?: string;
  expiresInSeconds?: number;
}

export interface CopyOptions {
  teamId: string;
  sourceKey: string;
  destinationKey: string;
}

export interface DeleteOptions {
  teamId: string;
  storageKey: string;
}

export interface ObjectStorage {
  put(options: PutOptions): Promise<{ storageKey: string }>;
  getBuffer(options: GetBufferOptions): Promise<Buffer>;
  getDownloadUrl(options: GetDownloadUrlOptions): Promise<string>;
  copy(options: CopyOptions): Promise<void>;
  delete(options: DeleteOptions): Promise<void>;
}
