"use client";
import { useState, useTransition } from "react";
import type { FormState } from "./owner-actions";

/** Botón con confirmación en dos pasos (sin ventanas emergentes) y mensaje del resultado. */
export function ConfirmButton({
  run,
  label,
  confirmLabel,
  danger = false,
}: {
  run: () => Promise<FormState>;
  label: string;
  confirmLabel: string;
  danger?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<FormState | null>(null);
  const [pending, start] = useTransition();
  const base = "rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

  if (result?.error) return <span className="text-sm text-accent">{result.error}</span>;
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={`${base} border border-line ${danger ? "text-accent" : ""}`}>
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await run()))}
        className={`${base} ${danger ? "bg-accent text-accent-ink" : "bg-foreground text-background"}`}
      >
        {pending ? "…" : confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={`${base} text-muted`}>
        Cancelar
      </button>
    </span>
  );
}
