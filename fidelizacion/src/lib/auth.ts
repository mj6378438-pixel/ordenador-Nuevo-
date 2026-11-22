import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = {
  businessId: string;
  businessName: string;
  slug: string;
  role: "owner" | "staff";
  displayName: string;
};

export type CurrentStaff = {
  userId: string;
  email: string | null;
  isPlatformAdmin: boolean;
  memberships: Membership[];
};

/** Usuario con sesión iniciada y los negocios en los que trabaja. Si no hay sesión, a /entrar. */
export async function getCurrentStaff(): Promise<CurrentStaff> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/entrar");

  const [{ data: rows }, { data: admin }] = await Promise.all([
    supabase
      .from("staff_users")
      .select("role, display_name, active, businesses ( id, name, slug )")
      .eq("user_id", claims.sub)
      .eq("active", true),
    supabase.from("platform_admins").select("user_id").eq("user_id", claims.sub).maybeSingle(),
  ]);

  type Row = {
    role: "owner" | "staff";
    display_name: string;
    businesses: { id: string; name: string; slug: string } | null;
  };

  const memberships = ((rows ?? []) as unknown as Row[])
    .filter((r) => r.businesses)
    .map((r) => ({
      businessId: r.businesses!.id,
      businessName: r.businesses!.name,
      slug: r.businesses!.slug,
      role: r.role,
      displayName: r.display_name,
    }));

  return {
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    isPlatformAdmin: Boolean(admin),
    memberships,
  };
}
