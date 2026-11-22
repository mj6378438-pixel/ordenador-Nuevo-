/** Tipos y textos compartidos por la página del cliente, Google Wallet y Apple Wallet. */

export type Business = {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  contact_email: string | null;
  logo_url: string | null;
  bg_color: string;
  fg_color: string;
  label_color: string;
  promo_message: string | null;
};

export type Program = {
  reward_type: "one_time" | "permanent";
  visits_required: number;
  discount_percent: number;
  reward_description: string;
};

export type Card = {
  id: string;
  serial_number: string;
  public_token: string;
  visits_total: number;
  visits_current: number;
  rewards_redeemed: number;
};

export type CardView = {
  business: Business;
  program: Program;
  card: Card;
  customerName: string;
};

/** Visitas que cuentan para el descuento según el tipo de premio. */
export function progressVisits(program: Program, card: Card) {
  return program.reward_type === "permanent" ? card.visits_total : card.visits_current;
}

export function hasDiscount(program: Program, card: Card) {
  return progressVisits(program, card) >= program.visits_required;
}

export function visitsRemaining(program: Program, card: Card) {
  return Math.max(0, program.visits_required - progressVisits(program, card));
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** "Te faltan 3 visitas para tu 10% en tu comida" / "¡Tienes un 10%...!" */
export function progressText(program: Program, card: Card): string {
  const reward = `${program.discount_percent}% de descuento ${program.reward_description}`;
  if (hasDiscount(program, card)) {
    return program.reward_type === "permanent"
      ? `Eres cliente VIP: tienes un ${reward} siempre`
      : `¡Tienes un ${reward}! Pídelo al pagar`;
  }
  const left = visitsRemaining(program, card);
  return `Te faltan ${plural(left, "visita", "visitas")} para tu ${reward}`;
}

/** "10 visitas = 10% en tu comida" */
export function ruleText(program: Program): string {
  const reward = `${program.discount_percent}% de descuento ${program.reward_description}`;
  return program.reward_type === "permanent"
    ? `A partir de ${plural(program.visits_required, "visita", "visitas")}, ${reward} para siempre`
    : `Cada ${plural(program.visits_required, "visita", "visitas")}, ${reward}`;
}
