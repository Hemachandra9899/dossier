import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  return hashedPassword;
}

export async function checkPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  const match = await bcrypt.compare(password, hashedPassword);
  return match;
}

export async function generateEncrpytedPassword(
  password: string,
): Promise<string> {
  // If the password is empty, return an empty string
  if (!password) return "";
  // If the password is already encrypted, return it
  // Check if it's encrypted by validating the format: 32-char hex IV + ":" + hex encrypted text
  const textParts: string[] = password.split(":");
  if (
    textParts.length === 2 &&
    textParts[0].length === 32 &&
    /^[a-fA-F0-9]+$/.test(textParts[0]) &&
    /^[a-fA-F0-9]+$/.test(textParts[1])
  ) {
    return password;
  }
  // Otherwise, encrypt the password
  const encryptedKey: string = crypto
    .createHash("sha256")
    .update(String(process.env.NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY))
    .digest("base64")
    .substring(0, 32);
  const IV: Buffer = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-ctr", encryptedKey, IV);
  let encryptedText: string = cipher.update(password, "utf8", "hex");
  encryptedText += cipher.final("hex");
  return IV.toString("hex") + ":" + encryptedText;
}

export function decryptEncrpytedPassword(password: string): string {
  if (!password) return "";
  const encryptedKey: string = crypto
    .createHash("sha256")
    .update(String(process.env.NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY))
    .digest("base64")
    .substring(0, 32);
  const textParts: string[] = password.split(":");
  // Check if it's in the expected encrypted format: 32-char hex IV + ":" + hex encrypted text
  if (
    !textParts ||
    textParts.length !== 2 ||
    textParts[0].length !== 32 ||
    !/^[a-fA-F0-9]+$/.test(textParts[0]) ||
    !/^[a-fA-F0-9]+$/.test(textParts[1])
  ) {
    return password; // Return as-is if not in encrypted format
  }
  try {
    const IV: Buffer = Buffer.from(textParts[0], "hex");
    const encryptedText: string = textParts[1];
    const decipher = crypto.createDecipheriv("aes-256-ctr", encryptedKey, IV);
    let decrypted: string = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    return password;
  }
}
