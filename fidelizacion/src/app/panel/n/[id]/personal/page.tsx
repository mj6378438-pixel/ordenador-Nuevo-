import { Suspense } from "react";
import { requireOwner } from "@/lib/owner";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "../confirm-button";
import { setStaffActive } from "../owner-actions";
import { StaffForm } from "./staff-form";

export const metadata = { title: "Personal" };

export default function Personal({ params }: PageProps<"/panel/n/[id]/personal">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/panel/n/[id]/personal">["params"] }) {
  const { id } = await params;
  await requireOwner(id);
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_users")
    .select("user_id, display_name, role, active, created_at")
    .eq("business_id", id)
    .order("created_at");
  const staff = (data ?? []) as { user_id: string; display_name: string; role: "owner" | "staff"; active: boolean }[];

  // Emails (están en Supabase Auth, solo accesibles desde el servidor)
  const admin = createAdminClient();
  const emails = new Map(
    await Promise.all(
      staff.map(async (s) => [s.user_id, (await admin.auth.admin.getUserById(s.user_id)).data.user?.email ?? ""] as const),
    ),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Personal</h1>
        <p className="text-sm text-muted">Quién puede escanear tarjetas en tu negocio. Cada uno entra con su email y contraseña.</p>
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {staff.map((s) => (
          <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className={`font-semibold ${s.active ? "" : "text-muted line-through"}`}>{s.display_name}</p>
              <p className="truncate text-sm text-muted">
                {emails.get(s.user_id)} · {s.role === "owner" ? "Dueño" : "Personal"}
                {s.active ? "" : " · sin acceso"}
              </p>
            </div>
            <ConfirmButton
              danger={s.active}
              label={s.active ? "Quitar acceso" : "Devolver acceso"}
              confirmLabel={s.active ? "Sí, quitar" : "Sí, devolver"}
              run={setStaffActive.bind(null, id, s.user_id, !s.active)}
            />
          </li>
        ))}
      </ul>
      <StaffForm id={id} />
    </div>
  );
}
