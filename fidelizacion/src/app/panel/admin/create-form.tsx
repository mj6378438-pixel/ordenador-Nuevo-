"use client";
import { useActionState, useState } from "react";
import { createBusiness, type CreateState } from "./actions";

const input = "mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

export function CreateBusinessForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createBusiness, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <details className="rounded-2xl border border-line bg-surface p-5" open={!!state.error}>
      <summary className="cursor-pointer font-display text-xl font-bold">+ Dar de alta un negocio</summary>
      <form action={action} className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Nombre del negocio</span>
            <input id="biz_name" name="name" required value={name} className={input}
              onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(toSlug(e.target.value)); }} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Dirección del QR</span>
            <input id="biz_slug" name="slug" required value={slug} className={input}
              onChange={(e) => { setSlugTouched(true); setSlug(toSlug(e.target.value)); }} />
            <span className="mt-1 block text-xs text-muted">…/c/{slug || "nombre-del-bar"} · no se puede cambiar después</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Nombre del dueño</span>
            <input id="owner_name" name="owner_name" required className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email del dueño</span>
            <input id="owner_email" name="owner_email" type="email" required inputMode="email" className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Contraseña inicial del dueño</span>
            <input id="owner_password" name="owner_password" type="text" minLength={8} autoComplete="off" className={input} />
            <span className="mt-1 block text-xs text-muted">Mínimo 8 caracteres. No hace falta si ya tiene cuenta.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Días de prueba gratis</span>
            <input id="trial_days" name="trial_days" type="number" min={0} max={365} defaultValue={30} inputMode="numeric" className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Cuota mensual (€)</span>
            <input id="monthly_price" name="monthly_price" inputMode="decimal" defaultValue="100" className={input} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Cuota de alta (€)</span>
            <input id="setup_fee" name="setup_fee" inputMode="decimal" placeholder="0" className={input} />
          </label>
        </div>
        {state.error && <p role="alert" className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-xl bg-ok/10 p-3 text-sm text-ok">{state.ok}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-accent px-5 py-3.5 font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Creando…" : "Crear negocio"}
        </button>
      </form>
    </details>
  );
}
