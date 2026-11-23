import { getCardViewBySerial } from "@/lib/cards";
import { createAdminClient } from "@/lib/supabase/server";
import { appleWalletConfigured, checkAuth, generatePass, passTypeId } from "@/lib/wallet/apple";

/**
 * Servicio web de PassKit (lo llama el iPhone, no las personas):
 *   POST   /v1/devices/{dispositivo}/registrations/{passType}/{serie}  → registrar para recibir avisos
 *   DELETE /v1/devices/{dispositivo}/registrations/{passType}/{serie}  → el cliente borró el pase
 *   GET    /v1/devices/{dispositivo}/registrations/{passType}?passesUpdatedSince=…  → qué ha cambiado
 *   GET    /v1/passes/{passType}/{serie}                                → última versión del pase
 *   POST   /v1/log                                                      → errores que reporta el iPhone
 */

type Ctx = RouteContext<"/api/apple/v1/[...path]">;
const empty = (status: number) => new Response(null, { status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parse(path: string[]) {
  const [kind, a, b, c, d] = path;
  if (kind === "devices" && b === "registrations") return { kind: "registrations" as const, device: a, type: c, serial: d };
  if (kind === "passes") return { kind: "pass" as const, type: a, serial: b };
  if (kind === "log") return { kind: "log" as const };
  return null;
}

function validSerial(serial: string | undefined): serial is string {
  return !!serial && UUID.test(serial);
}

export async function POST(req: Request, ctx: Ctx) {
  if (!appleWalletConfigured()) return empty(503);
  const route = parse((await ctx.params).path);

  if (route?.kind === "log") {
    const body = await req.json().catch(() => null);
    console.warn("[apple-wallet log]", JSON.stringify(body)?.slice(0, 2000));
    return empty(200);
  }
  if (route?.kind !== "registrations" || route.type !== passTypeId() || !validSerial(route.serial) || !route.device) {
    return empty(404);
  }
  if (!checkAuth(req.headers.get("authorization"), route.serial)) return empty(401);

  const body = (await req.json().catch(() => null)) as { pushToken?: string } | null;
  if (!body?.pushToken || body.pushToken.length > 200) return empty(400);

  const db = createAdminClient();
  const { data: card } = await db.from("cards").select("serial_number").eq("serial_number", route.serial).maybeSingle();
  if (!card) return empty(404);

  await db
    .from("push_tokens")
    .upsert({ device_library_id: route.device, push_token: body.pushToken, updated_at: new Date().toISOString() });
  const { error } = await db
    .from("apple_device_registrations")
    .insert({ device_library_id: route.device, serial_number: route.serial });
  // 23505 = ya estaba registrado
  if (error && error.code !== "23505") return empty(500);
  return empty(error ? 200 : 201);
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!appleWalletConfigured()) return empty(503);
  const route = parse((await ctx.params).path);
  if (route?.kind !== "registrations" || route.type !== passTypeId() || !validSerial(route.serial) || !route.device) {
    return empty(404);
  }
  if (!checkAuth(req.headers.get("authorization"), route.serial)) return empty(401);

  const db = createAdminClient();
  await db
    .from("apple_device_registrations")
    .delete()
    .eq("device_library_id", route.device)
    .eq("serial_number", route.serial);
  return empty(200);
}

export async function GET(req: Request, ctx: Ctx) {
  if (!appleWalletConfigured()) return empty(503);
  const route = parse((await ctx.params).path);

  // ¿Qué pases de este iPhone han cambiado?
  if (route?.kind === "registrations" && !route.serial) {
    if (route.type !== passTypeId() || !route.device) return empty(404);
    const since = new URL(req.url).searchParams.get("passesUpdatedSince");
    const sinceDate = since && !Number.isNaN(Date.parse(since)) ? since : null;
    const db = createAdminClient();
    const { data } = await db.rpc("apple_updated_serials", { p_device: route.device, p_since: sinceDate });
    const rows = (data ?? []) as { serial_number: string; updated_at: string }[];
    if (rows.length === 0) return empty(204);
    const lastUpdated = rows.map((r) => r.updated_at).sort().at(-1)!;
    return Response.json({ serialNumbers: rows.map((r) => r.serial_number), lastUpdated });
  }

  // Última versión de un pase
  if (route?.kind === "pass") {
    if (route.type !== passTypeId() || !validSerial(route.serial)) return empty(404);
    if (!checkAuth(req.headers.get("authorization"), route.serial)) return empty(401);
    const view = await getCardViewBySerial(route.serial);
    if (!view) return empty(404);
    const pass = await generatePass(view);
    return new Response(new Uint8Array(pass), {
      headers: {
        "content-type": "application/vnd.apple.pkpass",
        "last-modified": new Date(view.meta.updatedAt).toUTCString(),
        "cache-control": "no-store",
      },
    });
  }
  return empty(404);
}
