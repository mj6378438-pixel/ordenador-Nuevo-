"use client";
import Link from "next/link";
import { useActionState } from "react";
import { registerCustomer, type SignupState } from "./actions";

const input =
  "mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent";

export function SignupForm({ slug, businessName }: { slug: string; businessName: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    registerCustomer.bind(null, slug),
    {},
  );
  const v = state.values;

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Nombre</span>
        <input name="name" required autoComplete="given-name" defaultValue={v?.name} className={input} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          defaultValue={v?.email}
          className={input}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">
          Teléfono <span className="font-normal text-muted">(opcional)</span>
        </span>
        <input name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={v?.phone} className={input} />
      </label>

      {/* Campo trampa para robots: invisible para personas */}
      <input name="web" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <label className="flex items-start gap-3 text-sm">
        <input name="privacy" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
        <span>
          He leído y acepto la{" "}
          <Link href={`/c/${slug}/privacidad`} className="underline" target="_blank">
            política de privacidad
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          name="marketing"
          type="checkbox"
          defaultChecked={v?.marketing}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span>Quiero recibir ofertas y novedades de {businessName} por email.</span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-foreground px-5 py-4 text-base font-semibold text-background disabled:opacity-60"
      >
        {pending ? "Creando tu tarjeta…" : "Conseguir mi tarjeta"}
      </button>
    </form>
  );
}
