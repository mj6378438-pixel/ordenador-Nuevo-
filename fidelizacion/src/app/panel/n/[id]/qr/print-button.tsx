"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink">
      Imprimir cartel
    </button>
  );
}
