"use client";
import { useActionState, useState } from "react";
import { sendPromo, type FormState } from "../owner-actions";

export function PromoForm({ id, current }: { id: string; current: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendPromo.bind(null, id), {});
  const [text, setText] = useState(current ?? "");

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Mensaje</span>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: Este viernes, 2x1 en cafés de 17 a 19 h"
          className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
        />
        <span className="block text-right text-xs tabular-nums text-muted">{text.length}/200</span>
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-xl bg-ok/10 p-3 text-sm text-ok">{state.ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Enviando…" : "Enviar a todas las tarjetas"}
        </button>
        {current && (
          <button
            name="clear"
            value="1"
            disabled={pending}
            className="rounded-xl border border-line px-5 py-3 font-semibold disabled:opacity-60"
          >
            Quitar mensaje
          </button>
        )}
      </div>
    </form>
  );
}
