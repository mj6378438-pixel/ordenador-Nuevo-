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

const CARD_COLS =
  "id, business_id, serial_number, public_token, visits_total, visits_current, rewards_redeemed, google_object_id, updated_at, customers ( name )";

type CardRow = CardView["card"] & {
  business_id: string;
  google_object_id: string | null;
  updated_at: string;
  customers: { name: string } | null;
};

async function businessWithProgram(businessId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("businesses")
    .select(`${BUSINESS_COLS}, loyalty_programs ( ${PROGRAM_COLS} )`)
    .eq("id", businessId)
    .maybeSingle();
  if (!data) return null;
  const { loyalty_programs, ...business } = data as unknown as Business & {
    loyalty_programs: Program | Program[] | null;
  };
  const program = Array.isArray(loyalty_programs) ? loyalty_programs[0] : loyalty_programs;
  return program ? { business: business as Business, program } : null;
}

const toView = (pub: { business: Business; program: Program }, row: CardRow): CardView & { meta: CardMeta } => {
  const { customers, business_id, google_object_id, updated_at, ...card } = row;
  return {
    ...pub,
    card,
    customerName: customers?.name ?? "",
    meta: { businessId: business_id, googleObjectId: google_object_id, updatedAt: updated_at },
  };
};

export type CardMeta = { businessId: string; googleObjectId: string | null; updatedAt: string };

/** Tarjeta completa por su id interno (solo servidor). */
export async function getCardViewById(cardId: string) {
  const db = createAdminClient();
  const { data } = await db.from("cards").select(CARD_COLS).eq("id", cardId).maybeSingle();
  if (!data) return null;
  const row = data as unknown as CardRow;
  const pub = await businessWithProgram(row.business_id);
  return pub ? toView(pub, row) : null;
}

/** Tarjeta completa por su número de serie de Apple (solo servidor). */
export async function getCardViewBySerial(serial: string) {
  const db = createAdminClient();
  const { data } = await db.from("cards").select(CARD_COLS).eq("serial_number", serial).maybeSingle();
  if (!data) return null;
  const row = data as unknown as CardRow;
  const pub = await businessWithProgram(row.business_id);
  return pub ? toView(pub, row) : null;
}

/** Todas las tarjetas de un negocio (para promociones y cambios de diseño). */
export async function getBusinessCardViews(businessId: string) {
  const pub = await businessWithProgram(businessId);
  if (!pub) return [];
  const db = createAdminClient();
  const rows: CardRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("cards")
      .select(CARD_COLS)
      .eq("business_id", businessId)
      .order("created_at")
      .range(from, from + 999);
    const page = (data ?? []) as unknown as CardRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows.map((r) => toView(pub, r));
}
