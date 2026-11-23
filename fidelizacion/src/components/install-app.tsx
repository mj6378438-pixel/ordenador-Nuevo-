"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Platform = "ios" | "android" | "other";

const subscribe = () => () => {};
function useClientValue<T>(get: () => T, server: T) {
  return useSyncExternalStore(subscribe, get, () => server);
}

function getPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Botón / instrucciones para instalar la app en la pantalla de inicio. */
export function InstallApp({ compact = false }: { compact?: boolean }) {
  const platform = useClientValue<Platform | null>(getPlatform, null);
  const installed = useClientValue(isInstalled, true);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!platform || installed) return null;
  if (done) return <p className="rounded-2xl bg-ok/10 p-4 text-ok">✓ App instalada. Ya la tienes en tu pantalla de inicio.</p>;

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-semibold">📲 Instala la app en este móvil</p>
      {!compact && (
        <p className="mt-1 text-sm text-muted">
          Tendrás un icono en la pantalla de inicio y se abrirá a pantalla completa, como cualquier app.
        </p>
      )}

      {prompt ? (
        <button
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setDone(true);
            setPrompt(null);
          }}
          className="mt-4 w-full rounded-xl bg-accent px-5 py-3.5 font-semibold text-accent-ink"
        >
          Instalar app
        </button>
      ) : platform === "ios" ? (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>Pulsa el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba ⬆️).</li>
          <li>Baja y pulsa <b>«Añadir a pantalla de inicio»</b>.</li>
          <li>Pulsa <b>«Añadir»</b>. ¡Listo!</li>
        </ol>
      ) : platform === "android" ? (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
          <li>Abre esta página en <b>Chrome</b>.</li>
          <li>Pulsa los <b>tres puntos ⋮</b> de arriba a la derecha.</li>
          <li>Pulsa <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.</li>
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Abre esta página desde el móvil o la tablet del local para instalarla.
        </p>
      )}
    </div>
  );
}
