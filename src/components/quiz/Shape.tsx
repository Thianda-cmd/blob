import type { Shape as ShapeName } from "@/quiz/model";
import { ANSWER_STYLES } from "@/quiz/model";
import { cn } from "@/lib/utils";

/** The shape of an answer (triangle, diamond, circle, square, hexagon, drop), in white or its colour. */
export function Shape({ shape, className, fill = "#fff" }: { shape: ShapeName; className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} aria-hidden>
      {shape === "triangle" && <path d="M12 3.2 22 20.4H2Z" fill={fill} strokeLinejoin="round" stroke={fill} strokeWidth="1.6" />}
      {shape === "diamond" && <path d="M12 2.2 21.8 12 12 21.8 2.2 12Z" fill={fill} stroke={fill} strokeWidth="1.2" strokeLinejoin="round" />}
      {shape === "circle" && <circle cx="12" cy="12" r="9.6" fill={fill} />}
      {shape === "square" && <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2" fill={fill} />}
      {shape === "hexagon" && <path d="M7 3.4h10l5 8.6-5 8.6H7L2 12Z" fill={fill} stroke={fill} strokeWidth="1" strokeLinejoin="round" />}
      {shape === "drop" && <path d="M12 2.6c4.7 0 8.6 3.7 8.8 8.6.2 4.7-2.9 8.4-7 9.4-1.2.3-2.4.3-3.6 0-4.1-1-7.2-4.7-7-9.4C3.4 6.3 7.3 2.6 12 2.6Z" fill={fill} />}
    </svg>
  );
}

/** The style (shape and colours) of the answer at `index`. */
export const styleAt = (index: number) => ANSWER_STYLES[((index % ANSWER_STYLES.length) + ANSWER_STYLES.length) % ANSWER_STYLES.length];
