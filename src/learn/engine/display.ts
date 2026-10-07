// The tiny language lesson authors write maths in, parsed into a tree for <MathView>.
//
//   3(x + 2) = 3x + 6          implicit products, brackets
//   x^2   x^{n+1}   x_1        powers and subscripts (single atom or {group})
//   \frac{3}{4}   \sqrt{x}     fractions and roots (\sqrt[3]{x} for other roots)
//   "cm"                       plain text (units, words)
//   * → ·    - → −   <= → ≤   >= → ≥   != → ≠   +- → ±   => → ⇒
//   \pi \Delta \cdot \pm \le \ge \ne \approx \to \Rightarrow \infty \deg \rho …
//   \, \; \quad (spaces)   \\ (line break)   \{ \} (set braces)
//   \sin \cos \tan \log \lg \ln   upright functions (\log_2 8)
//   \binom{n}{k}   \abs{x}   \overline{36} (\period, \bar)   binomial coefficient, |x|, a bar on top
//   \Q \R \N \Z \in \notin \setminus \cap \cup \dots \delta \theta \prime \perp \parallel   symbols
//   \hl{..} \blob{..} \red{..} \green{..} \fade{..} \strike{..} \box{..}   styles
//   \group{..}                 keeps its contents on one line, no styling
//   x#key                      give a token a fixed animation key
//
// Every leaf gets a stable key ("x#0", "+#1", …) so the same token glides to its
// new place when the next animation frame is shown.

export type StyleName = "hl" | "blob" | "red" | "green" | "fade" | "strike" | "box" | "group" | "over";

export type DNode =
  | { k: string; type: "num" | "var" | "op" | "text" | "sym" | "fn"; v: string }
  | { k: string; type: "frac"; num: DNode[]; den: DNode[]; nobar?: boolean }
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
  sim: { type: "op", v: "∼" },
  propto: { type: "op", v: "∝" },
  to: { type: "op", v: "→" },
  Rightarrow: { type: "op", v: "⇒" },
  Leftrightarrow: { type: "op", v: "⇔" },
  uparrow: { type: "sym", v: "↑" },
  downarrow: { type: "sym", v: "↓" },
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
  Q: { type: "sym", v: "ℚ" },
  R: { type: "sym", v: "ℝ" },
  N: { type: "sym", v: "ℕ" },
  Z: { type: "sym", v: "ℤ" },
  notin: { type: "op", v: "∉" },
  setminus: { type: "op", v: "∖" },
  cap: { type: "op", v: "∩" },
  cup: { type: "op", v: "∪" },
  subset: { type: "op", v: "⊂" },
  perp: { type: "op", v: "⊥" },
  parallel: { type: "op", v: "∥" },
  dots: { type: "sym", v: "…" },
  ldots: { type: "sym", v: "…" },
  cdots: { type: "sym", v: "⋯" },
  delta: { type: "sym", v: "δ" },
  theta: { type: "sym", v: "θ" },
  phi: { type: "sym", v: "φ" },
  epsilon: { type: "sym", v: "ε" },
  prime: { type: "sym", v: "′" },
  angle: { type: "sym", v: "∠" },
};
/** Function names, set upright: \sin x, \log_2 8. */
const FUNCTIONS = new Set(["sin", "cos", "tan", "log", "lg", "ln", "exp"]);
/** Style commands with another name: \overline, \period and \bar draw a bar on top. */
const STYLE_ALIASES: Record<string, StyleName> = { overline: "over", period: "over", bar: "over" };
const STYLES: StyleName[] = ["hl", "blob", "red", "green", "fade", "strike", "box", "group", "over"];
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
  nobar?: boolean;
};

