import { Suspense } from "react";
import Link from "next/link";
import { appName } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default function Entrar({ searchParams }: PageProps<"/entrar">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <Link href="/" className="font-display text-lg font-bold tracking-tight">{appName}</Link>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">Acceso del personal</h1>
      <p className="mt-2 text-muted">Entra con la cuenta que te ha dado tu negocio.</p>
      <Suspense fallback={<div className="mt-8 h-64" />}>
        <FormWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FormWithNext({ searchParams }: { searchParams: PageProps<"/entrar">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/panel"} />;
}
