// The special functions behind the statistics: the error function, log-gamma, the regularised
// incomplete beta and gamma functions, and from them the normal, Student's t, chi-squared and F
// distributions with their inverses. Accurate to about 1e-12 or better (Excel shows 15 digits;
// lab work needs far fewer).

const SQRT2 = Math.SQRT2;
const SQRT_PI = Math.sqrt(Math.PI);

/** erfc(x) for x ≥ 0 by a continued fraction (Lentz), good for x ≳ 2. */
function erfcContinued(x: number): number {
  // erfc(x) = exp(-x²)/√π · 1/(x + 1/2/(x + 1/(x + 3/2/(x + 2/(x + …)))))
  const tiny = 1e-300;
  let f = x;
  if (f === 0) f = tiny;
  let C = f;
  let D = 0;
  for (let k = 1; k < 500; k++) {
    const a = k / 2;
    D = x + a * D;
    if (D === 0) D = tiny;
    C = x + a / C;
    if (C === 0) C = tiny;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / (SQRT_PI * f);
}

/** erf(x) by its series with positive terms (no cancellation), good for |x| ≲ 3. */
function erfSeries(x: number): number {
  // erf(x) = 2/√π · e^(−x²) · Σ 2ⁿ x^(2n+1) / (1·3·…·(2n+1))
  let term = x;
  let sum = x;
  const x2 = x * x;
  for (let n = 1; n < 200; n++) {
    term *= (2 * x2) / (2 * n + 1);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-17) break;
  }
  return (2 / SQRT_PI) * Math.exp(-x2) * sum;
}

export function erf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return -erf(-x);
  if (x < 2.5) return erfSeries(x);
  return 1 - erfcContinued(x);
}

export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return 2 - erfc(-x);
  if (x < 2.5) return 1 - erfSeries(x);
  return erfcContinued(x);
}

/** Standard normal cumulative distribution Φ(z). */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / SQRT2);
}

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Φ⁻¹(p): Acklam's rational approximation, then Halley steps on the exact Φ (≈1e-15). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) return NaN;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  let x: number;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - plow) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Refine: Halley's method with the accurate CDF (work in the tail that keeps precision).
  for (let k = 0; k < 3; k++) {
    const e = p < 0.5 ? normCdf(x) - p : -(normCdf(-x) - (1 - p));
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
    const nx = x - u / (1 + (x * u) / 2);
    if (!Number.isFinite(nx)) break;
    if (Math.abs(nx - x) < 1e-16 * Math.max(1, Math.abs(x))) {
      x = nx;
      break;
    }
    x = nx;
  }
  return x;
}

