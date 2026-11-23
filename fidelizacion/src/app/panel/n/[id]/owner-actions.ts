"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { isOwner } from "@/lib/owner";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { googleDeactivateCard } from "@/lib/wallet/google-api";
import { syncBusiness } from "@/lib/wallet/sync";

export type FormState = { ok?: string; error?: string };

const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Apunta en el registro de auditoría quién hizo qué (se escribe desde el servidor). */
async function audit(entry: { business_id: string; action: string; entity_id?: string | null; details?: object }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  await createAdminClient()
    .from("audit_log")
    .insert({ ...entry, actor_user_id: data?.claims?.sub ?? null });
}

// ─── Configuración de la tarjeta ────────────────────────────────────
export async function saveCardSettings(id: string, _p: FormState, f: FormData): Promise<FormState> {
  if (!(await isOwner(id))) return { error: "No tienes permiso para cambiar este negocio." };

  const name = str(f, "name");
  const colors = { bg_color: str(f, "bg_color"), fg_color: str(f, "fg_color"), label_color: str(f, "label_color") };
  const contact = str(f, "contact_email");
  const legal = str(f, "legal_name");
  const rewardType = str(f, "reward_type");
  const visits = Number(str(f, "visits_required"));
  const percent = Number(str(f, "discount_percent"));
  const description = str(f, "reward_description");

  if (name.length < 2 || name.length > 80) return { error: "Escribe el nombre del negocio." };
  if (!Object.values(colors).every((c) => HEX.test(c))) return { error: "Algún color no es válido." };
  if (contact && !EMAIL.test(contact)) return { error: "El email de contacto no es válido." };
  if (rewardType !== "one_time" && rewardType !== "permanent") return { error: "Elige el tipo de premio." };
  if (!Number.isInteger(visits) || visits < 1 || visits > 1000) return { error: "Las visitas deben ser un número entre 1 y 1000." };
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return { error: "El descuento debe estar entre 1 y 100 %." };
  if (description.length < 2 || description.length > 60) return { error: "Describe el premio (p. ej. «en tu comida»)." };

  // Logo (opcional)
  let logoUrl: string | undefined;
  const logo = f.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg"].includes(logo.type)) return { error: "El logo tiene que ser PNG o JPG." };
    if (logo.size > 1_000_000) return { error: "El logo pesa demasiado (máximo 1 MB)." };
    const admin = createAdminClient();
    const path = `${id}/${Date.now()}.${logo.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await admin.storage.from("logos").upload(path, logo, { contentType: logo.type });
    if (error) return { error: "No se ha podido subir el logo. Inténtalo de nuevo." };
    logoUrl = admin.storage.from("logos").getPublicUrl(path).data.publicUrl;
  }

  const supabase = await createClient();
  const { error: e1 } = await supabase
    .from("businesses")
    .update({ name, ...colors, contact_email: contact || null, legal_name: legal || null, ...(logoUrl ? { logo_url: logoUrl } : {}) })
    .eq("id", id);
  const { error: e2 } = await supabase
    .from("loyalty_programs")
    .update({ reward_type: rewardType, visits_required: visits, discount_percent: percent, reward_description: description, updated_at: new Date().toISOString() })
    .eq("business_id", id);
  if (e1 || e2) return { error: "No se han podido guardar los cambios." };

  after(() => syncBusiness(id, "design"));
  revalidatePath(`/panel/n/${id}`, "layout");
  return { ok: "Guardado. Las tarjetas de tus clientes se están actualizando." };
}

// ─── Promoción a todas las tarjetas ─────────────────────────────────
export async function sendPromo(id: string, _p: FormState, f: FormData): Promise<FormState> {
  if (!(await isOwner(id))) return { error: "No tienes permiso." };
  const clear = f.get("clear") === "1";
  const message = str(f, "message");
  if (!clear && (message.length < 3 || message.length > 200)) {
    return { error: "Escribe un mensaje de entre 3 y 200 caracteres." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("businesses").update({ promo_message: clear ? null : message }).eq("id", id);
  if (error) return { error: "No se ha podido guardar el mensaje." };
  await audit({ business_id: id, action: clear ? "promo.clear" : "promo.send" });

  after(() => syncBusiness(id, clear ? "design" : "promo"));
  revalidatePath(`/panel/n/${id}/promocion`);
  return { ok: clear ? "Mensaje quitado de las tarjetas." : "Enviado. Tus clientes lo recibirán en unos minutos." };
}

// ─── Clientes ───────────────────────────────────────────────────────
export async function deleteCustomer(id: string, customerId: string): Promise<FormState> {
  if (!(await isOwner(id))) return { error: "No tienes permiso." };
  const supabase = await createClient();
  const { data: card } = await supabase
    .from("cards")
    .select("id, google_object_id")
    .eq("customer_id", customerId)
    .eq("business_id", id)
    .maybeSingle();
  if (card?.google_object_id) await googleDeactivateCard(card.id).catch(() => {});

  const { error } = await supabase.from("customers").delete().eq("id", customerId).eq("business_id", id);
  if (error) return { error: "No se ha podido borrar." };
  await audit({ business_id: id, action: "customer.delete", entity_id: customerId });
  revalidatePath(`/panel/n/${id}/clientes`);
  return { ok: "Cliente y todos sus datos borrados." };
}

// ─── Personal ───────────────────────────────────────────────────────
export async function addStaff(id: string, _p: FormState, f: FormData): Promise<FormState> {
  if (!(await isOwner(id))) return { error: "No tienes permiso." };
  const name = str(f, "name");
  const email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  const role = str(f, "role") === "owner" ? "owner" : "staff";
  if (name.length < 2) return { error: "Escribe el nombre." };
  if (!EMAIL.test(email)) return { error: "El email no es válido." };

  const admin = createAdminClient();
  const { data: existing } = await admin.rpc("user_id_by_email", { p_email: email });
  let userId = existing as string | null;
  if (!userId) {
    if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return { error: "No se ha podido crear la cuenta." };
    userId = data.user.id;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_users")
    .upsert({ business_id: id, user_id: userId, role, display_name: name, active: true });
  if (error) return { error: "No se ha podido dar acceso." };
  await audit({ business_id: id, action: "staff.add", entity_id: userId, details: { role } });
  revalidatePath(`/panel/n/${id}/personal`);
  return {
    ok: existing
      ? `${name} ya tenía cuenta: ahora también tiene acceso a este negocio con su contraseña de siempre.`
      : `Cuenta creada. Dale a ${name} su email y la contraseña para que entre.`,
  };
}

export async function setStaffActive(id: string, userId: string, active: boolean): Promise<FormState> {
  if (!(await isOwner(id))) return { error: "No tienes permiso." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (auth?.claims?.sub === userId && !active) return { error: "No puedes quitarte el acceso a ti mismo." };
  const { error } = await supabase.from("staff_users").update({ active }).eq("business_id", id).eq("user_id", userId);
  if (error) return { error: "No se ha podido cambiar." };
  await audit({ business_id: id, action: active ? "staff.enable" : "staff.disable", entity_id: userId });
  revalidatePath(`/panel/n/${id}/personal`);
  return { ok: active ? "Acceso devuelto." : "Acceso quitado." };
}
