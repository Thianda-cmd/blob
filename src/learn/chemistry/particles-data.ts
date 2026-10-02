// Facts for the "particles" topic: states of matter, the six changes of state and melting and
// boiling temperatures at normal pressure (1013 hPa), rounded to whole degrees
// (CRC Handbook values).

import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { dec } from "./format";

export type State = 0 | 1 | 2;

export const STATE_NAMES: Record<State, Text> = {
  0: tx("solid", "fest"),
  1: tx("liquid", "flüssig"),
  2: tx("gas", "gasförmig"),
};

/** "(s)", "(l)", "(g)" */
export const STATE_SYMBOL: Record<State, string> = { 0: "s", 1: "l", 2: "g" };

export type Substance = {
  id: string;
  name: Text;
  /** Melting temperature in °C (equals the freezing temperature). */
  mp: number;
  /** Boiling temperature in °C (equals the condensing temperature). */
  bp: number;
};

export const SUBSTANCES: Substance[] = [
  { id: "water", name: tx("water", "Wasser"), mp: 0, bp: 100 },
  { id: "ethanol", name: tx("ethanol", "Ethanol"), mp: -114, bp: 78 },
  { id: "mercury", name: tx("mercury", "Quecksilber"), mp: -39, bp: 357 },
  { id: "oxygen", name: tx("oxygen", "Sauerstoff"), mp: -219, bp: -183 },
  { id: "nitrogen", name: tx("nitrogen", "Stickstoff"), mp: -210, bp: -196 },
  { id: "bromine", name: tx("bromine", "Brom"), mp: -7, bp: 59 },
  { id: "iron", name: tx("iron", "Eisen"), mp: 1538, bp: 2862 },
  { id: "copper", name: tx("copper", "Kupfer"), mp: 1085, bp: 2562 },
  { id: "lead", name: tx("lead", "Blei"), mp: 327, bp: 1749 },
  { id: "tin", name: tx("tin", "Zinn"), mp: 232, bp: 2602 },
  { id: "zinc", name: tx("zinc", "Zink"), mp: 420, bp: 907 },
  { id: "sodium", name: tx("sodium", "Natrium"), mp: 98, bp: 883 },
  { id: "sulfur", name: tx("sulfur", "Schwefel"), mp: 115, bp: 445 },
  { id: "salt", name: tx("sodium chloride (table salt)", "Natriumchlorid (Kochsalz)"), mp: 801, bp: 1465 },
  { id: "ammonia", name: tx("ammonia", "Ammoniak"), mp: -78, bp: -33 },
  { id: "acetone", name: tx("acetone", "Aceton"), mp: -95, bp: 56 },
  { id: "acetic", name: tx("acetic acid", "Essigsäure"), mp: 17, bp: 118 },
  { id: "methanol", name: tx("methanol", "Methanol"), mp: -98, bp: 65 },
  { id: "hydrogen", name: tx("hydrogen", "Wasserstoff"), mp: -259, bp: -253 },
  { id: "propane", name: tx("propane", "Propan"), mp: -188, bp: -42 },
  { id: "naphthalene", name: tx("naphthalene (mothballs)", "Naphthalin (Mottenkugeln)"), mp: 80, bp: 218 },
];

export const substance = (id: string) => SUBSTANCES.find((s) => s.id === id)!;

/** The state at temperature T (exactly at mp or bp the substance is changing state: use `atPoint`). */
export function stateAt(s: Pick<Substance, "mp" | "bp">, t: number): State {
  return t < s.mp ? 0 : t < s.bp ? 1 : 2;
}

/** "−114 °C" / "78 °C" in the given language, with a real minus sign. */
export const degC = (t: number, locale: Locale) => `${dec(t, locale, 1).replace("-", "−")} °C`;
export const degText = (t: number): Text => ({ en: degC(t, "en"), de: degC(t, "de") });
/** Display-language source: `-114 "°C"` (the minus becomes a real minus there). */
export const degMath = (t: number, locale: Locale = "en") => `${dec(t, locale, 1)} "°C"`;

// ---------------------------------------------------------------------------
// Changes of state

export type Change = "melt" | "freeze" | "boil" | "condense" | "sublime" | "deposit";

export const CHANGES: Record<Change, { from: State; to: State; name: Text; accept: Text[] }> = {
  melt: { from: 0, to: 1, name: tx("melting", "Schmelzen"), accept: [tx("melting", "Schmelzen"), "melt"] },
  freeze: { from: 1, to: 0, name: tx("freezing", "Erstarren"), accept: [tx("freezing", "Erstarren"), tx("solidifying", "Erstarrung"), tx("solidification", "Gefrieren")] },
  boil: { from: 1, to: 2, name: tx("evaporation", "Verdampfen"), accept: [tx("evaporation", "Verdampfen"), tx("vaporisation", "Verdampfung"), tx("vaporization", "Verdampfen"), "evaporating"] },
  condense: { from: 2, to: 1, name: tx("condensation", "Kondensieren"), accept: [tx("condensation", "Kondensieren"), tx("condensing", "Kondensation")] },
  sublime: { from: 0, to: 2, name: tx("sublimation", "Sublimieren"), accept: [tx("sublimation", "Sublimieren"), tx("subliming", "Sublimation")] },
  deposit: {
    from: 2,
    to: 0,
    name: tx("deposition", "Resublimieren"),
    accept: [tx("deposition", "Resublimieren"), tx("desublimation", "Resublimation"), tx("resublimation", "Desublimieren"), "Desublimation"],
  },
};

export const changeBetween = (from: State, to: State): Change =>
  (Object.keys(CHANGES) as Change[]).find((c) => CHANGES[c].from === from && CHANGES[c].to === to)!;

export const REVERSE: Record<Change, Change> = { melt: "freeze", freeze: "melt", boil: "condense", condense: "boil", sublime: "deposit", deposit: "sublime" };
