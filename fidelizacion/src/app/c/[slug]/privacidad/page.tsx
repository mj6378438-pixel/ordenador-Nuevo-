import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/lib/cards";
import { appName } from "@/lib/env";

export const metadata = { title: "Política de privacidad" };

// ⚠️ PLANTILLA: conviene que la revise un asesor antes de usarla con clientes reales.
export default function Privacidad({ params }: PageProps<"/c/[slug]/privacidad">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Suspense fallback={null}>
        <Texto params={params} />
      </Suspense>
    </main>
  );
}

async function Texto({ params }: { params: PageProps<"/c/[slug]/privacidad">["params"] }) {
  const { slug } = await params;
  const pub = await getPublicBusiness(slug);
  if (!pub) notFound();
  const b = pub.business;
  const responsable = b.legal_name || b.name;
  const contacto = b.contact_email ? (
    <a className="underline" href={`mailto:${b.contact_email}`}>{b.contact_email}</a>
  ) : (
    "en el propio establecimiento"
  );

  return (
    <article className="space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Política de privacidad</h1>
      <p className="text-muted">Tarjeta de cliente de {b.name}</p>

      <h2>¿Quién es el responsable de tus datos?</h2>
      <p>
        {responsable}. Puedes contactar con el negocio {contacto}. {appName} presta el servicio
        tecnológico de la tarjeta como encargado del tratamiento, siguiendo sus instrucciones.
      </p>

      <h2>¿Qué datos guardamos?</h2>
      <p>
        Tu nombre, tu email, tu teléfono si nos lo das, tus visitas y los descuentos que has usado,
        y la fecha en la que aceptaste esta política.
      </p>

      <h2>¿Para qué?</h2>
      <p>
        Para gestionar tu tarjeta de cliente: contar tus visitas, darte los descuentos y mantener la
        tarjeta actualizada en tu móvil. Solo si marcas la casilla correspondiente, también para
        enviarte ofertas y novedades de {b.name} por email. Puedes retirar ese permiso cuando
        quieras.
      </p>

      <h2>¿Con qué base legal?</h2>
      <p>
        La gestión de la tarjeta se basa en el servicio que nos pides al darte de alta. Las
        comunicaciones comerciales se basan en tu consentimiento.
      </p>

      <h2>¿Cuánto tiempo?</h2>
      <p>Mientras tengas la tarjeta activa, o hasta que nos pidas que borremos tus datos.</p>

      <h2>¿Con quién se comparten?</h2>
      <p>
        No vendemos tus datos. Para que la tarjeta funcione usamos proveedores técnicos
        (alojamiento y base de datos en la Unión Europea, y Apple o Google para guardar la tarjeta
        en tu Wallet).
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir ver, corregir o borrar tus datos, oponerte a su uso o pedir que te los
        enviemos, escribiendo al negocio {contacto}. Si no te atendemos bien, puedes reclamar ante
        la Agencia Española de Protección de Datos (aepd.es).
      </p>
    </article>
  );
}
