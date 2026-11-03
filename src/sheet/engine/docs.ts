// Help for every function in names.ts, in both languages: what it does, its arguments and an
// example. Used by the formula bar (autocomplete, argument hints) and the function browser (fx).
//
// CONTRACT: keyed by the canonical English name (FUNCTION_NAMES[i].en); every function has an entry.
//
// Written for students in their first lab semesters: plain words, the argument names Excel uses in
// each language (so a hint here matches the handout from class), examples with lab numbers where
// they fit, and tips for the functions that matter at the bench (mean or median, STABW.S for
// replicates, calibration lines, rounding for the report…). Examples are real formulas in that
// language's syntax: German with ";" between arguments and a decimal comma. The German and English
// example of a function are the same formula; scripts/check-sheet-templates.ts checks that, and that
// every function has an entry with arguments that match.

export type FnArgDoc = {
  /** As Excel names it in that language ("Zahl1", "Suchkriterium" / "number1", "lookup_value"). */
  name: string;
  /** One short sentence. */
  desc: string;
  optional?: boolean;
  /** Can be given again and again (Zahl1; Zahl2; …). */
  repeat?: boolean;
};

export type FnDoc = {
  /** One or two plain sentences: what it gives you. */
  summary: string;
  args: FnArgDoc[];
  /** A formula in that language with "=", e.g. "=MITTELWERT(B2:B6)". */
  example: string;
  /** What the example gives, in words ("the mean of the five measurements"). */
  exampleResult: string;
  /** Optional lab tip ("Für Kalibriergeraden: …"). */
  tip?: string;
};

type Pair = { en: FnDoc; de: FnDoc };
type Flags = { optional?: boolean; repeat?: boolean };

const OPT: Flags = { optional: true };
/** Optional and repeatable: number2, number3, … */
const MORE: Flags = { optional: true, repeat: true };
const a = (name: string, desc: string, flags?: Flags): FnArgDoc => ({ name, desc, ...flags });

// Argument lists many functions share.
const NUMBERS = {
  en: [a("number1", "A number, a cell or a range, e.g. B2:B6."), a("number2", "More numbers or ranges, up to 255.", MORE)],
  de: [a("Zahl1", "Eine Zahl, eine Zelle oder ein Bereich, z. B. B2:B6."), a("Zahl2", "Weitere Zahlen oder Bereiche, bis zu 255.", MORE)],
};
const ONE_NUMBER = { en: [a("number", "A number or a cell.")], de: [a("Zahl", "Eine Zahl oder eine Zelle.")] };
const VALUES = {
  en: [a("value1", "A value, a cell or a range."), a("value2", "More values or ranges, up to 255.", MORE)],
  de: [a("Wert1", "Ein Wert, eine Zelle oder ein Bereich."), a("Wert2", "Weitere Werte oder Bereiche, bis zu 255.", MORE)],
};
const ANGLE = { en: [a("number", "The angle in radians.")], de: [a("Zahl", "Der Winkel im Bogenmaß.")] };
const RATIO = { en: [a("number", "A number from −1 to 1.")], de: [a("Zahl", "Eine Zahl von −1 bis 1.")] };
const KNOWN = {
  en: [a("known_y's", "The y values, e.g. the absorbances."), a("known_x's", "The x values, e.g. the concentrations, as many as y values.")],
  de: [a("Y_Werte", "Die y-Werte, z. B. die Extinktionen."), a("X_Werte", "Die x-Werte, z. B. die Konzentrationen, genauso viele wie y-Werte.")],
};
const TWO_ARRAYS = {
  en: [a("array1", "The first row or column of values."), a("array2", "The second one, with as many values.")],
  de: [a("Matrix1", "Die erste Reihe von Werten."), a("Matrix2", "Die zweite, mit genauso vielen Werten.")],
};
const CHECK = { en: [a("value", "The value or cell to check.")], de: [a("Wert", "Der Wert oder die Zelle, die geprüft wird.")] };
const SERIAL = { en: [a("serial_number", "A date or time: a cell, or a formula such as TODAY().")], de: [a("Zahl", "Ein Datum oder eine Uhrzeit: eine Zelle oder eine Formel wie HEUTE().")] };
const TEXT_ARG = { en: [a("text", "A text or a cell with text.")], de: [a("Text", "Ein Text oder eine Zelle mit Text.")] };
const CRITERIA_MORE = {
  en: [a("criteria_range2", "More ranges to test.", MORE), a("criteria2", "The condition for each of those ranges.", MORE)],
  de: [a("Kriterien_Bereich2", "Weitere Bereiche, die geprüft werden.", MORE), a("Kriterien2", "Die Bedingung für jeden dieser Bereiche.", MORE)],
};

// ----------------------------------------------------------------------------------------------
// Mathematik

const MATH: Record<string, Pair> = {
  SUM: {
    en: {
      summary: "Adds up numbers: single values, cells or whole ranges. Text and empty cells are skipped.",
      args: NUMBERS.en,
      example: "=SUM(B2:B6)",
      exampleResult: "The total of the five values in B2 to B6.",
      tip: "Alt+= puts a SUM under a column of numbers in one go.",
    },
    de: {
      summary: "Addiert Zahlen: einzelne Werte, Zellen oder ganze Bereiche. Text und leere Zellen werden übersprungen.",
      args: NUMBERS.de,
      example: "=SUMME(B2:B6)",
      exampleResult: "Die Summe der fünf Werte in B2 bis B6.",
      tip: "Mit Alt+= setzt du die SUMME in einem Schritt unter eine Zahlenspalte.",
    },
  },
  SUMIF: {
    en: {
      summary: "Adds the cells that meet one condition, e.g. everything weighed of one substance.",
      args: [
        a("range", "The cells tested against the condition."),
        a("criteria", 'The condition, e.g. "NaCl", ">0.5" or a cell such as E2.'),
        a("sum_range", "The cells to add up; left out, the tested cells themselves.", OPT),
      ],
      example: '=SUMIF(A2:A20,"NaCl",C2:C20)',
      exampleResult: "The total mass in column C of all rows that say NaCl in column A.",
    },
    de: {
      summary: "Addiert die Zellen, die eine Bedingung erfüllen, z. B. alle Einwaagen einer Substanz.",
      args: [
        a("Bereich", "Die Zellen, die mit der Bedingung verglichen werden."),
        a("Suchkriterien", 'Die Bedingung, z. B. "NaCl", ">0,5" oder eine Zelle wie E2.'),
        a("Summe_Bereich", "Die Zellen, die addiert werden; ohne Angabe die geprüften Zellen selbst.", OPT),
      ],
      example: '=SUMMEWENN(A2:A20;"NaCl";C2:C20)',
      exampleResult: "Die Summe aller Einwaagen in Spalte C, bei denen in Spalte A NaCl steht.",
    },
  },
  SUMIFS: {
    en: {
      summary: "Adds the cells whose rows meet all of several conditions.",
      args: [a("sum_range", "The cells to add up."), a("criteria_range1", "The cells tested against the first condition."), a("criteria1", 'The first condition, e.g. "E. coli" or ">30".'), ...CRITERIA_MORE.en],
      example: '=SUMIFS(D2:D40,B2:B40,"E. coli",C2:C40,">30")',
      exampleResult: "The colonies in column D of all E. coli plates (column B) incubated above 30 °C (column C).",
    },
    de: {
      summary: "Addiert die Zellen, deren Zeilen alle Bedingungen erfüllen.",
      args: [a("Summe_Bereich", "Die Zellen, die addiert werden."), a("Kriterien_Bereich1", "Die Zellen, die mit der ersten Bedingung verglichen werden."), a("Kriterien1", 'Die erste Bedingung, z. B. "E. coli" oder ">30".'), ...CRITERIA_MORE.de],
      example: '=SUMMEWENNS(D2:D40;B2:B40;"E. coli";C2:C40;">30")',
      exampleResult: "Die Kolonien in Spalte D aller E.-coli-Platten (Spalte B), die über 30 °C bebrütet wurden (Spalte C).",
    },
  },
  SUMPRODUCT: {
    en: {
      summary: "Multiplies the matching cells of the ranges and adds up the products. Handy for weighted averages.",
      args: [a("array1", "The first range."), a("array2", "More ranges of the same size, multiplied cell by cell with the first.", MORE)],
      example: "=SUMPRODUCT(B2:B5,C2:C5)/SUM(C2:C5)",
      exampleResult: "The weighted average of the grades in B2:B5 with the weights in C2:C5.",
      tip: "All ranges must be the same size, otherwise you get #VALUE!.",
    },
    de: {
      summary: "Multipliziert die passenden Zellen der Bereiche und addiert die Produkte. Praktisch für gewichtete Mittelwerte.",
      args: [a("Array1", "Der erste Bereich."), a("Array2", "Weitere gleich große Bereiche, Zelle für Zelle mit dem ersten multipliziert.", MORE)],
      example: "=SUMMENPRODUKT(B2:B5;C2:C5)/SUMME(C2:C5)",
      exampleResult: "Der gewichtete Schnitt der Noten in B2:B5 mit den Gewichten in C2:C5.",
      tip: "Alle Bereiche müssen gleich groß sein, sonst gibt es #WERT!.",
    },
  },
  SUMSQ: {
    en: {
      summary: "Squares each number and adds up the squares.",
      args: NUMBERS.en,
      example: "=SUMSQ(3,4)",
      exampleResult: "25 (9 + 16).",
      tip: "Σx² is part of the slope of a line through the origin: m = SUMPRODUCT(x,y)/SUMSQ(x).",
    },
    de: {
      summary: "Quadriert jede Zahl und addiert die Quadrate.",
      args: NUMBERS.de,
      example: "=QUADRATESUMME(3;4)",
      exampleResult: "25 (9 + 16).",
      tip: "Σx² steckt in der Steigung einer Geraden durch den Nullpunkt: m = SUMMENPRODUKT(x;y)/QUADRATESUMME(x).",
    },
  },
  PRODUCT: {
    en: {
      summary: "Multiplies all the numbers.",
      args: NUMBERS.en,
      example: "=PRODUCT(10,10,5)",
      exampleResult: "500 – the total dilution of the steps 1:10, 1:10 and 1:5.",
    },
    de: {
      summary: "Multipliziert alle Zahlen miteinander.",
      args: NUMBERS.de,
      example: "=PRODUKT(10;10;5)",
      exampleResult: "500 – die Gesamtverdünnung aus den Stufen 1:10, 1:10 und 1:5.",
    },
  },
  SUBTOTAL: {
    en: {
      summary: "A sum, mean, count and more that leaves out rows hidden by a filter (and, with 101–111, rows hidden by hand).",
      args: [
        a(
          "function_num",
          "Which calculation: 1 mean, 2 count, 3 count non-empty, 4 max, 5 min, 6 product, 7 standard deviation (sample), 8 standard deviation (population), 9 sum, 10 variance (sample), 11 variance (population); 101–111 also skip rows hidden by hand.",
        ),
        a("ref1", "The range to calculate."),
        a("ref2", "More ranges.", MORE),
      ],
      example: "=SUBTOTAL(101,C2:C20)",
      exampleResult: "The mean of the visible rows of C2:C20 – rows hidden by a filter don't count.",
      tip: "A smart table's totals row uses SUBTOTAL, so its totals change when you filter. Other SUBTOTALs inside the range are skipped, so nothing counts twice.",
    },
    de: {
      summary: "Summe, Mittelwert, Anzahl und mehr ohne die Zeilen, die ein Filter ausblendet (mit 101–111 auch ohne von Hand ausgeblendete).",
      args: [
        a(
          "Funktion",
          "Welche Rechnung: 1 Mittelwert, 2 Anzahl, 3 Anzahl nicht leerer Zellen, 4 Max, 5 Min, 6 Produkt, 7 Standardabweichung (Stichprobe), 8 Standardabweichung (Grundgesamtheit), 9 Summe, 10 Varianz (Stichprobe), 11 Varianz (Grundgesamtheit); mit 101–111 zählen auch von Hand ausgeblendete Zeilen nicht.",
        ),
        a("Bezug1", "Der Bereich, der berechnet wird."),
        a("Bezug2", "Weitere Bereiche.", MORE),
      ],
      example: "=TEILERGEBNIS(101;C2:C20)",
      exampleResult: "Der Mittelwert der sichtbaren Zeilen von C2:C20 – weggefilterte Zeilen zählen nicht.",
      tip: "Die Ergebniszeile einer intelligenten Tabelle rechnet mit TEILERGEBNIS, darum ändern sich ihre Werte beim Filtern. Andere TEILERGEBNISSE im Bereich werden übersprungen, damit nichts doppelt zählt.",
    },
  },
  ROUND: {
    en: {
      summary: "Rounds a number to the decimal places you want (5 and above rounds up).",
      args: [a("number", "The number to round."), a("num_digits", "Decimal places: 2 → 0.01, 0 → a whole number, −1 → tens.")],
      example: "=ROUND(0.52349,3)",
      exampleResult: "0.523",
      tip: "Round only for the report. To keep calculating, keep the full value and just show fewer decimals (fewer decimal places in the toolbar) – otherwise rounding errors add up.",
    },
    de: {
      summary: "Rundet eine Zahl auf die gewünschten Nachkommastellen (ab 5 wird aufgerundet).",
      args: [a("Zahl", "Die Zahl, die gerundet wird."), a("Anzahl_Stellen", "Nachkommastellen: 2 → 0,01; 0 → ganze Zahl; −1 → Zehner.")],
      example: "=RUNDEN(0,52349;3)",
      exampleResult: "0,523",
      tip: "Runde erst fürs Protokoll. Zum Weiterrechnen den vollen Wert behalten und nur weniger Stellen anzeigen (Dezimalstellen in der Symbolleiste) – sonst addieren sich Rundungsfehler.",
    },
  },
  ROUNDUP: {
    en: {
      summary: "Rounds a number up, away from zero.",
      args: [a("number", "The number to round up."), a("num_digits", "Decimal places; 0 → a whole number.")],
      example: "=ROUNDUP(130/96,0)",
      exampleResult: "2 – for 130 tips you need two racks of 96.",
    },
    de: {
      summary: "Rundet eine Zahl auf, weg von der Null.",
      args: [a("Zahl", "Die Zahl, die aufgerundet wird."), a("Anzahl_Stellen", "Nachkommastellen; 0 → ganze Zahl.")],
      example: "=AUFRUNDEN(130/96;0)",
      exampleResult: "2 – für 130 Spitzen brauchst du zwei 96er-Racks.",
    },
  },
  ROUNDDOWN: {
    en: {
      summary: "Rounds a number down, towards zero.",
      args: [a("number", "The number to round down."), a("num_digits", "Decimal places; 0 → a whole number.")],
      example: "=ROUNDDOWN(1000/240,0)",
      exampleResult: "4 – 1000 µL are enough for 4 full portions of 240 µL.",
    },
    de: {
      summary: "Rundet eine Zahl ab, zur Null hin.",
      args: [a("Zahl", "Die Zahl, die abgerundet wird."), a("Anzahl_Stellen", "Nachkommastellen; 0 → ganze Zahl.")],
      example: "=ABRUNDEN(1000/240;0)",
      exampleResult: "4 – 1000 µL reichen für 4 ganze Portionen à 240 µL.",
    },
  },
  MROUND: {
    en: {
      summary: "Rounds to the nearest multiple of a step, e.g. to what a pipette can be set to.",
      args: [a("number", "The number to round."), a("multiple", "The step to round to, e.g. 0.5.")],
      example: "=MROUND(13.7,0.5)",
      exampleResult: "13.5 – to the nearest half microlitre.",
      tip: "Number and multiple need the same sign, otherwise you get #NUM!.",
    },
    de: {
      summary: "Rundet auf das nächste Vielfache eines Schritts, z. B. auf das, was eine Pipette einstellen kann.",
      args: [a("Zahl", "Die Zahl, die gerundet wird."), a("Vielfaches", "Der Schritt, auf den gerundet wird, z. B. 0,5.")],
      example: "=VRUNDEN(13,7;0,5)",
      exampleResult: "13,5 – auf den nächsten halben Mikroliter.",
      tip: "Zahl und Vielfaches brauchen dasselbe Vorzeichen, sonst gibt es #ZAHL!.",
    },
  },
  INT: {
    en: { summary: "Rounds down to the next whole number (−2.5 becomes −3).", args: ONE_NUMBER.en, example: "=INT(7.9)", exampleResult: "7" },
    de: { summary: "Rundet auf die nächstkleinere ganze Zahl ab (−2,5 wird −3).", args: ONE_NUMBER.de, example: "=GANZZAHL(7,9)", exampleResult: "7" },
  },
  TRUNC: {
    en: {
      summary: "Cuts off decimals without rounding (−2.5 becomes −2).",
      args: [a("number", "The number to cut."), a("num_digits", "Decimal places to keep; left out: 0.", OPT)],
      example: "=TRUNC(3.789,1)",
      exampleResult: "3.7",
    },
    de: {
      summary: "Schneidet Nachkommastellen ab, ohne zu runden (−2,5 wird −2).",
      args: [a("Zahl", "Die Zahl, die gekürzt wird."), a("Anzahl_Stellen", "Wie viele Nachkommastellen bleiben; ohne Angabe 0.", OPT)],
      example: "=KÜRZEN(3,789;1)",
      exampleResult: "3,7",
    },
  },
  CEILING: {
    en: {
      summary: "Rounds up to the next multiple of a step.",
      args: [a("number", "The number to round up."), a("significance", "The step, e.g. 5 or 0.5.")],
      example: "=CEILING(23,5)",
      exampleResult: "25 – the next multiple of 5.",
    },
    de: {
      summary: "Rundet auf das nächste Vielfache eines Schritts auf.",
      args: [a("Zahl", "Die Zahl, die aufgerundet wird."), a("Schritt", "Der Schritt, z. B. 5 oder 0,5.")],
      example: "=OBERGRENZE(23;5)",
      exampleResult: "25 – das nächste Vielfache von 5.",
    },
  },
  FLOOR: {
    en: {
      summary: "Rounds down to the previous multiple of a step.",
      args: [a("number", "The number to round down."), a("significance", "The step, e.g. 5 or 0.5.")],
      example: "=FLOOR(23,5)",
      exampleResult: "20 – the multiple of 5 below.",
    },
    de: {
      summary: "Rundet auf das vorige Vielfache eines Schritts ab.",
      args: [a("Zahl", "Die Zahl, die abgerundet wird."), a("Schritt", "Der Schritt, z. B. 5 oder 0,5.")],
      example: "=UNTERGRENZE(23;5)",
      exampleResult: "20 – das Vielfache von 5 darunter.",
    },
  },
  "CEILING.MATH": {
    en: {
      summary: "Rounds up to the next multiple of a step (1 when left out). Negative numbers go toward 0, or away from it with mode.",
      args: [
        a("number", "The number to round."),
        a("significance", "The step, e.g. 5 or 0.5; left out: 1. Its sign doesn't matter.", OPT),
        a("mode", "Only for negative numbers: 0 or left out rounds toward 0, any other number away from 0.", OPT),
      ],
      example: "=CEILING.MATH(24.3,5)",
      exampleResult: "25 – the next multiple of 5.",
      tip: "Without a step it rounds up to a whole number: =CEILING.MATH(6.2) gives 7, e.g. the number of plates you need.",
    },
    de: {
      summary: "Rundet auf das nächste Vielfache eines Schritts auf (ohne Angabe 1). Negative Zahlen gehen Richtung 0, mit Modus von 0 weg.",
      args: [
        a("Zahl", "Die Zahl, die gerundet wird."),
        a("Schritt", "Der Schritt, z. B. 5 oder 0,5; ohne Angabe 1. Sein Vorzeichen ist egal.", OPT),
        a("Modus", "Nur für negative Zahlen: 0 oder leer rundet Richtung 0, jede andere Zahl von 0 weg.", OPT),
      ],
      example: "=OBERGRENZE.MATHEMATIK(24,3;5)",
      exampleResult: "25 – das nächste Vielfache von 5.",
      tip: "Ohne Schritt rundet es auf eine ganze Zahl auf: =OBERGRENZE.MATHEMATIK(6,2) ergibt 7, z. B. die Anzahl Platten, die du brauchst.",
    },
  },
  "FLOOR.MATH": {
    en: {
      summary: "Rounds down to the previous multiple of a step (1 when left out). Negative numbers go away from 0, or toward it with mode.",
      args: [
        a("number", "The number to round."),
        a("significance", "The step, e.g. 5 or 0.5; left out: 1. Its sign doesn't matter.", OPT),
        a("mode", "Only for negative numbers: 0 or left out rounds away from 0, any other number toward 0.", OPT),
      ],
      example: "=FLOOR.MATH(24.3,5)",
      exampleResult: "20 – the multiple of 5 below.",
      tip: "Without a step it rounds down to a whole number: =FLOOR.MATH(6.7) gives 6.",
    },
    de: {
      summary: "Rundet auf das vorige Vielfache eines Schritts ab (ohne Angabe 1). Negative Zahlen gehen von 0 weg, mit Modus Richtung 0.",
      args: [
        a("Zahl", "Die Zahl, die gerundet wird."),
        a("Schritt", "Der Schritt, z. B. 5 oder 0,5; ohne Angabe 1. Sein Vorzeichen ist egal.", OPT),
        a("Modus", "Nur für negative Zahlen: 0 oder leer rundet von 0 weg, jede andere Zahl Richtung 0.", OPT),
      ],
      example: "=UNTERGRENZE.MATHEMATIK(24,3;5)",
      exampleResult: "20 – das Vielfache von 5 darunter.",
      tip: "Ohne Schritt rundet es auf eine ganze Zahl ab: =UNTERGRENZE.MATHEMATIK(6,7) ergibt 6.",
    },
  },
  EVEN: {
    en: {
      summary: "Rounds up (away from zero) to the next even whole number.",
      args: ONE_NUMBER.en,
      example: "=EVEN(7)",
      exampleResult: "8 – an even number of tubes, so the centrifuge is balanced.",
    },
    de: {
      summary: "Rundet auf (weg von der Null) zur nächsten geraden ganzen Zahl.",
      args: ONE_NUMBER.de,
      example: "=GERADE(7)",
      exampleResult: "8 – eine gerade Anzahl Röhrchen, damit die Zentrifuge ausbalanciert ist.",
    },
  },
  ODD: {
    en: { summary: "Rounds up (away from zero) to the next odd whole number.", args: ONE_NUMBER.en, example: "=ODD(4)", exampleResult: "5" },
    de: { summary: "Rundet auf (weg von der Null) zur nächsten ungeraden ganzen Zahl.", args: ONE_NUMBER.de, example: "=UNGERADE(4)", exampleResult: "5" },
  },
  ABS: {
    en: { summary: "The absolute value: the number without its sign.", args: ONE_NUMBER.en, example: "=ABS(0.498-0.512)", exampleResult: "0.014 – how far apart two replicates are." },
    de: { summary: "Der Betrag: die Zahl ohne Vorzeichen.", args: ONE_NUMBER.de, example: "=ABS(0,498-0,512)", exampleResult: "0,014 – so weit liegen zwei Replikate auseinander." },
  },
  SIGN: {
    en: { summary: "1 for a positive number, −1 for a negative one, 0 for zero.", args: ONE_NUMBER.en, example: "=SIGN(-0.3)", exampleResult: "−1" },
    de: { summary: "1 für eine positive Zahl, −1 für eine negative, 0 für null.", args: ONE_NUMBER.de, example: "=VORZEICHEN(-0,3)", exampleResult: "−1" },
  },
  SQRT: {
    en: {
      summary: "The square root. A negative number gives #NUM!.",
      args: [a("number", "The number to take the root of (0 or more).")],
      example: "=SQRT(0.0004)",
      exampleResult: "0.02 – the standard deviation that belongs to a variance of 0.0004.",
    },
    de: {
      summary: "Die Quadratwurzel. Eine negative Zahl gibt #ZAHL!.",
      args: [a("Zahl", "Die Zahl, aus der die Wurzel gezogen wird (0 oder mehr).")],
      example: "=WURZEL(0,0004)",
      exampleResult: "0,02 – die Standardabweichung zur Varianz 0,0004.",
    },
  },
  POWER: {
    en: {
      summary: "A number raised to a power (the same as ^).",
      args: [a("number", "The base."), a("power", "The exponent.")],
      example: "=POWER(10,-3)",
      exampleResult: "0.001 – the dilution after three 1:10 steps.",
    },
    de: {
      summary: "Eine Zahl hoch einer anderen (dasselbe wie ^).",
      args: [a("Zahl", "Die Basis."), a("Potenz", "Der Exponent.")],
      example: "=POTENZ(10;-3)",
      exampleResult: "0,001 – die Verdünnung nach drei 1:10-Stufen.",
    },
  },
  EXP: {
    en: {
      summary: "e (2.71828…) raised to a power – the opposite of LN.",
      args: [a("number", "The exponent.")],
      example: "=0.05*EXP(1.39*2)",
      exampleResult: "About 0.81 – the OD600 after 2 h of exponential growth from 0.05 with µ = 1.39 per hour.",
    },
    de: {
      summary: "e (2,71828…) hoch einer Zahl – das Gegenstück zu LN.",
      args: [a("Zahl", "Der Exponent.")],
      example: "=0,05*EXP(1,39*2)",
      exampleResult: "Etwa 0,81 – die OD600 nach 2 h exponentiellem Wachstum ab 0,05 mit µ = 1,39 pro Stunde.",
    },
  },
  LN: {
    en: {
      summary: "The natural logarithm (base e) – the opposite of EXP.",
      args: [a("number", "A positive number.")],
      example: "=LN(2)/1.39",
      exampleResult: "About 0.50 – the generation time in hours at a growth rate µ of 1.39 per hour.",
      tip: "Growth curves: in the log phase, LN(OD) over time is a straight line; its slope is the growth rate µ, and the generation time is LN(2)/µ.",
    },
    de: {
      summary: "Der natürliche Logarithmus (Basis e) – das Gegenstück zu EXP.",
      args: [a("Zahl", "Eine positive Zahl.")],
      example: "=LN(2)/1,39",
      exampleResult: "Etwa 0,50 – die Generationszeit in Stunden bei einer Wachstumsrate µ von 1,39 pro Stunde.",
      tip: "Wachstumskurven: In der log-Phase ist LN(OD) über der Zeit eine Gerade; ihre Steigung ist die Wachstumsrate µ, die Generationszeit ist LN(2)/µ.",
    },
  },
  LOG: {
    en: {
      summary: "The logarithm to a base you choose (10 if you leave it out).",
      args: [a("number", "A positive number."), a("base", "The base; left out: 10.", OPT)],
      example: "=LOG(8,2)",
      exampleResult: "3 – 8 is 2³, so three doublings.",
    },
    de: {
      summary: "Der Logarithmus zu einer Basis deiner Wahl (ohne Angabe 10).",
      args: [a("Zahl", "Eine positive Zahl."), a("Basis", "Die Basis; ohne Angabe 10.", OPT)],
      example: "=LOG(8;2)",
      exampleResult: "3 – 8 ist 2³, also drei Verdopplungen.",
    },
  },
  LOG10: {
    en: {
      summary: "The logarithm to base 10.",
      args: [a("number", "A positive number.")],
      example: "=-LOG10(0.0001)",
      exampleResult: "4 – the pH of a solution with c(H⁺) = 10⁻⁴ mol/L.",
      tip: "pH = −LOG10(c(H⁺)). Colony counts are often compared on a log scale, e.g. as a log reduction.",
    },
    de: {
      summary: "Der Logarithmus zur Basis 10.",
      args: [a("Zahl", "Eine positive Zahl.")],
      example: "=-LOG10(0,0001)",
      exampleResult: "4 – der pH-Wert bei c(H⁺) = 10⁻⁴ mol/L.",
      tip: "pH = −LOG10(c(H⁺)). Keimzahlen vergleicht man oft logarithmisch, z. B. als log-Reduktion.",
    },
  },
  PI: {
    en: { summary: "The number π (3.14159…), to 15 digits.", args: [], example: "=PI()*0.5^2", exampleResult: "About 0.785 – the area in cm² of a circle with a radius of 0.5 cm." },
    de: { summary: "Die Zahl π (3,14159…), auf 15 Stellen genau.", args: [], example: "=PI()*0,5^2", exampleResult: "Etwa 0,785 – die Fläche in cm² eines Kreises mit 0,5 cm Radius." },
  },
  MOD: {
    en: {
      summary: "The remainder of a division.",
      args: [a("number", "The number to divide."), a("divisor", "The number to divide by.")],
      example: "=MOD(26,8)",
      exampleResult: "2 – 26 samples fill 3 rows of 8, and 2 are left over.",
    },
    de: {
      summary: "Der Rest einer Division.",
      args: [a("Zahl", "Die Zahl, die geteilt wird."), a("Divisor", "Die Zahl, durch die geteilt wird.")],
      example: "=REST(26;8)",
      exampleResult: "2 – 26 Proben füllen 3 Reihen à 8, 2 bleiben übrig.",
    },
  },
  QUOTIENT: {
    en: {
      summary: "The whole-number part of a division, without the remainder.",
      args: [a("numerator", "The number to divide."), a("denominator", "The number to divide by.")],
      example: "=QUOTIENT(26,8)",
      exampleResult: "3 – full rows of 8 for 26 samples.",
    },
    de: {
      summary: "Der ganzzahlige Teil einer Division, ohne Rest.",
      args: [a("Zähler", "Die Zahl, die geteilt wird."), a("Nenner", "Die Zahl, durch die geteilt wird.")],
      example: "=QUOTIENT(26;8)",
      exampleResult: "3 – volle 8er-Reihen für 26 Proben.",
    },
  },
  GCD: {
    en: { summary: "The greatest common divisor of whole numbers.", args: NUMBERS.en, example: "=GCD(24,36)", exampleResult: "12" },
    de: { summary: "Der größte gemeinsame Teiler ganzer Zahlen.", args: NUMBERS.de, example: "=GGT(24;36)", exampleResult: "12" },
  },
  LCM: {
    en: { summary: "The least common multiple of whole numbers.", args: NUMBERS.en, example: "=LCM(4,6)", exampleResult: "12" },
    de: { summary: "Das kleinste gemeinsame Vielfache ganzer Zahlen.", args: NUMBERS.de, example: "=KGV(4;6)", exampleResult: "12" },
  },
  FACT: {
    en: { summary: "The factorial: 1 × 2 × 3 × … × the number.", args: [a("number", "A whole number, 0 or more.")], example: "=FACT(4)", exampleResult: "24 – the orders in which you can line up 4 samples." },
    de: { summary: "Die Fakultät: 1 × 2 × 3 × … × die Zahl.", args: [a("Zahl", "Eine ganze Zahl, 0 oder mehr.")], example: "=FAKULTÄT(4)", exampleResult: "24 – so viele Reihenfolgen gibt es für 4 Proben." },
  },
  COMBIN: {
    en: {
      summary: "How many ways there are to choose some items from a set, ignoring the order.",
      args: [a("number", "How many items there are."), a("number_chosen", "How many you choose.")],
      example: "=COMBIN(6,2)",
      exampleResult: "15 – the pairs you can compare among 6 samples.",
    },
    de: {
      summary: "Wie viele Möglichkeiten es gibt, aus einer Menge einige auszuwählen, ohne auf die Reihenfolge zu achten.",
      args: [a("Zahl", "Wie viele Elemente es gibt."), a("gewählte_Zahl", "Wie viele davon ausgewählt werden.")],
      example: "=KOMBINATIONEN(6;2)",
      exampleResult: "15 – so viele Paare kannst du aus 6 Proben vergleichen.",
    },
  },
  RAND: {
    en: {
      summary: "A random number from 0 to below 1, new with every change to the sheet.",
      args: [],
      example: "=RAND()",
      exampleResult: "E.g. 0.4271 – a different number after every edit.",
      tip: "To keep a value, copy the cell and paste it again as values only.",
    },
    de: {
      summary: "Eine Zufallszahl von 0 bis unter 1, neu bei jeder Änderung im Blatt.",
      args: [],
      example: "=ZUFALLSZAHL()",
      exampleResult: "Z. B. 0,4271 – nach jeder Änderung eine andere Zahl.",
      tip: "Damit der Wert bleibt: Zelle kopieren und über „Nur Werte einfügen“ wieder einfügen.",
    },
  },
  RANDBETWEEN: {
    en: {
      summary: "A random whole number between two numbers (both included), new with every change.",
      args: [a("bottom", "The smallest number it can give."), a("top", "The largest number it can give.")],
      example: "=RANDBETWEEN(1,96)",
      exampleResult: "A random well from 1 to 96, e.g. to place samples on a plate at random.",
    },
    de: {
      summary: "Eine zufällige ganze Zahl zwischen zwei Zahlen (beide eingeschlossen), neu bei jeder Änderung.",
      args: [a("Untere_Zahl", "Die kleinste Zahl, die vorkommen kann."), a("Obere_Zahl", "Die größte Zahl, die vorkommen kann.")],
      example: "=ZUFALLSBEREICH(1;96)",
      exampleResult: "Ein zufälliges Well von 1 bis 96, z. B. um Proben zufällig auf einer Platte zu verteilen.",
    },
  },
  DEGREES: {
    en: { summary: "Converts radians to degrees.", args: [a("angle", "The angle in radians.")], example: "=DEGREES(PI())", exampleResult: "180" },
    de: { summary: "Rechnet Bogenmaß in Grad um.", args: [a("Winkel", "Der Winkel im Bogenmaß.")], example: "=GRAD(PI())", exampleResult: "180" },
  },
  RADIANS: {
    en: { summary: "Converts degrees to radians – SIN, COS and TAN expect radians.", args: [a("angle", "The angle in degrees.")], example: "=RADIANS(180)", exampleResult: "3.14159… (π)" },
    de: { summary: "Rechnet Grad in Bogenmaß um – SIN, COS und TAN erwarten Bogenmaß.", args: [a("Winkel", "Der Winkel in Grad.")], example: "=BOGENMASS(180)", exampleResult: "3,14159… (π)" },
  },
  SIN: {
    en: { summary: "The sine of an angle in radians.", args: ANGLE.en, example: "=SIN(RADIANS(30))", exampleResult: "0.5" },
    de: { summary: "Der Sinus eines Winkels im Bogenmaß.", args: ANGLE.de, example: "=SIN(BOGENMASS(30))", exampleResult: "0,5" },
  },
  COS: {
    en: { summary: "The cosine of an angle in radians.", args: ANGLE.en, example: "=COS(RADIANS(60))", exampleResult: "0.5" },
    de: { summary: "Der Kosinus eines Winkels im Bogenmaß.", args: ANGLE.de, example: "=COS(BOGENMASS(60))", exampleResult: "0,5" },
  },
  TAN: {
    en: { summary: "The tangent of an angle in radians.", args: ANGLE.en, example: "=TAN(RADIANS(45))", exampleResult: "1" },
    de: { summary: "Der Tangens eines Winkels im Bogenmaß.", args: ANGLE.de, example: "=TAN(BOGENMASS(45))", exampleResult: "1" },
  },
  ASIN: {
    en: { summary: "The angle (in radians, −π/2 to π/2) whose sine is the number.", args: RATIO.en, example: "=DEGREES(ASIN(0.5))", exampleResult: "30 (degrees)" },
    de: { summary: "Der Winkel (im Bogenmaß, −π/2 bis π/2), dessen Sinus die Zahl ist.", args: RATIO.de, example: "=GRAD(ARCSIN(0,5))", exampleResult: "30 (Grad)" },
  },
  ACOS: {
    en: { summary: "The angle (in radians, 0 to π) whose cosine is the number.", args: RATIO.en, example: "=DEGREES(ACOS(0.5))", exampleResult: "60 (degrees)" },
    de: { summary: "Der Winkel (im Bogenmaß, 0 bis π), dessen Kosinus die Zahl ist.", args: RATIO.de, example: "=GRAD(ARCCOS(0,5))", exampleResult: "60 (Grad)" },
  },
  ATAN: {
    en: { summary: "The angle (in radians, −π/2 to π/2) whose tangent is the number.", args: [a("number", "The tangent of the angle.")], example: "=DEGREES(ATAN(1))", exampleResult: "45 (degrees)" },
    de: { summary: "Der Winkel (im Bogenmaß, −π/2 bis π/2), dessen Tangens die Zahl ist.", args: [a("Zahl", "Der Tangens des Winkels.")], example: "=GRAD(ARCTAN(1))", exampleResult: "45 (Grad)" },
  },
  ATAN2: {
    en: {
      summary: "The angle of the point (x, y) from the x axis, in radians from −π to π. x comes first, unlike in many other programs.",
      args: [a("x_num", "The point's x coordinate."), a("y_num", "The point's y coordinate.")],
      example: "=DEGREES(ATAN2(1,1))",
      exampleResult: "45 (degrees)",
    },
    de: {
      summary: "Der Winkel des Punkts (x, y) zur x-Achse, im Bogenmaß von −π bis π. x kommt zuerst, anders als in vielen anderen Programmen.",
      args: [a("x_Koordinate", "Die x-Koordinate des Punkts."), a("y_Koordinate", "Die y-Koordinate des Punkts.")],
      example: "=GRAD(ARCTAN2(1;1))",
      exampleResult: "45 (Grad)",
    },
  },
};

