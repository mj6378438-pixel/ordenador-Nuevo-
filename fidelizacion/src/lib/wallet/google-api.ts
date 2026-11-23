import "server-only";
import { requireEnv } from "@/lib/env";
import type { CardView } from "@/lib/loyalty";
import {
  buildLoyaltyClass,
  buildLoyaltyObject,
  googleWalletConfigured,
  objectId,
  serviceAccount,
  signJwt,
} from "./google";

/**
 * Llamadas a la API de Google Wallet para ACTUALIZAR tarjetas ya guardadas
 * (el alta va por el enlace con JWT, ver google.ts).
 * Si el cliente aún no ha guardado la tarjeta, Google responde 404 y lo ignoramos.
 */

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function call(method: string, path: string, body?: unknown): Promise<"ok" | "missing"> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return "missing";
  if (!res.ok) throw new Error(`Google Wallet ${method} ${path} → ${res.status}: ${await res.text()}`);
  return "ok";
}

export type Notice = { header: string; body: string };

/** Actualiza la tarjeta de un cliente y, opcionalmente, le manda una notificación. */
export async function googleUpdateCard(view: CardView, notice?: Notice) {
  if (!googleWalletConfigured()) return;
  const issuerId = requireEnv("GOOGLE_WALLET_ISSUER_ID");
  const obj = buildLoyaltyObject(view, issuerId);
  const id = encodeURIComponent(obj.id);

  const { loyaltyPoints, secondaryLoyaltyPoints, textModulesData, accountName, hexBackgroundColor } = obj;
  const r = await call("PATCH", `/loyaltyObject/${id}`, {
    loyaltyPoints,
    secondaryLoyaltyPoints,
    textModulesData,
    accountName,
    hexBackgroundColor,
  });
  if (r === "missing" || !notice) return;

  await call("POST", `/loyaltyObject/${id}/addMessage`, {
    message: {
      id: `m${Date.now()}`,
      header: notice.header,
      body: notice.body,
      // Notificación en el móvil (Google permite unas pocas al día por tarjeta)
      messageType: "TEXT_AND_NOTIFY",
    },
  });
}

/** Actualiza el diseño común de la tarjeta del negocio (nombre, logo, color). */
export async function googleUpdateClass(view: CardView) {
  if (!googleWalletConfigured()) return;
  const cls = buildLoyaltyClass(view, requireEnv("GOOGLE_WALLET_ISSUER_ID"));
  await call("PATCH", `/loyaltyClass/${encodeURIComponent(cls.id)}`, {
    issuerName: cls.issuerName,
    programLogo: cls.programLogo,
    hexBackgroundColor: cls.hexBackgroundColor,
    reviewStatus: "UNDER_REVIEW",
  });
}

/** Desactiva la tarjeta en Google (al borrar un cliente por RGPD). */
export async function googleDeactivateCard(cardId: string) {
  if (!googleWalletConfigured()) return;
  const id = encodeURIComponent(objectId(requireEnv("GOOGLE_WALLET_ISSUER_ID"), cardId));
  await call("PATCH", `/loyaltyObject/${id}`, { state: "INACTIVE" });
}
