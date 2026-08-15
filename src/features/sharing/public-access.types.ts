export interface CreateFileShareInput {
  fileId: string;
  name?: string;
  expiresAt?: Date;
  passcode?: string;
}
