// Ready-made spreadsheets for the lab (BTA training, first semesters): calibration curve,
// dilution series, growth curve, replicate measurements with mean and standard deviation, and more.
// Each builds a complete workbook in the user's language with formulas, a smart table and a chart.
//
// CONTRACT: keep the types; SHEET_TEMPLATES is shown by TemplatePicker.

import type { Locale } from "@/i18n/config";
import type { Text } from "@/i18n/text";
import type { Workbook } from "./types";

export type SheetTemplate = {
  id: string;
  /** lucide icon name hint for the picker (e.g. "trending-up", "flask-conical", "sigma"). Never sparkles or wands. */
  icon: string;
  title: Text;
  description: Text;
  build(locale: Locale): Workbook;
};

export const SHEET_TEMPLATES: SheetTemplate[] = [];
