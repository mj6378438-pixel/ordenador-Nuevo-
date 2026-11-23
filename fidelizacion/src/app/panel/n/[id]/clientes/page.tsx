import { Suspense } from "react";
import { requireOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "../confirm-button";
import { deleteCustomer } from "../owner-actions";

export const metadata = { title: "Clientes" };

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  cards: { visits_total: number; visits_current: number; rewards_redeemed: number; last_visit_on: string | null } | null;
};

export default function Clientes({ params, searchParams }: PageProps<"/panel/n/[id]/clientes">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando…</p>}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({
  params,
  searchParams,
}: Pick<PageProps<"/panel/n/[id]/clientes">, "params" | "searchParams">) {
  const { id } = await params;
  const { q } = await searchParams;
  await requireOwner(id);
  const search = typeof q === "string" ? q.trim().slice(0, 60) : "";

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, name, email, phone, marketing_opt_in, created_at, cards ( visits_total, visits_current, rewards_redeemed, last_visit_on )", { count: "exact" })
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (search) {
    const safe = search.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted">{count ?? 0} {search ? "encontrados" : "en total"}</p>
        </div>
        <a
          href={`/panel/n/${id}/clientes/exportar`}
          className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold"
        >
          Descargar emails para ofertas (CSV)
        </a>
      </div>
      <p className="text-sm text-muted">
        El archivo solo incluye a quien marcó la casilla de ofertas: es a quien podéis escribir por email.
      </p>

      <form className="flex gap-2" role="search">
        <input
          id="q"
          name="q"
          defaultValue={search}
          placeholder="Buscar por nombre, email o teléfono"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <button className="rounded-xl bg-foreground px-4 font-semibold text-background">Buscar</button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-muted">
          {search ? "No hay clientes con esa búsqueda." : "Aún no hay clientes. Aparecerán cuando escaneen el QR del mostrador."}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{c.name}</p>
                <p className="truncate text-sm text-muted">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                  {c.marketing_opt_in ? " · acepta ofertas" : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-right text-sm tabular-nums">
                  <b>{c.cards?.visits_total ?? 0}</b> visitas
                  <span className="block text-xs text-muted">
                    {c.cards?.rewards_redeemed ?? 0} {c.cards?.rewards_redeemed === 1 ? "descuento" : "descuentos"}
                  </span>
                </span>
                <ConfirmButton
                  danger
                  label="Borrar"
                  confirmLabel="Borrar todo"
                  run={deleteCustomer.bind(null, id, c.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        «Borrar» elimina al cliente, su tarjeta y su historial (derecho de supresión del RGPD). No se puede deshacer.
      </p>
    </div>
  );
}
