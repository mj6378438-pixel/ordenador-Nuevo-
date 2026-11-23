import { Suspense } from "react";
import { requireOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { VisitsChart } from "./visits-chart";

export const metadata = { title: "Resumen" };

type Stats = {
  customers_total: number;
  customers_30d: number;
  marketing_optin: number;
  visits_today: number;
  visits_30d: number;
  redeems_30d: number;
  redeems_total: number;
  with_discount: number;
  visits_by_day: { d: string; n: number }[];
};

export default function Resumen({ params }: PageProps<"/panel/n/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/panel/n/[id]">["params"] }) {
  const { id } = await params;
  const biz = await requireOwner(id);
  const supabase = await createClient();
  const [{ data: stats }, { data: recent }] = await Promise.all([
    supabase.rpc("owner_stats", { p_business: id }),
    supabase
      .from("transactions")
      .select("id, type, created_at, discount_percent, cards ( customers ( name ) )")
      .eq("business_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const s = stats as Stats | null;
  if (!s) return <p className="text-muted">No se han podido cargar los datos.</p>;

  const tiles = [
    { label: "Clientes", value: s.customers_total, sub: `+${s.customers_30d} este mes` },
    { label: "Visitas hoy", value: s.visits_today, sub: `${s.visits_30d} en 30 días` },
    { label: "Descuentos", value: s.redeems_30d, sub: `en 30 días · ${s.redeems_total} en total` },
    { label: "Aceptan ofertas", value: s.marketing_optin, sub: "pueden recibir emails" },
  ];
  type Recent = {
    id: string;
    type: "visit" | "redeem" | "adjust";
    created_at: string;
    discount_percent: number | null;
    cards: { customers: { name: string } | null } | null;
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{biz.name}</h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{t.label}</dt>
            <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums">{t.value}</dd>
            <dd className="text-xs text-muted">{t.sub}</dd>
          </div>
        ))}
      </dl>

      {s.with_discount > 0 && (
        <p className="rounded-2xl bg-ok/10 p-4 text-sm">
          <b className="text-ok">{s.with_discount}</b>{" "}
          {s.with_discount === 1 ? "cliente tiene" : "clientes tienen"} ahora mismo el descuento disponible.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <VisitsChart days={s.visits_by_day} />
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Últimos movimientos</h2>
        {(recent ?? []).length === 0 ? (
          <p className="mt-3 text-muted">Todavía no hay movimientos. Aparecerán al escanear la primera tarjeta.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {(recent as unknown as Recent[]).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 truncate">
                  <b>{r.cards?.customers?.name ?? "Cliente borrado"}</b>{" "}
                  <span className="text-muted">
                    {r.type === "visit" ? "· visita" : r.type === "redeem" ? `· descuento ${r.discount_percent}%` : "· ajuste"}
                  </span>
                </span>
                <time className="shrink-0 tabular-nums text-muted">
                  {new Date(r.created_at).toLocaleString("es-ES", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
