// Charts as files: SVG (vector, for reports) and PNG (2× for sharp prints), in light colours.
//
// CONTRACT: keep names and signatures.

import type { Locale } from "@/i18n/config";
import type { ChartSpec } from "../types";
import type { ChartData } from "./data";

export function chartSvg(spec: ChartSpec, data: ChartData, locale: Locale, size?: { w: number; h: number }): string {
  void spec;
  void data;
  void locale;
  void size;
  throw new Error("chart: chartSvg not implemented");
}

export function chartPng(spec: ChartSpec, data: ChartData, locale: Locale, size?: { w: number; h: number }): Promise<Blob> {
  void spec;
  void data;
  void locale;
  void size;
  throw new Error("chart: chartPng not implemented");
}
