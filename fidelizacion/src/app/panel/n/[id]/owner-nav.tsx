"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const tabs = [
  { href: "", label: "Resumen" },
  { href: "/tarjeta", label: "Tarjeta" },
  { href: "/clientes", label: "Clientes" },
  { href: "/promocion", label: "Promoción" },
  { href: "/personal", label: "Personal" },
  { href: "/qr", label: "QR" },
];

export function OwnerNav() {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const base = `/panel/n/${id}`;

  return (
    <nav className="no-print -mx-4 overflow-x-auto px-4" aria-label="Secciones del negocio">
      <ul className="flex gap-1 border-b border-line">
        {tabs.map((t) => {
          const href = base + t.href;
          const active = t.href === "" ? path === base : path.startsWith(href);
          return (
            <li key={t.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
                  active ? "border-accent text-foreground" : "border-transparent text-muted"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
