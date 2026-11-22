import { expect, it } from "vitest";
import { serviceInfo, type SubscriptionRow } from "@/lib/subscription";

const now = new Date("2026-06-15T12:00:00Z");
const base: SubscriptionRow = {
  subscription_status: "trial", trial_ends_at: "2026-06-20T00:00:00Z", paid_until: null,
  grace_days: 7, is_demo: false, active: true,
};

it("prueba vigente y caducada", () => {
  expect(serviceInfo(base, now)).toMatchObject({ ok: true, label: "En prueba" });
  expect(serviceInfo({ ...base, trial_ends_at: "2026-06-10T00:00:00Z" }, now)).toMatchObject({ ok: false });
});
it("margen de 7 días tras vencer el pago", () => {
  const a = { ...base, subscription_status: "active" as const };
  expect(serviceInfo({ ...a, paid_until: "2026-07-01T00:00:00Z" }, now)).toMatchObject({ ok: true, label: "Al día" });
  expect(serviceInfo({ ...a, paid_until: "2026-06-12T00:00:00Z" }, now)).toMatchObject({ ok: true, label: "Pago pendiente" });
  expect(serviceInfo({ ...a, paid_until: "2026-06-05T00:00:00Z" }, now)).toMatchObject({ ok: false });
  expect(serviceInfo({ ...a, paid_until: null }, now)).toMatchObject({ ok: true, until: null });
});
it("bloqueado y demo", () => {
  expect(serviceInfo({ ...base, subscription_status: "blocked" }, now).ok).toBe(false);
  expect(serviceInfo({ ...base, subscription_status: "blocked", is_demo: true }, now).ok).toBe(true);
});
