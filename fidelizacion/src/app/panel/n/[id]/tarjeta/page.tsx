import { Suspense } from "react";
import { requireOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { CardForm, type Settings } from "./card-form";

export const metadata = { title: "Configurar tarjeta" };

export default function Tarjeta({ params }: PageProps<"/panel/n/[id]/tarjeta">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/panel/n/[id]/tarjeta">["params"] }) {
  const { id } = await params;
  await requireOwner(id);
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "name, legal_name, contact_email, logo_url, bg_color, fg_color, label_color, loyalty_programs ( reward_type, visits_required, discount_percent, reward_description )",
    )
    .eq("id", id)
    .single();
  const { loyalty_programs, ...b } = data as unknown as Omit<Settings, "reward_type" | "visits_required" | "discount_percent" | "reward_description"> & {
    loyalty_programs: Pick<Settings, "reward_type" | "visits_required" | "discount_percent" | "reward_description">;
  };
  const program = Array.isArray(loyalty_programs) ? loyalty_programs[0] : loyalty_programs;

  return (
    <>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight">Tu tarjeta</h1>
      <CardForm id={id} initial={{ ...b, ...program }} />
    </>
  );
}
