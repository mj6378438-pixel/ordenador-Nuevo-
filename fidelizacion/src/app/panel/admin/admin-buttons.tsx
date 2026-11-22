"use client";
import { useTransition } from "react";
import { adminSubscriptionAction } from "../actions";

type Action = "pay_month" | "extend_trial" | "block" | "unblock";

export function AdminButtons({ businessId, blocked }: { businessId: string; blocked: boolean }) {
  const [pending, start] = useTransition();

  const run = (action: Action, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const r = await adminSubscriptionAction(businessId, action);
      if (!r.ok) window.alert("No se ha podido hacer el cambio.");
    });
  };

  const btn = "rounded-xl border border-line px-3 py-2.5 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button disabled={pending} onClick={() => run("pay_month")} className={`${btn} border-ok/40 text-ok`}>
        + 1 mes pagado
      </button>
      <button disabled={pending} onClick={() => run("extend_trial")} className={btn}>
        + 14 días de prueba
      </button>
      {blocked ? (
        <button disabled={pending} onClick={() => run("unblock")} className={`${btn} col-span-2`}>
          Desbloquear (sin fecha de fin)
        </button>
      ) : (
        <button
          disabled={pending}
          onClick={() => run("block", "¿Bloquear este negocio? Dejará de poder escanear y dar de alta clientes.")}
          className={`${btn} col-span-2 border-accent/40 text-accent`}
        >
          Bloquear
        </button>
      )}
    </div>
  );
}
