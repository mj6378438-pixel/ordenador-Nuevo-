import Link from "next/link";
import { Scanner } from "./scanner";

export const metadata = { title: "Escanear" };

export default function Escanear() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-8 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/panel" className="text-sm text-muted">← Panel</Link>
        <h1 className="font-display text-lg font-bold">Escanear tarjeta</h1>
        <span className="w-12" />
      </header>
      <Scanner />
    </main>
  );
}
