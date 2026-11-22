import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, serviceInfo, type SubscriptionRow } from "@/lib/subscription";
import { AdminButtons } from "./admin-buttons";

export const metadata = { title: "Superadmin" };

export default function Admin() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/panel" className="text-sm text-muted">← Panel</Link>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Negocios y pagos</h1>
      <p className="mt-1 text-muted">
        Si un negocio no paga, se bloquea: no puede escanear ni dar de alta clientes. Al marcarlo como
        pagado vuelve a funcionar al instante.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Lista />
      </Suspense>
    </main>
  );
}

type Row = SubscriptionRow & { id: string; name: string; slug: string; created_at: string };

const toneClass = { ok: "text-ok", warn: "text-warn", bad: "text-accent" } as const;

async function Lista() {
  const me = await getCurrentStaff();
  if (!me.isPlatformAdmin) redirect("/panel");

  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, name, slug, created_at, subscription_status, trial_ends_at, paid_until, grace_days, is_demo, active")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  if (rows.length === 0) return <p className="mt-6 text-muted">Todavía no hay negocios.</p>;

  return (
    <ul className="mt-6 space-y-3">
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
            {!b.is_demo && <AdminButtons businessId={b.id} blocked={!s.ok} />}
          </li>
        );
      })}
    </ul>
  );
}
