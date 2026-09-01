const LOCAL_SITE_ORIGIN = "http://localhost:3000";

export function getSiteOrigin(): URL {
  const configuredOrigin = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return new URL(url.origin);
      }
    } catch {
      // Fall through to a known-safe local origin when configuration is invalid.
    }
  }

  return new URL(LOCAL_SITE_ORIGIN);
}
