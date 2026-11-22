"use client";
import { useActionState, useState } from "react";
import { saveCardSettings, type FormState } from "../owner-actions";

export type Settings = {
  name: string;
  legal_name: string | null;
  contact_email: string | null;
  logo_url: string | null;
  bg_color: string;
  fg_color: string;
  label_color: string;
  reward_type: "one_time" | "permanent";
  visits_required: number;
  discount_percent: number;
  reward_description: string;
};

const input = "mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent";
const label = "text-sm font-medium";

export function CardForm({ id, initial }: { id: string; initial: Settings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCardSettings.bind(null, id), {});
  const [s, setS] = useState(initial);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logo_url);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  const reward = `${s.discount_percent}% de descuento ${s.reward_description}`;
  const ruleText =
    s.reward_type === "permanent"
      ? `A partir de ${s.visits_required} visitas, ${reward} para siempre`
      : `Cada ${s.visits_required} visitas, ${reward}`;

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_280px]">
      <form action={action} className="space-y-8">
        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-xl font-bold">Datos del negocio</legend>
          <label className="block">
            <span className={label}>Nombre que verán los clientes</span>
            <input id="name" name="name" required value={s.name} onChange={(e) => set("name", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Logo <span className="font-normal text-muted">(PNG cuadrado, máx. 1 MB)</span></span>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setLogoPreview(URL.createObjectURL(file));
              }}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-foreground file:px-4 file:py-2.5 file:font-semibold file:text-background"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["bg_color", "Fondo"],
                ["fg_color", "Texto"],
                ["label_color", "Etiquetas"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="block">
                <span className={label}>{l}</span>
                <input
                  id={k}
                  name={k}
                  type="color"
                  value={s[k]}
                  onChange={(e) => set(k, e.target.value)}
                  className="mt-1 h-12 w-full cursor-pointer rounded-xl border border-line bg-surface p-1"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-xl font-bold">El premio</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["one_time", "Premio de una vez", "Se aplica y el contador vuelve a empezar"],
                ["permanent", "Nivel permanente", "A partir de N visitas, siempre"],
              ] as const
            ).map(([v, t, d]) => (
              <label
                key={v}
                className={`cursor-pointer rounded-2xl border-2 p-4 ${s.reward_type === v ? "border-accent bg-accent/5" : "border-line bg-surface"}`}
              >
                <input
                  id={`reward_${v}`}
                  type="radio"
                  name="reward_type"
                  value={v}
                  checked={s.reward_type === v}
                  onChange={() => set("reward_type", v)}
                  className="sr-only"
                />
                <span className="block font-semibold">{t}</span>
                <span className="block text-sm text-muted">{d}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Visitas necesarias</span>
              <input id="visits_required" name="visits_required" type="number" min={1} max={1000} required inputMode="numeric"
                value={s.visits_required} onChange={(e) => set("visits_required", Number(e.target.value))} className={input} />
            </label>
            <label className="block">
              <span className={label}>Descuento (%)</span>
              <input id="discount_percent" name="discount_percent" type="number" min={1} max={100} required inputMode="numeric"
                value={s.discount_percent} onChange={(e) => set("discount_percent", Number(e.target.value))} className={input} />
            </label>
          </div>
          <label className="block">
            <span className={label}>¿En qué? <span className="font-normal text-muted">(p. ej. «en tu comida», «en un plato»)</span></span>
            <input id="reward_description" name="reward_description" required maxLength={60}
              value={s.reward_description} onChange={(e) => set("reward_description", e.target.value)} className={input} />
          </label>
          <p className="rounded-xl bg-background p-3 text-sm">Así lo verán: <b>{ruleText}</b></p>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-xl font-bold">Datos legales</legend>
          <p className="text-sm text-muted">Salen en la política de privacidad, para que los clientes puedan pedir que se borren sus datos.</p>
          <label className="block">
            <span className={label}>Razón social <span className="font-normal text-muted">(opcional)</span></span>
            <input id="legal_name" name="legal_name" value={s.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Email de contacto</span>
            <input id="contact_email" name="contact_email" type="email" value={s.contact_email ?? ""}
              onChange={(e) => set("contact_email", e.target.value)} className={input} />
          </label>
        </fieldset>

        {state.error && <p role="alert" className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-xl bg-ok/10 p-3 text-sm text-ok">{state.ok}</p>}

        <button disabled={pending} className="w-full rounded-xl bg-accent px-5 py-4 font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      {/* Vista previa en directo */}
      <aside className="md:sticky md:top-6 md:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Vista previa</p>
        <div className="rounded-3xl p-5 shadow-xl shadow-black/15" style={{ background: s.bg_color, color: s.fg_color }}>
          <div className="flex items-center gap-3">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-lg font-bold" style={{ background: s.fg_color, color: s.bg_color }}>
                {s.name.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 truncate font-display text-lg font-bold">{s.name || "Tu negocio"}</span>
          </div>
          <p className="mt-5 text-xs uppercase tracking-widest" style={{ color: s.label_color }}>Cliente</p>
          <p className="font-semibold">Lucía</p>
          <p className="mt-3 text-xs uppercase tracking-widest" style={{ color: s.label_color }}>Tu premio</p>
          <p className="text-sm">
            Te faltan 3 visitas para tu {reward}
          </p>
          <div className="mx-auto mt-5 grid h-24 w-24 place-items-center rounded-xl bg-white text-[10px] text-black/40">QR</div>
        </div>
      </aside>
    </div>
  );
}
