"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { syncCard } from "@/lib/wallet/sync";
import { createClient } from "@/lib/supabase/server";

export type ScanResult =
  | {
      ok: true;
      card_id: string;
      customer_name: string;
      business_name: string;
      visit_added: boolean;
      just_unlocked: boolean;
      has_discount: boolean;
      reward_type: "one_time" | "permanent";
      visits_total: number;
      visits_current: number;
      visits_required: number;
      visits_remaining: number;
      discount_percent: number;
      reward_description: string;
    }
  | { ok: false; error: "not_found" | "rate_limited" | "suspended" | "session" | "unknown" };

export type RedeemResult =
  | {
      ok: true;
      applied_percent: number;
      reward_type: "one_time" | "permanent";
      visits_total: number;
      visits_current: number;
      visits_remaining: number;
    }
  | { ok: false; error: "no_reward" | "not_found" | "suspended" | "session" | "unknown" };

/** Escanear = buscar la tarjeta y sumar la visita del día (si no la tenía ya). */
export async function scanAction(token: string): Promise<ScanResult> {
  if (!token || token.length > 100) return { ok: false, error: "not_found" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, error: "session" };

  const { data, error } = await supabase.rpc("scan_and_visit", { p_token: token.trim() });
  if (error || !data) return { ok: false, error: "unknown" };
  const result = data as ScanResult;
  // Actualiza el Wallet del cliente después de responder (no hace esperar al camarero)
  if (result.ok && result.visit_added) after(() => syncCard(result.card_id, "visit"));
  return result;
}

/** Aplicar el descuento (en premio de una vez, el contador vuelve a empezar). */
export async function redeemAction(cardId: string): Promise<RedeemResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, error: "session" };

  const { data, error } = await supabase.rpc("redeem_reward", { p_card_id: cardId });
  if (error || !data) return { ok: false, error: "unknown" };
  const result = data as RedeemResult;
  if (result.ok) after(() => syncCard(cardId, "redeem"));
  return result;
}

/** Acciones del superadmin sobre la suscripción de un negocio. */
export async function adminSubscriptionAction(
  businessId: string,
  action: "pay_month" | "extend_trial" | "block" | "unblock",
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_subscription", {
    p_business: businessId,
    p_action: action,
  });
  if (error || !(data as { ok?: boolean } | null)?.ok) {
    return { ok: false as const };
  }
  revalidatePath("/panel/admin");
  return { ok: true as const };
}
