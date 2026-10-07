// Display helpers for linear terms and systems (level 2) with stable token keys,
// so the steps of a worked solution glide into each other.

/** [coefficient, variable ("" for a number), key id] */
export type Term = [number, string, string];

/** A sum of terms. Keys: sign s<id>, coefficient c<id>, variable v<id>. */
export function side(ts: Term[], n: (v: number) => string = String): string {
  const parts = ts.filter(([c]) => c !== 0);
  if (!parts.length) return "0";
  return parts
    .map(([c, v, id], i) => {
      const sign = c < 0 ? `-#s${id} ` : i ? `+#s${id} ` : "";
      const a = Math.abs(c);
      if (!v) return `${sign}${n(a)}#c${id}`;
      return `${sign}${a === 1 ? "" : `${n(a)}#c${id} `}${v}#v${id}`;
    })
    .join(" ");
}

/**
 * Both equations, labelled (I) and (II); each stays on one line, (II) moves below (I) when space is
 * short. The gap belongs to (I), so it doesn't wrap onto the second line in front of (II).
 */
export const sys = (a: string, b: string) => `\\group{"(I)"#L1 \\, ${a} \\quad}#G1 \\group{"(II)"#L2 \\, ${b}}#G2`;

/**
 * Both equations stacked, (I) above (II), for a long (II) like $10y + x = 10x + y + 27$. `rest`
 * (the right side of (II), or a balance step) is a group of its own, so on a phone it moves to
 * the next line instead of running off the board.
 */
export const sysStack = (a: string, b: string, rest = "") => `\\group{"(I)"#L1 \\, ${a}}#G1 \\\\ \\group{"(II)"#L2 \\, ${b}}#G2${rest ? ` \\group{${rest}}#G3` : ""}`;

/** A balance step after an equation: "| − 100". */
export const bar = (op: string) => ` \\quad \\blob{|#bar ${op}}`;

/** The same source without keys, for notes and answer options. */
export const plain = (src: string) => src.replace(/#[A-Za-z0-9_]+/g, "").replace(/(\d) ([a-z])\b/g, "$1$2");

/** "+ 5" / "− 5" as display source (no keys). */
export const signed = (v: number, n: (v: number) => string = String) => `${v < 0 ? "-" : "+"} ${n(Math.abs(v))}`;
