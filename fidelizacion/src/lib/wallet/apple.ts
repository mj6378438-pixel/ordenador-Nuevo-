import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PKPass } from "passkit-generator";
import { isSet, requireBase64Env, requireEnv } from "@/lib/env";
import { type CardView, progressText, progressVisits, ruleText } from "@/lib/loyalty";
import { DEFAULT_ICON_PNG_BASE64 } from "./apple-assets";
import { appUrl } from "./google";

/**
 * Apple Wallet: genera el pase (.pkpass) firmado con el certificado del Pass Type ID.
 * Todo se activa solo cuando están puestas las variables de entorno de Apple.
 */

export function appleWalletConfigured() {
  return [
    "APPLE_TEAM_ID",
    "APPLE_PASS_TYPE_ID",
    "APPLE_PASS_CERT_BASE64",
    "APPLE_PASS_KEY_BASE64",
    "APPLE_WWDR_CERT_BASE64",
    "APPLE_PASS_AUTH_SECRET",
  ].every(isSet);
}

export const passTypeId = () => requireEnv("APPLE_PASS_TYPE_ID");

/** Token que Apple manda en cada llamada del iPhone: HMAC del número de serie. */
export function authTokenFor(serial: string) {
  return createHmac("sha256", requireEnv("APPLE_PASS_AUTH_SECRET")).update(serial).digest("hex");
}

/** Comprueba la cabecera "Authorization: ApplePass <token>". */
export function checkAuth(header: string | null, serial: string) {
  const given = header?.match(/^ApplePass\s+(\S+)$/)?.[1];
  if (!given) return false;
  const expected = Buffer.from(authTokenFor(serial));
  const got = Buffer.from(given);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function certificates() {
  return {
    signerCert: requireBase64Env("APPLE_PASS_CERT_BASE64"),
    signerKey: requireBase64Env("APPLE_PASS_KEY_BASE64"),
    signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
    wwdr: requireBase64Env("APPLE_WWDR_CERT_BASE64"),
  };
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** Logo del negocio (si es un PNG accesible) o el icono por defecto. */
async function logoPng(url: string | null): Promise<Buffer> {
  const fallback = Buffer.from(DEFAULT_ICON_PNG_BASE64, "base64");
  if (!url) return fallback;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const buf = Buffer.from(await res.arrayBuffer());
    // Firma de un PNG: 89 50 4E 47
    return res.ok && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? buf : fallback;
  } catch {
    return fallback;
  }
}

/** Contenido del pase (lo que se ve en el iPhone). Separado para poder probarlo. */
export function passContent(view: CardView) {
  const { business, program, card, customerName } = view;
  const n = progressVisits(program, card);
  const url = appUrl();

  const props = {
    formatVersion: 1 as const,
    passTypeIdentifier: requireEnv("APPLE_PASS_TYPE_ID"),
    teamIdentifier: requireEnv("APPLE_TEAM_ID"),
    serialNumber: card.serial_number,
    authenticationToken: authTokenFor(card.serial_number),
    // Apple solo acepta HTTPS: en local (http) el pase no se actualizará solo
    ...(url.startsWith("https://") ? { webServiceURL: `${url}/api/apple` } : {}),
    organizationName: business.name,
    description: `Tarjeta de cliente de ${business.name}`,
    logoText: business.name,
    backgroundColor: rgb(business.bg_color),
    foregroundColor: rgb(business.fg_color),
    labelColor: rgb(business.label_color),
    sharingProhibited: true,
  };

  const fields = {
    header: [{ key: "visitas", label: "VISITAS", value: `${Math.min(n, program.visits_required)}/${program.visits_required}` }],
    primary: [{ key: "cliente", label: "CLIENTE", value: customerName }],
    secondary: [
      // changeMessage: Apple avisa al cliente cuando este texto cambia
      { key: "premio", label: "TU PREMIO", value: progressText(program, card), changeMessage: "%@" },
    ],
    back: [
      ...(business.promo_message
        ? [{ key: "promo", label: "Novedades", value: business.promo_message, changeMessage: "%@" }]
        : []),
      { key: "regla", label: "Cómo funciona", value: ruleText(program) },
      { key: "visitas_total", label: "Visitas totales", value: String(card.visits_total) },
      { key: "privacidad", label: "Privacidad", value: `${url}/c/${business.slug}/privacidad` },
    ],
  };
  return { props, fields, barcode: card.public_token };
}

/** Genera el archivo .pkpass firmado. */
export async function generatePass(view: CardView): Promise<Buffer> {
  const { props, fields, barcode } = passContent(view);
  const icon = Buffer.from(DEFAULT_ICON_PNG_BASE64, "base64");
  const logo = await logoPng(view.business.logo_url);

  const pass = new PKPass(
    { "icon.png": icon, "icon@2x.png": icon, "icon@3x.png": icon, "logo.png": logo, "logo@2x.png": logo },
    certificates(),
    props,
  );
  pass.type = "storeCard";
  pass.headerFields.push(...fields.header);
  pass.primaryFields.push(...fields.primary);
  pass.secondaryFields.push(...fields.secondary);
  pass.backFields.push(...fields.back);
  pass.setBarcodes({ message: barcode, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" });
  return pass.getAsBuffer();
}
