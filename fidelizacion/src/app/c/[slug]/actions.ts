"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { cardCookie } from "@/lib/cards";

export type SignupState = {
  error?: string;
  values?: { name: string; email: string; phone: string; marketing: boolean };
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function registerCustomer(
  slug: string,
  _prev: SignupState,
  form: FormData,
): Promise<SignupState> {
  const values = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    phone: String(form.get("phone") ?? "").trim(),
    marketing: form.get("marketing") === "on",
  };

  // Campo trampa invisible: si viene relleno, es un robot
  if (String(form.get("web") ?? "")) return { values };

  if (values.name.length < 2 || values.name.length > 80) {
    return { error: "Escribe tu nombre.", values };
  }
  if (!EMAIL_RE.test(values.email) || values.email.length > 200) {
    return { error: "Revisa tu email, parece que no es correcto.", values };
  }
  if (values.phone && !/^\+?[0-9 ]{6,20}$/.test(values.phone)) {
    return { error: "Revisa el teléfono (solo números).", values };
  }
  if (form.get("privacy") !== "on") {
    return { error: "Para darte la tarjeta tienes que aceptar la política de privacidad.", values };
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("register_customer", {
    p_slug: slug,
    p_name: values.name,
    p_email: values.email,
    p_phone: values.phone.replaceAll(" ", ""),
    p_marketing: values.marketing,
  });
  if (error || !data) {
    return { error: "Algo ha fallado. Inténtalo de nuevo en un momento.", values };
  }

  const result = data as { status: "created" | "exists" | "no_business" | "suspended"; token?: string };
  if (result.status === "suspended") {
    return { error: "Las tarjetas de este negocio no están disponibles ahora mismo. Pregunta en el mostrador.", values };
  }
  if (result.status === "no_business") {
    return { error: "Este negocio no está disponible.", values };
  }

  const jar = await cookies();
  const saved = jar.get(cardCookie(slug))?.value;

  if (result.status === "exists" && saved !== result.token) {
    // Por seguridad no enseñamos la tarjeta de un email que alguien podría
    // haber escrito sin ser suyo.
    return {
      error:
        "Ya hay una tarjeta con este email. Búscala en tu Wallet. Si la has perdido, pide ayuda en el mostrador.",
      values,
    };
  }

  jar.set(cardCookie(slug), result.token!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 730,
  });
  redirect(`/c/${slug}/tarjeta`);
}
