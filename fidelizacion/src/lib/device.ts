export type Platform = "ios" | "android" | "other";

/** Detecta el sistema del móvil a partir del user-agent. */
export function detectPlatform(userAgent: string | null): Platform {
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}
