// Facts for the "atoms" topic: real isotopes, ions students meet in school and isotope
// mixtures for average atomic masses. Checked against IUPAC isotope tables.

/** Stable isotopes (mass numbers) of the first 20 elements. */
export const STABLE: Record<number, number[]> = {
  1: [1, 2],
  2: [3, 4],
  3: [6, 7],
  4: [9],
  5: [10, 11],
  6: [12, 13],
  7: [14, 15],
  8: [16, 17, 18],
  9: [19],
  10: [20, 21, 22],
  11: [23],
  12: [24, 25, 26],
  13: [27],
  14: [28, 29, 30],
  15: [31],
  16: [32, 33, 34, 36],
  17: [35, 37],
  18: [36, 38, 40],
  19: [39, 41],
  20: [40, 42, 43, 44, 46],
};

/** The most common isotope of the first 20 elements (mass number). */
export const COMMON: Record<number, number> = {
  1: 1, 2: 4, 3: 7, 4: 9, 5: 11, 6: 12, 7: 14, 8: 16, 9: 19, 10: 20,
  11: 23, 12: 24, 13: 27, 14: 28, 15: 31, 16: 32, 17: 35, 18: 40, 19: 39, 20: 40,
};

/** Isotopes with a name students may know, [symbol, mass number]. Light ones (Z ≤ 20). */
export const ISOTOPES_LIGHT: [string, number][] = [
  ["H", 2], ["H", 3], ["Li", 6], ["B", 10], ["C", 13], ["C", 14], ["N", 15], ["O", 17], ["O", 18],
  ["Ne", 22], ["Mg", 25], ["Mg", 26], ["Si", 29], ["Si", 30], ["S", 34], ["Cl", 35], ["Cl", 37],
  ["Ar", 36], ["K", 40], ["K", 41], ["Ca", 44],
];

/** Heavier real isotopes (stable or well known), [symbol, mass number]. */
export const ISOTOPES_HEAVY: [string, number][] = [
  ["Fe", 56], ["Ni", 58], ["Co", 60], ["Cu", 63], ["Cu", 65], ["Zn", 64], ["Br", 79], ["Br", 81],
  ["Sr", 90], ["Ag", 107], ["Ag", 109], ["Sn", 120], ["I", 127], ["I", 131], ["Cs", 137],
  ["Au", 197], ["Pb", 208], ["U", 235], ["U", 238],
];

/** Ions from school chemistry: [symbol, mass number of the isotope shown, charge]. */
export const IONS_MAIN: [string, number, number][] = [
  ["Li", 7, 1], ["Na", 23, 1], ["K", 39, 1], ["Be", 9, 2], ["Mg", 24, 2], ["Ca", 40, 2], ["Al", 27, 3],
  ["N", 14, -3], ["O", 16, -2], ["F", 19, -1], ["P", 31, -3], ["S", 32, -2], ["Cl", 35, -1], ["Cl", 37, -1],
];

/** Harder ions (transition metals and heavier main-group ions). */
export const IONS_HEAVY: [string, number, number][] = [
  ["Fe", 56, 2], ["Fe", 56, 3], ["Cu", 63, 2], ["Cu", 63, 1], ["Zn", 64, 2], ["Ag", 107, 1], ["Br", 79, -1], ["I", 127, -1], ["Ba", 138, 2], ["Sr", 88, 2],
];

/**
 * Isotope mixtures with rounded natural shares (percent) for average-mass tasks:
 * [symbol, [mass number, percent][]]. Shares add up to 100.
 */
export const MIXTURES: [string, [number, number][]][] = [
  ["Cl", [[35, 75], [37, 25]]],
  ["B", [[10, 20], [11, 80]]],
  ["Li", [[6, 7.5], [7, 92.5]]],
  ["Cu", [[63, 69], [65, 31]]],
  ["Ga", [[69, 60], [71, 40]]],
  ["Rb", [[85, 72], [87, 28]]],
  ["K", [[39, 93], [41, 7]]],
  ["Mg", [[24, 79], [25, 10], [26, 11]]],
  ["Si", [[28, 92], [29, 5], [30, 3]]],
];
