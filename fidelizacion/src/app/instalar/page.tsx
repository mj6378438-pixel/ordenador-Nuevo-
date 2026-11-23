import Link from "next/link";
import { InstallApp } from "@/components/install-app";
import { appName } from "@/lib/env";

export const metadata = { title: "Instalar la app" };

export default function Instalar() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Link href="/" className="font-display text-lg font-bold tracking-tight">{appName}</Link>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">La app del personal</h1>
      <p className="mt-2 text-muted">
        Se instala desde aquí en un minuto, sin App Store ni Google Play. Con ella escaneas las
        tarjetas de los clientes, se suman las visitas y aplicas los descuentos.
      </p>
      <div className="mt-6">
        <InstallApp />
      </div>
      <p className="mt-6 text-sm text-muted">
        ¿Ya la tienes? Ábrela desde el icono de tu pantalla de inicio o{" "}
        <Link href="/panel" className="underline">entra aquí</Link>.
      </p>
    </main>
  );
}
