import { Suspense } from "react";
import QRCode from "qrcode";
import { getPublicBusiness } from "@/lib/cards";
import { ruleText } from "@/lib/loyalty";
import { requireOwner } from "@/lib/owner";
import { appUrl } from "@/lib/wallet/google";
import { PrintButton } from "./print-button";

export const metadata = { title: "QR del mostrador" };

export default function Qr({ params }: PageProps<"/panel/n/[id]/qr">) {
  return (
    <Suspense fallback={<p className="text-muted">Cargando…</p>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: PageProps<"/panel/n/[id]/qr">["params"] }) {
  const { id } = await params;
  const biz = await requireOwner(id);
  const pub = await getPublicBusiness(biz.slug);
  if (!pub) return <p className="text-muted">Este negocio no está activo.</p>;
  const { business, program } = pub;
  const url = `${appUrl()}/c/${business.slug}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <div className="space-y-6">
      <div className="no-print space-y-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">QR del mostrador</h1>
        <p className="text-muted">
          Imprímelo y ponlo junto a la caja. Al escanearlo, tus clientes se dan de alta y guardan su tarjeta.
        </p>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <a href={`/panel/n/${id}/qr/png`} className="rounded-xl border border-line bg-surface px-5 py-3 font-semibold">
            Descargar solo el QR (PNG)
          </a>
        </div>
        <p className="break-all text-xs text-muted">Lleva a: {url}</p>
      </div>

      {/* Cartel (es lo único que sale al imprimir) */}
      <div
        className="mx-auto flex aspect-[1/1.414] w-full max-w-md flex-col items-center justify-between rounded-3xl p-8 text-center print:max-w-none print:rounded-none"
        style={{ background: business.bg_color, color: business.fg_color, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <div>
          <p className="text-sm uppercase tracking-[0.2em]" style={{ color: business.label_color }}>Tarjeta de cliente</p>
          <p className="mt-2 font-display text-4xl font-extrabold leading-tight">{business.name}</p>
        </div>
        <div
          className="w-3/5 rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div>
          <p className="font-display text-2xl font-bold">Escanea y llévate tu tarjeta</p>
          <p className="mt-2" style={{ color: business.label_color }}>{ruleText(program)}</p>
          <p className="mt-4 text-xs" style={{ color: business.label_color }}>
            Gratis · Sin descargar apps · Apple Wallet y Google Wallet
          </p>
        </div>
      </div>
    </div>
  );
}