// ----------------------------------------------------------------------------------------------
// Statistik

const RANK_ARGS = {
  en: [a("number", "The number to rank."), a("ref", "The list of numbers."), a("order", "0 or left out: the largest is 1st; 1: the smallest is 1st.", OPT)],
  de: [a("Zahl", "Die Zahl, deren Rang du suchst."), a("Bezug", "Die Liste der Zahlen."), a("Reihenfolge", "0 oder leer: die größte ist 1.; 1: die kleinste ist 1.", OPT)],
};
const F_ARGS = {
  en: [a("x", "The F-value, 0 or more."), a("deg_freedom1", "The degrees of freedom of the numerator, n₁ − 1."), a("deg_freedom2", "The degrees of freedom of the denominator, n₂ − 1.")],
  de: [a("x", "Der F-Wert, 0 oder mehr."), a("Freiheitsgrade1", "Die Freiheitsgrade des Zählers, n₁ − 1."), a("Freiheitsgrade2", "Die Freiheitsgrade des Nenners, n₂ − 1.")],
};
const CHI_ARGS = {
  en: [a("x", "The χ² value, 0 or more."), a("deg_freedom", "The degrees of freedom, e.g. the number of classes − 1.")],
  de: [a("x", "Der χ²-Wert, 0 oder mehr."), a("Freiheitsgrade", "Die Freiheitsgrade, z. B. die Anzahl der Klassen − 1.")],
};

