/** Estado de la suscripción de un negocio (misma regla que service_until() en la base de datos). */

export type SubscriptionRow = {
  subscription_status: "trial" | "active" | "past_due" | "blocked" | "cancelled";
  trial_ends_at: string;
  paid_until: string | null;
  grace_days: number;
  is_demo: boolean;
  active: boolean;
};

export type ServiceInfo = {
  ok: boolean;
  /** Fecha en la que se corta el servicio (null = sin fecha) */
  until: Date | null;
  label: string;
  tone: "ok" | "warn" | "bad";
};

const DAY = 86_400_000;

export function serviceInfo(b: SubscriptionRow, now = new Date()): ServiceInfo {
  if (!b.active) return { ok: false, until: null, label: "Desactivado", tone: "bad" };
  if (b.is_demo) return { ok: true, until: null, label: "Demo", tone: "ok" };

  let until: Date | null;
  switch (b.subscription_status) {
    case "trial":
      until = new Date(b.trial_ends_at);
      break;
    case "active":
    case "past_due":
      until = b.paid_until ? new Date(new Date(b.paid_until).getTime() + b.grace_days * DAY) : null;
      break;
    default:
      return { ok: false, until: null, label: b.subscription_status === "blocked" ? "Bloqueado" : "Cancelado", tone: "bad" };
  }

  const ok = until === null || now < until;
  if (!ok) return { ok, until, label: "Bloqueado por impago", tone: "bad" };
  if (b.subscription_status === "trial") return { ok, until, label: "En prueba", tone: "warn" };
  const paidUntil = b.paid_until ? new Date(b.paid_until) : null;
  if (paidUntil && now > paidUntil) return { ok, until, label: "Pago pendiente", tone: "warn" };
  return { ok, until, label: "Al día", tone: "ok" };
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
