import "server-only";
import http2 from "node:http2";
import { certificates, passTypeId } from "./apple";

/**
 * Avisos push de Apple (APNs) para que el iPhone descargue la última versión del pase.
 * Se envía un mensaje vacío; el iPhone llama después a nuestro servicio web.
 * Se usa el mismo certificado del Pass Type ID (no hace falta otra clave).
 */

export type PushResult = { token: string; status: number };

export async function pushToDevices(pushTokens: string[]): Promise<PushResult[]> {
  if (pushTokens.length === 0) return [];
  const { signerCert, signerKey, signerKeyPassphrase } = certificates();
  const client = http2.connect("https://api.push.apple.com:443", {
    cert: signerCert,
    key: signerKey,
    passphrase: signerKeyPassphrase,
  });
  client.on("error", (e) => console.error("APNs:", e.message));

  const send = (token: string) =>
    new Promise<PushResult>((resolve) => {
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        "apns-topic": passTypeId(),
        "apns-push-type": "background",
        "apns-priority": "5",
        "content-type": "application/json",
      });
      req.setTimeout(10_000, () => {
        req.close();
        resolve({ token, status: 0 });
      });
      req.on("response", (h) => resolve({ token, status: Number(h[":status"]) }));
      req.on("error", () => resolve({ token, status: 0 }));
      req.end("{}");
    });

  try {
    const results: PushResult[] = [];
    // De 50 en 50 para no saturar la conexión
    for (let i = 0; i < pushTokens.length; i += 50) {
      results.push(...(await Promise.all(pushTokens.slice(i, i + 50).map(send))));
    }
    return results;
  } finally {
    client.close();
  }
}
