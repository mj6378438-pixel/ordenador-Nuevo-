import { describe, expect, it } from "vitest";
import { hasDiscount, progressText, ruleText, visitsRemaining, type Card, type Program } from "@/lib/loyalty";

const card = (visits_total: number, visits_current: number): Card => ({
  id: "c", serial_number: "s", public_token: "t", visits_total, visits_current, rewards_redeemed: 0,
});
const oneTime: Program = { reward_type: "one_time", visits_required: 15, discount_percent: 10, reward_description: "en tu comida" };
const permanent: Program = { ...oneTime, reward_type: "permanent" };

describe("premio de una vez", () => {
  it("cuenta las visitas que faltan", () => {
    expect(visitsRemaining(oneTime, card(12, 12))).toBe(3);
    expect(progressText(oneTime, card(12, 12))).toBe("Te faltan 3 visitas para tu 10% de descuento en tu comida");
    expect(progressText(oneTime, card(14, 14))).toContain("Te faltan 1 visita para");
  });
  it("da el descuento al llegar", () => {
    expect(hasDiscount(oneTime, card(15, 15))).toBe(true);
    expect(progressText(oneTime, card(15, 15))).toBe("¡Tienes un 10% de descuento en tu comida! Pídelo al pagar");
  });
  it("tras canjear, cuenta desde cero aunque el total sea alto", () => {
    expect(hasDiscount(oneTime, card(15, 0))).toBe(false);
    expect(visitsRemaining(oneTime, card(15, 0))).toBe(15);
  });
});

describe("nivel permanente", () => {
  it("usa el total de visitas y no se pierde", () => {
    expect(hasDiscount(permanent, card(20, 0))).toBe(true);
    expect(progressText(permanent, card(20, 0))).toContain("siempre");
  });
});

it("explica la regla", () => {
  expect(ruleText(oneTime)).toBe("Cada 15 visitas, 10% de descuento en tu comida");
  expect(ruleText(permanent)).toBe("A partir de 15 visitas, 10% de descuento en tu comida para siempre");
});
