"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type CreateState = { ok?: string; error?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const cents = (v: string) => (v === "" ? null : Math.round(Number(v.replace(",", ".")) * 100));

/** Superadmin: da de alta un bar nuevo con su dueño. */
export async function createBusiness(_p: CreateState, f: FormData): Promise<CreateState> {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin !== true) return { error: "Solo los superadmin pueden dar de alta negocios." };

  const name = str(f, "name");
  const slug = str(f, "slug").toLowerCase();
  const ownerName = str(f, "owner_name");
  const ownerEmail = str(f, "owner_email").toLowerCase();
  const password = String(f.get("owner_password") ?? "");
  const trialDays = Number(str(f, "trial_days") || "30");
  const monthly = cents(str(f, "monthly_price"));
  const setup = cents(str(f, "setup_fee"));

  if (name.length < 2) return { error: "Escribe el nombre del negocio." };
  if (!SLUG.test(slug) || slug.length > 50) return { error: "La dirección solo puede llevar minúsculas, números y guiones (ej.: bar-pepe)." };
  if (ownerName.length < 2) return { error: "Escribe el nombre del dueño." };
  if (!EMAIL.test(ownerEmail)) return { error: "El email del dueño no es válido." };
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) return { error: "Días de prueba entre 0 y 365." };
  if ((monthly !== null && (Number.isNaN(monthly) || monthly < 0)) || (setup !== null && (Number.isNaN(setup) || setup < 0))) {
    return { error: "Revisa los precios." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.rpc("user_id_by_email", { p_email: ownerEmail });
  let ownerId = existing as string | null;
  if (!ownerId) {
    if (password.length < 8) return { error: "La contraseña del dueño debe tener al menos 8 caracteres." };
    const { data, error } = await admin.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true });
    if (error || !data.user) return { error: "No se ha podido crear la cuenta del dueño." };
    ownerId = data.user.id;
  }

  const { data, error } = await supabase.rpc("admin_create_business", {
    p_name: name,
    p_slug: slug,
    p_owner: ownerId,
    p_owner_name: ownerName,
    p_trial_days: trialDays,
    p_monthly_price_cents: monthly,
    p_setup_fee_cents: setup,
  });
  const r = data as { ok: boolean; error?: string } | null;
  if (error || !r?.ok) {
    return { error: r?.error === "slug_taken" ? "Esa dirección ya la usa otro negocio. Elige otra." : "No se ha podido crear el negocio." };
  }
  revalidatePath("/panel/admin");
  return {
    ok: existing
      ? `«${name}» creado. ${ownerName} ya tenía cuenta y entra con su contraseña de siempre.`
      : `«${name}» creado. Pásale a ${ownerName} su email y la contraseña para que entre en /entrar.`,
  };
}