const STATS: Record<string, Pair> = {
  AVERAGE: {
    en: {
      summary: "The arithmetic mean: the sum divided by how many numbers there are. Empty cells and text are skipped; a 0 counts.",
      args: NUMBERS.en,
      example: "=AVERAGE(B2:B4)",
      exampleResult: "0.505 – the mean of the triplicate 0.512, 0.498 and 0.505.",
      tip: "AVERAGE or MEDIAN? A single outlier pulls the mean, but hardly moves the median. For replicates, give the mean together with the standard deviation (STDEV.S).",
    },
    de: {
      summary: "Der arithmetische Mittelwert: die Summe geteilt durch die Anzahl der Zahlen. Leere Zellen und Text werden übersprungen, eine 0 zählt mit.",
      args: NUMBERS.de,
      example: "=MITTELWERT(B2:B4)",
      exampleResult: "0,505 – der Mittelwert der Dreifachbestimmung 0,512; 0,498 und 0,505.",
      tip: "MITTELWERT oder MEDIAN? Ein einzelner Ausreißer verschiebt den Mittelwert, den Median kaum. Bei Replikaten gibst du den Mittelwert zusammen mit der Standardabweichung (STABW.S) an.",
    },
  },
  AVERAGEA: {
    en: {
      summary: "Like AVERAGE, but text in the cells counts as 0, TRUE as 1 and FALSE as 0.",
      args: VALUES.en,
      example: "=AVERAGEA(B2:B5)",
      exampleResult: "3 (12 ÷ 4) when B2:B5 holds 2, 4, “n.d.” and 6 – AVERAGE gives 4.",
      tip: "Usually you want AVERAGE: an “n.d.” (not determined) shouldn't count as zero.",
    },
    de: {
      summary: "Wie MITTELWERT, aber Text in den Zellen zählt als 0, WAHR als 1 und FALSCH als 0.",
      args: VALUES.de,
      example: "=MITTELWERTA(B2:B5)",
      exampleResult: "3 (12 ÷ 4), wenn in B2:B5 2, 4, „n. b.“ und 6 stehen – MITTELWERT ergibt dagegen 4.",
      tip: "Meist willst du MITTELWERT: ein „n. b.“ (nicht bestimmt) soll nicht als null zählen.",
    },
  },
  AVERAGEIF: {
    en: {
      summary: "The mean of the cells that meet one condition.",
      args: [
        a("range", "The cells tested against the condition."),
        a("criteria", 'The condition, e.g. "Control", ">0" or a cell.'),
        a("average_range", "The cells to average; left out, the tested cells themselves.", OPT),
      ],
      example: '=AVERAGEIF(A2:A13,"Control",C2:C13)',
      exampleResult: "The mean of column C over all rows with Control in column A.",
    },
    de: {
      summary: "Der Mittelwert der Zellen, die eine Bedingung erfüllen.",
      args: [
        a("Bereich", "Die Zellen, die mit der Bedingung verglichen werden."),
        a("Kriterien", 'Die Bedingung, z. B. "Kontrolle", ">0" oder eine Zelle.'),
        a("Mittelwert_Bereich", "Die Zellen, die gemittelt werden; ohne Angabe die geprüften Zellen selbst.", OPT),
      ],
      example: '=MITTELWERTWENN(A2:A13;"Kontrolle";C2:C13)',
      exampleResult: "Der Mittelwert von Spalte C über alle Zeilen, in denen in Spalte A Kontrolle steht.",
    },
  },
  AVERAGEIFS: {
    en: {
      summary: "The mean of the cells whose rows meet all of several conditions.",
      args: [a("average_range", "The cells to average."), a("criteria_range1", "The cells tested against the first condition."), a("criteria1", 'The first condition, e.g. "Control".'), ...CRITERIA_MORE.en],
      example: '=AVERAGEIFS(D2:D40,A2:A40,"Control",B2:B40,24)',
      exampleResult: "The mean of column D for the controls measured after 24 h.",
    },
    de: {
      summary: "Der Mittelwert der Zellen, deren Zeilen alle Bedingungen erfüllen.",
      args: [a("Mittelwert_Bereich", "Die Zellen, die gemittelt werden."), a("Kriterien_Bereich1", "Die Zellen, die mit der ersten Bedingung verglichen werden."), a("Kriterien1", 'Die erste Bedingung, z. B. "Kontrolle".'), ...CRITERIA_MORE.de],
      example: '=MITTELWERTWENNS(D2:D40;A2:A40;"Kontrolle";B2:B40;24)',
      exampleResult: "Der Mittelwert von Spalte D für die Kontrollen, die nach 24 h gemessen wurden.",
    },
  },
  MEDIAN: {
    en: {
      summary: "The middle value of the sorted numbers; with an even count, the mean of the middle two.",
      args: NUMBERS.en,
      example: "=MEDIAN(B2:B6)",
      exampleResult: "0.505 for 0.501, 0.498, 0.505, 0.512 and 0.731 – the mean would be 0.549 because of the outlier 0.731.",
      tip: "Robust against outliers, so good for skewed data such as colony counts. For ordinary replicates, use the mean and the standard deviation.",
    },
    de: {
      summary: "Der mittlere Wert der sortierten Zahlen; bei gerader Anzahl der Mittelwert der beiden mittleren.",
      args: NUMBERS.de,
      example: "=MEDIAN(B2:B6)",
      exampleResult: "0,505 bei 0,501; 0,498; 0,505; 0,512 und 0,731 – der Mittelwert wäre wegen des Ausreißers 0,731 schon 0,549.",
      tip: "Unempfindlich gegen Ausreißer, darum gut für schiefe Daten wie Keimzahlen. Für normale Replikate nimmst du Mittelwert und Standardabweichung.",
    },
  },
  "MODE.SNGL": {
    en: { summary: "The number that occurs most often. #N/A when no number occurs twice.", args: NUMBERS.en, example: "=MODE.SNGL(2,3,3,5)", exampleResult: "3" },
    de: { summary: "Die Zahl, die am häufigsten vorkommt. #NV, wenn keine doppelt vorkommt.", args: NUMBERS.de, example: "=MODUS.EINF(2;3;3;5)", exampleResult: "3" },
  },
  MIN: {
    en: { summary: "The smallest number.", args: NUMBERS.en, example: "=MIN(C2:C7)", exampleResult: "The lowest absorbance of the standards in C2:C7 – the bottom of the calibration range." },
    de: { summary: "Die kleinste Zahl.", args: NUMBERS.de, example: "=MIN(C2:C7)", exampleResult: "Die kleinste Extinktion der Standards in C2:C7 – der untere Rand des Kalibrierbereichs." },
  },
  MAX: {
    en: {
      summary: "The largest number.",
      args: NUMBERS.en,
      example: "=MAX(C2:C7)",
      exampleResult: "The highest absorbance of the standards in C2:C7 – samples above it must be diluted.",
      tip: 'Is a sample inside the calibration range? =IF(B10>MAX(C2:C7),"dilute","ok").',
    },
    de: {
      summary: "Die größte Zahl.",
      args: NUMBERS.de,
      example: "=MAX(C2:C7)",
      exampleResult: "Die größte Extinktion der Standards in C2:C7 – Proben darüber musst du verdünnen.",
      tip: 'Liegt eine Probe im Kalibrierbereich? =WENN(B10>MAX(C2:C7);"verdünnen";"ok").',
    },
  },
  MINIFS: {
    en: {
      summary: "The smallest number among the cells whose rows meet all conditions.",
      args: [a("min_range", "The cells to look at."), a("criteria_range1", "The cells tested against the first condition."), a("criteria1", "The first condition."), ...CRITERIA_MORE.en],
      example: '=MINIFS(C2:C40,A2:A40,"Sample A")',
      exampleResult: "The lowest value measured for Sample A.",
    },
    de: {
      summary: "Die kleinste Zahl unter den Zellen, deren Zeilen alle Bedingungen erfüllen.",
      args: [a("Min_Bereich", "Die Zellen, die betrachtet werden."), a("Kriterien_Bereich1", "Die Zellen, die mit der ersten Bedingung verglichen werden."), a("Kriterien1", "Die erste Bedingung."), ...CRITERIA_MORE.de],
      example: '=MINWENNS(C2:C40;A2:A40;"Probe A")',
      exampleResult: "Der kleinste Messwert von Probe A.",
    },
  },
  MAXIFS: {
    en: {
      summary: "The largest number among the cells whose rows meet all conditions.",
      args: [a("max_range", "The cells to look at."), a("criteria_range1", "The cells tested against the first condition."), a("criteria1", "The first condition."), ...CRITERIA_MORE.en],
      example: '=MAXIFS(C2:C40,A2:A40,"Sample A")',
      exampleResult: "The highest value measured for Sample A.",
    },
    de: {
      summary: "Die größte Zahl unter den Zellen, deren Zeilen alle Bedingungen erfüllen.",
      args: [a("Max_Bereich", "Die Zellen, die betrachtet werden."), a("Kriterien_Bereich1", "Die Zellen, die mit der ersten Bedingung verglichen werden."), a("Kriterien1", "Die erste Bedingung."), ...CRITERIA_MORE.de],
      example: '=MAXWENNS(C2:C40;A2:A40;"Probe A")',
      exampleResult: "Der größte Messwert von Probe A.",
    },
  },
  COUNT: {
    en: {
      summary: "Counts the cells that contain numbers (dates count too); text and empty cells don't.",
      args: VALUES.en,
      example: "=COUNT(B2:B4)",
      exampleResult: "3 – the number of replicates, the n for the standard deviation.",
      tip: "You need n e.g. for the standard error: =STDEV.S(B2:B4)/SQRT(COUNT(B2:B4)).",
    },
    de: {
      summary: "Zählt die Zellen mit Zahlen (auch Datumsangaben); Text und leere Zellen zählen nicht.",
      args: VALUES.de,
      example: "=ANZAHL(B2:B4)",
      exampleResult: "3 – die Zahl der Replikate, das n für die Standardabweichung.",
      tip: "n brauchst du z. B. für den Standardfehler: =STABW.S(B2:B4)/WURZEL(ANZAHL(B2:B4)).",
    },
  },
  COUNTA: {
    en: { summary: "Counts the cells that aren't empty: numbers, text, errors.", args: VALUES.en, example: "=COUNTA(A2:A50)", exampleResult: "How many samples are listed in A2:A50." },
    de: { summary: "Zählt die Zellen, die nicht leer sind: Zahlen, Text, Fehler.", args: VALUES.de, example: "=ANZAHL2(A2:A50)", exampleResult: "Wie viele Proben in A2:A50 eingetragen sind." },
  },
  COUNTBLANK: {
    en: {
      summary: 'Counts the empty cells of a range (a formula that gives "" counts as empty too).',
      args: [a("range", "The cells to count in.")],
      example: "=COUNTBLANK(C2:C25)",
      exampleResult: "How many measurements are still missing.",
    },
    de: {
      summary: 'Zählt die leeren Zellen eines Bereichs (eine Formel, die "" ergibt, zählt auch als leer).',
      args: [a("Bereich", "Die Zellen, in denen gezählt wird.")],
      example: "=ANZAHLLEEREZELLEN(C2:C25)",
      exampleResult: "Wie viele Messwerte noch fehlen.",
    },
  },
  COUNTIF: {
    en: {
      summary: "Counts the cells that meet one condition.",
      args: [a("range", "The cells to count in."), a("criteria", 'The condition, e.g. "positive", ">0.5" or "Sample*" (* stands for any text).')],
      example: '=COUNTIF(D2:D20,"positive")',
      exampleResult: "How many samples were positive.",
    },
    de: {
      summary: "Zählt die Zellen, die eine Bedingung erfüllen.",
      args: [a("Bereich", "Die Zellen, in denen gezählt wird."), a("Suchkriterien", 'Die Bedingung, z. B. "positiv", ">0,5" oder "Probe*" (* steht für beliebigen Text).')],
      example: '=ZÄHLENWENN(D2:D20;"positiv")',
      exampleResult: "Wie viele Proben positiv waren.",
    },
  },
  COUNTIFS: {
    en: {
      summary: "Counts the rows that meet all of several conditions.",
      args: [
        a("criteria_range1", "The cells tested against the first condition."),
        a("criteria1", "The first condition."),
        a("criteria_range2", "More ranges to test.", MORE),
        a("criteria2", "The condition for each of those ranges.", MORE),
      ],
      example: '=COUNTIFS(B2:B40,"E. coli",D2:D40,">300")',
      exampleResult: "How many E. coli plates have more than 300 colonies – too many to count.",
    },
    de: {
      summary: "Zählt die Zeilen, die alle Bedingungen erfüllen.",
      args: [
        a("Kriterienbereich1", "Die Zellen, die mit der ersten Bedingung verglichen werden."),
        a("Kriterien1", "Die erste Bedingung."),
        a("Kriterienbereich2", "Weitere Bereiche, die geprüft werden.", MORE),
        a("Kriterien2", "Die Bedingung für jeden dieser Bereiche.", MORE),
      ],
      example: '=ZÄHLENWENNS(B2:B40;"E. coli";D2:D40;">300")',
      exampleResult: "Wie viele E.-coli-Platten mehr als 300 Kolonien haben – zu viele zum Auszählen.",
    },
  },
  "STDEV.S": {
    en: {
      summary: "The standard deviation of a sample (divides by n − 1): how much the values scatter around their mean.",
      args: NUMBERS.en,
      example: "=STDEV.S(B2:B4)",
      exampleResult: "0.007 for the triplicate 0.512, 0.498 and 0.505.",
      tip: "Your replicates are a sample of all possible measurements, so STDEV.S is right in the lab (STDEV.P only for a complete population). Write it as mean ± SD, e.g. 0.505 ± 0.007.",
    },
    de: {
      summary: "Die Standardabweichung einer Stichprobe (teilt durch n − 1): wie stark die Werte um ihren Mittelwert streuen.",
      args: NUMBERS.de,
      example: "=STABW.S(B2:B4)",
      exampleResult: "0,007 für die Dreifachbestimmung 0,512; 0,498 und 0,505.",
      tip: "Deine Replikate sind eine Stichprobe aus allen möglichen Messungen – im Labor ist darum STABW.S richtig (STABW.N nur für eine vollständige Grundgesamtheit). Angabe: Mittelwert ± s, z. B. 0,505 ± 0,007.",
    },
  },
  "STDEV.P": {
    en: {
      summary: "The standard deviation of a whole population (divides by n).",
      args: NUMBERS.en,
      example: "=STDEV.P(B2:B4)",
      exampleResult: "0.0057 for 0.512, 0.498 and 0.505 – smaller than with STDEV.S.",
      tip: "Only when your values really are all there is (e.g. the grades of everyone in a class). For replicates, use STDEV.S.",
    },
    de: {
      summary: "Die Standardabweichung einer Grundgesamtheit (teilt durch n).",
      args: NUMBERS.de,
      example: "=STABW.N(B2:B4)",
      exampleResult: "0,0057 für 0,512; 0,498 und 0,505 – kleiner als mit STABW.S.",
      tip: "Nur wenn deine Werte wirklich alle sind (z. B. die Noten aller in einer Klasse). Für Replikate nimm STABW.S.",
    },
  },
  STDEV: {
    en: {
      summary: "The older name of STDEV.S: the standard deviation of a sample (n − 1), with the same result.",
      args: NUMBERS.en,
      example: "=STDEV(B2:B4)",
      exampleResult: "0.007, the same as STDEV.S.",
      tip: "Kept for older workbooks; in new ones, use STDEV.S.",
    },
    de: {
      summary: "Der ältere Name von STABW.S: die Standardabweichung einer Stichprobe (n − 1), mit gleichem Ergebnis.",
      args: NUMBERS.de,
      example: "=STABW(B2:B4)",
      exampleResult: "0,007, wie mit STABW.S.",
      tip: "Gibt es für ältere Mappen; in neuen nimmst du STABW.S.",
    },
  },
  STDEVP: {
    en: { summary: "The older name of STDEV.P: the standard deviation of a population (n), with the same result.", args: NUMBERS.en, example: "=STDEVP(B2:B4)", exampleResult: "0.0057, the same as STDEV.P." },
    de: { summary: "Der ältere Name von STABW.N: die Standardabweichung einer Grundgesamtheit (n), mit gleichem Ergebnis.", args: NUMBERS.de, example: "=STABWN(B2:B4)", exampleResult: "0,0057, wie mit STABW.N." },
  },
  "VAR.S": {
    en: { summary: "The variance of a sample (divides by n − 1): the standard deviation squared.", args: NUMBERS.en, example: "=VAR.S(B2:B4)", exampleResult: "0.000049 for 0.512, 0.498 and 0.505." },
    de: { summary: "Die Varianz einer Stichprobe (teilt durch n − 1): das Quadrat der Standardabweichung.", args: NUMBERS.de, example: "=VAR.S(B2:B4)", exampleResult: "0,000049 für 0,512; 0,498 und 0,505." },
  },
  "VAR.P": {
    en: { summary: "The variance of a whole population (divides by n).", args: NUMBERS.en, example: "=VAR.P(B2:B4)", exampleResult: "0.0000327 for 0.512, 0.498 and 0.505." },
    de: { summary: "Die Varianz einer Grundgesamtheit (teilt durch n).", args: NUMBERS.de, example: "=VAR.P(B2:B4)", exampleResult: "0,0000327 für 0,512; 0,498 und 0,505." },
  },
  VAR: {
    en: { summary: "The older name of VAR.S: the variance of a sample (n − 1), with the same result.", args: NUMBERS.en, example: "=VAR(B2:B4)", exampleResult: "0.000049, the same as VAR.S." },
    de: { summary: "Der ältere Name von VAR.S: die Varianz einer Stichprobe (n − 1), mit gleichem Ergebnis.", args: NUMBERS.de, example: "=VARIANZ(B2:B4)", exampleResult: "0,000049, wie mit VAR.S." },
  },
  VARP: {
    en: { summary: "The older name of VAR.P: the variance of a population (n), with the same result.", args: NUMBERS.en, example: "=VARP(B2:B4)", exampleResult: "0.0000327, the same as VAR.P." },
    de: { summary: "Der ältere Name von VAR.P: die Varianz einer Grundgesamtheit (n), mit gleichem Ergebnis.", args: NUMBERS.de, example: "=VARIANZEN(B2:B4)", exampleResult: "0,0000327, wie mit VAR.P." },
  },
  AVEDEV: {
    en: { summary: "The mean absolute deviation: how far the values lie from their mean, on average.", args: NUMBERS.en, example: "=AVEDEV(2,4,6)", exampleResult: "1.333 (distances 2, 0 and 2)" },
    de: { summary: "Die mittlere absolute Abweichung: wie weit die Werte im Schnitt von ihrem Mittelwert entfernt sind.", args: NUMBERS.de, example: "=MITTELABW(2;4;6)", exampleResult: "1,333 (Abstände 2, 0 und 2)" },
  },
  DEVSQ: {
    en: { summary: "The sum of the squared deviations from the mean.", args: NUMBERS.en, example: "=DEVSQ(2,4,6)", exampleResult: "8 (4 + 0 + 4)" },
    de: { summary: "Die Summe der quadrierten Abweichungen vom Mittelwert.", args: NUMBERS.de, example: "=SUMQUADABW(2;4;6)", exampleResult: "8 (4 + 0 + 4)" },
  },
  GEOMEAN: {
    en: {
      summary: "The geometric mean: the n-th root of the product. For values that grow by factors, such as cell or colony counts.",
      args: NUMBERS.en,
      example: "=GEOMEAN(10,100,1000)",
      exampleResult: "100",
      tip: "All numbers must be positive.",
    },
    de: {
      summary: "Das geometrische Mittel: die n-te Wurzel aus dem Produkt. Für Werte, die mit Faktoren wachsen, wie Zell- oder Keimzahlen.",
      args: NUMBERS.de,
      example: "=GEOMITTEL(10;100;1000)",
      exampleResult: "100",
      tip: "Alle Zahlen müssen positiv sein.",
    },
  },
  HARMEAN: {
    en: { summary: "The harmonic mean: the count divided by the sum of the reciprocals; for averaging rates.", args: NUMBERS.en, example: "=HARMEAN(2,6)", exampleResult: "3" },
    de: { summary: "Das harmonische Mittel: die Anzahl geteilt durch die Summe der Kehrwerte; zum Mitteln von Raten.", args: NUMBERS.de, example: "=HARMITTEL(2;6)", exampleResult: "3" },
  },
  LARGE: {
    en: {
      summary: "The k-th largest number of a range.",
      args: [a("array", "The numbers."), a("k", "The rank: 1 is the largest, 2 the second largest…")],
      example: "=LARGE(C2:C20,2)",
      exampleResult: "The second highest value in C2:C20.",
    },
    de: {
      summary: "Die k-größte Zahl eines Bereichs.",
      args: [a("Matrix", "Die Zahlen."), a("k", "Der Rang: 1 ist die größte, 2 die zweitgrößte …")],
      example: "=KGRÖSSTE(C2:C20;2)",
      exampleResult: "Der zweitgrößte Wert in C2:C20.",
    },
  },
  SMALL: {
    en: {
      summary: "The k-th smallest number of a range.",
      args: [a("array", "The numbers."), a("k", "The rank: 1 is the smallest, 2 the second smallest…")],
      example: "=SMALL(C2:C20,1)",
      exampleResult: "The smallest value in C2:C20, the same as MIN.",
    },
    de: {
      summary: "Die k-kleinste Zahl eines Bereichs.",
      args: [a("Matrix", "Die Zahlen."), a("k", "Der Rang: 1 ist die kleinste, 2 die zweitkleinste …")],
      example: "=KKLEINSTE(C2:C20;1)",
      exampleResult: "Der kleinste Wert in C2:C20, wie MIN.",
    },
  },
  "RANK.EQ": {
    en: {
      summary: "The rank of a number in a list; equal numbers share the best rank.",
      args: RANK_ARGS.en,
      example: "=RANK.EQ(B2,B$2:B$20)",
      exampleResult: "The place of B2 in the list, the largest first.",
    },
    de: {
      summary: "Der Rang einer Zahl in einer Liste; gleiche Zahlen teilen sich den besten Rang.",
      args: RANK_ARGS.de,
      example: "=RANG.GLEICH(B2;B$2:B$20)",
      exampleResult: "Der Platz von B2 in der Liste, die größte Zahl zuerst.",
    },
  },
  "PERCENTILE.INC": {
    en: {
      summary: "The value below which a share k of the data lies (k from 0 to 1, both included).",
      args: [a("array", "The numbers."), a("k", "The share from 0 to 1, e.g. 0.95 for the 95th percentile.")],
      example: "=PERCENTILE.INC(B2:B101,0.95)",
      exampleResult: "The 95th percentile: 95 % of the values are at or below it.",
    },
    de: {
      summary: "Der Wert, unter dem ein Anteil k der Daten liegt (k von 0 bis 1, beide eingeschlossen).",
      args: [a("Matrix", "Die Zahlen."), a("k", "Der Anteil von 0 bis 1, z. B. 0,95 für das 95-%-Quantil.")],
      example: "=QUANTIL.INKL(B2:B101;0,95)",
      exampleResult: "Das 95-%-Quantil: 95 % der Werte liegen darunter oder darauf.",
    },
  },
  "QUARTILE.INC": {
    en: {
      summary: "A quartile of the data: 0 minimum, 1 first quartile, 2 median, 3 third quartile, 4 maximum.",
      args: [a("array", "The numbers."), a("quart", "Which quartile, 0 to 4.")],
      example: "=QUARTILE.INC(B2:B30,1)",
      exampleResult: "The first quartile: a quarter of the values are at or below it.",
    },
    de: {
      summary: "Ein Quartil der Daten: 0 Minimum, 1 erstes Quartil, 2 Median, 3 drittes Quartil, 4 Maximum.",
      args: [a("Matrix", "Die Zahlen."), a("Quartile", "Welches Quartil, 0 bis 4.")],
      example: "=QUARTILE.INKL(B2:B30;1)",
      exampleResult: "Das erste Quartil: ein Viertel der Werte liegt darunter oder darauf.",
    },
  },
  STANDARDIZE: {
    en: {
      summary: "The z-score: how many standard deviations a value lies from the mean.",
      args: [a("x", "The value."), a("mean", "The mean."), a("standard_dev", "The standard deviation.")],
      example: "=STANDARDIZE(0.53,0.505,0.007)",
      exampleResult: "About 3.6 – far out, probably an outlier.",
    },
    de: {
      summary: "Der z-Wert: wie viele Standardabweichungen ein Wert vom Mittelwert entfernt liegt.",
      args: [a("x", "Der Wert."), a("Mittelwert", "Der Mittelwert."), a("Standabwn", "Die Standardabweichung.")],
      example: "=STANDARDISIERUNG(0,53;0,505;0,007)",
      exampleResult: "Etwa 3,6 – weit draußen, vermutlich ein Ausreißer.",
    },
  },
  "NORM.DIST": {
    en: {
      summary: "The normal distribution: with cumulative TRUE the probability of a value up to x, with FALSE the height of the bell curve at x.",
      args: [a("x", "The value."), a("mean", "The mean."), a("standard_dev", "The standard deviation."), a("cumulative", "TRUE: the probability up to x; FALSE: the density at x.")],
      example: "=NORM.DIST(110,100,15,TRUE)",
      exampleResult: "About 0.75 – 75 % of the values lie below 110.",
    },
    de: {
      summary: "Die Normalverteilung: mit Kumuliert WAHR die Wahrscheinlichkeit für einen Wert bis x, mit FALSCH die Höhe der Glockenkurve bei x.",
      args: [a("x", "Der Wert."), a("Mittelwert", "Der Mittelwert."), a("Standabwn", "Die Standardabweichung."), a("Kumuliert", "WAHR: die Wahrscheinlichkeit bis x; FALSCH: die Dichte bei x.")],
      example: "=NORM.VERT(110;100;15;WAHR)",
      exampleResult: "Etwa 0,75 – 75 % der Werte liegen unter 110.",
    },
  },
  "NORM.INV": {
    en: {
      summary: "The value below which a given share of a normal distribution lies (the inverse of NORM.DIST).",
      args: [a("probability", "The share, between 0 and 1."), a("mean", "The mean."), a("standard_dev", "The standard deviation.")],
      example: "=NORM.INV(0.975,0,1)",
      exampleResult: "1.96 – the z for a two-sided 95 % range.",
    },
    de: {
      summary: "Der Wert, unter dem ein bestimmter Anteil einer Normalverteilung liegt (die Umkehrung von NORM.VERT).",
      args: [a("Wahrsch", "Der Anteil, zwischen 0 und 1."), a("Mittelwert", "Der Mittelwert."), a("Standabwn", "Die Standardabweichung.")],
      example: "=NORM.INV(0,975;0;1)",
      exampleResult: "1,96 – der z-Wert für einen zweiseitigen 95-%-Bereich.",
    },
  },
  "NORM.S.DIST": {
    en: {
      summary: "The standard normal distribution (mean 0, standard deviation 1).",
      args: [a("z", "The z-value."), a("cumulative", "TRUE: the probability up to z; FALSE: the density at z.")],
      example: "=NORM.S.DIST(1.96,TRUE)",
      exampleResult: "0.975",
    },
    de: {
      summary: "Die Standardnormalverteilung (Mittelwert 0, Standardabweichung 1).",
      args: [a("z", "Der z-Wert."), a("Kumuliert", "WAHR: die Wahrscheinlichkeit bis z; FALSCH: die Dichte bei z.")],
      example: "=NORM.S.VERT(1,96;WAHR)",
      exampleResult: "0,975",
    },
  },
  "NORM.S.INV": {
    en: { summary: "The z-value below which a given share of the standard normal distribution lies.", args: [a("probability", "The share, between 0 and 1.")], example: "=NORM.S.INV(0.95)", exampleResult: "1.645" },
    de: { summary: "Der z-Wert, unter dem ein bestimmter Anteil der Standardnormalverteilung liegt.", args: [a("Wahrsch", "Der Anteil, zwischen 0 und 1.")], example: "=NORM.S.INV(0,95)", exampleResult: "1,645" },
  },
  "T.DIST": {
    en: {
      summary: "Student's t-distribution (left-tailed): with cumulative TRUE the probability up to x.",
      args: [a("x", "The t-value."), a("deg_freedom", "The degrees of freedom, usually n − 1."), a("cumulative", "TRUE: the probability up to x; FALSE: the density.")],
      example: "=T.DIST(2.776,4,TRUE)",
      exampleResult: "About 0.975",
    },
    de: {
      summary: "Die t-Verteilung (linksseitig): mit Kumuliert WAHR die Wahrscheinlichkeit bis x.",
      args: [a("x", "Der t-Wert."), a("Freiheitsgrade", "Die Freiheitsgrade, meist n − 1."), a("Kumuliert", "WAHR: die Wahrscheinlichkeit bis x; FALSCH: die Dichte.")],
      example: "=T.VERT(2,776;4;WAHR)",
      exampleResult: "Etwa 0,975",
    },
  },
  "T.DIST.2T": {
    en: {
      summary: "The two-tailed t-distribution: the probability of a t at least this far from 0, on either side.",
      args: [a("x", "The t-value, 0 or more."), a("deg_freedom", "The degrees of freedom, usually n − 1.")],
      example: "=T.DIST.2T(2.776,4)",
      exampleResult: "About 0.05",
    },
    de: {
      summary: "Die zweiseitige t-Verteilung: die Wahrscheinlichkeit für ein t, das mindestens so weit von 0 liegt, auf beiden Seiten.",
      args: [a("x", "Der t-Wert, 0 oder mehr."), a("Freiheitsgrade", "Die Freiheitsgrade, meist n − 1.")],
      example: "=T.VERT.2S(2,776;4)",
      exampleResult: "Etwa 0,05",
    },
  },
  "T.INV": {
    en: {
      summary: "The t-value below which a given share of the t-distribution lies (left-tailed).",
      args: [a("probability", "The share, between 0 and 1."), a("deg_freedom", "The degrees of freedom.")],
      example: "=T.INV(0.975,4)",
      exampleResult: "2.776",
    },
    de: {
      summary: "Der t-Wert, unter dem ein bestimmter Anteil der t-Verteilung liegt (linksseitig).",
      args: [a("Wahrsch", "Der Anteil, zwischen 0 und 1."), a("Freiheitsgrade", "Die Freiheitsgrade.")],
      example: "=T.INV(0,975;4)",
      exampleResult: "2,776",
    },
  },
  "T.INV.2T": {
    en: {
      summary: "The two-tailed t-value for an error probability, e.g. for a confidence interval.",
      args: [a("probability", "The error probability, e.g. 0.05 for 95 %."), a("deg_freedom", "The degrees of freedom, n − 1.")],
      example: "=T.INV.2T(0.05,2)",
      exampleResult: "4.303 – the t for a 95 % confidence interval from 3 replicates (2 degrees of freedom).",
    },
    de: {
      summary: "Der zweiseitige t-Wert für eine Irrtumswahrscheinlichkeit, z. B. für ein Vertrauensintervall.",
      args: [a("Wahrsch", "Die Irrtumswahrscheinlichkeit, z. B. 0,05 für 95 %."), a("Freiheitsgrade", "Die Freiheitsgrade, n − 1.")],
      example: "=T.INV.2S(0,05;2)",
      exampleResult: "4,303 – der t-Wert für das 95-%-Vertrauensintervall aus 3 Replikaten (2 Freiheitsgrade).",
    },
  },
  "T.TEST": {
    en: {
      summary: "The p-value of a t-test: how likely a difference of the means at least this large would be if both groups really had the same mean.",
      args: [
        a("array1", "The first group's values."),
        a("array2", "The second group's values."),
        a("tails", "1: one-tailed; 2: two-tailed (usual)."),
        a("type", "1: paired; 2: two samples, equal variance; 3: two samples, unequal variance (Welch)."),
      ],
      example: "=T.TEST(B2:B4,C2:C4,2,3)",
      exampleResult: "E.g. 0.012 – below 0.05, so treatment and control differ significantly.",
      tip: "p < 0.05 usually counts as significant. Type 3 (Welch) is the safe choice when you don't know whether both groups scatter equally.",
    },
    de: {
      summary: "Der p-Wert eines t-Tests: wie wahrscheinlich ein mindestens so großer Unterschied der Mittelwerte wäre, wenn die beiden Gruppen in Wahrheit gleich wären.",
      args: [
        a("Matrix1", "Die Werte der ersten Gruppe."),
        a("Matrix2", "Die Werte der zweiten Gruppe."),
        a("Seiten", "1: einseitig; 2: zweiseitig (üblich)."),
        a("Typ", "1: gepaart; 2: zwei Stichproben, gleiche Varianz; 3: zwei Stichproben, ungleiche Varianz (Welch)."),
      ],
      example: "=T.TEST(B2:B4;C2:C4;2;3)",
      exampleResult: "Z. B. 0,012 – unter 0,05, Behandlung und Kontrolle unterscheiden sich also signifikant.",
      tip: "p < 0,05 gilt meist als signifikant. Typ 3 (Welch) ist die sichere Wahl, wenn du nicht weißt, ob beide Gruppen gleich stark streuen.",
    },
  },
  "CONFIDENCE.T": {
    en: {
      summary: "Half the width of the confidence interval of a mean, using the t-distribution (right for small samples).",
      args: [a("alpha", "The error probability: 0.05 for 95 %."), a("standard_dev", "The standard deviation, e.g. STDEV.S of the replicates."), a("size", "The number of values, n.")],
      example: "=CONFIDENCE.T(0.05,0.007,3)",
      exampleResult: "About 0.017 – the mean 0.505 lies between 0.488 and 0.522 with 95 % confidence.",
      tip: "Mean ± CONFIDENCE.T(0.05, s, n) is the 95 % confidence interval of your replicates.",
    },
    de: {
      summary: "Die halbe Breite des Vertrauensintervalls eines Mittelwerts, mit der t-Verteilung (richtig für kleine Stichproben).",
      args: [a("Alpha", "Die Irrtumswahrscheinlichkeit: 0,05 für 95 %."), a("Standabwn", "Die Standardabweichung, z. B. STABW.S der Replikate."), a("Umfang", "Die Anzahl der Werte, n.")],
      example: "=KONFIDENZ.T(0,05;0,007;3)",
      exampleResult: "Etwa 0,017 – der Mittelwert 0,505 liegt mit 95 % Sicherheit zwischen 0,488 und 0,522.",
      tip: "Mittelwert ± KONFIDENZ.T(0,05; s; n) ist das 95-%-Vertrauensintervall deiner Replikate.",
    },
  },
  "CONFIDENCE.NORM": {
    en: {
      summary: "Like CONFIDENCE.T, but with the normal distribution; only for large samples (about 30 values or more).",
      args: [a("alpha", "The error probability: 0.05 for 95 %."), a("standard_dev", "The standard deviation."), a("size", "The number of values, n.")],
      example: "=CONFIDENCE.NORM(0.05,2.5,50)",
      exampleResult: "About 0.69",
    },
    de: {
      summary: "Wie KONFIDENZ.T, aber mit der Normalverteilung; nur für große Stichproben (etwa ab 30 Werten).",
      args: [a("Alpha", "Die Irrtumswahrscheinlichkeit: 0,05 für 95 %."), a("Standabwn", "Die Standardabweichung."), a("Umfang", "Die Anzahl der Werte, n.")],
      example: "=KONFIDENZ.NORM(0,05;2,5;50)",
      exampleResult: "Etwa 0,69",
    },
  },
  CORREL: {
    en: {
      summary: "The correlation coefficient r (−1 to 1): how closely two rows of values follow a straight line.",
      args: TWO_ARRAYS.en,
      example: "=CORREL(B2:B7,C2:C7)",
      exampleResult: "E.g. 0.9999 – concentration and absorbance rise almost perfectly together.",
      tip: "r² is the R² of the linear trendline (RSQ).",
    },
    de: {
      summary: "Der Korrelationskoeffizient r (−1 bis 1): wie genau zwei Wertereihen einer Geraden folgen.",
      args: TWO_ARRAYS.de,
      example: "=KORREL(B2:B7;C2:C7)",
      exampleResult: "Z. B. 0,9999 – Konzentration und Extinktion steigen fast perfekt gemeinsam.",
      tip: "r² ist das R² der linearen Trendlinie (BESTIMMTHEITSMASS).",
    },
  },
  PEARSON: {
    en: { summary: "The Pearson correlation coefficient r – the same as CORREL.", args: TWO_ARRAYS.en, example: "=PEARSON(B2:B7,C2:C7)", exampleResult: "The same r as CORREL." },
    de: { summary: "Der Pearson-Korrelationskoeffizient r – dasselbe wie KORREL.", args: TWO_ARRAYS.de, example: "=PEARSON(B2:B7;C2:C7)", exampleResult: "Dasselbe r wie KORREL." },
  },
  "COVARIANCE.S": {
    en: {
      summary: "The covariance of a sample (divides by n − 1): positive when two rows of values rise together, negative when one falls as the other rises.",
      args: TWO_ARRAYS.en,
      example: "=COVARIANCE.S(B2:B7,C2:C7)",
      exampleResult: "A positive number: the higher the concentration, the higher the absorbance.",
    },
    de: {
      summary: "Die Kovarianz einer Stichprobe (teilt durch n − 1): positiv, wenn zwei Wertereihen gemeinsam steigen, negativ, wenn eine fällt, während die andere steigt.",
      args: TWO_ARRAYS.de,
      example: "=KOVARIANZ.S(B2:B7;C2:C7)",
      exampleResult: "Eine positive Zahl: je höher die Konzentration, desto höher die Extinktion.",
    },
  },
  "COVARIANCE.P": {
    en: { summary: "The covariance of a whole population (divides by n).", args: TWO_ARRAYS.en, example: "=COVARIANCE.P(B2:B7,C2:C7)", exampleResult: "A little smaller than COVARIANCE.S for the same values." },
    de: { summary: "Die Kovarianz einer Grundgesamtheit (teilt durch n).", args: TWO_ARRAYS.de, example: "=KOVARIANZ.P(B2:B7;C2:C7)", exampleResult: "Etwas kleiner als KOVARIANZ.S für dieselben Werte." },
  },
  SKEW: {
    en: { summary: "How lopsided the distribution is: 0 symmetric, positive with a long tail to the right.", args: NUMBERS.en, example: "=SKEW(B2:B30)", exampleResult: "E.g. 1.2 – a few high values pull the tail to the right." },
    de: { summary: "Wie schief die Verteilung ist: 0 symmetrisch, positiv mit einem langen Ausläufer nach rechts.", args: NUMBERS.de, example: "=SCHIEFE(B2:B30)", exampleResult: "Z. B. 1,2 – einige hohe Werte ziehen den Ausläufer nach rechts." },
  },
  KURT: {
    en: {
      summary: "The excess kurtosis: positive for a peaked distribution with heavy tails, negative for a flat one, 0 like the normal distribution. Needs 4 values or more.",
      args: NUMBERS.en,
      example: "=KURT(B2:B30)",
      exampleResult: "E.g. −0.4 – a little flatter than a normal distribution.",
    },
    de: {
      summary: "Die Kurtosis (Wölbung): positiv bei einer spitzen Verteilung mit breiten Ausläufern, negativ bei einer flachen, 0 wie bei der Normalverteilung. Braucht mindestens 4 Werte.",
      args: NUMBERS.de,
      example: "=KURT(B2:B30)",
      exampleResult: "Z. B. −0,4 – etwas flacher als eine Normalverteilung.",
    },
  },

  // Text counted as 0 (the "A" forms, like MITTELWERTA)
  STDEVA: {
    en: {
      summary: "Like STDEV.S, but text in ranges counts as 0 and TRUE as 1 (STDEV.S leaves them out).",
      args: VALUES.en,
      example: "=STDEVA(B2:B5)",
      exampleResult: "2.582 for 2, 4, “n.d.” and 6: the text counts as 0.",
      tip: "Rarely what you want: a value marked “n.d.” isn't 0. For replicates, use STDEV.S.",
    },
    de: {
      summary: "Wie STABW.S, aber Text in Bereichen zählt als 0 und WAHR als 1 (STABW.S lässt sie weg).",
      args: VALUES.de,
      example: "=STABWA(B2:B5)",
      exampleResult: "2,582 für 2, 4, „n. b.“ und 6: Der Text zählt als 0.",
      tip: "Selten das Richtige: Ein Wert „n. b.“ ist nicht 0. Für Replikate nimmst du STABW.S.",
    },
  },
  STDEVPA: {
    en: { summary: "Like STDEV.P (divides by n), but text in ranges counts as 0 and TRUE as 1.", args: VALUES.en, example: "=STDEVPA(B2:B5)", exampleResult: "2.236 for 2, 4, “n.d.” and 6." },
    de: { summary: "Wie STABW.N (teilt durch n), aber Text in Bereichen zählt als 0 und WAHR als 1.", args: VALUES.de, example: "=STABWNA(B2:B5)", exampleResult: "2,236 für 2, 4, „n. b.“ und 6." },
  },
  VARA: {
    en: { summary: "Like VAR.S, but text in ranges counts as 0 and TRUE as 1.", args: VALUES.en, example: "=VARA(B2:B5)", exampleResult: "6.667 for 2, 4, “n.d.” and 6." },
    de: { summary: "Wie VAR.S, aber Text in Bereichen zählt als 0 und WAHR als 1.", args: VALUES.de, example: "=VARIANZA(B2:B5)", exampleResult: "6,667 für 2, 4, „n. b.“ und 6." },
  },
  VARPA: {
    en: { summary: "Like VAR.P (divides by n), but text in ranges counts as 0 and TRUE as 1.", args: VALUES.en, example: "=VARPA(B2:B5)", exampleResult: "5 for 2, 4, “n.d.” and 6." },
    de: { summary: "Wie VAR.P (teilt durch n), aber Text in Bereichen zählt als 0 und WAHR als 1.", args: VALUES.de, example: "=VARIANZENA(B2:B5)", exampleResult: "5 für 2, 4, „n. b.“ und 6." },
  },

  // Ranks and quantiles
  "RANK.AVG": {
    en: {
      summary: "The rank of a number in a list; equal numbers share the mean of their places (two at the top are both 1.5).",
      args: RANK_ARGS.en,
      example: "=RANK.AVG(B2,B$2:B$20)",
      exampleResult: "The place of B2 in the list, the largest first; a tie for 3rd and 4th place gives 3.5.",
      tip: "Rank tests such as the Mann–Whitney U test work with these mean ranks.",
    },
    de: {
      summary: "Der Rang einer Zahl in einer Liste; gleiche Zahlen teilen sich den Mittelwert ihrer Plätze (zwei gleiche an der Spitze sind beide 1,5).",
      args: RANK_ARGS.de,
      example: "=RANG.MITTELW(B2;B$2:B$20)",
      exampleResult: "Der Platz von B2 in der Liste, die größte Zahl zuerst; bei Gleichstand auf Platz 3 und 4 ergibt es 3,5.",
      tip: "Rangtests wie der Mann-Whitney-U-Test rechnen mit diesen mittleren Rängen.",
    },
  },
  "PERCENTILE.EXC": {
    en: {
      summary: "Like PERCENTILE.INC, but k must lie inside the data: from 1/(n+1) to n/(n+1) for n values. The method many statistics books use.",
      args: [a("array", "The numbers."), a("k", "The share, e.g. 0.9 for the 90th percentile; with n values from 1/(n+1) to n/(n+1).")],
      example: "=PERCENTILE.EXC(B2:B101,0.95)",
      exampleResult: "The 95th percentile of the 100 values; #NUM! for a k outside 1/101 to 100/101.",
      tip: "With few values the outer percentiles don't exist: with 9 values, k must lie between 0.1 and 0.9.",
    },
    de: {
      summary: "Wie QUANTIL.INKL, aber k muss innerhalb der Daten liegen: bei n Werten von 1/(n+1) bis n/(n+1). Die Methode vieler Statistikbücher.",
      args: [a("Matrix", "Die Zahlen."), a("k", "Der Anteil, z. B. 0,9 für das 90-%-Quantil; bei n Werten von 1/(n+1) bis n/(n+1).")],
      example: "=QUANTIL.EXKL(B2:B101;0,95)",
      exampleResult: "Das 95-%-Quantil der 100 Werte; #ZAHL! für ein k außerhalb von 1/101 bis 100/101.",
      tip: "Bei wenigen Werten gibt es die äußeren Quantile nicht: Bei 9 Werten muss k zwischen 0,1 und 0,9 liegen.",
    },
  },
  "QUARTILE.EXC": {
    en: {
      summary: "A quartile by the exclusive method (PERCENTILE.EXC): 1 first quartile, 2 median, 3 third quartile.",
      args: [a("array", "The numbers."), a("quart", "Which quartile, 1 to 3.")],
      example: "=QUARTILE.EXC(B2:B30,1)",
      exampleResult: "The first quartile by the exclusive method; it lies a little further out than the one of QUARTILE.INC.",
      tip: "The first and third quartile need at least 3 numbers.",
    },
    de: {
      summary: "Ein Quartil nach der exklusiven Methode (QUANTIL.EXKL): 1 erstes Quartil, 2 Median, 3 drittes Quartil.",
      args: [a("Matrix", "Die Zahlen."), a("Quartile", "Welches Quartil, 1 bis 3.")],
      example: "=QUARTILE.EXKL(B2:B30;1)",
      exampleResult: "Das erste Quartil nach der exklusiven Methode; es liegt etwas weiter außen als das von QUARTILE.INKL.",
      tip: "Das erste und das dritte Quartil brauchen mindestens 3 Zahlen.",
    },
  },
  FREQUENCY: {
    en: {
      summary: "Counts how many values fall into each class: up to the first limit, above it up to the second, and so on; the last count is everything above the highest limit. An array: the cell shows the first count, INDEX gives the others.",
      args: [a("data_array", "The values to count, e.g. colony counts."), a("bins_array", "The upper limits of the classes, e.g. 50, 100 and 150.")],
      example: "=INDEX(FREQUENCY(B2:B31,D2:D4),2)",
      exampleResult: "How many values in B2:B31 lie above the first limit in D2, up to the second in D3.",
      tip: "For a histogram: limits in D2:D4, in E2 =INDEX(FREQUENCY($B$2:$B$31,$D$2:$D$4),ROW()-1), filled down to E5 (one row more than limits).",
    },
    de: {
      summary: "Zählt, wie viele Werte in jede Klasse fallen: bis zur ersten Grenze, darüber bis zur zweiten und so weiter; die letzte Anzahl zählt alles über der höchsten Grenze. Eine Matrix: Die Zelle zeigt die erste Anzahl, INDEX die anderen.",
      args: [a("Daten", "Die Werte, die gezählt werden, z. B. Koloniezahlen."), a("Klassen", "Die oberen Grenzen der Klassen, z. B. 50, 100 und 150.")],
      example: "=INDEX(HÄUFIGKEIT(B2:B31;D2:D4);2)",
      exampleResult: "Wie viele Werte in B2:B31 über der ersten Grenze in D2 und bis zur zweiten in D3 liegen.",
      tip: "Für ein Histogramm: Grenzen in D2:D4, in E2 =INDEX(HÄUFIGKEIT($B$2:$B$31;$D$2:$D$4);ZEILE()-1) und bis E5 nach unten ausfüllen (eine Zeile mehr als Grenzen).",
    },
  },

  // Distributions
  "T.DIST.RT": {
    en: {
      summary: "The right-tailed t-distribution: the probability of a t at least this large (the one-tailed p-value).",
      args: [a("x", "The t-value."), a("deg_freedom", "The degrees of freedom, usually n − 1.")],
      example: "=T.DIST.RT(2.5,10)",
      exampleResult: "About 0.016",
      tip: "For t ≥ 0, twice this is T.DIST.2T, the two-tailed p-value.",
    },
    de: {
      summary: "Die rechtsseitige t-Verteilung: die Wahrscheinlichkeit für ein mindestens so großes t (der einseitige p-Wert).",
      args: [a("x", "Der t-Wert."), a("Freiheitsgrade", "Die Freiheitsgrade, meist n − 1.")],
      example: "=T.VERT.RE(2,5;10)",
      exampleResult: "Etwa 0,016",
      tip: "Für t ≥ 0 ist das Doppelte T.VERT.2S, der zweiseitige p-Wert.",
    },
  },
  "F.TEST": {
    en: {
      summary: "The p-value of an F-test: how likely variances at least this different would be if both groups really scattered equally.",
      args: [a("array1", "The first group's values."), a("array2", "The second group's values.")],
      example: "=F.TEST(B2:B4,C2:C4)",
      exampleResult: "E.g. 0.61 – above 0.05, so no sign that the two groups scatter differently.",
      tip: "Before a t-test: with p ≥ 0.05, T.TEST type 2 (equal variances) fits; otherwise take type 3 (Welch).",
    },
    de: {
      summary: "Der p-Wert eines F-Tests: wie wahrscheinlich mindestens so unterschiedliche Varianzen wären, wenn beide Gruppen in Wahrheit gleich stark streuen.",
      args: [a("Matrix1", "Die Werte der ersten Gruppe."), a("Matrix2", "Die Werte der zweiten Gruppe.")],
      example: "=F.TEST(B2:B4;C2:C4)",
      exampleResult: "Z. B. 0,61 – über 0,05, also kein Hinweis, dass die Gruppen unterschiedlich stark streuen.",
      tip: "Vor dem t-Test: Bei p ≥ 0,05 passt T.TEST Typ 2 (gleiche Varianzen), sonst nimm Typ 3 (Welch).",
    },
  },
  "F.DIST": {
    en: {
      summary: "The F-distribution: with cumulative TRUE the probability of an F up to x, with FALSE the density.",
      args: [...F_ARGS.en, a("cumulative", "TRUE: the probability up to x; FALSE: the density at x.")],
      example: "=F.DIST(2.5,3,10,TRUE)",
      exampleResult: "About 0.88",
    },
    de: {
      summary: "Die F-Verteilung: mit Kumuliert WAHR die Wahrscheinlichkeit für ein F bis x, mit FALSCH die Dichte.",
      args: [...F_ARGS.de, a("Kumuliert", "WAHR: die Wahrscheinlichkeit bis x; FALSCH: die Dichte bei x.")],
      example: "=F.VERT(2,5;3;10;WAHR)",
      exampleResult: "Etwa 0,88",
    },
  },
  "F.DIST.RT": {
    en: {
      summary: "The right tail of the F-distribution: the probability of an F at least this large, the p-value of an F-test or an analysis of variance.",
      args: F_ARGS.en,
      example: "=F.DIST.RT(2.5,3,10)",
      exampleResult: "About 0.119",
    },
    de: {
      summary: "Der rechte Teil der F-Verteilung: die Wahrscheinlichkeit für ein mindestens so großes F, der p-Wert eines F-Tests oder einer Varianzanalyse.",
      args: F_ARGS.de,
      example: "=F.VERT.RE(2,5;3;10)",
      exampleResult: "Etwa 0,119",
    },
  },
  "F.INV": {
    en: {
      summary: "The F-value below which a given share of the F-distribution lies (the inverse of F.DIST).",
      args: [a("probability", "The share, from 0 to below 1."), ...F_ARGS.en.slice(1)],
      example: "=F.INV(0.95,3,10)",
      exampleResult: "3.708",
    },
    de: {
      summary: "Der F-Wert, unter dem ein bestimmter Anteil der F-Verteilung liegt (die Umkehrung von F.VERT).",
      args: [a("Wahrsch", "Der Anteil, von 0 bis unter 1."), ...F_ARGS.de.slice(1)],
      example: "=F.INV(0,95;3;10)",
      exampleResult: "3,708",
    },
  },
  "F.INV.RT": {
    en: {
      summary: "The critical F-value: the F that is exceeded only with a given probability, e.g. 0.05.",
      args: [a("probability", "The error probability, e.g. 0.05."), ...F_ARGS.en.slice(1)],
      example: "=F.INV.RT(0.05,3,10)",
      exampleResult: "3.708 – an F above it is significant at the 5 % level.",
    },
    de: {
      summary: "Der kritische F-Wert: das F, das nur mit einer bestimmten Wahrscheinlichkeit überschritten wird, z. B. 0,05.",
      args: [a("Wahrsch", "Die Irrtumswahrscheinlichkeit, z. B. 0,05."), ...F_ARGS.de.slice(1)],
      example: "=F.INV.RE(0,05;3;10)",
      exampleResult: "3,708 – ein F darüber ist auf dem 5-%-Niveau signifikant.",
    },
  },
  "CHISQ.TEST": {
    en: {
      summary: "The p-value of a chi-squared test: how likely deviations at least this large between the observed and the expected counts would be if the expected ratio were true.",
      args: [a("actual_range", "The observed counts, e.g. the plants of each phenotype."), a("expected_range", "The expected counts for the same cells, e.g. from a 3:1 ratio.")],
      example: "=CHISQ.TEST(B2:B3,C2:C3)",
      exampleResult: "E.g. 0.44 for 787 : 277 plants against the expected 798 : 266 – above 0.05, so no significant deviation from 3:1.",
      tip: "The expected counts are the total times the expected share: for 3:1, =SUM(B$2:B$3)*3/4 and =SUM(B$2:B$3)/4. In a table of rows and columns there are (rows − 1)·(columns − 1) degrees of freedom.",
    },
    de: {
      summary: "Der p-Wert eines Chi-Quadrat-Tests: wie wahrscheinlich mindestens so große Abweichungen zwischen beobachteten und erwarteten Anzahlen wären, wenn das erwartete Verhältnis stimmt.",
      args: [a("Beob_Messwerte", "Die beobachteten Anzahlen, z. B. die Pflanzen je Phänotyp."), a("Erwart_Werte", "Die erwarteten Anzahlen für dieselben Zellen, z. B. nach einem 3:1-Verhältnis.")],
      example: "=CHIQU.TEST(B2:B3;C2:C3)",
      exampleResult: "Z. B. 0,44 für 787 : 277 Pflanzen gegenüber erwarteten 798 : 266 – über 0,05, also keine signifikante Abweichung von 3:1.",
      tip: "Die erwarteten Anzahlen sind die Gesamtzahl mal dem erwarteten Anteil: für 3:1 =SUMME(B$2:B$3)*3/4 und =SUMME(B$2:B$3)/4. In einer Tabelle aus Zeilen und Spalten gibt es (Zeilen − 1)·(Spalten − 1) Freiheitsgrade.",
    },
  },
  "CHISQ.DIST": {
    en: {
      summary: "The chi-squared distribution: with cumulative TRUE the probability of a χ² up to x, with FALSE the density.",
      args: [...CHI_ARGS.en, a("cumulative", "TRUE: the probability up to x; FALSE: the density at x.")],
      example: "=CHISQ.DIST(3.84,1,TRUE)",
      exampleResult: "About 0.95",
    },
    de: {
      summary: "Die Chi-Quadrat-Verteilung: mit Kumuliert WAHR die Wahrscheinlichkeit für ein χ² bis x, mit FALSCH die Dichte.",
      args: [...CHI_ARGS.de, a("Kumuliert", "WAHR: die Wahrscheinlichkeit bis x; FALSCH: die Dichte bei x.")],
      example: "=CHIQU.VERT(3,84;1;WAHR)",
      exampleResult: "Etwa 0,95",
    },
  },
  "CHISQ.DIST.RT": {
    en: {
      summary: "The right tail of the chi-squared distribution: the p-value for a χ² you calculated yourself.",
      args: CHI_ARGS.en,
      example: "=CHISQ.DIST.RT(3.84,1)",
      exampleResult: "About 0.05 – the 5 % limit for one degree of freedom.",
    },
    de: {
      summary: "Der rechte Teil der Chi-Quadrat-Verteilung: der p-Wert zu einem χ², das du selbst ausgerechnet hast.",
      args: CHI_ARGS.de,
      example: "=CHIQU.VERT.RE(3,84;1)",
      exampleResult: "Etwa 0,05 – die 5-%-Grenze bei einem Freiheitsgrad.",
    },
  },
  "CHISQ.INV": {
    en: {
      summary: "The χ² below which a given share of the chi-squared distribution lies (the inverse of CHISQ.DIST).",
      args: [a("probability", "The share, from 0 to below 1."), CHI_ARGS.en[1]],
      example: "=CHISQ.INV(0.95,1)",
      exampleResult: "3.841",
    },
    de: {
      summary: "Das χ², unter dem ein bestimmter Anteil der Chi-Quadrat-Verteilung liegt (die Umkehrung von CHIQU.VERT).",
      args: [a("Wahrsch", "Der Anteil, von 0 bis unter 1."), CHI_ARGS.de[1]],
      example: "=CHIQU.INV(0,95;1)",
      exampleResult: "3,841",
    },
  },
  "CHISQ.INV.RT": {
    en: {
      summary: "The critical χ²: the value that is exceeded only with a given probability, e.g. 0.05.",
      args: [a("probability", "The error probability, e.g. 0.05."), CHI_ARGS.en[1]],
      example: "=CHISQ.INV.RT(0.05,3)",
      exampleResult: "7.815 – the 5 % limit for four classes (3 degrees of freedom), e.g. a 9:3:3:1 ratio.",
    },
    de: {
      summary: "Das kritische χ²: der Wert, der nur mit einer bestimmten Wahrscheinlichkeit überschritten wird, z. B. 0,05.",
      args: [a("Wahrsch", "Die Irrtumswahrscheinlichkeit, z. B. 0,05."), CHI_ARGS.de[1]],
      example: "=CHIQU.INV.RE(0,05;3)",
      exampleResult: "7,815 – die 5-%-Grenze bei vier Klassen (3 Freiheitsgrade), z. B. für ein 9:3:3:1-Verhältnis.",
    },
  },
};

