"use client";
import { useState } from "react";

type Day = { d: string; n: number };

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/** Columnas de visitas por día (30 días), con aviso al pasar el dedo o el ratón. */
export function VisitsChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.n));
  // Escala con un tope "redondo" para la línea de referencia
  const top = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const H = 140;
  const W = 600;
  const pad = { l: 28, r: 4, t: 8, b: 22 };
  const band = (W - pad.l - pad.r) / days.length;
  const barW = Math.min(14, band - 2);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const active = hover !== null ? days[hover] : null;

  return (
    <figure className="m-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <figcaption className="text-sm font-semibold">Visitas por día · últimos 30 días</figcaption>
        <span className="text-sm tabular-nums text-muted" aria-live="polite">
          {active ? `${fmtDay(active.d)}: ${active.n} ${active.n === 1 ? "visita" : "visitas"}` : " "}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Visitas por día. Máximo ${max} en un día.`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Referencias recesivas */}
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {v}
            </text>
          </g>
        ))}
        {days.map((day, i) => {
          const x = pad.l + i * band + (band - barW) / 2;
          const h = y(0) - y(day.n);
          const r = Math.min(4, h / 2, barW / 2);
          return (
            <g key={day.d}>
              {day.n > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(day.n) + r} Q${x},${y(day.n)} ${x + r},${y(day.n)} H${x + barW - r} Q${x + barW},${y(day.n)} ${x + barW},${y(day.n) + r} V${y(0)} Z`}
                  fill="var(--chart)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {/* Zona de toque más grande que la columna */}
              <rect
                x={pad.l + i * band}
                y={pad.t}
                width={band}
                height={H - pad.t - pad.b}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              >
                <title>{`${fmtDay(day.d)}: ${day.n}`}</title>
              </rect>
            </g>
          );
        })}
        <text x={pad.l} y={H - 4} fontSize={11} fill="var(--muted)">
          {days[0] && fmtDay(days[0].d)}
        </text>
        <text x={W - pad.r} y={H - 4} fontSize={11} fill="var(--muted)" textAnchor="end">
          Hoy
        </text>
      </svg>
      <details className="mt-2 text-sm text-muted">
        <summary className="cursor-pointer">Ver como tabla</summary>
        <table className="mt-2 w-full tabular-nums">
          <tbody>
            {days.filter((d) => d.n > 0).reverse().map((d) => (
              <tr key={d.d} className="border-b border-line">
                <td className="py-1">{fmtDay(d.d)}</td>
                <td className="py-1 text-right">{d.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
