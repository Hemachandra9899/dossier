import { type Session } from "next-auth";

export async function startServerPasskeyRegistration(opts: {
  session: Session;
}) {
  throw new Error("Passkeys are not supported");
}

export async function finishServerPasskeyRegistration(opts: {
  credential: any;
  session: Session;
}) {
  throw new Error("Passkeys are not supported");
}

export async function listUserPasskeys(opts: { session: Session }) {
  return [];
}

export async function removeUserPasskey(opts: {
  credentialId: string;
  session: Session;
}) {
  throw new Error("Passkeys are not supported");
}