// ----------------------------------------------------------------------------------------------
// Older names (Excel 2007 and before) that calculate like a newer function: old workbooks and
// textbooks use them. Each says which newer one to take and has that one's arguments.

const same = (now: string, lang: "en" | "de") => STATS[now][lang].args;

const OLDER: Record<string, Pair> = {
  RANK: {
    en: { summary: "The older name of RANK.EQ: the rank of a number in a list, with the same result.", args: same("RANK.EQ", "en"), example: "=RANK(B2,B$2:B$20)", exampleResult: "The place of B2 in the list, the same as RANK.EQ." },
    de: { summary: "Der ältere Name von RANG.GLEICH: der Rang einer Zahl in einer Liste, mit gleichem Ergebnis.", args: same("RANK.EQ", "de"), example: "=RANG(B2;B$2:B$20)", exampleResult: "Der Platz von B2 in der Liste, wie mit RANG.GLEICH." },
  },
  PERCENTILE: {
    en: { summary: "The older name of PERCENTILE.INC, with the same result.", args: same("PERCENTILE.INC", "en"), example: "=PERCENTILE(B2:B101,0.95)", exampleResult: "The 95th percentile, the same as PERCENTILE.INC." },
    de: { summary: "Der ältere Name von QUANTIL.INKL, mit gleichem Ergebnis.", args: same("PERCENTILE.INC", "de"), example: "=QUANTIL(B2:B101;0,95)", exampleResult: "Das 95-%-Quantil, wie mit QUANTIL.INKL." },
  },
  QUARTILE: {
    en: { summary: "The older name of QUARTILE.INC, with the same result.", args: same("QUARTILE.INC", "en"), example: "=QUARTILE(B2:B30,1)", exampleResult: "The first quartile, the same as QUARTILE.INC." },
    de: { summary: "Der ältere Name von QUARTILE.INKL, mit gleichem Ergebnis.", args: same("QUARTILE.INC", "de"), example: "=QUARTILE(B2:B30;1)", exampleResult: "Das erste Quartil, wie mit QUARTILE.INKL." },
  },
  MODE: {
    en: { summary: "The older name of MODE.SNGL: the number that occurs most often, with the same result.", args: NUMBERS.en, example: "=MODE(2,3,3,5)", exampleResult: "3, the same as MODE.SNGL." },
    de: { summary: "Der ältere Name von MODUS.EINF: die Zahl, die am häufigsten vorkommt, mit gleichem Ergebnis.", args: NUMBERS.de, example: "=MODALWERT(2;3;3;5)", exampleResult: "3, wie mit MODUS.EINF." },
  },
  NORMDIST: {
    en: { summary: "The older name of NORM.DIST, with the same result.", args: same("NORM.DIST", "en"), example: "=NORMDIST(110,100,15,TRUE)", exampleResult: "About 0.75, the same as NORM.DIST." },
    de: { summary: "Der ältere Name von NORM.VERT, mit gleichem Ergebnis.", args: same("NORM.DIST", "de"), example: "=NORMVERT(110;100;15;WAHR)", exampleResult: "Etwa 0,75, wie mit NORM.VERT." },
  },
  NORMINV: {
    en: { summary: "The older name of NORM.INV, with the same result.", args: same("NORM.INV", "en"), example: "=NORMINV(0.975,0,1)", exampleResult: "1.96, the same as NORM.INV." },
    de: { summary: "Der ältere Name von NORM.INV, mit gleichem Ergebnis.", args: same("NORM.INV", "de"), example: "=NORMINV(0,975;0;1)", exampleResult: "1,96, wie mit NORM.INV." },
  },
  NORMSDIST: {
    en: { summary: "The older form of NORM.S.DIST with TRUE: the probability of a standard normal value up to z.", args: [a("z", "The z-value.")], example: "=NORMSDIST(1.96)", exampleResult: "0.975" },
    de: { summary: "Die ältere Form von NORM.S.VERT mit WAHR: die Wahrscheinlichkeit für einen standardnormalverteilten Wert bis z.", args: [a("z", "Der z-Wert.")], example: "=STANDNORMVERT(1,96)", exampleResult: "0,975" },
  },
  NORMSINV: {
    en: { summary: "The older name of NORM.S.INV, with the same result.", args: same("NORM.S.INV", "en"), example: "=NORMSINV(0.95)", exampleResult: "1.645, the same as NORM.S.INV." },
    de: { summary: "Der ältere Name von NORM.S.INV, mit gleichem Ergebnis.", args: same("NORM.S.INV", "de"), example: "=STANDNORMINV(0,95)", exampleResult: "1,645, wie mit NORM.S.INV." },
  },
  TDIST: {
    en: {
      summary: "The older t-distribution: with tails 1 the one-tailed p-value of t (like T.DIST.RT), with 2 the two-tailed one (like T.DIST.2T).",
      args: [a("x", "The t-value, 0 or more."), a("deg_freedom", "The degrees of freedom, usually n − 1."), a("tails", "1: one-tailed; 2: two-tailed.")],
      example: "=TDIST(2.5,10,2)",
      exampleResult: "About 0.031, the same as T.DIST.2T(2.5,10).",
    },
    de: {
      summary: "Die ältere t-Verteilung: mit Seiten 1 der einseitige p-Wert von t (wie T.VERT.RE), mit 2 der zweiseitige (wie T.VERT.2S).",
      args: [a("x", "Der t-Wert, 0 oder mehr."), a("Freiheitsgrade", "Die Freiheitsgrade, meist n − 1."), a("Seiten", "1: einseitig; 2: zweiseitig.")],
      example: "=TVERT(2,5;10;2)",
      exampleResult: "Etwa 0,031, wie T.VERT.2S(2,5;10).",
    },
  },
  TINV: {
    en: { summary: "The older name of T.INV.2T: the two-tailed t-value for an error probability, with the same result.", args: same("T.INV.2T", "en"), example: "=TINV(0.05,2)", exampleResult: "4.303, the same as T.INV.2T." },
    de: { summary: "Der ältere Name von T.INV.2S: der zweiseitige t-Wert für eine Irrtumswahrscheinlichkeit, mit gleichem Ergebnis.", args: same("T.INV.2T", "de"), example: "=TINV(0,05;2)", exampleResult: "4,303, wie mit T.INV.2S." },
  },
  TTEST: {
    en: { summary: "The older name of T.TEST: the p-value of a t-test, with the same result.", args: same("T.TEST", "en"), example: "=TTEST(B2:B4,C2:C4,2,3)", exampleResult: "The same p-value as T.TEST." },
    de: { summary: "Der ältere Name von T.TEST: der p-Wert eines t-Tests, mit gleichem Ergebnis.", args: same("T.TEST", "de"), example: "=TTEST(B2:B4;C2:C4;2;3)", exampleResult: "Derselbe p-Wert wie mit T.TEST." },
  },
  CONFIDENCE: {
    en: { summary: "The older name of CONFIDENCE.NORM (normal distribution, for large samples), with the same result.", args: same("CONFIDENCE.NORM", "en"), example: "=CONFIDENCE(0.05,2.5,50)", exampleResult: "About 0.69", tip: "For a few replicates, use CONFIDENCE.T." },
    de: { summary: "Der ältere Name von KONFIDENZ.NORM (Normalverteilung, für große Stichproben), mit gleichem Ergebnis.", args: same("CONFIDENCE.NORM", "de"), example: "=KONFIDENZ(0,05;2,5;50)", exampleResult: "Etwa 0,69", tip: "Für wenige Replikate nimmst du KONFIDENZ.T." },
  },
  FTEST: {
    en: { summary: "The older name of F.TEST: the p-value of an F-test, with the same result.", args: same("F.TEST", "en"), example: "=FTEST(B2:B4,C2:C4)", exampleResult: "The same p-value as F.TEST." },
    de: { summary: "Der ältere Name von F.TEST: der p-Wert eines F-Tests, mit gleichem Ergebnis.", args: same("F.TEST", "de"), example: "=FTEST(B2:B4;C2:C4)", exampleResult: "Derselbe p-Wert wie mit F.TEST." },
  },
  FDIST: {
    en: { summary: "The older name of F.DIST.RT: the right tail of the F-distribution, with the same result.", args: same("F.DIST.RT", "en"), example: "=FDIST(2.5,3,10)", exampleResult: "About 0.119, the same as F.DIST.RT." },
    de: { summary: "Der ältere Name von F.VERT.RE: der rechte Teil der F-Verteilung, mit gleichem Ergebnis.", args: same("F.DIST.RT", "de"), example: "=FVERT(2,5;3;10)", exampleResult: "Etwa 0,119, wie mit F.VERT.RE." },
  },
  FINV: {
    en: { summary: "The older name of F.INV.RT: the critical F-value, with the same result.", args: same("F.INV.RT", "en"), example: "=FINV(0.05,3,10)", exampleResult: "3.708, the same as F.INV.RT." },
    de: { summary: "Der ältere Name von F.INV.RE: der kritische F-Wert, mit gleichem Ergebnis.", args: same("F.INV.RT", "de"), example: "=FINV(0,05;3;10)", exampleResult: "3,708, wie mit F.INV.RE." },
  },
  CHITEST: {
    en: { summary: "The older name of CHISQ.TEST: the p-value of a chi-squared test, with the same result.", args: same("CHISQ.TEST", "en"), example: "=CHITEST(B2:B3,C2:C3)", exampleResult: "The same p-value as CHISQ.TEST." },
    de: { summary: "Der ältere Name von CHIQU.TEST: der p-Wert eines Chi-Quadrat-Tests, mit gleichem Ergebnis.", args: same("CHISQ.TEST", "de"), example: "=CHITEST(B2:B3;C2:C3)", exampleResult: "Derselbe p-Wert wie mit CHIQU.TEST." },
  },
  CHIDIST: {
    en: { summary: "The older name of CHISQ.DIST.RT: the p-value for a χ², with the same result.", args: same("CHISQ.DIST.RT", "en"), example: "=CHIDIST(3.84,1)", exampleResult: "About 0.05, the same as CHISQ.DIST.RT." },
    de: { summary: "Der ältere Name von CHIQU.VERT.RE: der p-Wert zu einem χ², mit gleichem Ergebnis.", args: same("CHISQ.DIST.RT", "de"), example: "=CHIVERT(3,84;1)", exampleResult: "Etwa 0,05, wie mit CHIQU.VERT.RE." },
  },
  CHIINV: {
    en: { summary: "The older name of CHISQ.INV.RT: the critical χ², with the same result.", args: same("CHISQ.INV.RT", "en"), example: "=CHIINV(0.05,3)", exampleResult: "7.815, the same as CHISQ.INV.RT." },
    de: { summary: "Der ältere Name von CHIQU.INV.RE: das kritische χ², mit gleichem Ergebnis.", args: same("CHISQ.INV.RT", "de"), example: "=CHIINV(0,05;3)", exampleResult: "7,815, wie mit CHIQU.INV.RE." },
  },
};

