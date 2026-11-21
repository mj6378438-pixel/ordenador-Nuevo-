import Link from "next/link";
import { appName } from "@/lib/env";

const pasos = [
  { n: "1", t: "Escanea el QR", d: "El cliente escanea el código del mostrador con la cámara." },
  { n: "2", t: "Añade la tarjeta", d: "Va directa a Apple Wallet o Google Wallet. Sin descargar apps." },
  { n: "3", t: "Suma con cada compra", d: "El dependiente escanea la tarjeta y la actualiza al momento." },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-14">
      <header className="flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight">{appName}</span>
        <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
          Versión en construcción · Fase 1
        </span>
      </header>

      <section className="mt-10 grid items-center gap-10 sm:mt-16 sm:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            La tarjeta de sellos,
            <br />
            <span className="text-accent">ahora en el móvil.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Tus clientes guardan su tarjeta de puntos en Apple Wallet o Google Wallet y se
            actualiza sola cada vez que compran.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/estado"
              className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink"
            >
              Ver estado de la configuración
            </Link>
          </div>
        </div>

        {/* Maqueta de la tarjeta tal y como se verá en el Wallet */}
        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-3xl bg-[#3b2a20] p-6 text-[#f7efe6] shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-bold">Café La Esquina</span>
              <span className="text-xs uppercase tracking-widest opacity-70">Sellos</span>
            </div>
            <div className="mt-6 grid grid-cols-5 gap-2" aria-label="7 de 10 sellos">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-full border-2 border-[#f7efe6]/60 ${
                    i < 7 ? "bg-[#f7efe6]" : ""
                  }`}
                />
              ))}
            </div>
            <div className="mt-6 flex items-end justify-between text-sm">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-70">Cliente</div>
                <div className="font-semibold">Lucía</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest opacity-70">Próximo premio</div>
                <div className="font-semibold">Faltan 3 · Café gratis</div>
              </div>
            </div>
            <div className="mx-auto mt-6 grid h-28 w-28 place-items-center rounded-xl bg-white text-[10px] text-black/50">
              código QR
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {pasos.map((p) => (
          <div key={p.n} className="rounded-2xl border border-line bg-surface p-5">
            <div className="font-display text-3xl font-extrabold text-accent">{p.n}</div>
            <div className="mt-2 font-semibold">{p.t}</div>
            <p className="mt-1 text-sm text-muted">{p.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
