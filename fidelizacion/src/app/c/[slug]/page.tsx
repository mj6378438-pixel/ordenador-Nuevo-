import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/lib/cards";
import { ruleText } from "@/lib/loyalty";
import { BusinessHeader } from "./business-header";
import { SignupForm } from "./signup-form";

export default function AltaCliente({ params }: PageProps<"/c/[slug]">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Alta params={params} />
    </Suspense>
  );
}

async function Alta({ params }: { params: PageProps<"/c/[slug]">["params"] }) {
  const { slug } = await params;
  const pub = await getPublicBusiness(slug);
  if (!pub) notFound();
  const { business, program } = pub;

  return (
    <main className="flex flex-1 flex-col">
      <BusinessHeader business={business} subtitle={ruleText(program)} />
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h2 className="font-display text-2xl font-bold tracking-tight">Tu tarjeta de cliente</h2>
        <p className="mb-6 mt-1 text-muted">
          Gratis y sin descargar apps: se guarda en el Wallet de tu móvil.
        </p>
        <SignupForm slug={slug} businessName={business.name} />
      </div>
    </main>
  );
}
