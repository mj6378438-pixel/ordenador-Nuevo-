"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/panel");

  if (!email || !password) return { error: "Escribe tu email y tu contraseña.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === "invalid_credentials"
          ? "Email o contraseña incorrectos."
          : "No se ha podido iniciar sesión. Inténtalo de nuevo.",
      email,
    };
  }
  // Solo redirigimos dentro del panel (evita redirecciones a otras webs)
  redirect(next.startsWith("/panel") ? next : "/panel");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
