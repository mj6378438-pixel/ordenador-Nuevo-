/**
 * Lectura centralizada de variables de entorno.
 * Las claves y certificados viven SOLO en variables de entorno, nunca en el código.
 */

export type EnvCheck = {
  key: string;
  label: string;
  phase: number;
  secret: boolean;
};

/** Todas las variables que usará el proyecto, con la fase en la que hacen falta. */
export const ENV_CHECKS: EnvCheck[] = [
  { key: "NEXT_PUBLIC_APP_URL", label: "URL pública de la app", phase: 1, secret: false },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase · URL del proyecto", phase: 1, secret: false },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", label: "Supabase · clave pública (publishable)", phase: 1, secret: false },
  { key: "SUPABASE_SECRET_KEY", label: "Supabase · clave secreta (secret)", phase: 1, secret: true },
  { key: "GOOGLE_WALLET_ISSUER_ID", label: "Google Wallet · Issuer ID", phase: 3, secret: false },
  { key: "GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64", label: "Google Wallet · cuenta de servicio (JSON en base64)", phase: 3, secret: true },
  { key: "APPLE_TEAM_ID", label: "Apple · Team ID", phase: 4, secret: false },
  { key: "APPLE_PASS_TYPE_ID", label: "Apple · Pass Type ID", phase: 4, secret: false },
  { key: "APPLE_PASS_CERT_BASE64", label: "Apple · certificado del pase (base64)", phase: 4, secret: true },
  { key: "APPLE_PASS_KEY_BASE64", label: "Apple · clave privada del pase (base64)", phase: 4, secret: true },
  { key: "APPLE_WWDR_CERT_BASE64", label: "Apple · certificado WWDR G4 (base64)", phase: 4, secret: true },
  { key: "APPLE_PASS_AUTH_SECRET", label: "Apple · secreto para tokens de los pases", phase: 4, secret: true },
];

export function isSet(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/** Devuelve la variable o lanza un error claro en español si falta. */
export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) {
    throw new Error(
      `Falta la variable de entorno ${key}. Revisa tu archivo .env.local (o las variables del proyecto en Vercel).`,
    );
  }
  return v.trim();
}

/** Decodifica una variable que contiene un archivo en base64 (certificados, JSON...). */
export function requireBase64Env(key: string): Buffer {
  return Buffer.from(requireEnv(key), "base64");
}

export const appName = process.env.NEXT_PUBLIC_APP_NAME || "Tarjeta de Puntos";
