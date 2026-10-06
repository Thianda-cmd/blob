"use client";

// Two or three drawings in one lesson widget, switched with a pill toggle.

import { motion } from "motion/react";
import { useState, type ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { VertebrateBirdSkeleton, VertebrateFeather } from "./VertebrateBird";
import { VertebrateFish } from "./VertebrateFish";
import { VertebrateGills } from "./VertebrateGills";
import { VertebrateSkeleton } from "./VertebrateSkeleton";
import { VertebrateTeethWidget } from "./VertebrateTeeth";

function Tabs({ tabs }: { tabs: { label: Text; view: ComponentType }[] }) {
  const t = useText();
  const [i, setI] = useState(0);
  const View = tabs[i].view;
  return (
    <div className="space-y-3">
      <div className="flex w-fit max-w-full flex-wrap rounded-full border border-line bg-surface p-0.5 text-[13.5px] font-semibold" role="tablist">
        {tabs.map((tab, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)} className={cn("rounded-full px-3.5 py-1 transition-colors", k === i ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
            {t(tab.label)}
          </button>
        ))}
      </div>
      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
        <View />
      </motion.div>
    </div>
  );
}

const FishOrgans = () => <VertebrateFish mode="explore" />;
const BirdSkeleton = () => <VertebrateBirdSkeleton mode="explore" />;
const Feather = () => <VertebrateFeather mode="explore" />;
const Skeleton = () => <VertebrateSkeleton mode="explore" />;

export const VertebrateFishWidget = () => (
  <Tabs
    tabs={[
      { label: tx("Organs", "Organe"), view: FishOrgans },
      { label: tx("Gills: countercurrent", "Kiemen: Gegenstrom"), view: VertebrateGills },
    ]}
  />
);

export const VertebrateBirdWidget = () => (
  <Tabs
    tabs={[
      { label: tx("Skeleton", "Skelett"), view: BirdSkeleton },
      { label: tx("Feather", "Feder"), view: Feather },
    ]}
  />
);

export const VertebrateMammalWidget = () => (
  <Tabs
    tabs={[
      { label: tx("Skeleton plan", "Grundbauplan"), view: Skeleton },
      { label: tx("Teeth", "Gebiss"), view: VertebrateTeethWidget },
    ]}
  />
);
