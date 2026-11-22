import { cookies } from "next/headers";
import { cardCookie, getCardByToken, getCardViewBySerial } from "@/lib/cards";
import { appleWalletConfigured, generatePass } from "@/lib/wallet/apple";

/** Descarga del pase de Apple Wallet para el cliente (su tarjeta la identifica la cookie). */
export async function GET(_req: Request, ctx: RouteContext<"/api/apple/pase/[slug]">) {
  const { slug } = await ctx.params;
  if (!appleWalletConfigured()) return new Response("Apple Wallet aún no está disponible.", { status: 503 });

  const token = (await cookies()).get(cardCookie(slug))?.value;
  if (!token) return Response.redirect(new URL(`/c/${slug}`, _req.url), 303);

  const basic = await getCardByToken(slug, token);
  if (!basic) return Response.redirect(new URL(`/c/${slug}`, _req.url), 303);
  const view = await getCardViewBySerial(basic.card.serial_number);
  if (!view) return new Response("Tarjeta no encontrada", { status: 404 });

  const pass = await generatePass(view);
  return new Response(new Uint8Array(pass), {
    headers: {
      "content-type": "application/vnd.apple.pkpass",
      "content-disposition": `attachment; filename="${slug}.pkpass"`,
      "cache-control": "no-store",
    },
  });
}
