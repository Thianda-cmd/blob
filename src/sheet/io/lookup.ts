// A lookup table read with a key from a file or the clipboard ("sum", "Percent", "amp"): only the
// table's own entries count, never what every object has ("constructor", "__proto__", "toString").

/** A value of a lookup table for a key from a file: never one of Object's own ("constructor", "__proto__"). */
export function lookup<T>(table: Readonly<Record<string, T>>, key: string | null | undefined): T | undefined {
  return key != null && Object.hasOwn(table, key) ? table[key] : undefined;
}
