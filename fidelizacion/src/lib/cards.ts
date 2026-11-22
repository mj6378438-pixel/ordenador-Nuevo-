import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { Business, CardView, Program } from "@/lib/loyalty";

/** Cookie del móvil del cliente que recuerda su tarjeta en ese negocio. */
export const cardCookie = (slug: string) => `tarjeta_${slug}`;

const BUSINESS_COLS =
  "id, slug, name, legal_name, contact_email, logo_url, bg_color, fg_color, label_color, promo_message";
const PROGRAM_COLS = "reward_type, visits_required, discount_percent, reward_description";

/** Negocio activo y su regla, para la página pública. Null si no existe. */
export async function getPublicBusiness(slug: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("businesses")
    .select(`${BUSINESS_COLS}, loyalty_programs ( ${PROGRAM_COLS} )`)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  const { loyalty_programs, ...business } = data as unknown as Business & {
    loyalty_programs: Program | Program[] | null;
  };
  const program = Array.isArray(loyalty_programs) ? loyalty_programs[0] : loyalty_programs;
  if (!program) return null;
  return { business: business as Business, program };
}

/** Tarjeta por su token del QR, comprobando que es de ese negocio. */
export async function getCardByToken(slug: string, token: string): Promise<CardView | null> {
  const pub = await getPublicBusiness(slug);
  if (!pub) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("cards")
    .select("id, serial_number, public_token, visits_total, visits_current, rewards_redeemed, customers ( name )")
    .eq("public_token", token)
    .eq("business_id", pub.business.id)
    .maybeSingle();
  if (!data) return null;
  const { customers, ...card } = data as unknown as CardView["card"] & {
    customers: { name: string } | null;
  };
  return { ...pub, card, customerName: customers?.name ?? "" };
}
