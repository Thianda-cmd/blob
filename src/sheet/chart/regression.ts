// Trendlines like Excel's (Trendlinie): the same model, coefficients, equation and R², so a
// calibration line here matches the one in class.
//
// CONTRACT: used by the chart data (data.ts), the chart view and tests. Keep names and signatures.
//
// Models (Excel's): linear y = m·x + b; polynomial y = cₙxⁿ + … + c₁x + c₀; exponential
// y = a·e^(b·x) (fitted on ln y); logarithmic y = a·ln(x) + b; power y = a·x^b (fitted on ln x,
// ln y); moving average over `period` points. R² as Excel shows it (for exponential and power: of
// the fit on the logarithms; with a fixed intercept: Excel's own definition, see the tests).

import type { Locale } from "@/i18n/config";
import type { TrendlineSpec } from "../types";

export type Fit = {
  type: TrendlineSpec["type"];
  /**
   * linear [b, m]; polynomial [c₀, c₁, …, cₙ]; exponential [a, b]; logarithmic [b, a] (y = a·ln x + b);
   * power [a, b]; movingAverage [] (see `points`).
   */
  coefficients: number[];
  /** Coefficient of determination; null for moving averages. */
  r2: number | null;
  /** Points used (pairs with both numbers; and x > 0 / y > 0 where the model needs it). */
  n: number;
  /** The fitted y at x (NaN outside the model's domain, e.g. ln of x ≤ 0). */
  predict(x: number): number;
  /** Moving average: the averaged points, in x order. */
  points?: { x: number; y: number }[];
};

export type FitError = { error: "too-few-points" | "non-positive-x" | "non-positive-y" | "singular" | "bad-intercept" };

/** Fit a trendline to (x, y) pairs (NaN pairs skipped). Moving averages keep the data's order. */
export function fitTrendline(xs: number[], ys: number[], spec: Pick<TrendlineSpec, "type" | "order" | "period" | "intercept">): Fit | FitError {
  void xs;
  void ys;
  void spec;
  throw new Error("regression: fitTrendline not implemented");
}

/**
 * The equation as Excel shows it on the chart, in the user's number format:
 * "y = 0,0523x + 0,0012", "y = 1,2e^(0,35x)" (rendered with a superscript by the chart),
 * "y = 2,1ln(x) - 0,5", "y = 0,3x² - 1,2x + 4". `digits`: significant digits (Excel: 4–5).
 */
export function equationText(fit: Fit, locale: Locale, digits?: number): string {
  void fit;
  void locale;
  void digits;
  throw new Error("regression: equationText not implemented");
}

/** "R² = 0,9987" in the user's number format. */
export function r2Text(r2: number, locale: Locale, digits?: number): string {
  void r2;
  void locale;
  void digits;
  throw new Error("regression: r2Text not implemented");
}

/**
 * Solve a fitted line for x: the concentration of a sample from its measured value (y), the
 * everyday use of a calibration curve. null when there is no (unique) answer.
 */
export function solveForX(fit: Fit, y: number): number | null {
  void fit;
  void y;
  throw new Error("regression: solveForX not implemented");
}
