import { Dna, Earth, FlaskConical, Funnel, Hand, Microscope, Network, Pill, Pipette, Scissors, SprayCan, Syringe } from "lucide-react";
import type { SVGProps } from "react";
import type { EventIcon as Kind } from "../types";

/** The little picture of a milestone: lucide where it has one, else drawn in the same style. */
export function EventIcon({ kind, className }: { kind: Kind; className?: string }) {
  const p = { className, strokeWidth: 1.8, "aria-hidden": true } as const;
  switch (kind) {
    case "microscope":
      return <Microscope {...p} />;
    case "flask":
      return <FlaskConical {...p} />;
    case "vaccine":
      return <Syringe {...p} />;
    case "hands":
      return <Hand {...p} />;
    case "scalpel":
      return <SprayCan {...p} />;
    case "stain":
      return <Pipette {...p} />;
    case "filter":
      return <Funnel {...p} />;
    case "pill":
      return <Pill {...p} />;
    case "tree":
      return <Network {...p} />;
    case "dna":
    case "helix":
      return <Dna {...p} />;
    case "scissors":
      return <Scissors {...p} />;
    case "earth":
      return <Earth {...p} />;
    default:
      return <Drawn kind={kind} className={className} />;
  }
}

function Drawn({ kind, className }: { kind: Kind; className?: string }) {
  const s: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };
  switch (kind) {
    case "lens":
      // Leeuwenhoek's microscope: a metal plate, the tiny lens, the specimen pin and its screw.
      return (
        <svg {...s}>
          <rect x="6" y="2.5" width="8" height="15" rx="2" />
          <circle cx="10" cy="7" r="1.6" />
          <path d="M14 7h4M18 4.5v9.5M18 14l-4 6M10 17.5V21" />
        </svg>
      );
    case "cells":
      // Hooke's cork cells.
      return (
        <svg {...s}>
          <path d="M3 5h18v14H3z" />
          <path d="M9 5v14M15 5v14M3 12h6M15 10h6M9 15h6" />
        </svg>
      );
    case "swan":
      // Pasteur's swan-neck flask.
      return (
        <svg {...s}>
          <path d="M9.5 10.5V9C9.5 5 13 3 16 4.5s3.5 4.5 5 4" />
          <path d="M12.5 10.5C12.5 7.5 14 6.5 15.5 7.2" />
          <path d="M9.5 10.5a6 6 0 1 0 3 0" />
          <path d="M6.2 16h11.6" />
        </svg>
      );
    case "dish":
      // A Petri dish with colonies.
      return (
        <svg {...s}>
          <ellipse cx="12" cy="13" rx="9.5" ry="6" />
          <path d="M2.5 13v1.5c0 3.3 4.3 6 9.5 6s9.5-2.7 9.5-6V13" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="14" cy="14" r="1.3" />
          <circle cx="15" cy="10.5" r=".8" />
        </svg>
      );
    case "rod":
      // Rod-shaped bacteria.
      return (
        <svg {...s}>
          <rect x="3" y="5" width="12" height="5" rx="2.5" transform="rotate(-18 9 7.5)" />
          <rect x="9" y="13.5" width="12" height="5" rx="2.5" transform="rotate(12 15 16)" />
        </svg>
      );
    case "spore":
      return (
        <svg {...s}>
          <rect x="2.5" y="7.5" width="19" height="9" rx="4.5" />
          <ellipse cx="16" cy="12" rx="3" ry="2.4" />
        </svg>
      );
    case "phage":
      // A bacteriophage: head, tail and tail fibres.
      return (
        <svg {...s}>
          <path d="M12 2.5l4 2.3v4.6L12 11.7 8 9.4V4.8z" />
          <path d="M12 11.7v6.3M9.5 14h5M12 18l-4 3.5M12 18l4 3.5M12 18l-6 1M12 18l6 1" />
        </svg>
      );
    case "mould":
      // Fleming's plate: a mould colony with a clear zone where bacteria don't grow.
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="9.5" />
          <circle cx="9.5" cy="10" r="2.6" />
          <circle cx="9.5" cy="10" r="5" strokeDasharray="2 2.2" />
          <circle cx="17" cy="15" r=".8" />
          <circle cx="15.5" cy="18" r=".8" />
          <circle cx="18.2" cy="11.5" r=".8" />
        </svg>
      );
    case "plasmid":
      return (
        <svg {...s}>
          <path d="M19.4 9A8 8 0 1 0 20 12" />
          <path d="M16 10.3A4.2 4.2 0 1 0 16.2 12" />
        </svg>
      );
    default:
      return (
        <svg {...s}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
