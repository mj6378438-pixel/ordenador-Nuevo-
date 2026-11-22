import { Suspense } from "react";
import { getCurrentStaff } from "@/lib/auth";
import { signOut } from "@/app/entrar/actions";

export const metadata = { title: "Panel" };

export default function Panel() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <PanelContent />
      </Suspense>
    </main>
  );
}

const roleLabel = { owner: "Dueño", staff: "Personal" } as const;

async function PanelContent() {
  const me = await getCurrentStaff();
  const name = me.memberships[0]?.displayName ?? me.email ?? "";

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Hola,</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{name}</h1>
        </div>
        <form action={signOut}>
          <button className="rounded-xl border border-line px-4 py-2 text-sm font-medium">Salir</button>
        </form>
      </header>

      {me.isPlatformAdmin && (
        <p className="mt-4 inline-block rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
          Superadmin
        </p>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-widest text-muted">Tus negocios</h2>
      {me.memberships.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-surface p-5 text-muted">
          Tu cuenta todavía no está asociada a ningún negocio. Pide al dueño que te dé acceso.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {me.memberships.map((m) => (
            <li key={m.businessId} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-xl font-bold">{m.businessName}</span>
                <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                  {roleLabel[m.role]}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <span className="rounded-xl bg-background px-3 py-3 text-center text-muted">
                  Escanear tarjeta · Fase 5
                </span>
                {m.role === "owner" && (
                  <span className="rounded-xl bg-background px-3 py-3 text-center text-muted">
                    Configurar · Fase 7
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
