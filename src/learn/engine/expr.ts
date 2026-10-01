// Parses, evaluates and compares the maths students type in.
// Accepts school notation: 2x, 3(x+1), x², √9, 2,5 (decimal comma), ·, ×, :, −.

export type Ast =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "add" | "sub" | "div"; l: Ast; r: Ast }
  | { t: "mul"; l: Ast; r: Ast; implicit?: boolean }
  | { t: "pow"; b: Ast; e: Ast }
  | { t: "neg"; e: Ast }
  | { t: "sqrt"; e: Ast };

type Tok =
  | { k: "num"; v: number; s: string }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "fn"; v: "sqrt" };

export type ParseResult = { ok: true; ast: Ast } | { ok: false; error: string };

const FUNCTIONS = ["sqrt", "wurzel", "root"];

function tokenize(input: string): Tok[] | string {
  const src = input
    .replace(/[−–—]/g, "-")
    .replace(/[·×∙⋅*]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/π/g, "pi")
    .replace(/√/g, " sqrt ")
    .replace(/\[/g, "(")
    .replace(/]/g, ")");
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
      const raw = src.slice(i, j);
      const norm = raw.replace(",", ".");
      if ((norm.match(/\./g) ?? []).length > 1 || norm === ".") return `I can't read the number "${raw}".`;
      out.push({ k: "num", v: Number(norm), s: raw });
      i = j;
      continue;
    }
    if (/[a-zA-ZäöüÄÖÜß]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const word = src.slice(i, j).toLowerCase();
      if (FUNCTIONS.includes(word)) {
        out.push({ k: "fn", v: "sqrt" });
      } else if (word === "pi") {
        out.push({ k: "num", v: Math.PI, s: "π" });
      } else {
        // Separate letters are separate variables multiplied together: "xy" = x·y.
        for (const ch of src.slice(i, j)) out.push({ k: "id", v: ch });
      }
      i = j;
      continue;
    }
    if ("+-*/^()".includes(c)) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    return `I don't know the symbol "${c}".`;
  }
  return out;
}

