export async function sendEmail(_params?: any) {
  return Promise.resolve();
}

export async function fetchAndDeleteLoginCodeData(
  _email: string,
  _code: string,
): Promise<{ callbackUrl: string } | null> {
  return null;
}
export default sendEmail;
