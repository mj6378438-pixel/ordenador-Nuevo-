import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { cardCookie, getCardByToken } from "@/lib/cards";
import { detectPlatform } from "@/lib/device";
import { hasDiscount, progressText, progressVisits, type CardView } from "@/lib/loyalty";
import { googleSaveUrl, googleWalletConfigured } from "@/lib/wallet/google";

export const metadata = { title: "Tu tarjeta" };

export default function TarjetaCliente({ params }: PageProps<"/c/[slug]/tarjeta">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Tarjeta params={params} />
    </Suspense>
  );
}

async function Tarjeta({ params }: { params: PageProps<"/c/[slug]/tarjeta">["params"] }) {
  const { slug } = await params;
  const token = (await cookies()).get(cardCookie(slug))?.value;
  if (!token) redirect(`/c/${slug}`);

  const view = await getCardByToken(slug, token);
  if (!view) redirect(`/c/${slug}`);

  const platform = detectPlatform((await headers()).get("user-agent"));
  const qrSvg = await QRCode.toString(view.card.public_token, { type: "svg", margin: 1 });

  let googleUrl: string | null = null;
  if (platform !== "ios" && googleWalletConfigured()) {
    try {
      googleUrl = googleSaveUrl(view);
    } catch (e) {
      console.error("Google Wallet:", e);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <p className="text-center text-sm font-medium text-ok">Tu tarjeta de cliente</p>
      <h1 className="mt-1 text-center font-display text-3xl font-extrabold tracking-tight">
        ¡Hola, {view.customerName.split(" ")[0]}!
      </h1>
      <p className="mt-2 text-center text-muted">Guárdala en tu móvil para tenerla siempre a mano.</p>

      <div className="mt-6 space-y-3">
        {platform !== "android" && (
          <div className="rounded-xl bg-black px-5 py-4 text-center text-white opacity-60">
             Añadir a Apple Wallet
            <span className="block text-xs opacity-80">Disponible muy pronto</span>
          </div>
        )}
        {googleUrl && (
          <a
            href={googleUrl}
            className="block rounded-xl bg-black px-5 py-4 text-center font-semibold text-white"
          >
            Añadir a Google Wallet
          </a>
        )}
        {platform !== "ios" && !googleUrl && (
          <p className="rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm text-muted">
            Google Wallet aún no está configurado en este negocio.
          </p>
        )}
      </div>

      <CardPreview view={view} qrSvg={qrSvg} />

      <p className="mt-4 text-center text-sm text-muted">
        También puedes enseñar este código en el mostrador desde esta página.
      </p>
    </main>
  );
}

function CardPreview({ view, qrSvg }: { view: CardView; qrSvg: string }) {
  const { business, program, card } = view;
  const done = progressVisits(program, card);
  const showStamps = program.visits_required <= 20;
  const discount = hasDiscount(program, card);

  return (
    <div
      className="mt-8 rounded-3xl p-6 shadow-xl shadow-black/15"
      style={{ background: business.bg_color, color: business.fg_color }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-xl font-bold">{business.name}</span>
        <span className="text-xs uppercase tracking-widest" style={{ color: business.label_color }}>
          {done} {done === 1 ? "visita" : "visitas"}
        </span>
      </div>

      {showStamps ? (
        <div
          className="mt-5 grid grid-cols-5 gap-2"
          aria-label={`${Math.min(done, program.visits_required)} de ${program.visits_required} visitas`}
        >
          {Array.from({ length: program.visits_required }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-full border-2"
              style={{
                borderColor: business.fg_color,
                background: i < done ? business.fg_color : "transparent",
                opacity: i < done ? 1 : 0.5,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 h-3 overflow-hidden rounded-full" style={{ background: `${business.fg_color}33` }}>
          <div
            className="h-full rounded-full"
            style={{
              background: business.fg_color,
              width: `${Math.min(100, (done / program.visits_required) * 100)}%`,
            }}
          />
        </div>
      )}

      <p className={`mt-5 text-sm ${discount ? "font-bold" : ""}`}>{progressText(program, card)}</p>

      <div
        className="mx-auto mt-6 w-40 rounded-xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
    </div>
  );
}