export function parse(input: string): ParseResult {
  const lexed = tokenize(input);
  if (typeof lexed === "string") return { ok: false, error: lexed };
  if (lexed.length === 0) return { ok: false, error: "Type an answer first." };
  const toks: Tok[] = lexed;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.k === "op" && (peek() as { v: string }).v === v;
  const startsAtom = () => {
    const t = peek();
    return !!t && (t.k === "num" || t.k === "id" || t.k === "fn" || (t.k === "op" && t.v === "("));
  };

  function expr(): Ast {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as { v: string }).v;
      const right = term();
      left = { t: op === "+" ? "add" : "sub", l: left, r: right };
    }
    return left;
  }
  function term(): Ast {
    let left = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (toks[p++] as { v: string }).v;
        const right = unary();
        left = op === "*" ? { t: "mul", l: left, r: right } : { t: "div", l: left, r: right };
      } else if (startsAtom()) {
        left = { t: "mul", l: left, r: power(), implicit: true };
      } else break;
    }
    return left;
  }
  function unary(): Ast {
    if (isOp("-")) {
      p++;
      return { t: "neg", e: unary() };
    }
    if (isOp("+")) {
      p++;
      return unary();
    }
    return power();
  }
  function power(): Ast {
    const base = atom();
    if (isOp("^")) {
      p++;
      return { t: "pow", b: base, e: unary() };
    }
    return base;
  }
  function atom(): Ast {
    const t = toks[p++];
    if (!t) throw new Error("Something is missing at the end.");
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "id") return { t: "var", name: t.v };
    if (t.k === "fn") {
      if (isOp("(")) {
        p++;
        const inner = expr();
        if (!isOp(")")) throw new Error("A bracket is missing.");
        p++;
        return { t: "sqrt", e: inner };
      }
      return { t: "sqrt", e: power() };
    }
    if (t.v === "(") {
      const inner = expr();
      if (!isOp(")")) throw new Error("A closing bracket is missing.");
      p++;
      return inner;
    }
    throw new Error(t.v === ")" ? "There's an extra closing bracket." : `"${t.v}" can't go there.`);
  }

  try {
    const ast = expr();
    if (p < toks.length) {
      const t = toks[p];
      return { ok: false, error: t.k === "op" && t.v === ")" ? "There's an extra closing bracket." : "I couldn't read all of that." };
    }
    return { ok: true, ast };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function evaluate(ast: Ast, env: Record<string, number>): number {
  switch (ast.t) {
    case "num":
      return ast.v;
    case "var":
      return ast.name in env ? env[ast.name] : NaN;
    case "add":
      return evaluate(ast.l, env) + evaluate(ast.r, env);
    case "sub":
      return evaluate(ast.l, env) - evaluate(ast.r, env);
    case "mul":
      return evaluate(ast.l, env) * evaluate(ast.r, env);
    case "div":
      return evaluate(ast.l, env) / evaluate(ast.r, env);
    case "pow":
      return Math.pow(evaluate(ast.b, env), evaluate(ast.e, env));
    case "neg":
      return -evaluate(ast.e, env);
    case "sqrt":
      return Math.sqrt(evaluate(ast.e, env));
  }
}

export function variables(ast: Ast, out = new Set<string>()): Set<string> {
  if (ast.t === "var") out.add(ast.name);
  if ("l" in ast) {
    variables(ast.l, out);
    variables(ast.r, out);
  }
  if (ast.t === "pow") {
    variables(ast.b, out);
    variables(ast.e, out);
  }
  if (ast.t === "neg" || ast.t === "sqrt") variables(ast.e, out);
  return out;
}

export function close(a: number, b: number, tol = 1e-9) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Are two expressions the same function? Checked at random points (with positive values when `positive`). */
export function equivalent(a: Ast, b: Ast, opts: { positive?: boolean } = {}): boolean {
  const names = [...new Set([...variables(a), ...variables(b)])];
  let valid = 0;
  for (let i = 0; i < 24 && valid < 8; i++) {
    const env: Record<string, number> = {};
    for (const n of names) {
      const r = 0.37 + ((i * 7919 + n.charCodeAt(0) * 104729) % 1000) / 160;
      env[n] = opts.positive || i % 2 === 0 ? r : -r;
    }
    const x = evaluate(a, env);
    const y = evaluate(b, env);
    if (!Number.isFinite(x) && !Number.isFinite(y)) continue;
    if (!close(x, y, 1e-7)) return false;
    valid++;
  }
  return valid >= 3;
}

export function equivalentText(a: string, b: string, opts: { positive?: boolean } = {}) {
  const pa = parse(a);
  const pb = parse(b);
  return pa.ok && pb.ok && equivalent(pa.ast, pb.ast, opts);
}

const isSum = (a: Ast) => a.t === "add" || a.t === "sub";

/** True when no product or power still contains a bracketed sum, e.g. "6x + 9" but not "3(2x + 3)". */
export function isExpanded(ast: Ast): boolean {
  switch (ast.t) {
    case "mul":
      if (isSum(stripNeg(ast.l)) || isSum(stripNeg(ast.r))) return false;
      return isExpanded(ast.l) && isExpanded(ast.r);
    case "pow":
      if (isSum(stripNeg(ast.b))) return false;
      return isExpanded(ast.b) && isExpanded(ast.e);
    case "neg":
      if (isSum(ast.e)) return false;
      return isExpanded(ast.e);
    case "div":
      if (isSum(ast.r)) return isExpanded(ast.l);
      return isExpanded(ast.l) && isExpanded(ast.r);
    case "add":
    case "sub":
      return isExpanded(ast.l) && isExpanded(ast.r);
    case "sqrt":
      return isExpanded(ast.e);
    default:
      return true;
  }
}

function stripNeg(a: Ast): Ast {
  return a.t === "neg" ? stripNeg(a.e) : a;
}

/** Monomial signature like "x^2y" for each term of a sum, or null when the expression isn't a plain polynomial. */
export function termSignatures(ast: Ast): string[] | null {
  const terms: Ast[] = [];
  const flatten = (a: Ast) => {
    if (a.t === "add" || a.t === "sub") {
      flatten(a.l);
      flatten(a.r);
    } else terms.push(a);
  };
  flatten(ast);
  const sigs: string[] = [];
  for (const term of terms) {
    const powers: Record<string, number> = {};
    const walk = (a: Ast): boolean => {
      if (a.t === "num") return true;
      if (a.t === "var") {
        powers[a.name] = (powers[a.name] ?? 0) + 1;
        return true;
      }
      if (a.t === "neg") return walk(a.e);
      if (a.t === "mul") return walk(a.l) && walk(a.r);
      if (a.t === "div") return walk(a.l) && a.r.t === "num";
      if (a.t === "pow" && a.b.t === "var" && a.e.t === "num") {
        powers[a.b.name] = (powers[a.b.name] ?? 0) + a.e.v;
        return true;
      }
      return false;
    };
    if (!walk(term)) return null;
    sigs.push(
      Object.keys(powers)
        .sort()
        .filter((k) => powers[k] !== 0)
        .map((k) => (powers[k] === 1 ? k : `${k}^${powers[k]}`))
        .join(""),
    );
  }
  return sigs;
}

/** Like terms combined? ("5x + 3" yes, "3x + 2x + 3" no). Non-polynomials count as simplified. */
export function likeTermsCombined(ast: Ast): boolean {
  const sigs = termSignatures(ast);
  if (!sigs) return true;
  return new Set(sigs).size === sigs.length;
}

// ---------------------------------------------------------------------------
// Display: turn an AST back into the display language used by <MathView>.

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "?";
  const r = Math.round(n * 1e6) / 1e6;
  return String(r);
}

