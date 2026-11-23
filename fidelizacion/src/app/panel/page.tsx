import { Suspense } from "react";
import { getCurrentStaff } from "@/lib/auth";
import Link from "next/link";
import { signOut } from "@/app/entrar/actions";
import { InstallApp } from "@/components/install-app";
import { fmtDate } from "@/lib/subscription";

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
        <Link
          href="/panel/admin"
          className="mt-4 flex items-center justify-between rounded-2xl bg-foreground px-5 py-4 font-semibold text-background"
        >
          Superadmin · negocios y pagos <span aria-hidden>→</span>
        </Link>
      )}

      {me.memberships.map((m) =>
        !m.service.ok ? (
          <div key={m.businessId} className="mt-4 rounded-2xl border-2 border-accent bg-accent/10 p-5">
            <p className="font-semibold text-accent">Servicio suspendido · {m.businessName}</p>
            <p className="mt-1 text-sm">
              Hay un pago pendiente. No se pueden escanear tarjetas ni dar de alta clientes hasta
              regularizarlo. Las tarjetas de tus clientes no se pierden.
            </p>
          </div>
        ) : m.service.tone === "warn" && m.role === "owner" && m.service.until ? (
          <div key={m.businessId} className="mt-4 rounded-2xl border border-warn/50 bg-warn/10 p-4 text-sm">
            {m.service.label === "En prueba"
              ? `Periodo de prueba gratis de ${m.businessName} hasta el ${fmtDate(m.service.until)}.`
              : `Pago pendiente en ${m.businessName}. El servicio se cortará el ${fmtDate(m.service.until)}.`}
          </div>
        ) : null,
      )}

      {me.memberships.some((m) => m.service.ok) && (
        <Link
          href="/panel/escanear"
          className="mt-6 flex items-center justify-center gap-3 rounded-3xl bg-accent px-6 py-7 font-display text-2xl font-extrabold text-accent-ink shadow-lg shadow-accent/25"
        >
          <span aria-hidden>📷</span> Escanear tarjeta
        </Link>
      )}

      <div className="mt-4">
        <InstallApp compact />
      </div>

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
              {m.role === "owner" && (
                <Link
                  href={`/panel/n/${m.businessId}`}
                  className="mt-4 flex items-center justify-between rounded-xl bg-background px-4 py-3 text-sm font-semibold"
                >
                  Gestionar: tarjeta, clientes, personal, promociones y QR <span aria-hidden>→</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
