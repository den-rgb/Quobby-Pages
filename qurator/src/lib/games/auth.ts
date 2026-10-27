export async function resolveProfileId(
  authorization: string | null,
  verifyBearer: (token: string) => Promise<string | null>,
  readCookieSession: () => Promise<string | null>,
): Promise<string | null> {
  if (authorization !== null) {
    const bearer = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(authorization);
    if (!bearer) return null;
    try {
      return await verifyBearer(bearer[1]);
    } catch {
      return null;
    }
  }
  try {
    return await readCookieSession();
  } catch {
    return null;
  }
}