// ----------------------------------------------------------------------------------------------
// Regression (Kalibriergeraden, Prognosen)

const REGRESSION: Record<string, Pair> = {
  SLOPE: {
    en: {
      summary: "The slope m of the best straight line y = m·x + b through the points (least squares) – the same m as the chart's linear trendline.",
      args: KNOWN.en,
      example: "=SLOPE(C2:C7,B2:B7)",
      exampleResult: "0.0523 – the absorbance rises by 0.0523 per mg/L.",
      tip: "Calibration line: m = SLOPE(absorbances, concentrations) and b = INTERCEPT(…); a sample's concentration is then =(A − b)/m, e.g. =(B12-$F$3)/$F$2. Mind the order: the y values come first!",
    },
    de: {
      summary: "Die Steigung m der besten Geraden y = m·x + b durch die Punkte (kleinste Quadrate) – dasselbe m wie bei der linearen Trendlinie im Diagramm.",
      args: KNOWN.de,
      example: "=STEIGUNG(C2:C7;B2:B7)",
      exampleResult: "0,0523 – die Extinktion steigt um 0,0523 pro mg/L.",
      tip: "Kalibriergerade: m = STEIGUNG(Extinktionen; Konzentrationen) und b = ACHSENABSCHNITT(…); die Konzentration einer Probe ist dann =(E − b)/m, z. B. =(B12-$F$3)/$F$2. Achte auf die Reihenfolge: zuerst die y-Werte!",
    },
  },
  INTERCEPT: {
    en: {
      summary: "The intercept b of the best straight line y = m·x + b: where it crosses the y axis.",
      args: KNOWN.en,
      example: "=INTERCEPT(C2:C7,B2:B7)",
      exampleResult: "0.0012 – the absorbance the line predicts at 0 mg/L, ideally close to the blank.",
      tip: "A sample's concentration from its absorbance A: =(A − b)/m with b = INTERCEPT and m = SLOPE.",
    },
    de: {
      summary: "Der Achsenabschnitt b der besten Geraden y = m·x + b: wo sie die y-Achse schneidet.",
      args: KNOWN.de,
      example: "=ACHSENABSCHNITT(C2:C7;B2:B7)",
      exampleResult: "0,0012 – die Extinktion, die die Gerade bei 0 mg/L vorhersagt, idealerweise nahe am Blindwert.",
      tip: "Die Konzentration einer Probe aus ihrer Extinktion E: =(E − b)/m mit b = ACHSENABSCHNITT und m = STEIGUNG.",
    },
  },
  RSQ: {
    en: {
      summary: "The coefficient of determination R² of the straight line: 1 means every point lies exactly on it.",
      args: KNOWN.en,
      example: "=RSQ(C2:C7,B2:B7)",
      exampleResult: "0.9998 – the standards lie almost perfectly on the line.",
      tip: "The same R² the chart shows next to a linear trendline. Many lab procedures ask for R² ≥ 0.99 (some for 0.995 or 0.999). A high R² alone doesn't prove the curve is straight – look at the chart too.",
    },
    de: {
      summary: "Das Bestimmtheitsmaß R² der Geraden: 1 heißt, alle Punkte liegen genau darauf.",
      args: KNOWN.de,
      example: "=BESTIMMTHEITSMASS(C2:C7;B2:B7)",
      exampleResult: "0,9998 – die Standards liegen fast perfekt auf der Geraden.",
      tip: "Dasselbe R², das das Diagramm an der linearen Trendlinie zeigt. Viele Laborvorschriften verlangen R² ≥ 0,99 (manche 0,995 oder 0,999). Ein hohes R² allein beweist nicht, dass die Kurve gerade ist – schau dir auch das Diagramm an.",
    },
  },
  STEYX: {
    en: {
      summary: "The standard error of the y estimate (residual standard deviation s_y): how far the points scatter around the line, in y units.",
      args: KNOWN.en,
      example: "=STEYX(C2:C7,B2:B7)",
      exampleResult: "E.g. 0.003 – the typical distance of a standard from the line.",
      tip: "Divided by the slope it gives the method's standard deviation s_x0 = STEYX/SLOPE, in concentration units – the basis of the limits of detection and quantification in the calibration method (DIN 32645).",
    },
    de: {
      summary: "Der Standardfehler der y-Schätzung (Reststandardabweichung s_y): wie weit die Punkte um die Gerade streuen, in y-Einheiten.",
      args: KNOWN.de,
      example: "=STFEHLERYX(C2:C7;B2:B7)",
      exampleResult: "Z. B. 0,003 – der typische Abstand eines Standards von der Geraden.",
      tip: "Geteilt durch die Steigung ergibt sich die Verfahrensstandardabweichung s_x0 = STFEHLERYX/STEIGUNG in Konzentrationseinheiten – die Grundlage für Nachweis- und Bestimmungsgrenze nach der Kalibriermethode (DIN 32645).",
    },
  },
  FORECAST: {
    en: {
      summary: "The older name of FORECAST.LINEAR: the y value the best straight line predicts at x.",
      args: [a("x", "The x value to predict for."), ...KNOWN.en],
      example: "=FORECAST(5,C2:C7,B2:B7)",
      exampleResult: "The absorbance the calibration line predicts for 5 mg/L, the same as FORECAST.LINEAR.",
    },
    de: {
      summary: "Der ältere Name von PROGNOSE.LINEAR: der y-Wert, den die beste Gerade bei x vorhersagt.",
      args: [a("x", "Der x-Wert, für den vorhergesagt wird."), ...KNOWN.de],
      example: "=PROGNOSE(5;C2:C7;B2:B7)",
      exampleResult: "Die Extinktion, die die Kalibriergerade für 5 mg/L vorhersagt, wie PROGNOSE.LINEAR.",
    },
  },
  "FORECAST.LINEAR": {
    en: {
      summary: "The y value the best straight line through the points predicts at x: m·x + b in one step.",
      args: [a("x", "The x value to predict for."), ...KNOWN.en],
      example: "=FORECAST.LINEAR(5,C2:C7,B2:B7)",
      exampleResult: "About 0.263 – the absorbance a 5 mg/L standard should have.",
      tip: "For a concentration from an absorbance, calculate =(A − b)/m. Swapping the ranges, FORECAST.LINEAR(A, concentrations, absorbances), fits a different line (x on y) and gives a slightly different result.",
    },
    de: {
      summary: "Der y-Wert, den die beste Gerade durch die Punkte bei x vorhersagt: m·x + b in einem Schritt.",
      args: [a("x", "Der x-Wert, für den vorhergesagt wird."), ...KNOWN.de],
      example: "=PROGNOSE.LINEAR(5;C2:C7;B2:B7)",
      exampleResult: "Etwa 0,263 – die Extinktion, die ein Standard mit 5 mg/L haben sollte.",
      tip: "Für die Konzentration aus einer Extinktion rechnest du =(E − b)/m. Vertauschte Bereiche, PROGNOSE.LINEAR(E; Konzentrationen; Extinktionen), passen eine andere Gerade an (x auf y) und geben ein leicht anderes Ergebnis.",
    },
  },
  TREND: {
    en: {
      summary: "Values on the best straight line: for new x values, or for the known ones. With const FALSE the line goes through the origin.",
      args: [
        a("known_y's", "The y values."),
        a("known_x's", "The x values; left out: 1, 2, 3…", OPT),
        a("new_x's", "The x values to predict for; left out: the known x values.", OPT),
        a("const", "TRUE or left out: b is fitted; FALSE: b = 0, the line goes through the origin.", OPT),
      ],
      example: "=TREND(C2:C7,B2:B7,5)",
      exampleResult: "The same as FORECAST.LINEAR for 5 mg/L, about 0.263.",
    },
    de: {
      summary: "Werte auf der besten Geraden: für neue x-Werte oder für die bekannten. Mit Konstante FALSCH geht die Gerade durch den Nullpunkt.",
      args: [
        a("Y_Werte", "Die y-Werte."),
        a("X_Werte", "Die x-Werte; ohne Angabe 1, 2, 3 …", OPT),
        a("Neue_x_Werte", "Die x-Werte, für die vorhergesagt wird; ohne Angabe die bekannten.", OPT),
        a("Konstante", "WAHR oder leer: b wird angepasst; FALSCH: b = 0, die Gerade geht durch den Nullpunkt.", OPT),
      ],
      example: "=TREND(C2:C7;B2:B7;5)",
      exampleResult: "Dasselbe wie PROGNOSE.LINEAR für 5 mg/L, etwa 0,263.",
    },
  },
  GROWTH: {
    en: {
      summary: "Values on the best exponential curve y = b·mˣ – predicts exponential growth, e.g. of bacteria.",
      args: [
        a("known_y's", "The y values (all positive)."),
        a("known_x's", "The x values; left out: 1, 2, 3…", OPT),
        a("new_x's", "The x values to predict for; left out: the known x values.", OPT),
        a("const", "TRUE or left out: b is fitted; FALSE: b = 1.", OPT),
      ],
      example: "=GROWTH(B5:B9,A5:A9,4)",
      exampleResult: "The OD600 the exponential curve through the log phase (rows 5–9) predicts after 4 h.",
    },
    de: {
      summary: "Werte auf der besten Exponentialkurve y = b·mˣ – sagt exponentielles Wachstum vorher, z. B. von Bakterien.",
      args: [
        a("Y_Werte", "Die y-Werte (alle positiv)."),
        a("X_Werte", "Die x-Werte; ohne Angabe 1, 2, 3 …", OPT),
        a("Neue_x_Werte", "Die x-Werte, für die vorhergesagt wird; ohne Angabe die bekannten.", OPT),
        a("Konstante", "WAHR oder leer: b wird angepasst; FALSCH: b = 1.", OPT),
      ],
      example: "=VARIATION(B5:B9;A5:A9;4)",
      exampleResult: "Die OD600, die die Exponentialkurve durch die log-Phase (Zeilen 5–9) nach 4 h vorhersagt.",
    },
  },
  LINEST: {
    en: {
      summary: "Fits a straight line (least squares) and gives its numbers as an array: first the slope m, then the intercept b; with stats TRUE also standard errors, R² and more.",
      args: [
        a("known_y's", "The y values."),
        a("known_x's", "The x values; left out: 1, 2, 3…", OPT),
        a("const", "TRUE or left out: an ordinary line; FALSE: the line through the origin (b = 0).", OPT),
        a("stats", "TRUE: also the standard errors, R², F, degrees of freedom and sums of squares; FALSE or left out: just m and b.", OPT),
      ],
      example: "=INDEX(LINEST(C2:C7,B2:B7,FALSE),1)",
      exampleResult: "The slope of the line through the origin, e.g. 0.0525.",
      tip: "A line through the origin, like “intercept = 0” on the chart's trendline: =INDEX(LINEST(y,x,FALSE),1). With stats, R² is in row 3, column 1: =INDEX(LINEST(y,x,TRUE,TRUE),3,1).",
    },
    de: {
      summary: "Passt eine Gerade an (kleinste Quadrate) und gibt ihre Kennzahlen als Matrix zurück: zuerst die Steigung m, dann den Achsenabschnitt b; mit Stats WAHR auch Standardfehler, R² und mehr.",
      args: [
        a("Y_Werte", "Die y-Werte."),
        a("X_Werte", "Die x-Werte; ohne Angabe 1, 2, 3 …", OPT),
        a("Konstante", "WAHR oder leer: eine normale Gerade; FALSCH: die Gerade durch den Nullpunkt (b = 0).", OPT),
        a("Stats", "WAHR: zusätzlich Standardfehler, R², F-Wert, Freiheitsgrade und Quadratsummen; FALSCH oder leer: nur m und b.", OPT),
      ],
      example: "=INDEX(RGP(C2:C7;B2:B7;FALSCH);1)",
      exampleResult: "Die Steigung der Geraden durch den Nullpunkt, z. B. 0,0525.",
      tip: "Eine Gerade durch den Nullpunkt, wie „Schnittpunkt = 0“ an der Trendlinie im Diagramm: =INDEX(RGP(y;x;FALSCH);1). Mit Stats steht R² in Zeile 3, Spalte 1: =INDEX(RGP(y;x;WAHR;WAHR);3;1).",
    },
  },
  LOGEST: {
    en: {
      summary: "Fits an exponential curve y = b·mˣ and gives m (the growth factor per x step), then b, as an array.",
      args: [
        a("known_y's", "The y values (all positive)."),
        a("known_x's", "The x values; left out: 1, 2, 3…", OPT),
        a("const", "TRUE or left out: b is fitted; FALSE: b = 1.", OPT),
        a("stats", "TRUE: also standard errors, R² and more; FALSE or left out: just m and b.", OPT),
      ],
      example: "=LN(INDEX(LOGEST(B5:B9,A5:A9),1))",
      exampleResult: "The growth rate µ (per hour) of the log phase in rows 5–9; the generation time is then LN(2)/µ.",
      tip: "µ = LN(m) is the same number as the exponent of the chart's exponential trendline y = a·e^(µx).",
    },
    de: {
      summary: "Passt eine Exponentialkurve y = b·mˣ an und gibt m (den Wachstumsfaktor pro x-Schritt) und dann b als Matrix zurück.",
      args: [
        a("Y_Werte", "Die y-Werte (alle positiv)."),
        a("X_Werte", "Die x-Werte; ohne Angabe 1, 2, 3 …", OPT),
        a("Konstante", "WAHR oder leer: b wird angepasst; FALSCH: b = 1.", OPT),
        a("Stats", "WAHR: zusätzlich Standardfehler, R² und mehr; FALSCH oder leer: nur m und b.", OPT),
      ],
      example: "=LN(INDEX(RKP(B5:B9;A5:A9);1))",
      exampleResult: "Die Wachstumsrate µ (pro Stunde) der log-Phase in den Zeilen 5–9; die Generationszeit ist dann LN(2)/µ.",
      tip: "µ = LN(m) ist dieselbe Zahl wie der Exponent der exponentiellen Trendlinie im Diagramm, y = a·e^(µx).",
    },
  },
};

