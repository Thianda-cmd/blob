// The tiny language lesson authors write maths in, parsed into a tree for <MathView>.
//
//   3(x + 2) = 3x + 6          implicit products, brackets
//   x^2   x^{n+1}   x_1        powers and subscripts (single atom or {group})
//   \frac{3}{4}   \sqrt{x}     fractions and roots (\sqrt[3]{x} for other roots)
//   "cm"                       plain text (units, words)
//   * → ·    - → −   <= → ≤   >= → ≥   != → ≠   +- → ±   => → ⇒
//   \pi \Delta \cdot \pm \le \ge \ne \approx \to \Rightarrow \infty \deg \rho …
//   \, \; \quad (spaces)   \\ (line break)   \{ \} (set braces)
//   \hl{..} \blob{..} \red{..} \green{..} \fade{..} \strike{..} \box{..}   styles
//   \group{..}                 keeps its contents on one line, no styling
//   x#key                      give a token a fixed animation key
//
// Every leaf gets a stable key ("x#0", "+#1", …) so the same token glides to its
// new place when the next animation frame is shown.

export type StyleName = "hl" | "blob" | "red" | "green" | "fade" | "strike" | "box" | "group";

export type DNode =
  | { k: string; type: "num" | "var" | "op" | "text" | "sym"; v: string }
  | { k: string; type: "frac"; num: DNode[]; den: DNode[] }
  | { k: string; type: "pow"; base: DNode[]; exp: DNode[] }
  | { k: string; type: "sub"; base: DNode[]; sub: DNode[] }
  | { k: string; type: "sqrt"; body: DNode[]; index: DNode[] | null }
  | { k: string; type: "paren"; open: string; close: string; body: DNode[] }
  | { k: string; type: "style"; style: StyleName; body: DNode[] }
  | { k: string; type: "space"; v: string };

const SYMBOLS: Record<string, { type: "op" | "sym"; v: string }> = {
  pi: { type: "sym", v: "π" },
  Delta: { type: "sym", v: "Δ" },
  alpha: { type: "sym", v: "α" },
  infty: { type: "sym", v: "∞" },
  deg: { type: "sym", v: "°" },
  cdot: { type: "op", v: "·" },
  times: { type: "op", v: "×" },
  div: { type: "op", v: ":" },
  pm: { type: "op", v: "±" },
  le: { type: "op", v: "≤" },
  ge: { type: "op", v: "≥" },
  ne: { type: "op", v: "≠" },
  approx: { type: "op", v: "≈" },
  to: { type: "op", v: "→" },
  Rightarrow: { type: "op", v: "⇒" },
  Leftrightarrow: { type: "op", v: "⇔" },
  in: { type: "op", v: "∈" },
  beta: { type: "sym", v: "β" },
  gamma: { type: "sym", v: "γ" },
  lambda: { type: "sym", v: "λ" },
  mu: { type: "sym", v: "μ" },
  rho: { type: "sym", v: "ρ" },
  sigma: { type: "sym", v: "σ" },
  varphi: { type: "sym", v: "φ" },
  omega: { type: "sym", v: "ω" },
  emptyset: { type: "sym", v: "∅" },
  mid: { type: "op", v: "|" },
};
const STYLES: StyleName[] = ["hl", "blob", "red", "green", "fade", "strike", "box", "group"];
const OPS: Record<string, string> = { "+": "+", "-": "−", "*": "·", "/": "/", ":": ":", "=": "=", "<": "<", ">": ">", ",": ",", ";": ";", "|": "|", "!": "!", "%": "%", "·": "·", "−": "−", "±": "±", "≤": "≤", "≥": "≥", "≠": "≠", "≈": "≈", "⇒": "⇒", "→": "→", "°": "°" };

type Raw = {
  type: DNode["type"];
  k?: string;
  v?: string;
  num?: Raw[];
  den?: Raw[];
  base?: Raw[];
  exp?: Raw[];
  sub?: Raw[];
  body?: Raw[];
  index?: Raw[] | null;
  open?: string;
  close?: string;
  style?: StyleName;
};

