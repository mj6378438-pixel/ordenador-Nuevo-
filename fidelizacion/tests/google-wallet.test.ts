import { generateKeyPairSync, createVerify } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { CardView } from "@/lib/loyalty";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const view: CardView = {
  business: {
    id: "11111111-2222-3333-4444-555555555555", slug: "cafe", name: "Café La Esquina",
    legal_name: null, contact_email: null, logo_url: null,
    bg_color: "#3b2a20", fg_color: "#f7efe6", label_color: "#d9c7b3", promo_message: null,
  },
  program: { reward_type: "one_time", visits_required: 10, discount_percent: 10, reward_description: "en tu comida" },
  card: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", serial_number: "9f8e7d6c-0000-0000-0000-000000000000",
    public_token: "TOKEN_OPACO", visits_total: 7, visits_current: 7, rewards_redeemed: 0,
  },
  customerName: "Lucía",
};

beforeAll(() => {
  process.env.GOOGLE_WALLET_ISSUER_ID = "3388000000012345678";
  process.env.NEXT_PUBLIC_APP_URL = "https://ejemplo.com";
  process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_BASE64 = Buffer.from(
    JSON.stringify({
      client_email: "wallet@proyecto.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    }),
  ).toString("base64");
});

describe("Google Wallet", () => {
  it("genera un enlace con un JWT firmado y válido", async () => {
    const { googleSaveUrl } = await import("@/lib/wallet/google");
    const url = googleSaveUrl(view);
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);

    const [h, b, sig] = url.split("/").pop()!.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${b}`);
    expect(verifier.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);

    const claims = JSON.parse(Buffer.from(b, "base64url").toString());
    expect(claims).toMatchObject({
      iss: "wallet@proyecto.iam.gserviceaccount.com",
      aud: "google",
      typ: "savetowallet",
      origins: ["https://ejemplo.com"],
    });

    const cls = claims.payload.loyaltyClasses[0];
    const obj = claims.payload.loyaltyObjects[0];
    expect(cls.id).toBe("3388000000012345678.negocio_11111111222233334444555555555555");
    expect(cls.programLogo.sourceUri.uri).toBe("https://ejemplo.com/logo-tarjeta.png");
    expect(obj.classId).toBe(cls.id);
    expect(obj.id).toMatch(/^3388000000012345678\.tarjeta_[a-f0-9]{32}$/);
    expect(obj.barcode).toEqual({ type: "QR_CODE", value: "TOKEN_OPACO" });
    expect(obj.loyaltyPoints.balance.int).toBe(7);
    expect(obj.secondaryLoyaltyPoints.balance.int).toBe(3);
    expect(obj.accountName).toBe("Lucía");
    // Nunca el email ni el id interno en la tarjeta
    expect(JSON.stringify(obj)).not.toContain("@");
    expect(obj.accountId).toBe("9F8E7D6C");
  });
});
