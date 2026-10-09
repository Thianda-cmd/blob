// Functions students type for a plot: "x^2 - 2", "2x + 1", "f(x) = 0,5x³", "sin(x)", "√x", "1/x",
// "e^x", "|x|", "ln(x)". Parsed into a small tree once, then evaluated quickly for every point.

type Fn = (x: number) => number;
type Tok = { k: "num"; v: number } | { k: "id"; v: string } | { k: "op"; v: string };

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sqrt: Math.sqrt,
  wurzel: Math.sqrt,
  abs: Math.abs,
  betrag: Math.abs,
  ln: Math.log,
  log: Math.log10,
  lg: Math.log10,
  exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function tokenize(input: string): Tok[] | null {
  const src = input
    .replace(/^\s*(?:[a-zA-Z]\s*\(\s*x\s*\)|y)\s*=/, "")
    .replace(/[−–—]/g, "-")
    .replace(/[·×∙⋅*]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt");
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.,]/.test(src[j])) j++;
      const n = Number(src.slice(i, j).replace(",", "."));
      if (!Number.isFinite(n)) return null;
      out.push({ k: "num", v: n });
      i = j;
      continue;
    }
    if (/[a-zA-ZäöüÄÖÜß]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-ZäöüÄÖÜß]/.test(src[j])) j++;
      let word = src.slice(i, j).toLowerCase();
      // Split "xsin" or "2pix" style runs into known names and single letters.
      while (word) {
        const name = Object.keys(FUNCS)
          .concat(Object.keys(CONSTS))
          .sort((a, b) => b.length - a.length)
          .find((n) => word.startsWith(n));
        if (name) {
          out.push({ k: "id", v: name });
          word = word.slice(name.length);
        } else {
          out.push({ k: "id", v: word[0] });
          word = word.slice(1);
        }
      }
      i = j;
      continue;
    }
    if ("+-*/^()|".includes(c)) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    return null;
  }
  return out;
}

/** Parse a function of x. Null when it can't be read. */
export function parseFunction(input: string): Fn | null {
  if (!input.trim()) return null;
  const tokens = tokenize(input);
  if (!tokens || !tokens.length) return null;
  const toks: Tok[] = tokens;
  let i = 0;
  let absDepth = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.k === "op" && (peek() as { v: string }).v === v;

  // expr := term (("+"|"-") term)*
  function expr(): Fn {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[i++] as { v: string }).v;
      const l = left;
      const r = term();
      left = op === "+" ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return left;
  }
  // term := unary (("*"|"/"|implicit) unary)*
  function term(): Fn {
    let left = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (toks[i++] as { v: string }).v;
        const l = left;
        const r = unary();
        left = op === "*" ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
        continue;
      }
      const t = peek();
      // Implicit product: 2x, 3(x+1), x sin(x), (x+1)(x-1). A "|" only opens a new |…| when we're not inside one.
      if (t && (t.k === "num" || t.k === "id" || (t.k === "op" && (t.v === "(" || (t.v === "|" && absDepth === 0))))) {
        const l = left;
        const r = unary();
        left = (x) => l(x) * r(x);
        continue;
      }
      return left;
    }
  }
  function unary(): Fn {
    if (isOp("-")) {
      i++;
      const v = unary();
      return (x) => -v(x);
    }
    if (isOp("+")) {
      i++;
      return unary();
    }
    return power();
  }
  // power := atom ("^" unary)?   (right associative: 2^x^2 = 2^(x^2))
  function power(): Fn {
    const base = atom();
    if (isOp("^")) {
      i++;
      const exp = unary();
      return (x) => Math.pow(base(x), exp(x));
    }
    return base;
  }
  function atom(): Fn {
    const t = toks[i++];
    if (!t) throw new Error("end");
    if (t.k === "num") return () => t.v;
    if (t.k === "op" && t.v === "(") {
      const inner = expr();
      if (!isOp(")")) throw new Error(")");
      i++;
      return inner;
    }
    if (t.k === "op" && t.v === "|") {
      absDepth++;
      const inner = expr();
      absDepth--;
      if (!isOp("|")) throw new Error("|");
      i++;
      return (x) => Math.abs(inner(x));
    }
    if (t.k === "id") {
      if (t.v === "x") return (x) => x;
      if (t.v in CONSTS) {
        const c = CONSTS[t.v];
        return () => c;
      }
      const fn = FUNCS[t.v];
      if (fn) {
        // sin x, sin(x), sin^2(x) is not supported; sin 2x reads as sin(2x).
        const arg = isOp("(") ? atom() : power();
        return (x) => fn(arg(x));
      }
    }
    throw new Error("token");
  }

  try {
    const f = expr();
    if (i !== toks.length) return null;
    // A function that can't even be evaluated somewhere isn't one.
    const probe = [-2.3, -1, 0.5, 1.7, 3.1].some((x) => Number.isFinite(f(x)));
    return probe ? f : null;
  } catch {
    return null;
  }
}
