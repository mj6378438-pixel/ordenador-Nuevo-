import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { view } from "./fixtures";

const calls: { url: string; method: string; body: unknown }[] = [];
let objectExists = true;

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_WALLET_ISSUER_ID = "3388000000012345678";
  process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64 = Buffer.from(
    JSON.stringify({ client_email: "w@p.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }),
  ).toString("base64");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method!, body: init.body && typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    if (url.includes("oauth2")) return Response.json({ access_token: "tok", expires_in: 3600 });
    if (!objectExists && url.includes("loyaltyObject")) return new Response("no", { status: 404 });
    return Response.json({});
  });
});
afterEach(() => { calls.length = 0; objectExists = true; });

describe("actualizaciones de Google Wallet", () => {
  it("actualiza las visitas y manda la notificación", async () => {
    const { googleUpdateCard } = await import("@/lib/wallet/google-api");
    await googleUpdateCard({ ...view, card: { ...view.card, visits_current: 8, visits_total: 8 } }, { header: "Café", body: "¡+1 visita!" });
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toContain("/loyaltyObject/3388000000012345678.tarjeta_");
    expect(patch.body).toMatchObject({ loyaltyPoints: { balance: { int: 8 } }, secondaryLoyaltyPoints: { balance: { int: 2 } } });
    const msg = calls.find((c) => c.url.endsWith("/addMessage"))!;
    expect(msg.body).toMatchObject({ message: { body: "¡+1 visita!", messageType: "TEXT_AND_NOTIFY" } });
  });

  it("si el cliente no guardó la tarjeta, no falla ni manda aviso", async () => {
    objectExists = false;
    const { googleUpdateCard } = await import("@/lib/wallet/google-api");
    await expect(googleUpdateCard(view, { header: "x", body: "y" })).resolves.toBeUndefined();
    expect(calls.some((c) => c.url.endsWith("/addMessage"))).toBe(false);
  });

  it("reutiliza el token de acceso", async () => {
    const { googleUpdateCard } = await import("@/lib/wallet/google-api");
    await googleUpdateCard(view);
    await googleUpdateCard(view);
    expect(calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(0);
  });
});

it("textos de aviso", async () => {
  const { noticeFor } = await import("@/lib/loyalty");
  expect(noticeFor("visit", view)?.body).toBe("¡+1 visita! Llevas 7. Te faltan 3 visitas para tu 10% de descuento en tu comida.");
  const full = { ...view, card: { ...view.card, visits_current: 10 } };
  expect(noticeFor("visit", full)?.body).toContain("¡Enhorabuena!");
  expect(noticeFor("redeem", view)?.body).toContain("¡A por el siguiente!");
  expect(noticeFor("promo", view)?.body).toBe("2x1 los martes");
});
