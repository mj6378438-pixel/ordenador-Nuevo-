import QRCode from "qrcode";
import { isOwner } from "@/lib/owner";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/wallet/google";

/** El QR del mostrador como imagen PNG en alta resolución. */
export async function GET(_req: Request, ctx: RouteContext<"/panel/n/[id]/qr/png">) {
  const { id } = await ctx.params;
  if (!(await isOwner(id))) return new Response("No tienes permiso.", { status: 403 });
  const supabase = await createClient();
  const { data } = await supabase.from("businesses").select("slug").eq("id", id).single();
  if (!data) return new Response("No encontrado", { status: 404 });

  const png = await QRCode.toBuffer(`${appUrl()}/c/${data.slug}`, { width: 1200, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="qr-${data.slug}.png"`,
    },
  });
}
