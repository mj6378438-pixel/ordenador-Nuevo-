import "server-only";
import { createSign } from "node:crypto";
import { isSet, requireBase64Env, requireEnv } from "@/lib/env";
import { type CardView, progressText, progressVisits, ruleText, visitsRemaining } from "@/lib/loyalty";

/**
 * Google Wallet: genera el enlace "Añadir a Google Wallet".
 * El enlace lleva un JWT firmado con la cuenta de servicio que contiene la
 * "clase" (el diseño de la tarjeta del negocio) y el "objeto" (la tarjeta de
 * este cliente). Google los crea la primera vez que alguien pulsa el botón.
 */

type ServiceAccount = { client_email: string; private_key: string };

export function googleWalletConfigured() {
  return isSet("GOOGLE_WALLET_ISSUER_ID") && isSet("GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64");
}

function serviceAccount(): ServiceAccount {
  const json = JSON.parse(requireBase64Env("GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64").toString("utf8"));
  if (!json.client_email || !json.private_key) {
    throw new Error("GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64 no contiene un JSON de cuenta de servicio válido.");
  }
  return json;
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export function signJwt(claims: object, privateKeyPem: string): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  return `${header}.${body}.${signer.sign(privateKeyPem).toString("base64url")}`;
}

const lang = "es-ES";
const localized = (value: string) => ({ defaultValue: { language: lang, value } });

export function classId(issuerId: string, businessId: string) {
  return `${issuerId}.negocio_${businessId.replaceAll("-", "")}`;
}

export function objectId(issuerId: string, cardId: string) {
  return `${issuerId}.tarjeta_${cardId.replaceAll("-", "")}`;
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function buildLoyaltyClass(view: CardView, issuerId: string) {
  const { business } = view;
  return {
    id: classId(issuerId, business.id),
    issuerName: business.name,
    programName: "Tarjeta de cliente",
    programLogo: {
      sourceUri: { uri: business.logo_url || `${appUrl()}/logo-tarjeta.png` },
      contentDescription: localized(business.name),
    },
    hexBackgroundColor: business.bg_color,
    countryCode: "ES",
    reviewStatus: "UNDER_REVIEW",
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
    localizedProgramName: localized("Tarjeta de cliente"),
  };
}

export function buildLoyaltyObject(view: CardView, issuerId: string) {
  const { business, program, card, customerName } = view;
  const modules = [
    { id: "progreso", header: "Tu premio", body: progressText(program, card) },
    { id: "regla", header: "Cómo funciona", body: ruleText(program) },
  ];
  if (business.promo_message) {
    modules.unshift({ id: "promo", header: "Novedades", body: business.promo_message });
  }
  return {
    id: objectId(issuerId, card.id),
    classId: classId(issuerId, business.id),
    state: "ACTIVE",
    // Nunca el email: un identificador corto y opaco
    accountId: card.serial_number.slice(0, 8).toUpperCase(),
    accountName: customerName,
    hexBackgroundColor: business.bg_color,
    loyaltyPoints: {
      label: "Visitas",
      balance: { int: progressVisits(program, card) },
    },
    secondaryLoyaltyPoints: {
      label: "Faltan",
      balance: { int: visitsRemaining(program, card) },
    },
    barcode: { type: "QR_CODE", value: card.public_token },
    textModulesData: modules,
  };
}

/** URL del botón "Añadir a Google Wallet". */
export function googleSaveUrl(view: CardView): string {
  const issuerId = requireEnv("GOOGLE_WALLET_ISSUER_ID");
  const sa = serviceAccount();
  const jwt = signJwt(
    {
      iss: sa.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [appUrl()],
      payload: {
        loyaltyClasses: [buildLoyaltyClass(view, issuerId)],
        loyaltyObjects: [buildLoyaltyObject(view, issuerId)],
      },
    },
    sa.private_key,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
