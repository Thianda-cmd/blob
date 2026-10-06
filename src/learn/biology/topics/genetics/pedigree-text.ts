// Words for pedigrees: names of the modes, why a family rules a mode out, genotype labels.

import { resolveText, tx, type Text } from "@/i18n/text";
import { isDominant, isX, type Mode, type Pedigree, type Sex, type Trio } from "./pedigree";

export const MODE_NAME: Record<Mode, Text> = {
  AD: tx("autosomal dominant", "autosomal-dominant"),
  AR: tx("autosomal recessive", "autosomal-rezessiv"),
  XD: tx("X-linked dominant", "X-chromosomal-dominant"),
  XR: tx("X-linked recessive", "X-chromosomal-rezessiv"),
};

/** Diseases taught in school for each mode. */
export const MODE_EXAMPLES: Record<Mode, Text[]> = {
  AD: [tx("Huntington's disease", "Chorea Huntington"), tx("polydactyly", "Polydaktylie (Vielfingrigkeit)"), tx("Marfan syndrome", "Marfan-Syndrom")],
  AR: [tx("cystic fibrosis", "Mukoviszidose"), tx("phenylketonuria (PKU)", "Phenylketonurie (PKU)"), tx("albinism", "Albinismus")],
  XD: [tx("vitamin D-resistant rickets", "Vitamin-D-resistente Rachitis")],
  XR: [tx("red-green colour blindness", "Rot-Grün-Sehschwäche"), tx("haemophilia A", "Bluterkrankheit (Hämophilie A)"), tx("Duchenne muscular dystrophy", "Muskeldystrophie Duchenne")],
};

const num = (i: number) => i + 1;

/** Why this family of three rules the mode out (person numbers as drawn). */
export function reasonText(ped: Pedigree, mode: Mode, trio: Trio): Text {
  const P = ped.people;
  const f = num(trio.father);
  const m = num(trio.mother);
  const c = num(trio.child);
  const fa = P[trio.father].affected;
  const ma = P[trio.mother].affected;
  const child = P[trio.child];
  const ca = child.affected;
  const son = child.sex === "m";
  switch (mode) {
    case "AD":
      return tx(
        `Persons ${f} and ${m} are both healthy, but their child ${c} is affected. With a dominant allele, an affected child needs at least one affected parent.`,
        `${f} und ${m} sind beide gesund, ihr Kind ${c} ist aber krank. Bei einem dominanten Allel braucht ein krankes Kind mindestens einen kranken Elternteil.`,
      );
    case "AR":
      return tx(
        `Persons ${f} and ${m} are both affected ($aa$) and can only pass on $a$. Their child ${c} would have to be affected too, but is healthy.`,
        `${f} und ${m} sind beide krank ($aa$) und können nur $a$ weitergeben. Ihr Kind ${c} müsste also auch krank sein, ist aber gesund.`,
      );
    case "XR":
      if (!son && ca && !fa)
        return tx(
          `Daughter ${c} is affected, so she would be $X^a X^a$. One $X^a$ must come from her father ${f}, but he is healthy ($X^A Y$).`,
          `Tochter ${c} ist krank, wäre also $X^a X^a$. Ein $X^a$ muss vom Vater ${f} stammen, der ist aber gesund ($X^A Y$).`,
        );
      if (son && ma && !ca)
        return tx(
          `Mother ${m} is affected ($X^a X^a$), so every son gets an $X^a$ from her. Son ${c} would have to be affected, but he is healthy.`,
          `Mutter ${m} ist krank ($X^a X^a$), also bekommt jeder Sohn von ihr ein $X^a$. Sohn ${c} müsste krank sein, ist aber gesund.`,
        );
      return tx(
        `Both parents ${f} and ${m} are affected, so daughter ${c} gets an $X^a$ from each of them. She would have to be affected, but is healthy.`,
        `Beide Eltern ${f} und ${m} sind krank, also bekommt Tochter ${c} von jedem ein $X^a$. Sie müsste krank sein, ist aber gesund.`,
      );
    case "XD":
      if (!son && fa && !ca)
        return tx(
          `Father ${f} is affected ($X^A Y$) and passes his $X^A$ on to every daughter. Daughter ${c} would have to be affected, but she is healthy.`,
          `Vater ${f} ist krank ($X^A Y$) und gibt sein $X^A$ an jede Tochter weiter. Tochter ${c} müsste krank sein, ist aber gesund.`,
        );
      if (son && ca && !ma)
        return tx(
          `Son ${c} is affected, so he has an $X^A$. A son's X always comes from his mother, but mother ${m} is healthy ($X^a X^a$).`,
          `Sohn ${c} ist krank, hat also ein $X^A$. Das X eines Sohnes stammt immer von der Mutter, aber Mutter ${m} ist gesund ($X^a X^a$).`,
        );
      return tx(
        `Daughter ${c} is affected, but neither parent (${f}, ${m}) carries the dominant allele $X^A$.`,
        `Tochter ${c} ist krank, aber keiner der Eltern (${f}, ${m}) trägt das dominante Allel $X^A$.`,
      );
  }
}

/** Why one mode works: a short verdict. */
export const possibleText = (mode: Mode): Text =>
  tx(`No family contradicts ${resolveText(MODE_NAME[mode], "en")} inheritance, so it remains possible.`, `Keine Familie widerspricht dem ${resolveText(MODE_NAME[mode], "de")}en Erbgang. Er bleibt möglich.`);

/** Genotype for d disease alleles, in display form (X^A X^a etc.). Dominant modes: the disease allele is A. */
export function genoOf(mode: Mode, sex: Sex, d: number): string {
  if (isX(mode)) {
    const dis = isDominant(mode) ? "A" : "a";
    const ok = isDominant(mode) ? "a" : "A";
    if (sex === "m") return d ? `X^${dis} Y` : `X^${ok} Y`;
    return d === 0 ? `X^${ok} X^${ok}` : d === 1 ? `X^A X^a` : `X^${dis} X^${dis}`;
  }
  if (isDominant(mode)) return d === 0 ? "aa" : d === 1 ? "Aa" : "AA";
  return d === 0 ? "AA" : d === 1 ? "Aa" : "aa";
}

/** Short label for a set of possible genotypes: "Aa", or "A?" when the second allele is open. */
export function genoLabel(mode: Mode, sex: Sex, set: number[]): string {
  if (set.length === 1) return genoOf(mode, sex, set[0]);
  if (isX(mode)) return sex === "m" ? "?" : `X^${isDominant(mode) ? (set.includes(0) ? "?" : "A") : set.includes(2) ? "?" : "A"} X^?`;
  // autosomal: both options share one allele
  if (isDominant(mode)) return set.includes(0) ? "?" : "A?";
  return set.includes(2) ? "?" : "A?";
}

/** Is this person certainly a heterozygous, healthy carrier? */
export function isCarrier(mode: Mode, sex: Sex, affected: boolean, set: number[]) {
  if (affected || isDominant(mode)) return false;
  if (isX(mode) && sex === "m") return false;
  return set.length === 1 && set[0] === 1;
}