// ----------------------------------------------------------------------------------------------
// Logik

const LOGIC: Record<string, Pair> = {
  IF: {
    en: {
      summary: "Gives one value when a condition is true and another when it's false.",
      args: [
        a("logical_test", 'The condition, e.g. B2>0.5 or A2="Control".'),
        a("value_if_true", "What to show when it's true."),
        a("value_if_false", "What to show when it's false; left out: FALSE.", OPT),
      ],
      example: '=IF(B2>MAX($C$2:$C$7),"dilute","ok")',
      exampleResult: "“dilute” when the sample's absorbance is above the highest standard, otherwise “ok”.",
      tip: 'Text in a formula goes in quotes, and "" makes a cell look empty. For more than two cases, use IFS.',
    },
    de: {
      summary: "Gibt einen Wert, wenn eine Bedingung wahr ist, und einen anderen, wenn sie falsch ist.",
      args: [
        a("Prüfung", 'Die Bedingung, z. B. B2>0,5 oder A2="Kontrolle".'),
        a("Dann_Wert", "Was erscheint, wenn sie wahr ist."),
        a("Sonst_Wert", "Was erscheint, wenn sie falsch ist; ohne Angabe FALSCH.", OPT),
      ],
      example: '=WENN(B2>MAX($C$2:$C$7);"verdünnen";"ok")',
      exampleResult: "„verdünnen“, wenn die Extinktion der Probe über dem höchsten Standard liegt, sonst „ok“.",
      tip: 'Text steht in der Formel in Anführungszeichen, und "" lässt eine Zelle leer aussehen. Für mehr als zwei Fälle nimm WENNS.',
    },
  },
  IFS: {
    en: {
      summary: "Checks conditions in order and gives the value of the first one that is true.",
      args: [
        a("logical_test1", "The first condition."),
        a("value_if_true1", "What to show when it's true."),
        a("logical_test2", "More conditions, checked in order.", MORE),
        a("value_if_true2", "What to show for each of them.", MORE),
      ],
      example: '=IFS(D2<0.05,"very good",D2<0.1,"good",TRUE,"check")',
      exampleResult: "Rates the coefficient of variation in D2: below 5 % “very good”, below 10 % “good”, otherwise “check”.",
      tip: "TRUE as the last condition catches everything else; without it, no match gives #N/A.",
    },
    de: {
      summary: "Prüft Bedingungen der Reihe nach und gibt den Wert der ersten, die wahr ist.",
      args: [
        a("Wahrheitstest1", "Die erste Bedingung."),
        a("Wert_wenn_wahr1", "Was erscheint, wenn sie wahr ist."),
        a("Wahrheitstest2", "Weitere Bedingungen, der Reihe nach geprüft.", MORE),
        a("Wert_wenn_wahr2", "Was jeweils erscheint.", MORE),
      ],
      example: '=WENNS(D2<0,05;"sehr gut";D2<0,1;"gut";WAHR;"prüfen")',
      exampleResult: "Bewertet den Variationskoeffizienten in D2: unter 5 % „sehr gut“, unter 10 % „gut“, sonst „prüfen“.",
      tip: "WAHR als letzte Bedingung fängt alles Übrige ab; ohne sie gibt es ohne Treffer #NV.",
    },
  },
  AND: {
    en: {
      summary: "TRUE when all the conditions are true.",
      args: [a("logical1", "The first condition."), a("logical2", "More conditions, up to 255.", MORE)],
      example: "=AND(B2>=0.1,B2<=1)",
      exampleResult: "TRUE when the absorbance in B2 is between 0.1 and 1, where a photometer measures most precisely.",
    },
    de: {
      summary: "WAHR, wenn alle Bedingungen wahr sind.",
      args: [a("Wahrheitswert1", "Die erste Bedingung."), a("Wahrheitswert2", "Weitere Bedingungen, bis zu 255.", MORE)],
      example: "=UND(B2>=0,1;B2<=1)",
      exampleResult: "WAHR, wenn die Extinktion in B2 zwischen 0,1 und 1 liegt – dort misst ein Photometer am genauesten.",
    },
  },
  OR: {
    en: {
      summary: "TRUE when at least one of the conditions is true.",
      args: [a("logical1", "The first condition."), a("logical2", "More conditions, up to 255.", MORE)],
      example: '=OR(C2="positive",D2>100)',
      exampleResult: "TRUE when the sample is positive or has more than 100 colonies.",
    },
    de: {
      summary: "WAHR, wenn mindestens eine Bedingung wahr ist.",
      args: [a("Wahrheitswert1", "Die erste Bedingung."), a("Wahrheitswert2", "Weitere Bedingungen, bis zu 255.", MORE)],
      example: '=ODER(C2="positiv";D2>100)',
      exampleResult: "WAHR, wenn die Probe positiv ist oder mehr als 100 Kolonien hat.",
    },
  },
  NOT: {
    en: { summary: "Turns TRUE into FALSE and FALSE into TRUE.", args: [a("logical", "A condition or a TRUE/FALSE value.")], example: "=NOT(ISBLANK(B2))", exampleResult: "TRUE when B2 isn't empty." },
    de: { summary: "Macht aus WAHR FALSCH und aus FALSCH WAHR.", args: [a("Wahrheitswert", "Eine Bedingung oder ein WAHR/FALSCH-Wert.")], example: "=NICHT(ISTLEER(B2))", exampleResult: "WAHR, wenn B2 nicht leer ist." },
  },
  XOR: {
    en: {
      summary: "TRUE when an odd number of the conditions is true – with two conditions: exactly one.",
      args: [a("logical1", "The first condition."), a("logical2", "More conditions.", MORE)],
      example: "=XOR(B2>0,C2>0)",
      exampleResult: "TRUE when exactly one of B2 and C2 is positive.",
    },
    de: {
      summary: "WAHR, wenn eine ungerade Anzahl der Bedingungen wahr ist – bei zwei Bedingungen: genau eine.",
      args: [a("Wahrheitswert1", "Die erste Bedingung."), a("Wahrheitswert2", "Weitere Bedingungen.", MORE)],
      example: "=XODER(B2>0;C2>0)",
      exampleResult: "WAHR, wenn genau eine von B2 und C2 positiv ist.",
    },
  },
  IFERROR: {
    en: {
      summary: "Gives the value – or something you choose if it is an error (#DIV/0!, #N/A, #VALUE!…).",
      args: [a("value", "The formula that might fail."), a("value_if_error", 'What to show instead, e.g. "" or 0.')],
      example: '=IFERROR(C2/B2,"")',
      exampleResult: "C2 divided by B2 – or an empty-looking cell while B2 is still empty, instead of #DIV/0!.",
      tip: "Handy for rows you haven't filled in yet. But don't hide errors you should see: a #VALUE! often means a typo in the data.",
    },
    de: {
      summary: "Gibt den Wert – oder etwas, das du wählst, wenn er ein Fehler ist (#DIV/0!, #NV, #WERT! …).",
      args: [a("Wert", "Die Formel, die schiefgehen kann."), a("Wert_falls_Fehler", 'Was stattdessen erscheint, z. B. "" oder 0.')],
      example: '=WENNFEHLER(C2/B2;"")',
      exampleResult: "C2 geteilt durch B2 – oder eine leer wirkende Zelle, solange B2 noch leer ist, statt #DIV/0!.",
      tip: "Praktisch für Zeilen, die noch nicht ausgefüllt sind. Verstecke aber keine Fehler, die du sehen solltest: ein #WERT! heißt oft, dass in den Daten ein Tippfehler steckt.",
    },
  },
  IFNA: {
    en: {
      summary: "Like IFERROR, but only catches #N/A – e.g. a lookup that found nothing.",
      args: [a("value", "The formula that might give #N/A."), a("value_if_na", "What to show instead.")],
      example: '=IFNA(VLOOKUP(A2,$F$2:$G$20,2,FALSE),"not in the list")',
      exampleResult: "The molar mass from the list, or “not in the list”.",
    },
    de: {
      summary: "Wie WENNFEHLER, fängt aber nur #NV ab – z. B. eine Suche, die nichts gefunden hat.",
      args: [a("Wert", "Die Formel, die #NV ergeben kann."), a("Wert_bei_NV", "Was stattdessen erscheint.")],
      example: '=WENNNV(SVERWEIS(A2;$F$2:$G$20;2;FALSCH);"nicht in der Liste")',
      exampleResult: "Die molare Masse aus der Liste oder „nicht in der Liste“.",
    },
  },
  SWITCH: {
    en: {
      summary: "Compares a value with a list and gives the result that belongs to the first match.",
      args: [
        a("expression", "The value to compare."),
        a("value1", "The first value to compare with."),
        a("result1", "What to give when it matches."),
        a("default_or_value2", "More values to compare with – or, last and on its own, the result when nothing matches.", MORE),
        a("result2", "What to give when that value matches.", MORE),
      ],
      example: '=SWITCH(B2,1,"Gram-positive",2,"Gram-negative","unknown")',
      exampleResult: "The text for the code in B2; “unknown” for any other code.",
    },
    de: {
      summary: "Vergleicht einen Wert mit einer Liste und gibt das Ergebnis zum ersten Treffer.",
      args: [
        a("Ausdruck", "Der Wert, der verglichen wird."),
        a("Wert1", "Der erste Vergleichswert."),
        a("Ergebnis1", "Was erscheint, wenn er passt."),
        a("Standard_oder_Wert2", "Weitere Vergleichswerte – oder, als letztes und allein, das Ergebnis, wenn nichts passt.", MORE),
        a("Ergebnis2", "Was erscheint, wenn dieser Wert passt.", MORE),
      ],
      example: '=ERSTERWERT(B2;1;"grampositiv";2;"gramnegativ";"unbekannt")',
      exampleResult: "Den Text zum Code in B2; „unbekannt“ bei jedem anderen Code.",
    },
  },
  TRUE: {
    en: { summary: "The logical value TRUE. You can also just type TRUE.", args: [], example: "=TRUE()", exampleResult: "TRUE" },
    de: { summary: "Der Wahrheitswert WAHR. Du kannst auch einfach WAHR schreiben.", args: [], example: "=WAHR()", exampleResult: "WAHR" },
  },
  FALSE: {
    en: { summary: "The logical value FALSE. You can also just type FALSE.", args: [], example: "=FALSE()", exampleResult: "FALSE" },
    de: { summary: "Der Wahrheitswert FALSCH. Du kannst auch einfach FALSCH schreiben.", args: [], example: "=FALSCH()", exampleResult: "FALSCH" },
  },
};

// ----------------------------------------------------------------------------------------------
// Nachschlagen und Verweisen