/** A lone element with a number and a sign is an ion: "Mg2+" means Mg²⁺ (as chemists write it), not Mg₂⁺. */
export const ionCharges = (text: string) => text.replace(/(^|[\s(+>])(\d*)([A-Z][a-z]?)(\d+)([+-])(?=$|[\s)#])/g, "$1$2$3^$4$5");

/** Chemical notation inside \\ce{…}: upright element symbols, automatic subscripts and charges. Each species stays on one line. */
function chem(text: string): Raw[] {
  const out: Raw[] = [];
  let run: Raw[] = [];
  const flush = () => {
    if (run.length > 1) out.push({ type: "style", style: "group", body: run });
    else out.push(...run);
    run = [];
  };
  for (const r of chemTokens(ionCharges(text))) {
    if (r.type === "op") {
      flush();
      out.push(r);
    } else run.push(r);
  }
  flush();
  return out;
}

function chemTokens(text: string): Raw[] {
  const out: Raw[] = [];
  let i = 0;
  let speciesStart = true; // a number here is a coefficient, not a subscript
  const last = () => out[out.length - 1];
  const isSpecies = (r?: Raw) => !!r && (r.type === "sym" || r.type === "sub" || r.type === "paren" || r.type === "pow");
  const charge = (raw: string) => raw.replace(/-/g, "−");

  while (i < text.length) {
    const c = text[i];
    if (c === " ") {
      i++;
      speciesStart = true;
      continue;
    }
    if (c === "#") {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_-]/.test(text[j])) j++;
      const prev = last();
      if (prev) prev.k = text.slice(i + 1, j);
      i = j;
      continue;
    }
    const three = text.slice(i, i + 3);
    const two = text.slice(i, i + 2);
    if (three === "<=>" || c === "⇌") {
      out.push({ type: "op", v: "⇌" });
      i += c === "⇌" ? 1 : 3;
      speciesStart = true;
      continue;
    }
    if (two === "->" || c === "→") {
      out.push({ type: "op", v: "→" });
      i += c === "→" ? 1 : 2;
      speciesStart = true;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < text.length && /[0-9.,]/.test(text[j])) j++;
      const num = text.slice(i, j);
      i = j;
      const prev = last();
      if (!speciesStart && isSpecies(prev)) {
        out.pop();
        out.push({ type: "sub", base: [prev!], sub: [{ type: "num", v: num }] });
      } else out.push({ type: "num", v: num });
      continue;
    }
    if (/[A-Z]/.test(c) || (c === "e" && !/[a-z]/.test(text[i + 1] ?? ""))) {
      let j = i + 1;
      if (c !== "e") while (j < text.length && /[a-z]/.test(text[j])) j++;
      out.push({ type: "sym", v: text.slice(i, j) });
      i = j;
      speciesStart = false;
      continue;
    }
    if (c === "^") {
      // explicit charge: ^2-, ^{3+}, ^+
      i++;
      let raw = "";
      if (text[i] === "{") {
        const j = text.indexOf("}", i);
        raw = text.slice(i + 1, j < 0 ? text.length : j);
        i = j < 0 ? text.length : j + 1;
      } else {
        const m = text.slice(i).match(/^[0-9]*[+-]?/);
        raw = m ? m[0] : "";
        i += raw.length;
      }
      const prev = out.pop();
      out.push({ type: "pow", base: prev ? [prev] : [], exp: [{ type: "sym", v: charge(raw) }] });
      continue;
    }
    if ((c === "+" || c === "-") && !speciesStart && isSpecies(last()) && /^(?:$|[\s)#])/.test(text.slice(i + 1, i + 2))) {
      // trailing charge: Na+, Cl-
      const prev = out.pop()!;
      out.push({ type: "pow", base: [prev], exp: [{ type: "sym", v: charge(c) }] });
      i++;
      continue;
    }
    if (c === "(" || c === "[") {
      const close = c === "(" ? ")" : "]";
      const j = text.indexOf(close, i);
      const inner = text.slice(i + 1, j < 0 ? text.length : j);
      i = j < 0 ? text.length : j + 1;
      if (/^(aq|s|l|g)$/.test(inner)) out.push({ type: "text", v: `(${inner})` });
      else out.push({ type: "paren", open: c, close, body: chemTokens(inner) });
      speciesStart = false;
      continue;
    }
    if (c === "*" || c === "·") {
      out.push({ type: "op", v: "·" });
      i++;
      speciesStart = true;
      continue;
    }
    if (c === "+" || c === "=") {
      out.push({ type: "op", v: c });
      i++;
      speciesStart = true;
      continue;
    }
    out.push({ type: "text", v: c });
    i++;
  }
  return out;
}

export function parseDisplay(src: string): DNode[] {
  let i = 0;

  const skipWs = () => {
    while (i < src.length && src[i] === " ") i++;
  };

  function group(inSet = false): Raw[] {
    // Parses until a closing } or ) or ] belonging to the caller (inside \{ … \} also until \}).
    const out: Raw[] = [];
    for (;;) {
      skipWs();
      if (i >= src.length) return out;
      if (inSet && src.startsWith("\\}", i)) return out;
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
      // 0,\overline{36}: the decimal comma belongs to the number, and number and period stay together.
      if (/[.,]/.test(src[j] ?? "") && /^\\(overline|period|bar)\b/.test(src.slice(j + 1))) {
        const v = src.slice(i, j + 1);
        i = j + 1;
        return [{ type: "style", style: "group", body: [{ type: "num", v }, ...atom()] }];
      }
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
      if (src[j] === "{") {
        // A set {−5; 5} stays on one line.
        i = j + 1;
        const body = group(true);
        const closed = src.startsWith("\\}", i);
        if (closed) i += 2;
        return [{ type: "style", style: "group", body: [{ type: "sym", v: "{" }, ...body, ...(closed ? [{ type: "sym" as const, v: "}" }] : [])] }];
      }
      if (src[j] === "}") {
        i = j + 1;
        return [{ type: "sym", v: "}" }];
      }
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      const cmd = src.slice(i + 1, j);
      i = j;
      if (cmd === "ce") {
        // Chemistry: \ce{2H2 + O2 -> 2H2O}, \ce{SO4^2-}, \ce{Ca(OH)2}, \ce{Na+ (aq)}
        skipWs();
        if (src[i] !== "{") return [];
        let depth = 0;
        let j = i;
        for (; j < src.length; j++) {
          if (src[j] === "{") depth++;
          else if (src[j] === "}" && --depth === 0) break;
        }
        const body = src.slice(i + 1, j);
        i = j + 1;
        return chem(body);
      }
      if (cmd === "text") {
        // \text{plain words}, like "…" quotes
        skipWs();
        if (src[i] !== "{") return [];
        const j = src.indexOf("}", i);
        const v = src.slice(i + 1, j < 0 ? src.length : j);
        i = j < 0 ? src.length : j + 1;
        return [{ type: "text", v }];
      }
      if (cmd === "frac") {
        // As in LaTeX, \frac12 is one half: without braces each argument is one digit.
        const digit = (): Raw[] | null => {
          skipWs();
          if (!/[0-9]/.test(src[i] ?? "")) return null;
          return [{ type: "num", v: src[i++] }];
        };
        const num = digit() ?? argument();
        const den = digit() ?? argument();
        return [{ type: "frac", num, den }];
      }
      if (cmd === "binom") {
        const num = argument();
        const den = argument();
        return [{ type: "paren", open: "(", close: ")", body: [{ type: "frac", num, den, nobar: true }] }];
      }
      if (cmd === "abs") return [{ type: "paren", open: "|", close: "|", body: argument() }];
      if (FUNCTIONS.has(cmd)) {
        // The name with its index or power (log₂, sin²) and its argument stay together: sin 30°, log₂ 32.
        let head: Raw = { type: "fn", v: cmd };
        const script = (base: Raw): Raw => {
          skipWs();
          if (src[i] !== "^" && src[i] !== "_") return base;
          const c = src[i++];
          const arg = argument();
          return c === "^" ? { type: "pow", base: [base], exp: arg } : { type: "sub", base: [base], sub: arg };
        };
        head = script(head);
        skipWs();
        const rest = src.slice(i);
        const startsArgument = /^[0-9A-Za-z(]/.test(rest) || /^\\(alpha|beta|gamma|delta|theta|phi|varphi|omega|pi|frac|sqrt|abs)\b/.test(rest);
        if (!startsArgument) return [head];
        const [arg, ...more] = atom();
        return [{ type: "style", style: "group", body: [head, ...(arg ? [script(arg)] : []), ...more] }];
      }
      if (STYLE_ALIASES[cmd]) return [{ type: "style", style: STYLE_ALIASES[cmd], body: argument() }];
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
        case "fn":
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
