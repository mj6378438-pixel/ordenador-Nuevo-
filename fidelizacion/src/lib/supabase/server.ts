import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

/**
 * Cliente de Supabase para el servidor, con la sesión del usuario que ha iniciado sesión.
 * Respeta Row Level Security: cada negocio solo ve sus datos.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: lo ignoramos, el proxy refresca la sesión.
          }
        },
      },
    },
  );
}

/**
 * Cliente "administrador" que se salta Row Level Security.
 * Úsalo SOLO en el servidor y solo cuando haga falta (p. ej. el servicio web de Apple Wallet,
 * que llama sin usuario). Nunca lo importes desde un componente de cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