export function parseDisplay(src: string): DNode[] {
  let i = 0;

  const skipWs = () => {
    while (i < src.length && src[i] === " ") i++;
  };

  function group(): Raw[] {
    // Parses until a closing } or ) or ] belonging to the caller.
    const out: Raw[] = [];
    for (;;) {
      skipWs();
      if (i >= src.length) return out;
      const c = src[i];
      if (c === "}" || c === ")" || c === "]") return out;
      if (c === "^" || c === "_") {
        i++;
        const arg = argument();
        const prev = out.pop();
        const base: Raw[] = prev ? [prev] : [];
        out.push(c === "^" ? { type: "pow", base, exp: arg } : { type: "sub", base, sub: arg });
        continue;
      }
      if (c === "#") {
        i++;
        let j = i;
        while (j < src.length && /[A-Za-z0-9_-]/.test(src[j])) j++;
        const key = src.slice(i, j);
        i = j;
        const prev = out[out.length - 1];
        if (prev) prev.k = key;
        continue;
      }
      out.push(...atom());
    }
  }

  /** A single atom or {group} used as exponent, subscript or command argument. */
  function argument(): Raw[] {
    skipWs();
    if (src[i] === "{") {
      i++;
      const g = group();
      if (src[i] === "}") i++;
      return g;
    }
    // A single character/number/command as the argument.
    if (/[0-9]/.test(src[i] ?? "")) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      const v = src.slice(i, j);
      i = j;
      return [{ type: "num", v }];
    }
    return atom();
  }

  function atom(): Raw[] {
    const c = src[i];
    // numbers (decimal point or comma between digits)
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && (/[0-9]/.test(src[j]) || (/[.,]/.test(src[j]) && /[0-9]/.test(src[j + 1] ?? "") && /[0-9]/.test(src[j - 1] ?? "")))) j++;
      const v = src.slice(i, j);
      i = j;
      return [{ type: "num", v }];
    }
    if (/[A-Za-zÄÖÜäöüß]/.test(c)) {
      i++;
      return [{ type: "var", v: c }];
    }
    if (c === '"') {
      const j = src.indexOf('"', i + 1);
      const v = src.slice(i + 1, j < 0 ? src.length : j);
      i = j < 0 ? src.length : j + 1;
      return [{ type: "text", v }];
    }
    if (c === "(" || c === "[") {
      const close = c === "(" ? ")" : "]";
      i++;
      const body = group();
      if (src[i] === close) i++;
      return [{ type: "paren", open: c, close, body }];
    }
    if (c === "{") {
      i++;
      const body = group();
      if (src[i] === "}") i++;
      return body;
    }
    if (c === "\\") {
      let j = i + 1;
      if (src[j] === "," || src[j] === " ") {
        i = j + 1;
        return [{ type: "space", v: "thin" }];
      }
      if (src[j] === ";") {
        i = j + 1;
        return [{ type: "space", v: "med" }];
      }
      if (src[j] === "\\") {
        i = j + 1;
        return [{ type: "space", v: "br" }];
      }
      if (src[j] === "{" || src[j] === "}") {
        i = j + 1;
        return [{ type: "sym", v: src[j] }];
      }
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      const cmd = src.slice(i + 1, j);
      i = j;
      if (cmd === "frac") {
        const num = argument();
        const den = argument();
        return [{ type: "frac", num, den }];
      }
      if (cmd === "sqrt") {
        skipWs();
        let index: Raw[] | null = null;
        if (src[i] === "[") {
          i++;
          index = group();
          if (src[i] === "]") i++;
        }
        return [{ type: "sqrt", body: argument(), index }];
      }
      if (cmd === "quad") return [{ type: "space", v: "quad" }];
      if ((STYLES as string[]).includes(cmd)) return [{ type: "style", style: cmd as StyleName, body: argument() }];
      const sym = SYMBOLS[cmd];
      if (sym) return [{ ...sym }];
      return [{ type: "text", v: cmd }];
    }
    // two-character operators
    const two = src.slice(i, i + 2);
    const TWO: Record<string, string> = { "<=": "≤", ">=": "≥", "!=": "≠", "+-": "±", "=>": "⇒", "->": "→", "<=>": "⇔" };
    if (src.slice(i, i + 3) === "<=>") {
      i += 3;
      return [{ type: "op", v: "⇔" }];
    }
    if (TWO[two]) {
      i += 2;
      return [{ type: "op", v: TWO[two] }];
    }
    i++;
    if (OPS[c]) return [{ type: "op", v: OPS[c] }];
    return [{ type: "text", v: c }];
  }

  const raw = group();
  return assignKeys(raw);
}

function assignKeys(nodes: Raw[]): DNode[] {
  const counts: Record<string, number> = {};
  const next = (name: string) => {
    const n = counts[name] ?? 0;
    counts[name] = n + 1;
    return `${name}#${n}`;
  };
  const walk = (list: Raw[]): DNode[] =>
    list.map((n) => {
      const out = { ...n } as DNode & { k?: string };
      switch (n.type) {
        case "num":
        case "var":
        case "op":
        case "text":
        case "sym":
          out.k = n.k ?? next(n.v ?? "");
          break;
        case "space":
          out.k = n.k ?? next("space");
          break;
        default:
          out.k = n.k ?? next(n.type);
      }
      const o = out as Record<string, unknown>;
      for (const field of ["num", "den", "base", "exp", "sub", "body"] as const) {
        if (Array.isArray(o[field])) o[field] = walk(o[field] as Raw[]);
      }
      if (Array.isArray(o.index)) o.index = walk(o.index as Raw[]);
      return out as DNode;
    });
  return walk(nodes);
}
