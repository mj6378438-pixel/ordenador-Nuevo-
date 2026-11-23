import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { view } from "./fixtures";

// Certificados FALSOS solo para probar que el pase se firma y se empaqueta bien.
const dir = mkdtempSync(join(tmpdir(), "pkpass-"));
const sh = (cmd: string) => execSync(cmd, { cwd: dir, stdio: "pipe" });


beforeAll(() => {
  sh(`openssl req -x509 -newkey rsa:2048 -nodes -keyout wwdr.key -out wwdr.pem -days 2 -subj "/CN=Falso WWDR"`);
  sh(`openssl req -newkey rsa:2048 -keyout signer.key -out signer.csr -subj "/CN=pass.com.ejemplo.test" -passout pass:clave123`);
  sh(`openssl x509 -req -in signer.csr -CA wwdr.pem -CAkey wwdr.key -CAcreateserial -out signer.pem -days 2`);
  const b64 = (f: string) => readFileSync(join(dir, f)).toString("base64");
  Object.assign(process.env, {
    APPLE_TEAM_ID: "ABCDE12345",
    APPLE_PASS_TYPE_ID: "pass.com.ejemplo.test",
    APPLE_PASS_CERT_BASE64: b64("signer.pem"),
    APPLE_PASS_KEY_BASE64: b64("signer.key"),
    APPLE_PASS_KEY_PASSPHRASE: "clave123",
    APPLE_WWDR_CERT_BASE64: b64("wwdr.pem"),
    APPLE_PASS_AUTH_SECRET: "secreto-de-prueba-123",
    NEXT_PUBLIC_APP_URL: "https://ejemplo.com",
  });
});

describe("Apple Wallet", () => {
  it("está configurado con todas las variables", async () => {
    const { appleWalletConfigured } = await import("@/lib/wallet/apple");
    expect(appleWalletConfigured()).toBe(true);
  });

  it("autentica al iPhone solo con el token correcto", async () => {
    const { authTokenFor, checkAuth } = await import("@/lib/wallet/apple");
    const s = view.card.serial_number;
    expect(checkAuth(`ApplePass ${authTokenFor(s)}`, s)).toBe(true);
    expect(checkAuth(`ApplePass ${authTokenFor("otra")}`, s)).toBe(false);
    expect(checkAuth(null, s)).toBe(false);
    expect(checkAuth(authTokenFor(s), s)).toBe(false);
  });

  it("genera un .pkpass firmado con el contenido correcto", async () => {
    const { generatePass } = await import("@/lib/wallet/apple");
    const buf = await generatePass(view);
    const file = join(dir, "tarjeta.pkpass");
    writeFileSync(file, buf);

    const list = execSync(`unzip -l ${file}`).toString();
    for (const f of ["pass.json", "manifest.json", "signature", "icon.png", "logo.png"]) {
      expect(list).toContain(f);
    }
    const pass = JSON.parse(execSync(`unzip -p ${file} pass.json`).toString());
    expect(pass).toMatchObject({
      passTypeIdentifier: "pass.com.ejemplo.test",
      teamIdentifier: "ABCDE12345",
      serialNumber: view.card.serial_number,
      webServiceURL: "https://ejemplo.com/api/apple",
      organizationName: "Café La Esquina",
      backgroundColor: "rgb(59, 42, 32)",
    });
    expect(pass.authenticationToken).toHaveLength(64);
    expect(pass.barcodes[0]).toMatchObject({ message: "TOKEN_OPACO", format: "PKBarcodeFormatQR" });
    expect(pass.storeCard.headerFields[0].value).toBe("7/10");
    expect(pass.storeCard.secondaryFields[0]).toMatchObject({ key: "premio", changeMessage: "%@" });
    expect(pass.storeCard.backFields[0]).toMatchObject({ key: "promo", value: "2x1 los martes" });
    // Nunca datos personales en el código de barras
    expect(JSON.stringify(pass.barcodes)).not.toContain("@");

    // La firma es un PKCS#7 válido hecho con nuestro certificado
    writeFileSync(join(dir, "signature.der"), execSync(`unzip -p ${file} signature`));
    const p7 = sh(`openssl pkcs7 -inform DER -in signature.der -print_certs`).toString();
    expect(p7).toContain("pass.com.ejemplo.test");
  });
});
