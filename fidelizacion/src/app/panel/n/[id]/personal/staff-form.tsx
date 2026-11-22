"use client";
import { useActionState } from "react";
import { addStaff, type FormState } from "../owner-actions";

const input = "mt-1 w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent";

export function StaffForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addStaff.bind(null, id), {});
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-bold">Añadir a alguien</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Nombre</span>
          <input id="staff_name" name="name" required className={input} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input id="staff_email" name="email" type="email" required inputMode="email" className={input} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Contraseña inicial</span>
          <input id="staff_password" name="password" type="text" minLength={8} autoComplete="off" className={input} />
          <span className="mt-1 block text-xs text-muted">Mínimo 8 caracteres. No hace falta si ya tiene cuenta.</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Permisos</span>
          <select id="staff_role" name="role" className={input} defaultValue="staff">
            <option value="staff">Personal: solo escanear</option>
            <option value="owner">Dueño: todo el panel</option>
          </select>
        </label>
      </div>
      {state.error && <p role="alert" className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-xl bg-ok/10 p-3 text-sm text-ok">{state.ok}</p>}
      <button disabled={pending} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink disabled:opacity-60">
        {pending ? "Creando…" : "Dar acceso"}
      </button>
    </form>
  );
}
