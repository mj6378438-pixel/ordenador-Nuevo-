import type { Business } from "@/lib/loyalty";

/** Cabecera con los colores y el logo del negocio. */
export function BusinessHeader({ business, subtitle }: { business: Business; subtitle?: string }) {
  return (
    <div
      className="px-4 pb-8 pt-10 text-center"
      style={{ background: business.bg_color, color: business.fg_color }}
    >
      {business.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={business.logo_url} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
      ) : (
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl font-display text-2xl font-extrabold"
          style={{ background: business.fg_color, color: business.bg_color }}
        >
          {business.name.slice(0, 1)}
        </div>
      )}
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">{business.name}</h1>
      {subtitle && (
        <p className="mt-2 text-base" style={{ color: business.label_color }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