const LOOKUP: Record<string, Pair> = {
  VLOOKUP: {
    en: {
      summary: "Looks for a value in the first column of a table and gives the value from another column of the same row.",
      args: [
        a("lookup_value", "What to look for, e.g. a substance name."),
        a("table_array", "The table; its first column is searched."),
        a("col_index_num", "Which column of the table to return: 1 is the first."),
        a("range_lookup", "FALSE: exact matches only (usual); TRUE or left out: the nearest smaller value in a sorted first column.", OPT),
      ],
      example: '=VLOOKUP("NaCl",$A$2:$C$20,3,FALSE)',
      exampleResult: "The molar mass of NaCl from column 3 of the substance list, e.g. 58.44.",
      tip: "Almost always write FALSE at the end – otherwise VLOOKUP happily returns the wrong row of an unsorted list. XLOOKUP is easier and can also look to the left.",
    },
    de: {
      summary: "Sucht einen Wert in der ersten Spalte einer Tabelle und gibt den Wert aus einer anderen Spalte derselben Zeile.",
      args: [
        a("Suchkriterium", "Wonach gesucht wird, z. B. ein Substanzname."),
        a("Matrix", "Die Tabelle; gesucht wird in ihrer ersten Spalte."),
        a("Spaltenindex", "Aus welcher Spalte der Tabelle das Ergebnis kommt: 1 ist die erste."),
        a("Bereich_Verweis", "FALSCH: nur genaue Treffer (üblich); WAHR oder leer: der nächstkleinere Wert in einer sortierten ersten Spalte.", OPT),
      ],
      example: '=SVERWEIS("NaCl";$A$2:$C$20;3;FALSCH)',
      exampleResult: "Die molare Masse von NaCl aus Spalte 3 der Substanzliste, z. B. 58,44.",
      tip: "Schreib fast immer FALSCH ans Ende – sonst liefert SVERWEIS in einer unsortierten Liste gern die falsche Zeile. XVERWEIS ist einfacher und kann auch nach links suchen.",
    },
  },
  HLOOKUP: {
    en: {
      summary: "Like VLOOKUP, but searches the first row and gives the value from a row below it.",
      args: [
        a("lookup_value", "What to look for."),
        a("table_array", "The table; its first row is searched."),
        a("row_index_num", "Which row of the table to return: 1 is the first."),
        a("range_lookup", "FALSE: exact matches only (usual); TRUE or left out: the nearest smaller value in a sorted first row.", OPT),
      ],
      example: '=HLOOKUP("24 h",$B$1:$H$5,3,FALSE)',
      exampleResult: "The value in row 3 of the column headed “24 h”.",
    },
    de: {
      summary: "Wie SVERWEIS, sucht aber in der ersten Zeile und gibt den Wert aus einer Zeile darunter.",
      args: [
        a("Suchkriterium", "Wonach gesucht wird."),
        a("Matrix", "Die Tabelle; gesucht wird in ihrer ersten Zeile."),
        a("Zeilenindex", "Aus welcher Zeile der Tabelle das Ergebnis kommt: 1 ist die erste."),
        a("Bereich_Verweis", "FALSCH: nur genaue Treffer (üblich); WAHR oder leer: der nächstkleinere Wert in einer sortierten ersten Zeile.", OPT),
      ],
      example: '=WVERWEIS("24 h";$B$1:$H$5;3;FALSCH)',
      exampleResult: "Der Wert in Zeile 3 der Spalte mit der Überschrift „24 h“.",
    },
  },
  XLOOKUP: {
    en: {
      summary: "Looks for a value in one column (or row) and gives the value at the same place in another.",
      args: [
        a("lookup_value", "What to look for."),
        a("lookup_array", "The column or row to search."),
        a("return_array", "The column or row to return from."),
        a("if_not_found", "What to show when nothing is found; left out: #N/A.", OPT),
        a("match_mode", "0: exact (default); −1: exact or the next smaller; 1: exact or the next larger; 2: with wildcards * and ?.", OPT),
        a("search_mode", "1: first to last (default); −1: last to first; 2 or −2: binary search in sorted data.", OPT),
      ],
      example: '=XLOOKUP("Tris",A2:A20,C2:C20,"not found")',
      exampleResult: "The molar mass of Tris from column C, e.g. 121.14 – or “not found”.",
      tip: "Easier than VLOOKUP: exact matches by default, no counting columns, and the result column may be left of the searched one.",
    },
    de: {
      summary: "Sucht einen Wert in einer Spalte (oder Zeile) und gibt den Wert an derselben Stelle einer anderen.",
      args: [
        a("Suchkriterium", "Wonach gesucht wird."),
        a("Suchmatrix", "Die Spalte oder Zeile, die durchsucht wird."),
        a("Rückgabematrix", "Die Spalte oder Zeile, aus der das Ergebnis kommt."),
        a("wenn_nicht_gefunden", "Was erscheint, wenn nichts gefunden wird; ohne Angabe #NV.", OPT),
        a("Vergleichsmodus", "0: genau (Standard); −1: genau oder der nächstkleinere; 1: genau oder der nächstgrößere; 2: mit Platzhaltern * und ?.", OPT),
        a("Suchmodus", "1: vom ersten zum letzten (Standard); −1: vom letzten zum ersten; 2 oder −2: binäre Suche in sortierten Daten.", OPT),
      ],
      example: '=XVERWEIS("Tris";A2:A20;C2:C20;"nicht gefunden")',
      exampleResult: "Die molare Masse von Tris aus Spalte C, z. B. 121,14 – oder „nicht gefunden“.",
      tip: "Einfacher als SVERWEIS: standardmäßig genaue Treffer, kein Spaltenzählen, und die Ergebnisspalte darf links von der Suchspalte liegen.",
    },
  },
  INDEX: {
    en: {
      summary: "The value at a given row and column of a range.",
      args: [
        a("array", "The range, or an array such as the result of LINEST."),
        a("row_num", "The row inside the range: 1 is the first."),
        a("column_num", "The column inside the range; can be left out for a single row or column.", OPT),
      ],
      example: "=INDEX(B2:D7,3,2)",
      exampleResult: "The value in the 3rd row and 2nd column of B2:D7, i.e. C4.",
      tip: 'With MATCH it finds values anywhere: =INDEX(C2:C20,MATCH("Tris",A2:A20,0)).',
    },
    de: {
      summary: "Der Wert in einer bestimmten Zeile und Spalte eines Bereichs.",
      args: [
        a("Matrix", "Der Bereich oder eine Matrix wie das Ergebnis von RGP."),
        a("Zeile", "Die Zeile innerhalb des Bereichs: 1 ist die erste."),
        a("Spalte", "Die Spalte innerhalb des Bereichs; kann bei nur einer Zeile oder Spalte fehlen.", OPT),
      ],
      example: "=INDEX(B2:D7;3;2)",
      exampleResult: "Der Wert in der 3. Zeile und 2. Spalte von B2:D7, also C4.",
      tip: 'Mit VERGLEICH findet es Werte überall: =INDEX(C2:C20;VERGLEICH("Tris";A2:A20;0)).',
    },
  },
  MATCH: {
    en: {
      summary: "The position of a value in a row or column (1 for the first cell).",
      args: [
        a("lookup_value", "What to look for."),
        a("lookup_array", "One row or column to search."),
        a("match_type", "0: exact match (usual); 1 or left out: the largest value ≤ the one you look for (sorted ascending); −1: the smallest value ≥ it (sorted descending).", OPT),
      ],
      example: '=MATCH("Sample C",A2:A20,0)',
      exampleResult: "3 when Sample C is in the third cell, A4.",
    },
    de: {
      summary: "Die Position eines Werts in einer Zeile oder Spalte (1 für die erste Zelle).",
      args: [
        a("Suchkriterium", "Wonach gesucht wird."),
        a("Suchmatrix", "Eine Zeile oder Spalte, die durchsucht wird."),
        a("Vergleichstyp", "0: genauer Treffer (üblich); 1 oder leer: der größte Wert ≤ dem gesuchten (aufsteigend sortiert); −1: der kleinste Wert ≥ dem gesuchten (absteigend sortiert).", OPT),
      ],
      example: '=VERGLEICH("Probe C";A2:A20;0)',
      exampleResult: "3, wenn Probe C in der dritten Zelle steht, also in A4.",
    },
  },
  XMATCH: {
    en: {
      summary: "The position of a value in a row or column (1 for the first cell), searched like XLOOKUP: exact by default, or the next smaller or larger value, with wildcards, or from the end.",
      args: [
        a("lookup_value", "What to look for."),
        a("lookup_array", "One row or column to search."),
        a("match_mode", "0: exact (default); −1: exact or the next smaller; 1: exact or the next larger; 2: with the wildcards * and ?.", OPT),
        a("search_mode", "1: from the first to the last (default); −1: from the last to the first; 2 or −2: binary search in sorted data.", OPT),
      ],
      example: '=XMATCH("Sample C",A2:A20)',
      exampleResult: "3 when Sample C is in the third cell, A4.",
      tip: "Easier than MATCH: exact matches by default, and the next smaller or larger value needs no sorting.",
    },
    de: {
      summary: "Die Position eines Werts in einer Zeile oder Spalte (1 für die erste Zelle), gesucht wie mit XVERWEIS: standardmäßig genau, oder der nächstkleinere oder -größere Wert, mit Platzhaltern oder vom Ende her.",
      args: [
        a("Suchkriterium", "Wonach gesucht wird."),
        a("Suchmatrix", "Eine Zeile oder Spalte, die durchsucht wird."),
        a("Vergleichsmodus", "0: genau (Standard); −1: genau oder der nächstkleinere; 1: genau oder der nächstgrößere; 2: mit den Platzhaltern * und ?.", OPT),
        a("Suchmodus", "1: vom ersten zum letzten (Standard); −1: vom letzten zum ersten; 2 oder −2: binäre Suche in sortierten Daten.", OPT),
      ],
      example: '=XVERGLEICH("Probe C";A2:A20)',
      exampleResult: "3, wenn Probe C in der dritten Zelle steht, also in A4.",
      tip: "Einfacher als VERGLEICH: standardmäßig genaue Treffer, und für den nächstkleineren oder -größeren Wert muss nichts sortiert sein.",
    },
  },
  LOOKUP: {
    en: {
      summary: "Looks a value up in a sorted row or column (the largest value that is ≤ the one sought) and gives the value at the same place of a second row or column.",
      args: [
        a("lookup_value", "What to look for."),
        a("lookup_vector", "One row or column, sorted ascending."),
        a("result_vector", "The row or column the result comes from; left out: the lookup vector itself.", OPT),
      ],
      example: "=LOOKUP(D2,A2:A7,B2:B7)",
      exampleResult: "The grade for the share of points in D2, when A2:A7 holds the lowest share of each grade (0 %, 50 %, 60 %, 70 %, 80 %, 90 %) and B2:B7 the grades 6 to 1.",
      tip: "Only for sorted data; for exact matches, use XLOOKUP, or VLOOKUP with FALSE.",
    },
    de: {
      summary: "Sucht einen Wert in einer sortierten Zeile oder Spalte (den größten Wert, der ≤ dem gesuchten ist) und gibt den Wert an derselben Stelle einer zweiten Zeile oder Spalte.",
      args: [
        a("Suchkriterium", "Wonach gesucht wird."),
        a("Suchvektor", "Eine Zeile oder Spalte, aufsteigend sortiert."),
        a("Ergebnisvektor", "Die Zeile oder Spalte, aus der das Ergebnis kommt; ohne Angabe der Suchvektor selbst.", OPT),
      ],
      example: "=VERWEIS(D2;A2:A7;B2:B7)",
      exampleResult: "Die Note zum Punkteanteil in D2, wenn in A2:A7 der kleinste Anteil jeder Note steht (0 %, 50 %, 60 %, 70 %, 80 %, 90 %) und in B2:B7 die Noten 6 bis 1.",
      tip: "Nur für sortierte Daten; für genaue Treffer nimm XVERWEIS oder SVERWEIS mit FALSCH.",
    },
  },
  CHOOSE: {
    en: {
      summary: "Picks a value from a list by its number.",
      args: [a("index_num", "Which value: 1 for the first."), a("value1", "The first value."), a("value2", "More values, up to 254.", MORE)],
      example: '=CHOOSE(2,"low","medium","high")',
      exampleResult: "“medium”",
    },
    de: {
      summary: "Wählt einen Wert aus einer Liste nach seiner Nummer.",
      args: [a("Index", "Welcher Wert: 1 für den ersten."), a("Wert1", "Der erste Wert."), a("Wert2", "Weitere Werte, bis zu 254.", MORE)],
      example: '=WAHL(2;"niedrig";"mittel";"hoch")',
      exampleResult: "„mittel“",
    },
  },
  ROW: {
    en: {
      summary: "The row number of a cell – or of the cell the formula is in.",
      args: [a("reference", "A cell; left out: this cell.", OPT)],
      example: "=ROW(B5)",
      exampleResult: "5",
      tip: "=ROW()-1 numbers rows by itself: in row 2 it gives 1.",
    },
    de: {
      summary: "Die Zeilennummer einer Zelle – oder der Zelle, in der die Formel steht.",
      args: [a("Bezug", "Eine Zelle; ohne Angabe diese Zelle.", OPT)],
      example: "=ZEILE(B5)",
      exampleResult: "5",
      tip: "=ZEILE()-1 nummeriert Zeilen von selbst: in Zeile 2 ergibt es 1.",
    },
  },
  COLUMN: {
    en: { summary: "The column number of a cell (A = 1) – or of the cell the formula is in.", args: [a("reference", "A cell; left out: this cell.", OPT)], example: "=COLUMN(D1)", exampleResult: "4" },
    de: { summary: "Die Spaltennummer einer Zelle (A = 1) – oder der Zelle, in der die Formel steht.", args: [a("Bezug", "Eine Zelle; ohne Angabe diese Zelle.", OPT)], example: "=SPALTE(D1)", exampleResult: "4" },
  },
  ROWS: {
    en: { summary: "How many rows a range has.", args: [a("array", "A range.")], example: "=ROWS(A2:A21)", exampleResult: "20" },
    de: { summary: "Wie viele Zeilen ein Bereich hat.", args: [a("Matrix", "Ein Bereich.")], example: "=ZEILEN(A2:A21)", exampleResult: "20" },
  },
  COLUMNS: {
    en: { summary: "How many columns a range has.", args: [a("array", "A range.")], example: "=COLUMNS(B1:D1)", exampleResult: "3" },
    de: { summary: "Wie viele Spalten ein Bereich hat.", args: [a("Matrix", "Ein Bereich.")], example: "=SPALTEN(B1:D1)", exampleResult: "3" },
  },
};

// ----------------------------------------------------------------------------------------------
// Text

const TEXT: Record<string, Pair> = {
  CONCAT: {
    en: {
      summary: "Joins texts, numbers and whole ranges into one text.",
      args: [a("text1", "The first text, cell or range."), a("text2", "More texts, cells or ranges.", MORE)],
      example: '=CONCAT(A2," (",B2,")")',
      exampleResult: "E.g. “Sample A (1:10)” when A2 holds Sample A and B2 holds 1:10.",
      tip: 'The & operator does the same: =A2&" ("&B2&")".',
    },
    de: {
      summary: "Verbindet Texte, Zahlen und ganze Bereiche zu einem Text.",
      args: [a("Text1", "Der erste Text, die erste Zelle oder der erste Bereich."), a("Text2", "Weitere Texte, Zellen oder Bereiche.", MORE)],
      example: '=TEXTKETTE(A2;" (";B2;")")',
      exampleResult: "Z. B. „Probe A (1:10)“, wenn in A2 Probe A und in B2 1:10 steht.",
      tip: 'Der Operator & macht dasselbe: =A2&" ("&B2&")".',
    },
  },
  CONCATENATE: {
    en: {
      summary: "The older way to join texts (without ranges); CONCAT or & do the same.",
      args: [a("text1", "The first text or cell."), a("text2", "More texts or cells.", MORE)],
      example: '=CONCATENATE("OD",600)',
      exampleResult: "“OD600”",
    },
    de: {
      summary: "Der ältere Weg, Texte zu verbinden (ohne Bereiche); TEXTKETTE oder & machen dasselbe.",
      args: [a("Text1", "Der erste Text oder die erste Zelle."), a("Text2", "Weitere Texte oder Zellen.", MORE)],
      example: '=VERKETTEN("OD";600)',
      exampleResult: "„OD600“",
    },
  },
  TEXTJOIN: {
    en: {
      summary: "Joins texts and ranges with a separator between them, optionally skipping empty cells.",
      args: [
        a("delimiter", 'What goes between the pieces, e.g. ", ".'),
        a("ignore_empty", "TRUE: skip empty cells."),
        a("text1", "The first text, cell or range."),
        a("text2", "More texts, cells or ranges.", MORE),
      ],
      example: '=TEXTJOIN(", ",TRUE,A2:A6)',
      exampleResult: "All sample names from A2:A6 in one line, separated by commas.",
    },
    de: {
      summary: "Verbindet Texte und Bereiche mit einem Trennzeichen dazwischen, auf Wunsch ohne leere Zellen.",
      args: [
        a("Trennzeichen", 'Was zwischen die Teile kommt, z. B. ", ".'),
        a("Leer_ignorieren", "WAHR: leere Zellen überspringen."),
        a("Text1", "Der erste Text, die erste Zelle oder der erste Bereich."),
        a("Text2", "Weitere Texte, Zellen oder Bereiche.", MORE),
      ],
      example: '=TEXTVERKETTEN(", ";WAHR;A2:A6)',
      exampleResult: "Alle Probennamen aus A2:A6 in einer Zeile, durch Kommas getrennt.",
    },
  },
  LEFT: {
    en: {
      summary: "The first characters of a text.",
      args: [a("text", "The text."), a("num_chars", "How many characters; left out: 1.", OPT)],
      example: '=LEFT("E. coli K12",7)',
      exampleResult: "“E. coli”",
    },
    de: {
      summary: "Die ersten Zeichen eines Texts.",
      args: [a("Text", "Der Text."), a("Anzahl_Zeichen", "Wie viele Zeichen; ohne Angabe 1.", OPT)],
      example: '=LINKS("E. coli K12";7)',
      exampleResult: "„E. coli“",
    },
  },
  RIGHT: {
    en: {
      summary: "The last characters of a text.",
      args: [a("text", "The text."), a("num_chars", "How many characters; left out: 1.", OPT)],
      example: '=RIGHT("E. coli K12",3)',
      exampleResult: "“K12”",
    },
    de: {
      summary: "Die letzten Zeichen eines Texts.",
      args: [a("Text", "Der Text."), a("Anzahl_Zeichen", "Wie viele Zeichen; ohne Angabe 1.", OPT)],
      example: '=RECHTS("E. coli K12";3)',
      exampleResult: "„K12“",
    },
  },
  MID: {
    en: {
      summary: "A piece from the middle of a text.",
      args: [a("text", "The text."), a("start_num", "The position of the first character you want: 1 is the first."), a("num_chars", "How many characters.")],
      example: '=MID("P-2026-017",3,4)',
      exampleResult: "“2026”",
    },
    de: {
      summary: "Ein Stück aus der Mitte eines Texts.",
      args: [a("Text", "Der Text."), a("Erstes_Zeichen", "Die Stelle des ersten gewünschten Zeichens: 1 ist das erste."), a("Anzahl_Zeichen", "Wie viele Zeichen.")],
      example: '=TEIL("P-2026-017";3;4)',
      exampleResult: "„2026“",
    },
  },
  LEN: {
    en: { summary: "How many characters a text has (spaces count).", args: TEXT_ARG.en, example: '=LEN("ATGCGTA")', exampleResult: "7 – the length of the sequence." },
    de: { summary: "Wie viele Zeichen ein Text hat (Leerzeichen zählen mit).", args: TEXT_ARG.de, example: '=LÄNGE("ATGCGTA")', exampleResult: "7 – die Länge der Sequenz." },
  },
  UPPER: {
    en: { summary: "The text in capital letters.", args: TEXT_ARG.en, example: '=UPPER("atgc")', exampleResult: "“ATGC”" },
    de: { summary: "Der Text in Großbuchstaben.", args: TEXT_ARG.de, example: '=GROSS("atgc")', exampleResult: "„ATGC“" },
  },
  LOWER: {
    en: { summary: "The text in small letters.", args: TEXT_ARG.en, example: '=LOWER("NaCl")', exampleResult: "“nacl”" },
    de: { summary: "Der Text in Kleinbuchstaben.", args: TEXT_ARG.de, example: '=KLEIN("NaCl")', exampleResult: "„nacl“" },
  },
  PROPER: {
    en: { summary: "The text with a capital letter at the start of each word.", args: TEXT_ARG.en, example: '=PROPER("anna müller")', exampleResult: "“Anna Müller”" },
    de: { summary: "Der Text mit großem Anfangsbuchstaben bei jedem Wort.", args: TEXT_ARG.de, example: '=GROSS2("anna müller")', exampleResult: "„Anna Müller“" },
  },
  TRIM: {
    en: {
      summary: "Removes spaces at the start and the end and turns several spaces in a row into one.",
      args: TEXT_ARG.en,
      example: '=TRIM("  Sample   A ")',
      exampleResult: "“Sample A”",
      tip: "Helps when pasted names don't match in a lookup because of hidden spaces.",
    },
    de: {
      summary: "Entfernt Leerzeichen am Anfang und Ende und macht aus mehreren Leerzeichen hintereinander eines.",
      args: TEXT_ARG.de,
      example: '=GLÄTTEN("  Probe   A ")',
      exampleResult: "„Probe A“",
      tip: "Hilft, wenn eingefügte Namen beim Nachschlagen wegen versteckter Leerzeichen nicht passen.",
    },
  },
  TEXT: {
    en: {
      summary: "Turns a number into text in a format you choose, e.g. for labels.",
      args: [a("value", "The number or date."), a("format_text", 'The format code in quotes, e.g. "0.00", "0.0%" or "MM/DD/YYYY".')],
      example: '=TEXT(0.0523,"0.000")',
      exampleResult: "“0.052” as text.",
      tip: 'The result is text, so you can\'t calculate with it any more. Format codes follow the language: German uses "0,000".',
    },
    de: {
      summary: "Macht aus einer Zahl Text in einem Format deiner Wahl, z. B. für Beschriftungen.",
      args: [a("Wert", "Die Zahl oder das Datum."), a("Textformat", 'Der Formatcode in Anführungszeichen, z. B. "0,00", "0,0 %" oder "TT.MM.JJJJ".')],
      example: '=TEXT(0,0523;"0,000")',
      exampleResult: "„0,052“ als Text.",
      tip: 'Das Ergebnis ist Text, damit rechnest du nicht mehr. Die Formatcodes folgen der Sprache: Englisch schreibt "0.000".',
    },
  },
  VALUE: {
    en: { summary: "Turns a text that looks like a number into a number.", args: [a("text", "The text, e.g. from pasted data.")], example: '=VALUE("0.523")', exampleResult: "0.523 as a number." },
    de: { summary: "Macht aus einem Text, der wie eine Zahl aussieht, eine Zahl.", args: [a("Text", "Der Text, z. B. aus eingefügten Daten.")], example: '=WERT("0,523")', exampleResult: "0,523 als Zahl." },
  },
  FIND: {
    en: {
      summary: "The position of a text inside another; minds upper and lower case. #VALUE! when it isn't there.",
      args: [a("find_text", "The text to find."), a("within_text", "The text to search in."), a("start_num", "Where to start; left out: 1.", OPT)],
      example: '=FIND("coli","E. coli K12")',
      exampleResult: "4",
    },
    de: {
      summary: "Die Position eines Texts in einem anderen; achtet auf Groß- und Kleinschreibung. #WERT!, wenn er nicht vorkommt.",
      args: [a("Suchtext", "Der Text, der gesucht wird."), a("Text", "Der Text, in dem gesucht wird."), a("Erstes_Zeichen", "Ab welcher Stelle; ohne Angabe 1.", OPT)],
      example: '=FINDEN("coli";"E. coli K12")',
      exampleResult: "4",
    },
  },
  SEARCH: {
    en: {
      summary: "Like FIND, but ignores upper and lower case and allows wildcards (* and ?).",
      args: [a("find_text", "The text to find."), a("within_text", "The text to search in."), a("start_num", "Where to start; left out: 1.", OPT)],
      example: '=SEARCH("COLI","E. coli K12")',
      exampleResult: "4",
    },
    de: {
      summary: "Wie FINDEN, aber ohne auf Groß- und Kleinschreibung zu achten, und mit Platzhaltern (* und ?).",
      args: [a("Suchtext", "Der Text, der gesucht wird."), a("Text", "Der Text, in dem gesucht wird."), a("Erstes_Zeichen", "Ab welcher Stelle; ohne Angabe 1.", OPT)],
      example: '=SUCHEN("COLI";"E. coli K12")',
      exampleResult: "4",
    },
  },
  SUBSTITUTE: {
    en: {
      summary: "Replaces one text with another wherever it occurs (or only its n-th occurrence).",
      args: [a("text", "The text to change."), a("old_text", "The text to replace."), a("new_text", "What to put instead."), a("instance_num", "Which occurrence to replace; left out: all.", OPT)],
      example: '=SUBSTITUTE("0.5 ml","ml","mL")',
      exampleResult: "“0.5 mL”",
    },
    de: {
      summary: "Ersetzt einen Text überall, wo er vorkommt, durch einen anderen (oder nur sein n-tes Vorkommen).",
      args: [a("Text", "Der Text, der geändert wird."), a("Alter_Text", "Der Text, der ersetzt wird."), a("Neuer_Text", "Was stattdessen hinkommt."), a("ntes_Auftreten", "Welches Vorkommen ersetzt wird; ohne Angabe alle.", OPT)],
      example: '=WECHSELN("0,5 ml";"ml";"mL")',
      exampleResult: "„0,5 mL“",
    },
  },
  REPLACE: {
    en: {
      summary: "Replaces a number of characters at a given position with a new text.",
      args: [a("old_text", "The text to change."), a("start_num", "Where the part to replace starts."), a("num_chars", "How many characters to replace."), a("new_text", "The new characters.")],
      example: '=REPLACE("P-2025-017",3,4,"2026")',
      exampleResult: "“P-2026-017”",
    },
    de: {
      summary: "Ersetzt eine Anzahl Zeichen an einer bestimmten Stelle durch einen neuen Text.",
      args: [a("Alter_Text", "Der Text, der geändert wird."), a("Erstes_Zeichen", "Wo der ersetzte Teil beginnt."), a("Anzahl_Zeichen", "Wie viele Zeichen ersetzt werden."), a("Neuer_Text", "Die neuen Zeichen.")],
      example: '=ERSETZEN("P-2025-017";3;4;"2026")',
      exampleResult: "„P-2026-017“",
    },
  },
  REPT: {
    en: {
      summary: "Repeats a text a number of times.",
      args: [a("text", "The text to repeat."), a("number_times", "How often.")],
      example: '=REPT("|",5)',
      exampleResult: "“|||||” – a tiny bar chart inside a cell.",
    },
    de: {
      summary: "Wiederholt einen Text mehrmals.",
      args: [a("Text", "Der Text, der wiederholt wird."), a("Multiplikator", "Wie oft.")],
      example: '=WIEDERHOLEN("|";5)',
      exampleResult: "„|||||“ – ein winziges Balkendiagramm in einer Zelle.",
    },
  },
  EXACT: {
    en: {
      summary: "TRUE when two texts are exactly the same, upper and lower case included.",
      args: [a("text1", "The first text."), a("text2", "The second text.")],
      example: '=EXACT("NaCl","NACL")',
      exampleResult: "FALSE",
    },
    de: {
      summary: "WAHR, wenn zwei Texte genau gleich sind, auch in Groß- und Kleinschreibung.",
      args: [a("Text1", "Der erste Text."), a("Text2", "Der zweite Text.")],
      example: '=IDENTISCH("NaCl";"NACL")',
      exampleResult: "FALSCH",
    },
  },
  FIXED: {
    en: {
      summary: "Rounds a number and turns it into text with thousands separators.",
      args: [a("number", "The number."), a("decimals", "Decimal places; left out: 2.", OPT), a("no_commas", "TRUE: without thousands separators.", OPT)],
      example: "=FIXED(1234.567,1)",
      exampleResult: "“1,234.6” as text.",
    },
    de: {
      summary: "Rundet eine Zahl und macht daraus Text mit Tausenderpunkten.",
      args: [a("Zahl", "Die Zahl."), a("Dezimalstellen", "Nachkommastellen; ohne Angabe 2.", OPT), a("Keine_Punkte", "WAHR: ohne Tausenderpunkte.", OPT)],
      example: "=FEST(1234,567;1)",
      exampleResult: "„1.234,6“ als Text.",
    },
  },
  CHAR: {
    en: { summary: "The character with a given code number (1–255).", args: [a("number", "The code number.")], example: "=CHAR(65)", exampleResult: "“A”" },
    de: { summary: "Das Zeichen mit einer bestimmten Codenummer (1–255).", args: [a("Zahl", "Die Codenummer.")], example: "=ZEICHEN(65)", exampleResult: "„A“" },
  },
  CODE: {
    en: { summary: "The code number of the first character of a text.", args: TEXT_ARG.en, example: '=CODE("A")', exampleResult: "65" },
    de: { summary: "Die Codenummer des ersten Zeichens eines Texts.", args: TEXT_ARG.de, example: '=CODE("A")', exampleResult: "65" },
  },
};

