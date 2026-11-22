"use server";
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
  | { ok: false; error: "not_found" | "rate_limited" | "session" | "unknown" };

export type RedeemResult =
  | {
      ok: true;
      applied_percent: number;
      reward_type: "one_time" | "permanent";
      visits_total: number;
      visits_current: number;
      visits_remaining: number;
    }
  | { ok: false; error: "no_reward" | "not_found" | "session" | "unknown" };

/** Escanear = buscar la tarjeta y sumar la visita del día (si no la tenía ya). */
export async function scanAction(token: string): Promise<ScanResult> {
  if (!token || token.length > 100) return { ok: false, error: "not_found" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, error: "session" };

  const { data, error } = await supabase.rpc("scan_and_visit", { p_token: token.trim() });
  if (error || !data) return { ok: false, error: "unknown" };
  return data as ScanResult;
}

/** Aplicar el descuento (en premio de una vez, el contador vuelve a empezar). */
export async function redeemAction(cardId: string): Promise<RedeemResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, error: "session" };

  const { data, error } = await supabase.rpc("redeem_reward", { p_card_id: cardId });
  if (error || !data) return { ok: false, error: "unknown" };
  return data as RedeemResult;
}
