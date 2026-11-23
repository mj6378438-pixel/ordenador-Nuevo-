import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ENV_CHECKS, isSet } from "@/lib/env";

async function checkSupabase(): Promise<{ ok: boolean; msg: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok: false, msg: "Faltan la URL o la clave pública." };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return { ok: true, msg: "Conectado correctamente." };
    return { ok: false, msg: `Supabase respondió con error ${res.status}. Revisa la URL y la clave.` };
  } catch {
    return { ok: false, msg: "No se pudo conectar. ¿La URL es correcta?" };
  }
}

export default function Estado() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <Link href="/" className="text-sm text-muted">← Inicio</Link>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Estado de la configuración</h1>
      <p className="mt-2 text-muted">
        Aquí ves qué claves están puestas. Nunca se muestran los valores, solo si existen.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Comprobando…</p>}>
        <Comprobaciones />
      </Suspense>
    </main>
  );
}

// Se calcula en cada visita (lee las variables del servidor en el momento).
async function Comprobaciones() {
  await connection();
  const supa = await checkSupabase();
  const fases = [...new Set(ENV_CHECKS.map((c) => c.phase))];

  return (
    <>

      <div className={`mt-6 rounded-2xl border p-4 ${supa.ok ? "border-ok/40" : "border-warn/50"} bg-surface`}>
        <div className="font-semibold">
          {supa.ok ? "✅" : "⚠️"} Conexión con Supabase
        </div>
        <p className="mt-1 text-sm text-muted">{supa.msg}</p>
      </div>

      {fases.map((fase) => (
        <section key={fase} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Necesario a partir de la fase {fase}
          </h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {ENV_CHECKS.filter((c) => c.phase === fase).map((c) => {
              const ok = isSet(c.key);
              return (
                <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{c.label}</div>
                    <code className="block truncate text-xs text-muted">{c.key}</code>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${ok ? "text-ok" : "text-muted"}`}>
                    {ok ? "Puesta" : "Pendiente"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