export function toDisplay(ast: Ast, parentPrec = 0): string {
  const wrap = (s: string, prec: number) => (prec < parentPrec ? `(${s})` : s);
  switch (ast.t) {
    case "num":
      // Display output uses the decimal comma students write in Germany.
      return ast.v < 0 ? wrap(`-${fmt(-ast.v).replace(".", ",")}`, 3) : fmt(ast.v).replace(".", ",");
    case "var":
      return ast.name;
    case "add":
      return wrap(`${toDisplay(ast.l, 1)} + ${toDisplay(ast.r, 1)}`, 1);
    case "sub":
      return wrap(`${toDisplay(ast.l, 1)} - ${toDisplay(ast.r, 2)}`, 1);
    case "mul": {
      const l = toDisplay(ast.l, 2);
      const r = toDisplay(ast.r, 2);
      const juxtapose = ast.implicit !== false && (ast.r.t === "var" || ast.r.t === "pow" || ast.r.t === "sqrt" || r.startsWith("(")) && ast.l.t !== "div";
      return wrap(juxtapose ? `${l}${r}` : `${l} * ${r}`, 2);
    }
    case "div":
      return `\\frac{${toDisplay(ast.l)}}{${toDisplay(ast.r)}}`;
    case "pow":
      return wrap(`${toDisplay(ast.b, 5)}^{${toDisplay(ast.e)}}`, 4);
    case "neg":
      return wrap(`-${toDisplay(ast.e, 3)}`, 3);
    case "sqrt":
      return `\\sqrt{${toDisplay(ast.e)}}`;
  }
}

/** Parse a number the way students type it: "3", "-2,5", "3/4", "1 1/2" isn't supported on purpose. */
export function parseNumber(input: string): number | null {
  const r = parse(input);
  if (!r.ok || variables(r.ast).size) return null;
  const v = evaluate(r.ast, {});
  return Number.isFinite(v) ? v : null;
}
