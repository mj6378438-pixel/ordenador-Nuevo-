import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// ─── Base de datos falsa en memoria ───
const db = {
  cards: [{ serial_number: "9f8e7d6c-1111-2222-3333-444444444444", updated_at: "2026-11-22T10:00:00.000000+00:00" }],
  push_tokens: [] as { device_library_id: string; push_token: string }[],
  apple_device_registrations: [] as { device_library_id: string; serial_number: string }[],
};
type Row = Record<string, unknown>;
function table(name: keyof typeof db) {
  let rows = db[name] as Row[];
  const filters: [string, unknown][] = [];
  const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    maybeSingle: async () => ({ data: rows.find(match) ?? null }),
    upsert: async (r: Row) => {
      const i = rows.findIndex((x) => x.device_library_id === r.device_library_id);
      if (i >= 0) rows[i] = r; else rows.push(r);
      return { error: null };
    },
    insert: async (r: Row) => {
      if (rows.some((x) => x.device_library_id === r.device_library_id && x.serial_number === r.serial_number)) {
        return { error: { code: "23505" } };
      }
      rows.push(r);
      return { error: null };
    },
    delete: () => {
      const del = {
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return Object.assign(Promise.resolve().then(() => {
            (db[name] as Row[]) = rows = rows.filter((r) => !match(r));
            return { error: null };
          }), del);
        },
      };
      return del;
    },
  };
  return q;
}
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: (t: keyof typeof db) => table(t),
    rpc: async (_fn: string, args: { p_device: string; p_since: string | null }) => ({
      data: db.apple_device_registrations
        .filter((r) => r.device_library_id === args.p_device)
        .map((r) => db.cards.find((c) => c.serial_number === r.serial_number)!)
        .filter((c) => !args.p_since || c.updated_at > args.p_since),
    }),
  }),
}));
vi.mock("@/lib/cards", async () => {
  const { view } = await import("./fixtures");
  return { getCardViewBySerial: async () => ({ ...view, meta: { updatedAt: db.cards[0].updated_at } }) };
});

const SERIAL = "9f8e7d6c-1111-2222-3333-444444444444";
const BASE = "https://ejemplo.com/api/apple/v1";

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), "ws-"));
  const sh = (c: string) => execSync(c, { cwd: dir, stdio: "pipe" });
  sh(`openssl req -x509 -newkey rsa:2048 -nodes -keyout k.pem -out c.pem -days 2 -subj "/CN=x"`);
  const b64 = (f: string) => readFileSync(join(dir, f)).toString("base64");
  Object.assign(process.env, {
    APPLE_TEAM_ID: "ABCDE12345", APPLE_PASS_TYPE_ID: "pass.com.ejemplo.test",
    APPLE_PASS_CERT_BASE64: b64("c.pem"), APPLE_PASS_KEY_BASE64: b64("k.pem"), APPLE_PASS_KEY_PASSPHRASE: "",
    APPLE_WWDR_CERT_BASE64: b64("c.pem"), APPLE_PASS_AUTH_SECRET: "s", NEXT_PUBLIC_APP_URL: "https://ejemplo.com",
  });
});

const ctx = (path: string) => ({ params: Promise.resolve({ path: path.split("/") }) });

describe("servicio web de PassKit", async () => {
  const route = await import("@/app/api/apple/v1/[...path]/route");
  const { authTokenFor } = await import("@/lib/wallet/apple");
  const auth = () => ({ authorization: `ApplePass ${authTokenFor(SERIAL)}` });
  const regPath = `devices/IPHONE1/registrations/pass.com.ejemplo.test/${SERIAL}`;

  it("rechaza registrarse sin el token correcto", async () => {
    const res = await route.POST(
      new Request(`${BASE}/${regPath}`, { method: "POST", headers: { authorization: "ApplePass mal" }, body: '{"pushToken":"t1"}' }),
      ctx(regPath) as never,
    );
    expect(res.status).toBe(401);
  });

  it("registra el iPhone (201) y no lo duplica (200)", async () => {
    const req = () => new Request(`${BASE}/${regPath}`, { method: "POST", headers: auth(), body: '{"pushToken":"t1"}' });
    expect((await route.POST(req(), ctx(regPath) as never)).status).toBe(201);
    expect((await route.POST(req(), ctx(regPath) as never)).status).toBe(200);
    expect(db.apple_device_registrations).toHaveLength(1);
    expect(db.push_tokens[0].push_token).toBe("t1");
  });

  it("dice qué pases han cambiado", async () => {
    const p = "devices/IPHONE1/registrations/pass.com.ejemplo.test";
    const res = await route.GET(new Request(`${BASE}/${p}`), ctx(p) as never);
    const json = await res.json();
    expect(json.serialNumbers).toEqual([SERIAL]);
    const again = await route.GET(
      new Request(`${BASE}/${p}?passesUpdatedSince=${encodeURIComponent(json.lastUpdated)}`), ctx(p) as never,
    );
    expect(again.status).toBe(204);
  });

  it("entrega la última versión del pase", async () => {
    const p = `passes/pass.com.ejemplo.test/${SERIAL}`;
    expect((await route.GET(new Request(`${BASE}/${p}`), ctx(p) as never)).status).toBe(401);
    const res = await route.GET(new Request(`${BASE}/${p}`, { headers: auth() }), ctx(p) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.apple.pkpass");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });

  it("da de baja el iPhone", async () => {
    const res = await route.DELETE(new Request(`${BASE}/${regPath}`, { method: "DELETE", headers: auth() }), ctx(regPath) as never);
    expect(res.status).toBe(200);
    expect(db.apple_device_registrations).toHaveLength(0);
  });

  it("acepta los logs del iPhone", async () => {
    const res = await route.POST(new Request(`${BASE}/log`, { method: "POST", body: '{"logs":["x"]}' }), ctx("log") as never);
    expect(res.status).toBe(200);
  });
});
