import "server-only";
import { getBusinessCardViews, getCardViewById } from "@/lib/cards";
import { type CardEvent, noticeFor } from "@/lib/loyalty";
import { createAdminClient } from "@/lib/supabase/server";
import { appleWalletConfigured } from "./apple";
import { pushToDevices } from "./apns";
import { googleWalletConfigured } from "./google";
import { googleUpdateCard, googleUpdateClass } from "./google-api";

/**
 * Mantiene las tarjetas de los Wallet al día después de cada cambio.
 * Se llama "después de responder" (after) para que escanear siga siendo instantáneo.
 * Los fallos se registran pero nunca rompen la acción del dependiente.
 */

const log = (what: string, e: unknown) => console.error(`[wallet] ${what}:`, e instanceof Error ? e.message : e);

/** Avisa a los iPhone que tienen alguno de estos pases para que lo recarguen. */
export async function applePushSerials(serials: string[]) {
  if (!appleWalletConfigured() || serials.length === 0) return;
  const db = createAdminClient();
  for (let i = 0; i < serials.length; i += 200) {
    const { data } = await db
      .from("apple_device_registrations")
      .select("device_library_id, push_tokens ( push_token )")
      .in("serial_number", serials.slice(i, i + 200));
    const rows = (data ?? []) as unknown as {
      device_library_id: string;
      push_tokens: { push_token: string } | null;
    }[];
    const tokens = [...new Set(rows.map((r) => r.push_tokens?.push_token).filter(Boolean) as string[])];
    const results = await pushToDevices(tokens);
    // 410 = ese iPhone ya no tiene la tarjeta: limpiamos su registro
    const gone = results.filter((r) => r.status === 410).map((r) => r.token);
    if (gone.length) await db.from("push_tokens").delete().in("push_token", gone);
  }
}

/** Tras una visita o un canje: actualiza esa tarjeta y avisa al cliente. */
export async function syncCard(cardId: string, event: CardEvent) {
  const view = await getCardViewById(cardId);
  if (!view) return;
  const notice = noticeFor(event, view) ?? undefined;
  await Promise.all([
    view.meta.googleObjectId && googleWalletConfigured()
      ? googleUpdateCard(view, notice).catch((e) => log("Google", e))
      : null,
    applePushSerials([view.card.serial_number]).catch((e) => log("Apple", e)),
  ]);
}

/** Tras cambiar el diseño, la regla o enviar una promoción: todas las tarjetas del negocio. */
export async function syncBusiness(businessId: string, event: "promo" | "design") {
  const views = await getBusinessCardViews(businessId);
  if (views.length === 0) return;

  if (googleWalletConfigured()) {
    if (event === "design") await googleUpdateClass(views[0]).catch((e) => log("Google clase", e));
    const saved = views.filter((v) => v.meta.googleObjectId);
    // De 8 en 8 para no pasarnos con la API de Google
    for (let i = 0; i < saved.length; i += 8) {
      await Promise.all(
        saved.slice(i, i + 8).map((v) =>
          googleUpdateCard(v, event === "promo" ? (noticeFor("promo", v) ?? undefined) : undefined).catch((e) =>
            log("Google", e),
          ),
        ),
      );
    }
  }
  await applePushSerials(views.map((v) => v.card.serial_number)).catch((e) => log("Apple", e));
}
