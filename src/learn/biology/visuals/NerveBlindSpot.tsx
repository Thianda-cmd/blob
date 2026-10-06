"use client";

// Level 1 widget for "nervous-system": find your own blind spot. Fix the cross with one eye,
// move closer to the screen, and the dot disappears; a line with a gap even looks closed,
// because the brain fills it in. Then the eye section shows why.

import { AnimatePresence, motion } from "motion/react";
import { Eye } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { GhostButton, Note, Segmented } from "./NerveKit";
import { NerveEye } from "./NerveEye";

type Side = "right" | "left";
type Kind = "dot" | "line";

export function NerveBlindSpot() {
  const t = useText();
  const [side, setSide] = useState<Side>("right");
  const [kind, setKind] = useState<Kind>("dot");
  const [found, setFound] = useState(false);
  // Right eye open: look at the cross on the left, the target sits to the right (and the other way round).
  const cross = side === "right" ? 110 : 450;
  const target = side === "right" ? 400 : 160;

  const how: Text =
    side === "right"
      ? tx(
          "Cover your **left** eye. Look only at the cross with your right eye. Now slowly move your face towards the screen (about 25 to 35 cm away). At one distance the target disappears!",
          "Halte dir das **linke** Auge zu. Schau mit dem rechten Auge nur auf das Kreuz. Geh jetzt langsam mit dem Gesicht näher an den Bildschirm (etwa 25 bis 35 cm). Bei einem bestimmten Abstand verschwindet das Ziel!",
        )
      : tx(
          "Cover your **right** eye. Look only at the cross with your left eye. Now slowly move your face towards the screen (about 25 to 35 cm away). At one distance the target disappears!",
          "Halte dir das **rechte** Auge zu. Schau mit dem linken Auge nur auf das Kreuz. Geh jetzt langsam mit dem Gesicht näher an den Bildschirm (etwa 25 bis 35 cm). Bei einem bestimmten Abstand verschwindet das Ziel!",
        );
  const why: Text =
    kind === "dot"
      ? tx(
          "At that distance the image of the dot lands exactly on your **blind spot**. That's where the optic nerve leaves the eye: there are no sensory cells there, so nothing is seen.",
          "Bei diesem Abstand fällt das Bild des Punktes genau auf deinen **blinden Fleck**. Dort verlässt der Sehnerv das Auge: Es gibt keine Sinneszellen, also wird nichts gesehen.",
        )
      : tx(
          "The gap falls on your **blind spot**, and your brain simply fills in the line. You never notice the hole in everyday life: the brain completes the picture, and your other eye covers the spot.",
          "Die Lücke fällt auf deinen **blinden Fleck**, und dein Gehirn ergänzt die Linie einfach. Im Alltag merkst du das Loch nie: Das Gehirn vervollständigt das Bild, und das andere Auge sieht die Stelle ja.",
        );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={side}
          onChange={setSide}
          label={tx("Which eye is open", "Welches Auge offen ist")}
          options={[
            { id: "right", label: tx("right eye open", "rechtes Auge offen") },
            { id: "left", label: tx("left eye open", "linkes Auge offen") },
          ]}
        />
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            setFound(false);
          }}
          label={tx("Target", "Ziel")}
          options={[
            { id: "dot", label: tx("dot", "Punkt") },
            { id: "line", label: tx("line with a gap", "Linie mit Lücke") },
          ]}
        />
      </div>
      <div className="rounded-xl border border-line bg-raised p-2">
        <svg viewBox="0 0 560 150" className="mx-auto block h-auto w-full max-w-[640px]" role="img" aria-label={t(tx("Blind spot test: a cross and a target", "Test zum blinden Fleck: ein Kreuz und ein Ziel"))}>
          <g stroke="var(--ink)" strokeWidth={5} strokeLinecap="round">
            <line x1={cross - 14} x2={cross + 14} y1={75} y2={75} />
            <line x1={cross} x2={cross} y1={61} y2={89} />
          </g>
          {kind === "dot" ? (
            <circle cx={target} cy={75} r={15} fill="var(--blob)" />
          ) : (
            <g stroke="var(--blob)" strokeWidth={6} strokeLinecap="round">
              <line x1={target - (side === "right" ? 110 : 90)} x2={target - 16} y1={75} y2={75} />
              <line x1={target + 16} x2={target + (side === "right" ? 90 : 110)} y1={75} y2={75} />
            </g>
          )}
        </svg>
      </div>
      <Note id={`how-${side}`} text={how} />
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton pressed={found} onClick={() => setFound(!found)}>
          <Eye className="size-4" /> {t(kind === "dot" ? tx("The dot is gone!", "Der Punkt ist weg!") : tx("The line looks closed!", "Die Linie sieht geschlossen aus!"))}
        </GhostButton>
      </div>
      <AnimatePresence initial={false}>
        {found && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
            <Note id={`why-${kind}`} text={why} accent />
            <NerveEye mode="names" show={["retina", "fovea", "blindspot", "opticnerve"]} highlight={["blindspot"]} legend="below" pupil={0.5} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
