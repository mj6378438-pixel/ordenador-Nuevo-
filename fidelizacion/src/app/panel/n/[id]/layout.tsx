import Link from "next/link";
import { Suspense } from "react";
import { OwnerNav } from "./owner-nav";

export default function OwnerLayout({ children }: LayoutProps<"/panel/n/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6">
      <Link href="/panel" className="no-print text-sm text-muted">← Panel</Link>
      <div className="mt-3">
        <Suspense fallback={<div className="h-[45px] border-b border-line" />}>
          <OwnerNav />
        </Suspense>
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}
