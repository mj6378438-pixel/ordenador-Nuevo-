import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, serviceInfo, type SubscriptionRow } from "@/lib/subscription";
import { AdminButtons } from "./admin-buttons";
import { CreateBusinessForm } from "./create-form";

export const metadata = { title: "Superadmin" };

export default function Admin() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/panel" className="text-sm text-muted">
        ← Panel
      </Link>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Negocios y pagos</h1>
      <p className="mt-1 text-muted">
        Si un negocio no paga, se bloquea: no puede escanear ni dar de alta clientes. Al marcarlo como pagado
        vuelve a funcionar al instante.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Lista />
      </Suspense>
    </main>
  );
}

type Row = SubscriptionRow & {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  monthly_price_cents: number | null;
  setup_fee_cents: number | null;
};

const eur = (c: number | null) =>
  c == null
    ? "—"
    : (c / 100).toLocaleString("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: c % 100 ? 2 : 0,
      });

const toneClass = { ok: "text-ok", warn: "text-warn", bad: "text-accent" } as const;

async function Lista() {
  const me = await getCurrentStaff();
  if (!me.isPlatformAdmin) redirect("/panel");

  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, created_at, subscription_status, trial_ends_at, paid_until, grace_days, is_demo, active, monthly_price_cents, setup_fee_cents",
    )
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const real = rows.filter((b) => !b.is_demo);
  const paying = real.filter((b) => serviceInfo(b).label === "Al día");
  const mrr = paying.reduce((sum, b) => sum + (b.monthly_price_cents ?? 0), 0);
  const tiles = [
    { label: "Negocios", value: String(real.length) },
    { label: "Pagando", value: String(paying.length) },
    { label: "En prueba", value: String(real.filter((b) => serviceInfo(b).label === "En prueba").length) },
    { label: "Ingresos al mes", value: eur(mrr) },
  ];

  return (
    <div className="mt-6 space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{t.label}</dt>
            <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>
      <CreateBusinessForm />
      {rows.length === 0 && <p className="text-muted">Todavía no hay negocios.</p>}
      <ul className="space-y-3">
        {rows.map((b) => {
          const s = serviceInfo(b);
          return (
            <li key={b.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-bold">{b.name}</p>
                  <p className="text-xs text-muted">/c/{b.slug}</p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${toneClass[s.tone]}`}>{s.label}</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {b.is_demo
                  ? "Negocio de demostración: no caduca."
                  : s.until
                    ? `${s.ok ? "Funciona hasta el" : "Cortado desde el"} ${fmtDate(s.until)}${
                        b.subscription_status !== "trial" ? ` (incluye ${b.grace_days} días de margen)` : ""
                      }.`
                    : s.ok
                      ? "Activo sin fecha de fin."
                      : ""}
              </p>
              {!b.is_demo && (
                <p className="mt-1 text-sm tabular-nums text-muted">
                  Cuota: <b className="text-foreground">{eur(b.monthly_price_cents)}/mes</b> · Alta:{" "}
                  {eur(b.setup_fee_cents)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Link href={`/panel/n/${b.id}`} className="rounded-xl bg-background px-3 py-2 font-semibold">
                  Ver panel del negocio →
                </Link>
              </div>
              {!b.is_demo && <AdminButtons businessId={b.id} blocked={!s.ok} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
