import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The model page's two columns: the picture (sticky, so it stays in sight while you read) and
 * the panel beside it. Below lg they stack; `panelFirst` puts the panel on top there, so a
 * quiz question stays in sight above the picture you tap.
 */
export function Layout({ stage, panel, panelFirst, single }: { stage: ReactNode; panel: ReactNode; panelFirst?: boolean; single?: boolean }) {
  if (single || !stage) return <div className="mx-auto w-full max-w-[640px]">{panel}</div>;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-5">
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-line bg-raised p-3 shadow-card sm:p-5 lg:sticky lg:top-3">
        <div className="relative">{stage}</div>
      </div>
      <div className={cn("min-w-0", panelFirst && "max-lg:order-first")}>{panel}</div>
    </div>
  );
}
