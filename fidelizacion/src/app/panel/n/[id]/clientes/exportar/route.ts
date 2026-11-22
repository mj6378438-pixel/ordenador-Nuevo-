import { isOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";

/** CSV con los clientes que aceptaron recibir ofertas (para enviar emails de marketing). */
export async function GET(_req: Request, ctx: RouteContext<"/panel/n/[id]/clientes/exportar">) {
  const { id } = await ctx.params;
  if (!(await isOwner(id))) return new Response("No tienes permiso.", { status: 403 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("name, email, phone, marketing_opt_in_at, created_at, cards ( visits_total )")
    .eq("business_id", id)
    .eq("marketing_opt_in", true)
    .order("created_at");

  // Evita que Excel interprete celdas como fórmulas
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const rows = (data ?? []) as unknown as {
    name: string; email: string; phone: string | null; marketing_opt_in_at: string | null; created_at: string;
    cards: { visits_total: number } | null;
  }[];
  const csv = [
    ["Nombre", "Email", "Teléfono", "Visitas", "Alta", "Consentimiento ofertas"].map(cell).join(";"),
    ...rows.map((r) =>
      [r.name, r.email, r.phone, r.cards?.visits_total ?? 0, r.created_at.slice(0, 10), r.marketing_opt_in_at?.slice(0, 10)]
        .map(cell)
        .join(";"),
    ),
  ].join("\r\n");

  return new Response("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clientes-ofertas.csv"`,
      "cache-control": "no-store",
    },
  });
}
