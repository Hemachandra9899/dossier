import crypto from "crypto";

/**
 * Generates a Gravatar hash for the given email.
 * @param {string} email - The email address.
 * @returns {string} The Gravatar hash.
 */
export const generateGravatarHash = (email: string | null): string => {
  if (!email) return "";
  // 1. Trim leading and trailing whitespace from an email address
  const trimmedEmail = email.trim();

  // 2. Force all characters to lower-case
  const lowerCaseEmail = trimmedEmail.toLowerCase();

  // 3. Hash the final string with SHA256
  const hash = crypto.createHash("sha256").update(lowerCaseEmail).digest("hex");

  return hash;
};
