"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { redeemAction, scanAction, type RedeemResult, type ScanResult } from "../actions";

// Lector de QR nativo (Android/Chrome). En iPhone no existe y usamos jsQR.
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): Detector;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

type Phase =
  | { kind: "scanning" }
  | { kind: "loading" }
  | { kind: "result"; result: ScanResult; redeem?: RedeemResult; redeeming?: boolean };

const errorText: Record<string, string> = {
  not_found: "Esta tarjeta no es de tu negocio o no existe.",
  rate_limited: "Esta tarjeta se ha escaneado muchas veces seguidas. Espera un minuto.",
  suspended:
    "Servicio suspendido: este negocio tiene un pago pendiente. El dueño debe ponerse en contacto con nosotros.",
  session: "Tu sesión ha caducado. Vuelve a entrar.",
  unknown: "Algo ha fallado. Inténtalo otra vez.",
  no_reward: "Este cliente todavía no tiene descuento.",
};

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: "scanning" });
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleToken = useCallback(async (token: string) => {
    if (busy.current) return;
    busy.current = true;
    navigator.vibrate?.(60);
    setPhase({ kind: "loading" });
    const result = await scanAction(token).catch(
      (): ScanResult => ({ ok: false, error: "unknown" }),
    );
    if (result.ok && result.just_unlocked) navigator.vibrate?.([80, 60, 80]);
    setPhase({ kind: "result", result });
  }, []);

  // Cámara + bucle de lectura
  useEffect(() => {
    if (phase.kind !== "scanning") return;
    busy.current = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
      } catch {
        setCameraError(
          "No podemos usar la cámara. Dale permiso en los ajustes del navegador y vuelve a abrir esta pantalla.",
        );
        return;
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});

      let detector: Detector | null = null;
      if (window.BarcodeDetector) {
        try {
          const formats = (await window.BarcodeDetector.getSupportedFormats?.()) ?? ["qr_code"];
          if (formats.includes("qr_code")) detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {}
      }
      const jsQR = detector ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped || busy.current) return;
        if (video.readyState >= 2) {
          try {
            let value: string | undefined;
            if (detector) {
              value = (await detector.detect(video))[0]?.rawValue;
            } else if (jsQR) {
              const canvas = (canvasRef.current ??= document.createElement("canvas"));
              const w = 480;
              const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
              ctx.drawImage(video, 0, 0, w, h);
              value = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data;
            }
            if (value) return void handleToken(value);
          } catch {}
        }
        timer = setTimeout(tick, 120);
      };
      tick();
    }
    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [phase.kind, handleToken]);

  async function redeem(cardId: string) {
    if (phase.kind !== "result") return;
    setPhase({ ...phase, redeeming: true });
    const redeemResult = await redeemAction(cardId).catch(
      (): RedeemResult => ({ ok: false, error: "unknown" }),
    );
    if (redeemResult.ok) navigator.vibrate?.(60);
    setPhase({ ...phase, redeeming: false, redeem: redeemResult });
  }

  const next = () => setPhase({ kind: "scanning" });

  return (
    <div className="flex flex-1 flex-col">
      {phase.kind !== "result" && (
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-cover" />
          {/* Marco de enfoque */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="aspect-square w-2/3 rounded-3xl border-4 border-white/90 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
          </div>
          <p className="absolute inset-x-0 bottom-5 text-center text-sm font-medium text-white">
            {phase.kind === "loading" ? "Comprobando…" : "Apunta al QR de la tarjeta"}
          </p>
          {cameraError && (
            <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center text-white">
              <p>{cameraError}</p>
            </div>
          )}
        </div>
      )}

      {phase.kind === "result" && (
        <ResultView phase={phase} onRedeem={redeem} onNext={next} />
      )}
    </div>
  );
}

function ResultView({
  phase,
  onRedeem,
  onNext,
}: {
  phase: Extract<Phase, { kind: "result" }>;
  onRedeem: (cardId: string) => void;
  onNext: () => void;
}) {
  const r = phase.result;
  const nextButton = (
    <button
      onClick={onNext}
      className="mt-4 w-full rounded-2xl bg-foreground px-5 py-5 text-lg font-bold text-background"
    >
      Escanear otra tarjeta
    </button>
  );

  if (!r.ok) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border-2 border-accent bg-accent/10 p-6 text-center">
          <div className="text-4xl">✕</div>
          <p className="mt-2 text-lg font-semibold">{errorText[r.error]}</p>
          {r.error === "session" && (
            <Link href="/entrar" className="mt-3 inline-block underline">Entrar</Link>
          )}
        </div>
        {nextButton}
      </div>
    );
  }

  const redeemed = phase.redeem?.ok ? phase.redeem : null;
  // Tras aplicar el descuento, los números vienen actualizados de la base de datos
  const now = redeemed ?? r;
  const progress = r.reward_type === "permanent" ? now.visits_total : now.visits_current;
  const remaining = now.visits_remaining;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-line bg-surface p-6">
        <p className="text-sm text-muted">{r.business_name}</p>
        <h2 className="font-display text-3xl font-extrabold tracking-tight">{r.customer_name}</h2>

        <p className={`mt-3 text-lg font-semibold ${r.visit_added ? "text-ok" : "text-warn"}`}>
          {r.visit_added ? "✓ Visita apuntada" : "Ya había venido hoy · no se suma otra"}
        </p>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-muted">Visitas</span>
          <span className="font-display text-2xl font-bold">
            {Math.min(progress, r.visits_required)} / {r.visits_required}
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-ok transition-all"
            style={{ width: `${Math.min(100, (progress / r.visits_required) * 100)}%` }}
          />
        </div>
        {remaining > 0 && (
          <p className="mt-2 text-sm text-muted">
            Le faltan {remaining} para su {r.discount_percent}%.
          </p>
        )}
      </div>

      {r.has_discount && !redeemed && (
        <div className="mt-4 rounded-3xl bg-ok p-6 text-center text-white">
          {r.just_unlocked && <p className="text-lg font-semibold">🎉 ¡Lo acaba de conseguir!</p>}
          <p className="font-display text-4xl font-extrabold">{r.discount_percent}% de descuento</p>
          <p className="mt-1 opacity-90">
            {r.reward_type === "permanent" ? "Cliente VIP: siempre" : "Aplícalo"} {r.reward_description}
          </p>
          <button
            onClick={() => onRedeem(r.card_id)}
            disabled={phase.redeeming}
            className="mt-5 w-full rounded-2xl bg-white px-5 py-4 text-lg font-bold text-ok disabled:opacity-60"
          >
            {phase.redeeming
              ? "Aplicando…"
              : r.reward_type === "permanent"
                ? "Anotar descuento aplicado"
                : "Aplicar descuento"}
          </button>
        </div>
      )}

      {redeemed && (
        <div className="mt-4 rounded-3xl border-2 border-ok p-6 text-center">
          <p className="text-lg font-bold text-ok">✓ Descuento del {redeemed.applied_percent}% aplicado</p>
          <p className="mt-1 text-sm text-muted">
            {redeemed.reward_type === "one_time"
              ? "Descuéntalo en caja. El contador vuelve a empezar."
              : "Descuéntalo en caja. Sigue siendo cliente VIP."}
          </p>
        </div>
      )}

      {phase.redeem && !phase.redeem.ok && (
        <p className="mt-4 rounded-2xl bg-accent/10 p-4 text-center text-accent">
          {errorText[phase.redeem.error]}
        </p>
      )}

      {nextButton}
    </div>
  );
}