// ----------------------------------------------------------------------------------------------
// Gamma and beta

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x) for x > 0 (Lanczos, g = 7). */
export function lnGamma(x: number): number {
  if (x < 0.5) {
    // Reflection: Γ(x)Γ(1−x) = π / sin(πx)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (Numerical Recipes' betacf, modified Lentz). */
function betaCf(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lbt = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) return (bt * betaCf(a, b, x)) / a;
  return 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

// ----------------------------------------------------------------------------------------------
// Student's t

/** P(T ≤ t) for ν degrees of freedom (ν may be fractional, as in Welch's test). */
export function tCdf(t: number, df: number): number {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const x = df / (df + t * t);
  const tail = 0.5 * betaInc(x, df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}

/** P(T > |t|) · 2, computed without cancellation. */
export function tTwoTail(t: number, df: number): number {
  const x = df / (df + t * t);
  return betaInc(x, df / 2, 0.5);
}

/** Upper tail P(T > t) without cancellation for large t. */
export function tUpper(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * betaInc(x, df / 2, 0.5);
  return t > 0 ? tail : 1 - tail;
}

export function tPdf(t: number, df: number): number {
  return Math.exp(lnGamma((df + 1) / 2) - lnGamma(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log(1 + (t * t) / df));
}

/** The t with P(T ≤ t) = p: Newton steps on the exact CDF, kept inside a shrinking bracket. */
export function tInv(p: number, df: number): number {
  if (!(p > 0 && p < 1) || !(df > 0)) return NaN;
  if (p === 0.5) return 0;
  // Work with the lower tail q = min(p, 1−p) and mirror; the tail probability keeps full precision.
  const lower = p < 0.5;
  const q = lower ? p : 1 - p;
  // Starting point: the normal quantile corrected (Cornish–Fisher, Hill 1970).
  const z = -normInv(q);
  const g1 = (z * z * z + z) / 4;
  const g2 = (5 * Math.pow(z, 5) + 16 * z * z * z + 3 * z) / 96;
  const g3 = (3 * Math.pow(z, 7) + 19 * Math.pow(z, 5) + 17 * z * z * z - 15 * z) / 384;
  let t = z + g1 / df + g2 / (df * df) + g3 / (df * df * df);
  if (!Number.isFinite(t) || t <= 0) t = 1;
  // Bracket [lo, hi] with tailAt(lo) ≥ q ≥ tailAt(hi); the upper tail falls as t grows.
  const tailAt = (x: number) => 0.5 * betaInc(df / (df + x * x), df / 2, 0.5);
  let lo = 0;
  let hi = t;
  while (tailAt(hi) > q) {
    lo = hi;
    hi *= 2;
    if (hi > 1e300) break;
  }
  for (let k = 0; k < 200; k++) {
    const f = tailAt(t) - q;
    if (f > 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    const deriv = -tPdf(t, df);
    let next = t - f / deriv;
    if (!Number.isFinite(next) || next <= lo || next >= hi) next = (lo + hi) / 2;
    if (Math.abs(next - t) <= 1e-15 * Math.max(1, Math.abs(t))) {
      t = next;
      break;
    }
    t = next;
  }
  return lower ? -t : t;
}

// ----------------------------------------------------------------------------------------------
// Chi-squared and F

/** The P(a, x) series, good below x = a + 1. */
function gammaSeries(a: number, x: number): number {
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let n = 1; n < 1_000_000; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

/** Q(a, x) by a continued fraction (modified Lentz), good from x = a + 1 on. */
function gammaFraction(a: number, x: number): number {
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1_000_000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Regularised lower incomplete gamma P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaFraction(a, x);
}

/** Regularised upper incomplete gamma Q(a, x) = 1 − P(a, x), without cancellation in the tail. */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaFraction(a, x);
}

/** P(χ² ≤ x) for k degrees of freedom. */
export const chiSqCdf = (x: number, k: number) => gammaP(k / 2, x / 2);
/** P(χ² > x): the p-value of a chi-squared test. */
export const chiSqUpper = (x: number, k: number) => gammaQ(k / 2, x / 2);

export function chiSqPdf(x: number, k: number): number {
  if (x < 0) return 0;
  if (x === 0) return k < 2 ? Infinity : k === 2 ? 0.5 : 0;
  return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lnGamma(k / 2));
}

/** P(F ≤ x) for d1 and d2 degrees of freedom. */
export function fCdf(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  return betaInc((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2);
}

/** P(F > x), computed from its own side so small tails keep their digits. */
export function fUpper(x: number, d1: number, d2: number): number {
  if (x <= 0) return 1;
  return betaInc(d2 / (d2 + d1 * x), d2 / 2, d1 / 2);
}

export function fPdf(x: number, d1: number, d2: number): number {
  if (x < 0) return 0;
  if (x === 0) return d1 < 2 ? Infinity : d1 === 2 ? 1 : 0;
  const lnB = lnGamma(d1 / 2) + lnGamma(d2 / 2) - lnGamma((d1 + d2) / 2);
  return Math.exp((d1 / 2) * Math.log(d1 / d2) + (d1 / 2 - 1) * Math.log(x) - ((d1 + d2) / 2) * Math.log1p((d1 * x) / d2) - lnB);
}

/**
 * The x ≥ 0 where a distribution on [0, ∞) has the lower tail p (`upper`: the upper tail p).
 * Works on whichever tail is smaller, so tiny probabilities keep their precision: Newton steps
 * with the density, inside a bracket that bisection falls back on.
 */
function invertTail(p: number, upper: boolean, cdf: (x: number) => number, sf: (x: number) => number, pdf: (x: number) => number, start: number): number {
  const useUpper = upper ? p <= 0.5 : p > 0.5;
  const q = upper === useUpper ? p : 1 - p;
  const tail = useUpper ? sf : cdf;
  // tail(x) − q falls (upper tail) or rises (lower tail) with x: f > 0 means x is too small (upper)…
  const tooSmall = (f: number) => (useUpper ? f > 0 : f < 0);
  let lo = 0;
  let hi = Math.max(1, start);
  while (tooSmall(tail(hi) - q)) {
    lo = hi;
    hi *= 2;
    if (hi > 1e300) return NaN;
  }
  let x = start > lo && start < hi ? start : (lo + hi) / 2;
  for (let k = 0; k < 300; k++) {
    const f = tail(x) - q;
    if (f === 0) return x;
    if (tooSmall(f)) lo = x;
    else hi = x;
    const slope = useUpper ? -pdf(x) : pdf(x);
    let next = x - f / slope;
    if (!Number.isFinite(next) || next <= lo || next >= hi) next = (lo + hi) / 2;
    if (Math.abs(next - x) <= 1e-15 * Math.abs(x) || hi - lo <= 1e-15 * hi) return next;
    x = next;
  }
  return x;
}

/** The x with P(χ² ≤ x) = p (`upper`: P(χ² > x) = p). */
export function chiSqInv(p: number, k: number, upper = false): number {
  // A start near the answer (Wilson–Hilferty): (1 − 2/(9k) + z·√(2/(9k)))³ · k.
  const z = normInv(upper ? 1 - p : p);
  const w = 2 / (9 * k);
  const start = Number.isFinite(z) ? k * Math.pow(Math.max(0.01, 1 - w + z * Math.sqrt(w)), 3) : k;
  return invertTail(
    p,
    upper,
    (x) => chiSqCdf(x, k),
    (x) => chiSqUpper(x, k),
    (x) => chiSqPdf(x, k),
    start,
  );
}

/** The x with P(F ≤ x) = p (`upper`: P(F > x) = p). */
export function fInv(p: number, d1: number, d2: number, upper = false): number {
  return invertTail(
    p,
    upper,
    (x) => fCdf(x, d1, d2),
    (x) => fUpper(x, d1, d2),
    (x) => fPdf(x, d1, d2),
    1,
  );
}

/** Γ(n+1) = n! for whole n (exact for small n). */
export function factorial(n: number): number {
  if (n < 0) return NaN;
  if (n < 171) {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
  return Infinity;
}