// ----------------------------------------------------------------------------------------------
// Datum und Uhrzeit

const DATE: Record<string, Pair> = {
  TODAY: {
    en: {
      summary: "Today's date; it updates whenever the sheet recalculates.",
      args: [],
      example: "=TODAY()",
      exampleResult: "Today's date, e.g. 11/3/2026.",
      tip: "Ctrl+; types today's date as a fixed value that doesn't change.",
    },
    de: {
      summary: "Das heutige Datum; es aktualisiert sich, wenn das Blatt neu rechnet.",
      args: [],
      example: "=HEUTE()",
      exampleResult: "Das heutige Datum, z. B. 03.11.2026.",
      tip: "Strg+; trägt das heutige Datum als festen Wert ein, der sich nicht mehr ändert.",
    },
  },
  NOW: {
    en: {
      summary: "The current date and time; it updates whenever the sheet recalculates.",
      args: [],
      example: "=NOW()",
      exampleResult: "E.g. 11/3/2026 14:30.",
      tip: "Ctrl+Shift+: types the current time as a fixed value – handy for logging when you took a sample.",
    },
    de: {
      summary: "Das aktuelle Datum mit Uhrzeit; es aktualisiert sich, wenn das Blatt neu rechnet.",
      args: [],
      example: "=JETZT()",
      exampleResult: "Z. B. 03.11.2026 14:30.",
      tip: "Strg+Umschalt+: trägt die aktuelle Uhrzeit als festen Wert ein – praktisch, um festzuhalten, wann du eine Probe genommen hast.",
    },
  },
  DATE: {
    en: {
      summary: "A date from year, month and day.",
      args: [a("year", "The year, e.g. 2026."), a("month", "The month, 1 to 12 (13 carries on into the next year)."), a("day", "The day of the month.")],
      example: "=DATE(2026,11,3)",
      exampleResult: "11/3/2026 (as a date number).",
    },
    de: {
      summary: "Ein Datum aus Jahr, Monat und Tag.",
      args: [a("Jahr", "Das Jahr, z. B. 2026."), a("Monat", "Der Monat, 1 bis 12 (13 geht ins nächste Jahr weiter)."), a("Tag", "Der Tag im Monat.")],
      example: "=DATUM(2026;11;3)",
      exampleResult: "03.11.2026 (als Datumszahl).",
    },
  },
  TIME: {
    en: {
      summary: "A time from hours, minutes and seconds, as a fraction of a day.",
      args: [a("hour", "The hours."), a("minute", "The minutes."), a("second", "The seconds.")],
      example: "=TIME(1,30,0)",
      exampleResult: "1:30, the number 0.0625 – e.g. an incubation time.",
    },
    de: {
      summary: "Eine Uhrzeit aus Stunden, Minuten und Sekunden, als Bruchteil eines Tages.",
      args: [a("Stunde", "Die Stunden."), a("Minute", "Die Minuten."), a("Sekunde", "Die Sekunden.")],
      example: "=ZEIT(1;30;0)",
      exampleResult: "1:30, die Zahl 0,0625 – z. B. eine Inkubationszeit.",
    },
  },
  YEAR: {
    en: { summary: "The year of a date.", args: SERIAL.en, example: "=YEAR(DATE(2026,11,3))", exampleResult: "2026" },
    de: { summary: "Das Jahr eines Datums.", args: SERIAL.de, example: "=JAHR(DATUM(2026;11;3))", exampleResult: "2026" },
  },
  MONTH: {
    en: { summary: "The month of a date, 1 to 12.", args: SERIAL.en, example: "=MONTH(DATE(2026,11,3))", exampleResult: "11" },
    de: { summary: "Der Monat eines Datums, 1 bis 12.", args: SERIAL.de, example: "=MONAT(DATUM(2026;11;3))", exampleResult: "11" },
  },
  DAY: {
    en: { summary: "The day of the month of a date, 1 to 31.", args: SERIAL.en, example: "=DAY(DATE(2026,11,3))", exampleResult: "3" },
    de: { summary: "Der Tag im Monat eines Datums, 1 bis 31.", args: SERIAL.de, example: "=TAG(DATUM(2026;11;3))", exampleResult: "3" },
  },
  HOUR: {
    en: { summary: "The hour of a time, 0 to 23.", args: SERIAL.en, example: "=HOUR(TIME(14,30,0))", exampleResult: "14" },
    de: { summary: "Die Stunde einer Uhrzeit, 0 bis 23.", args: SERIAL.de, example: "=STUNDE(ZEIT(14;30;0))", exampleResult: "14" },
  },
  MINUTE: {
    en: { summary: "The minute of a time, 0 to 59.", args: SERIAL.en, example: "=MINUTE(TIME(14,30,0))", exampleResult: "30" },
    de: { summary: "Die Minute einer Uhrzeit, 0 bis 59.", args: SERIAL.de, example: "=MINUTE(ZEIT(14;30;0))", exampleResult: "30" },
  },
  SECOND: {
    en: { summary: "The second of a time, 0 to 59.", args: SERIAL.en, example: "=SECOND(TIME(14,30,15))", exampleResult: "15" },
    de: { summary: "Die Sekunde einer Uhrzeit, 0 bis 59.", args: SERIAL.de, example: "=SEKUNDE(ZEIT(14;30;15))", exampleResult: "15" },
  },
  WEEKDAY: {
    en: {
      summary: "The day of the week of a date, as a number.",
      args: [SERIAL.en[0], a("return_type", "1 or left out: Sunday = 1 … Saturday = 7; 2: Monday = 1 … Sunday = 7.", OPT)],
      example: "=WEEKDAY(DATE(2026,11,3),2)",
      exampleResult: "2 – a Tuesday.",
    },
    de: {
      summary: "Der Wochentag eines Datums, als Zahl.",
      args: [SERIAL.de[0], a("Typ", "1 oder leer: Sonntag = 1 … Samstag = 7; 2: Montag = 1 … Sonntag = 7.", OPT)],
      example: "=WOCHENTAG(DATUM(2026;11;3);2)",
      exampleResult: "2 – ein Dienstag.",
    },
  },
  WEEKNUM: {
    en: {
      summary: "The week number of a date. For the calendar weeks used in Germany, use type 21 or ISOWEEKNUM.",
      args: [a("serial_number", "A date."), a("return_type", "1 or left out: weeks start on Sunday, week 1 holds January 1; 2: weeks start on Monday; 21: ISO weeks as in Germany.", OPT)],
      example: "=WEEKNUM(DATE(2026,11,3),21)",
      exampleResult: "45",
    },
    de: {
      summary: "Die Wochennummer eines Datums. Für die Kalenderwochen in Deutschland nimm Typ 21 oder ISOKALENDERWOCHE.",
      args: [a("Fortlaufende_Zahl", "Ein Datum."), a("Zahl_Typ", "1 oder leer: Wochen beginnen sonntags, Woche 1 enthält den 1. Januar; 2: Wochen beginnen montags; 21: ISO-Wochen wie in Deutschland.", OPT)],
      example: "=KALENDERWOCHE(DATUM(2026;11;3);21)",
      exampleResult: "45",
    },
  },
  ISOWEEKNUM: {
    en: {
      summary: "The ISO calendar week: weeks start on Monday, and week 1 holds the year's first Thursday – the week numbers used in Germany.",
      args: [a("date", "A date.")],
      example: "=ISOWEEKNUM(DATE(2026,11,3))",
      exampleResult: "45",
    },
    de: {
      summary: "Die ISO-Kalenderwoche: Wochen beginnen montags, Woche 1 enthält den ersten Donnerstag des Jahres – die Kalenderwochen in Deutschland.",
      args: [a("Datum", "Ein Datum.")],
      example: "=ISOKALENDERWOCHE(DATUM(2026;11;3))",
      exampleResult: "45",
    },
  },
  DATEDIF: {
    en: {
      summary: "The time between two dates in whole years, months or days.",
      args: [
        a("start_date", "The earlier date."),
        a("end_date", "The later date; it must not be before the start."),
        a("unit", '"Y" years, "M" months, "D" days; "MD", "YM" and "YD" give the rest after whole months or years.'),
      ],
      example: '=DATEDIF(DATE(2026,9,1),DATE(2026,11,3),"D")',
      exampleResult: "63 (days)",
      tip: "Excel doesn't list DATEDIF in its function wizard, but it works the same way.",
    },
    de: {
      summary: "Die Zeit zwischen zwei Daten in ganzen Jahren, Monaten oder Tagen.",
      args: [
        a("Ausgangsdatum", "Das frühere Datum."),
        a("Enddatum", "Das spätere Datum; es darf nicht vor dem Ausgangsdatum liegen."),
        a("Einheit", '"Y" Jahre, "M" Monate, "D" Tage; "MD", "YM" und "YD" geben den Rest nach ganzen Monaten oder Jahren.'),
      ],
      example: '=DATEDIF(DATUM(2026;9;1);DATUM(2026;11;3);"D")',
      exampleResult: "63 (Tage)",
      tip: "Excel zeigt DATEDIF nicht im Funktionsassistenten, es funktioniert aber genauso.",
    },
  },
  DAYS: {
    en: {
      summary: "The number of days between two dates. Mind the order: the end date comes first.",
      args: [a("end_date", "The later date."), a("start_date", "The earlier date.")],
      example: "=DAYS(DATE(2026,11,3),DATE(2026,9,1))",
      exampleResult: "63",
    },
    de: {
      summary: "Die Zahl der Tage zwischen zwei Daten. Achte auf die Reihenfolge: das Enddatum kommt zuerst.",
      args: [a("Zieldatum", "Das spätere Datum."), a("Ausgangsdatum", "Das frühere Datum.")],
      example: "=TAGE(DATUM(2026;11;3);DATUM(2026;9;1))",
      exampleResult: "63",
    },
  },
  EDATE: {
    en: {
      summary: "The date a number of months before or after a date.",
      args: [a("start_date", "The starting date."), a("months", "Months to add; negative for earlier.")],
      example: "=EDATE(DATE(2026,11,3),6)",
      exampleResult: "5/3/2027 – e.g. when a reagent opened today expires after 6 months.",
    },
    de: {
      summary: "Das Datum eine Anzahl Monate vor oder nach einem Datum.",
      args: [a("Ausgangsdatum", "Das Ausgangsdatum."), a("Monate", "Wie viele Monate dazukommen; negativ für früher.")],
      example: "=EDATUM(DATUM(2026;11;3);6)",
      exampleResult: "03.05.2027 – z. B. wann ein heute geöffnetes Reagenz nach 6 Monaten abläuft.",
    },
  },
  EOMONTH: {
    en: {
      summary: "The last day of the month a number of months away.",
      args: [a("start_date", "The starting date."), a("months", "0: this month; 1: next month; −1: last month.")],
      example: "=EOMONTH(DATE(2026,11,3),0)",
      exampleResult: "11/30/2026 – the end of this month.",
    },
    de: {
      summary: "Der letzte Tag des Monats, eine Anzahl Monate entfernt.",
      args: [a("Ausgangsdatum", "Das Ausgangsdatum."), a("Monate", "0: dieser Monat; 1: nächster Monat; −1: letzter Monat.")],
      example: "=MONATSENDE(DATUM(2026;11;3);0)",
      exampleResult: "30.11.2026 – das Ende dieses Monats.",
    },
  },
  NETWORKDAYS: {
    en: {
      summary: "The number of working days (Monday to Friday) between two dates, both included.",
      args: [a("start_date", "The first day."), a("end_date", "The last day."), a("holidays", "A range of dates to skip as well, e.g. public holidays.", OPT)],
      example: "=NETWORKDAYS(DATE(2026,11,2),DATE(2026,11,13))",
      exampleResult: "10 – two full working weeks.",
    },
    de: {
      summary: "Die Zahl der Arbeitstage (Montag bis Freitag) zwischen zwei Daten, beide eingeschlossen.",
      args: [a("Ausgangsdatum", "Der erste Tag."), a("Enddatum", "Der letzte Tag."), a("Freie_Tage", "Ein Bereich mit Daten, die zusätzlich nicht zählen, z. B. Feiertage.", OPT)],
      example: "=NETTOARBEITSTAGE(DATUM(2026;11;2);DATUM(2026;11;13))",
      exampleResult: "10 – zwei volle Arbeitswochen.",
    },
  },
};

// ----------------------------------------------------------------------------------------------
// Information

const INFO: Record<string, Pair> = {
  ISBLANK: {
    en: {
      summary: "TRUE when a cell is empty.",
      args: CHECK.en,
      example: "=ISBLANK(C2)",
      exampleResult: "TRUE as long as nothing is entered in C2.",
      tip: 'A formula that shows "" isn\'t empty for ISBLANK; compare with ="" instead.',
    },
    de: {
      summary: "WAHR, wenn eine Zelle leer ist.",
      args: CHECK.de,
      example: "=ISTLEER(C2)",
      exampleResult: "WAHR, solange in C2 nichts eingetragen ist.",
      tip: 'Eine Formel, die "" zeigt, ist für ISTLEER nicht leer; vergleich dann lieber mit ="".',
    },
  },
  ISNUMBER: {
    en: { summary: "TRUE when the value is a number (dates count too).", args: CHECK.en, example: "=ISNUMBER(B2)", exampleResult: "TRUE when B2 holds a number, FALSE for a text such as “n.d.”." },
    de: { summary: "WAHR, wenn der Wert eine Zahl ist (auch ein Datum).", args: CHECK.de, example: "=ISTZAHL(B2)", exampleResult: "WAHR, wenn in B2 eine Zahl steht, FALSCH bei Text wie „n. b.“." },
  },
  ISTEXT: {
    en: { summary: "TRUE when the value is a text.", args: CHECK.en, example: "=ISTEXT(A2)", exampleResult: "TRUE when A2 holds a text, e.g. a sample name." },
    de: { summary: "WAHR, wenn der Wert ein Text ist.", args: CHECK.de, example: "=ISTTEXT(A2)", exampleResult: "WAHR, wenn in A2 ein Text steht, z. B. ein Probenname." },
  },
  ISERROR: {
    en: { summary: "TRUE for any error value (#DIV/0!, #N/A, #VALUE!…).", args: CHECK.en, example: "=ISERROR(C2/B2)", exampleResult: "TRUE when B2 is empty or 0." },
    de: { summary: "WAHR bei jedem Fehlerwert (#DIV/0!, #NV, #WERT! …).", args: CHECK.de, example: "=ISTFEHLER(C2/B2)", exampleResult: "WAHR, wenn B2 leer oder 0 ist." },
  },
  ISNA: {
    en: { summary: "TRUE only for the error #N/A.", args: CHECK.en, example: '=ISNA(MATCH("Tris",A2:A20,0))', exampleResult: "TRUE when Tris isn't in the list." },
    de: { summary: "WAHR nur beim Fehler #NV.", args: CHECK.de, example: '=ISTNV(VERGLEICH("Tris";A2:A20;0))', exampleResult: "WAHR, wenn Tris nicht in der Liste steht." },
  },
  ISLOGICAL: {
    en: { summary: "TRUE when the value is TRUE or FALSE.", args: CHECK.en, example: "=ISLOGICAL(B2>1)", exampleResult: "TRUE – a comparison gives a logical value." },
    de: { summary: "WAHR, wenn der Wert WAHR oder FALSCH ist.", args: CHECK.de, example: "=ISTLOG(B2>1)", exampleResult: "WAHR – ein Vergleich ergibt einen Wahrheitswert." },
  },
  ISEVEN: {
    en: { summary: "TRUE for an even number (decimals are cut off first).", args: ONE_NUMBER.en, example: "=ISEVEN(ROW())", exampleResult: "TRUE in even rows – handy for patterns." },
    de: { summary: "WAHR bei einer geraden Zahl (Nachkommastellen werden vorher abgeschnitten).", args: ONE_NUMBER.de, example: "=ISTGERADE(ZEILE())", exampleResult: "WAHR in geraden Zeilen – praktisch für Muster." },
  },
  ISODD: {
    en: { summary: "TRUE for an odd number (decimals are cut off first).", args: ONE_NUMBER.en, example: "=ISODD(7)", exampleResult: "TRUE" },
    de: { summary: "WAHR bei einer ungeraden Zahl (Nachkommastellen werden vorher abgeschnitten).", args: ONE_NUMBER.de, example: "=ISTUNGERADE(7)", exampleResult: "WAHR" },
  },
  ISFORMULA: {
    en: { summary: "TRUE when the cell contains a formula.", args: [a("reference", "The cell to check.")], example: "=ISFORMULA(D5)", exampleResult: "TRUE when D5 is calculated, FALSE when it was typed in." },
    de: { summary: "WAHR, wenn die Zelle eine Formel enthält.", args: [a("Bezug", "Die Zelle, die geprüft wird.")], example: "=ISTFORMEL(D5)", exampleResult: "WAHR, wenn D5 berechnet wird, FALSCH, wenn der Wert eingetippt ist." },
  },
  NA: {
    en: {
      summary: "The error value #N/A: “no value available”. Charts skip it, so it leaves a gap instead of a 0.",
      args: [],
      example: "=NA()",
      exampleResult: "#N/A",
      tip: 'E.g. =IF(B2="",NA(),B2), so a measurement that is still missing doesn\'t show up as 0 on a chart.',
    },
    de: {
      summary: "Der Fehlerwert #NV: „nicht vorhanden“. Diagramme überspringen ihn, er hinterlässt also eine Lücke statt einer 0.",
      args: [],
      example: "=NV()",
      exampleResult: "#NV",
      tip: 'Z. B. =WENN(B2="";NV();B2), damit ein noch fehlender Messwert im Diagramm nicht als 0 erscheint.',
    },
  },
};

// ----------------------------------------------------------------------------------------------
// Naturwissenschaft (Einheiten umrechnen)

const SCIENCE: Record<string, Pair> = {
  CONVERT: {
    en: {
      summary: "Converts a value from one unit to another, e.g. µL to mL, mg to g or °C to K.",
      args: [
        a("number", "The value to convert."),
        a("from_unit", 'Its unit in quotes, e.g. "ul" (µL), "ml", "l", "ug", "mg", "g", "C" or "K".'),
        a("to_unit", "The unit you want, of the same kind."),
      ],
      example: '=CONVERT(250,"ul","ml")',
      exampleResult: "0.25 – 250 µL are 0.25 mL.",
      tip: 'Prefixes as in Excel: "u" micro, "m" milli, "n" nano, "k" kilo – so "ug", "ml", "nm", "kg". Upper and lower case matter. Amounts of substance (mol) can\'t be converted into masses – for that you need the molar mass: m = n · M.',
    },
    de: {
      summary: "Rechnet einen Wert in eine andere Einheit um, z. B. µL in mL, mg in g oder °C in K.",
      args: [
        a("Zahl", "Der Wert, der umgerechnet wird."),
        a("Von_Maßeinheit", 'Seine Einheit in Anführungszeichen, z. B. "ul" (µL), "ml", "l", "ug", "mg", "g", "C" oder "K".'),
        a("In_Maßeinheit", "Die gewünschte Einheit derselben Art."),
      ],
      example: '=UMWANDELN(250;"ul";"ml")',
      exampleResult: "0,25 – 250 µL sind 0,25 mL.",
      tip: 'Vorsätze wie in Excel: "u" Mikro, "m" Milli, "n" Nano, "k" Kilo – also "ug", "ml", "nm", "kg". Groß- und Kleinschreibung zählt. Stoffmengen (mol) lassen sich nicht in Massen umrechnen – dafür brauchst du die molare Masse: m = n · M.',
    },
  },
};

export const FUNCTION_DOCS: Record<string, { en: FnDoc; de: FnDoc }> = { ...MATH, ...STATS, ...OLDER, ...REGRESSION, ...LOGIC, ...LOOKUP, ...TEXT, ...DATE, ...INFO, ...SCIENCE };
