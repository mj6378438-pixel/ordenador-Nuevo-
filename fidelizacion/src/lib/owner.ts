import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type OwnedBusiness = { id: string; name: string; slug: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Para páginas: el usuario debe ser dueño de ese negocio (o superadmin). */
export async function requireOwner(businessId: string): Promise<OwnedBusiness> {
  if (!UUID.test(businessId)) notFound();
  const me = await getCurrentStaff();
  const m = me.memberships.find((x) => x.businessId === businessId && x.role === "owner");
  if (m) return { id: m.businessId, name: m.businessName, slug: m.slug };
  if (me.isPlatformAdmin) {
    const supabase = await createClient();
    const { data } = await supabase.from("businesses").select("id, name, slug").eq("id", businessId).maybeSingle();
    if (data) return data as OwnedBusiness;
    notFound();
  }
  redirect("/panel");
}

/** Para acciones del servidor: comprueba en la base de datos que es dueño. */
export async function isOwner(businessId: string): Promise<boolean> {
  if (!UUID.test(businessId)) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_owner_of", { b: businessId });
  return data === true;
}
