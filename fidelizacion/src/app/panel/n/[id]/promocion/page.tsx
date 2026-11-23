import { Suspense } from "react";
import { requireOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { PromoForm } from "./promo-form";

export const metadata = { title: "Promoción" };

export default function Promocion({ params }: PageProps<"/panel/n/[id]/promocion">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/panel/n/[id]/promocion">["params"] }) {
  const { id } = await params;
  await requireOwner(id);
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("promo_message").eq("id", id).single();

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Promoción</h1>
        <p className="mt-1 text-muted">
          El mensaje aparece en la tarjeta del Wallet de todos tus clientes y les llega una notificación al móvil.
        </p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Úsalo con moderación: Google y Apple limitan los avisos y un cliente harto puede borrar la tarjeta.</li>
        <li>El mensaje se queda en la tarjeta hasta que lo cambies o lo quites.</li>
      </ul>
      <PromoForm id={id} current={(data as { promo_message: string | null } | null)?.promo_message ?? null} />
    </div>
  );
}
