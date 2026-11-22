import type { MetadataRoute } from "next";
import { appName } from "@/lib/env";

/** Lo que convierte la web del personal en una app instalable (icono, pantalla completa). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/panel",
    name: appName,
    short_name: "Escanear",
    description: "App del personal: escanea tarjetas, suma visitas y aplica descuentos.",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ef",
    theme_color: "#f6f4ef",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Escanear tarjeta", url: "/panel/escanear" }],
  };
}
