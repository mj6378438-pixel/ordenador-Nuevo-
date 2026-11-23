import type { CardView } from "@/lib/loyalty";

/** Tarjeta de ejemplo para las pruebas. */
export const view: CardView = {
  business: {
    id: "11111111-2222-3333-4444-555555555555", slug: "cafe", name: "Café La Esquina",
    legal_name: null, contact_email: null, logo_url: null,
    bg_color: "#3b2a20", fg_color: "#f7efe6", label_color: "#d9c7b3", promo_message: "2x1 los martes",
  },
  program: { reward_type: "one_time", visits_required: 10, discount_percent: 10, reward_description: "en tu comida" },
  card: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", serial_number: "9f8e7d6c-1111-2222-3333-444444444444",
    public_token: "TOKEN_OPACO", visits_total: 7, visits_current: 7, rewards_redeemed: 0,
  },
  customerName: "Lucía",
};
