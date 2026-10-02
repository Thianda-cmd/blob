import type { Locale } from "./config";

/**
 * A message dictionary: the same keys in every language. Values are strings or
 * functions for interpolation and plurals, e.g. `due: (n: number) => …`.
 *
 *   export const tasksText = defineMessages({
 *     en: { title: "Tasks", left: (n: number) => (n === 1 ? "1 task left" : `${n} tasks left`) },
 *     de: { title: "Aufgaben", left: (n) => (n === 1 ? "1 Aufgabe offen" : `${n} Aufgaben offen`) },
 *   });
 *
 * The German side is checked against the English one, so a missing key is a type error.
 */
export type Dict<T> = Record<Locale, T>;

export function defineMessages<T extends Record<string, unknown>>(messages: { en: T; de: NoInfer<T> }): Dict<T> {
  return messages;
}
