import { addDays } from "date-fns";
import { fromYmd, ymd } from "./time";

// The timetable of class BTA926A at bta.bojes.org (BOJE), for importing into Blob's calendar.
//
// The site is a TanStack Start app: its timetable comes from a server function (answered in
// seroval's JSON format), everything else it knows about the school year (quarters, holidays,
// subject names, exams) is written into its JavaScript. The server reads both (api/timetable/bta)
// and hands the browser one plain `Timetable`; when the site's script can't be read, Blob's own
// copy of the school year below fills in. Everything here is plain data and works on either side.

export const BTA_ORIGIN = "https://bta.bojes.org";
export const BTA_CLASS = "BTA926A";
/** The timetable's server function (TanStack Start ids are hashes of the function's place in the code). */
export const BTA_PLAN_FN = "f4d599e9f9b1394b0945a0cc871625c04d33c6642cac15652d22b6a7786affe4";

export type Rhythm = { kind: "weekly" } | { kind: "fortnightly"; weeks: "even" | "odd" } | { kind: "quarter"; nr: number; from: string; to: string };

export type TimetableLesson = {
  /** The site's own id ("0-0-2"): day, block and column. */
  id: string;
  /** 0 Monday … 4 Friday. */
  day: number;
  /** Minutes after midnight. */
  start: number;
  end: number;
  /** "B5T" (the site writes some with a trailing dot). */
  code: string;
  /** "Mikroorganismen untersuchen" (the code when the site has no name for it). */
  name: string;
  /** "Theorie" or "Praxis" for learning fields. */
  part: string | null;
  /** "LF 5" */
  field: string | null;
  teachers: string[];
  room: string;
  /** What the site's hint says besides the rhythm. */
  note: string | null;
  /** A correction the class wrote down ("Laut Schule jetzt 15:15-16:45"). */
  correction: string | null;
  rhythm: Rhythm;
  /** The site's colour for the subject (hue, 0..359). */
  hue: number;
};

/** A stretch without school, both days included (yyyy-mm-dd). */
export type SchoolBreak = { name: string; from: string; to: string };

export type Quarter = { nr: number; from: string; to: string };

export type TimetableExam = { code: string; name: string; date: string; title: string };

export type Timetable = {
  source: "bta";
  className: string;
  /** When the school last changed the timetable, as the site says it ("2.10.2026 10:44"). */
  updated: string | null;
  /** The time blocks ("8:00"–"9:30"). */
  blocks: { from: string; to: string }[];
  lessons: TimetableLesson[];
  quarters: Quarter[];
  breaks: SchoolBreak[];
  /** Single days without school (public holidays, bridge days) in the school year: yyyy-mm-dd → name. */
  daysOff: Record<string, string>;
  exams: TimetableExam[];
  /** First and last day of the school year. */
  year: { from: string; to: string };
  /** Whether the school year's details came from the site (else from Blob's copy). */
  live: boolean;
};

// The school year as the site had it on 26 October 2026 ------------------------------------------

type Subject = { name: string; part?: string; field?: number; exams?: { date: string; title: string }[] };

export type SchoolProfile = {
  quarters: Quarter[];
  breaks: SchoolBreak[];
  bridgeDays: Record<string, string>;
  fields: Record<number, string>;
  subjects: Record<string, Subject>;
  hues: Record<string, number>;
};

export const PROFILE_SNAPSHOT: SchoolProfile = {
  quarters: [
    { nr: 1, from: "2026-08-01", to: "2026-12-18" },
    { nr: 2, from: "2026-12-19", to: "2027-01-31" },
    { nr: 3, from: "2027-02-01", to: "2027-04-16" },
    { nr: 4, from: "2027-04-17", to: "2027-07-31" },
  ],
  breaks: [
    { name: "Sommerferien", from: "2026-07-01", to: "2026-08-04" },
    { name: "Herbstferien", from: "2026-10-12", to: "2026-10-23" },
    { name: "Weihnachtsferien", from: "2026-12-21", to: "2027-01-08" },
    { name: "Osterferien", from: "2027-03-15", to: "2027-04-02" },
    { name: "Sommerferien", from: "2027-07-05", to: "2027-08-06" },
    { name: "Herbstferien", from: "2027-10-18", to: "2027-10-29" },
    { name: "Weihnachtsferien", from: "2027-12-23", to: "2028-01-11" },
    { name: "Osterferien", from: "2028-04-03", to: "2028-04-21" },
    { name: "Sommerferien", from: "2028-07-03", to: "2028-08-04" },
    { name: "Herbstferien", from: "2028-10-23", to: "2028-11-03" },
    { name: "Weihnachtsferien", from: "2028-12-21", to: "2029-01-09" },
    { name: "Osterferien", from: "2029-03-19", to: "2029-04-06" },
    { name: "Sommerferien", from: "2029-07-09", to: "2029-08-10" },
  ],
  bridgeDays: Object.fromEntries(
    ["2026-05-15", "2027-05-07", "2028-05-26", "2029-05-11", "2026-05-26", "2027-05-18", "2028-06-06", "2029-05-22", "2029-04-30", "2028-10-02", "2029-10-04", "2029-10-05"].map((d) => [d, "Brückentag"]),
  ),
  fields: {
    1: "Lösungen herstellen",
    3: "Stoffsysteme qualitativ / quantitativ analysieren",
    4: "Pflanzen untersuchen",
    5: "Mikroorganismen untersuchen",
    6: "Ökosysteme untersuchen",
  },
  subjects: {
    B1T: {
      name: "",
      field: 1,
      part: "Theorie",
      exams: [
        { date: "2026-10-28", title: "Klausur Nr. 1 (Grundlagen)" },
        { date: "2026-11-26", title: "Klausur Nr. 2" },
        { date: "2027-02-11", title: "Klausur Nr. 3" },
      ],
    },
    BC1P: { name: "", field: 1, part: "Praxis" },
    B3T: {
      name: "",
      field: 3,
      part: "Theorie",
      exams: [
        { date: "2026-11-03", title: "Klausur Nr. 1" },
        { date: "2027-01-19", title: "Klausur Nr. 2" },
      ],
    },
    B3P: { name: "", field: 3, part: "Praxis" },
    B4T: { name: "", field: 4, part: "Theorie" },
    B4P: { name: "", field: 4, part: "Praxis" },
    B5T: {
      name: "",
      field: 5,
      part: "Theorie",
      exams: [
        { date: "2026-11-04", title: "Klausur Nr. 1" },
        { date: "2027-02-03", title: "Klausur Nr. 2" },
      ],
    },
    B6T: {
      name: "",
      field: 6,
      part: "Theorie",
      exams: [
        { date: "2026-10-05", title: "Klausur Nr. 1" },
        { date: "2027-01-25", title: "Klausur Nr. 2" },
      ],
    },
    DEUT: { name: "Deutsch" },
    ENGL: { name: "Englisch" },
    EDV: { name: "EDV", exams: [{ date: "2026-11-11", title: "Klausur Nr. 1" }] },
    MFH: { name: "Mathematik (FH)", exams: [{ date: "2026-11-04", title: "Klausur Nr. 1" }] },
  },
  hues: { "LF 1": 60, "LF 3": 305, "LF 4": 145, "LF 5": 345, "LF 6": 185, DEUT: 25, ENGL: 225, EDV: 265, MFH: 100 },
};

// Reading the site --------------------------------------------------------------------------------

type SerovalNode = { t: number; i?: number; s?: unknown; a?: (SerovalNode | null)[]; p?: { k: string[]; v: SerovalNode[] } | null; f?: SerovalNode };

/** seroval keeps a few characters escaped inside strings (so the text could sit in a script tag). */
function unescapeString(s: string): string {
  return s.replace(/\\(\\|"|n|r|b|t|f|u2028|u2029|x3C)/g, (_, c: string) =>
    c === "n" ? "\n" : c === "r" ? "\r" : c === "b" ? "\b" : c === "t" ? "\t" : c === "f" ? "\f" : c === "u2028" ? "\u2028" : c === "u2029" ? "\u2029" : c === "x3C" ? "<" : c,
  );
}

const CONSTANTS: Record<number, unknown> = { 0: null, 1: undefined, 2: true, 3: false, 4: -0, 5: Infinity, 6: -Infinity, 7: NaN };

/** Turns a server function's answer (seroval's JSON nodes) back into plain values. Throws on anything unusual. */
export function decodeSeroval(root: unknown): unknown {
  const refs = new Map<number, unknown>();
  let budget = 50_000;
  const walk = (n: SerovalNode | null | undefined, depth: number): unknown => {
    if (n == null) return undefined;
    if (--budget < 0 || depth > 40) throw new Error("seroval: too big");
    switch (n.t) {
      case 0:
        return typeof n.s === "number" ? n.s : Number(n.s);
      case 1:
        return unescapeString(String(n.s ?? ""));
      case 2:
        return CONSTANTS[Number(n.s)];
      case 4:
        // A value seen before (shared or circular).
        return refs.get(Number(n.i));
      case 5: {
        const d = new Date(String(n.s));
        if (n.i != null) refs.set(n.i, d);
        return d;
      }
      case 9: {
        const out: unknown[] = [];
        if (n.i != null) refs.set(n.i, out);
        for (const x of n.a ?? []) out.push(walk(x, depth + 1));
        return out;
      }
      case 10:
      case 11: {
        const out: Record<string, unknown> = n.t === 11 ? Object.create(null) : {};
        if (n.i != null) refs.set(n.i, out);
        const keys = n.p?.k ?? [];
        const values = n.p?.v ?? [];
        keys.forEach((k, idx) => {
          out[unescapeString(k)] = walk(values[idx], depth + 1);
        });
        return out;
      }
      default:
        throw new Error(`seroval: node type ${n.t}`);
    }
  };
  return walk(root as SerovalNode, 0);
}

/** The JavaScript array, object or call arguments starting at `open` (its bracket), with strings skipped properly. */
function balanced(js: string, open: number): string | null {
  const opening = js[open];
  const close = ({ "[": "]", "{": "}", "(": ")" } as Record<string, string>)[opening];
  if (!close) return null;
  let depth = 0;
  for (let i = open; i < js.length && i < open + 200_000; i++) {
    const c = js[i];
    if (c === "`" || c === '"' || c === "'") {
      const q = c;
      for (i++; i < js.length && js[i] !== q; i++) if (js[i] === "\\") i++;
      continue;
    }
    if (c === opening) depth++;
    else if (c === close && --depth === 0) return js.slice(open, i + 1);
  }
  return null;
}

const STR = "`([^`]*)`";
const DATE = "`(\\d{4}-\\d{2}-\\d{2})`";

function examsIn(text: string): { date: string; title: string }[] {
  const out: { date: string; title: string }[] = [];
  for (const m of text.matchAll(new RegExp(`\\{datum:${DATE},titel:${STR}\\}`, "g"))) out.push({ date: m[1], title: m[2].slice(0, 120) });
  return out;
}

/**
 * The school year as the site's script has it: quarters, holidays, bridge days, subject names and
 * exams, found by their shape (the script's own names change with every release). Returns only
 * what it could read; the rest comes from the snapshot.
 */
export function readProfile(js: string): Partial<SchoolProfile> {
  const out: Partial<SchoolProfile> = {};

  const quarters = js.match(new RegExp(`\\[\\{nr:1,von:${DATE},bis:${DATE}\\}(?:,\\{nr:\\d,von:${DATE},bis:${DATE}\\})*\\]`));
  if (quarters) {
    out.quarters = [...quarters[0].matchAll(new RegExp(`\\{nr:(\\d),von:${DATE},bis:${DATE}\\}`, "g"))].map((m) => ({ nr: Number(m[1]), from: m[2], to: m[3] }));
  }

  const breaks = js.match(new RegExp(`\\[\\{name:${STR},von:${DATE},bis:${DATE}\\}(?:,\\{name:${STR},von:${DATE},bis:${DATE}\\})*\\]`));
  if (breaks) {
    out.breaks = [...breaks[0].matchAll(new RegExp(`\\{name:${STR},von:${DATE},bis:${DATE}\\}`, "g"))].map((m) => ({ name: m[1].slice(0, 60), from: m[2], to: m[3] }));
  }

  const bridges = js.match(/\{"\d{4}-\d{2}-\d{2}":`[^`]*`(?:,"\d{4}-\d{2}-\d{2}":`[^`]*`)*\}/);
  if (bridges) out.bridgeDays = Object.fromEntries([...bridges[0].matchAll(/"(\d{4}-\d{2}-\d{2})":`([^`]*)`/g)].map((m) => [m[1], m[2].slice(0, 60)]));

  const fields: Record<number, string> = {};
  for (const m of js.matchAll(new RegExp(`(\\d+):\\{titel:${STR},bereich:${STR},theorie:\\d+,praxis:\\d+\\}`, "g"))) fields[Number(m[1])] = m[2].slice(0, 80);
  if (Object.keys(fields).length) out.fields = fields;

  const subjects: Record<string, Subject> = {};
  // Learning fields: B1T:ye(1,`Theorie`,`…`,[{datum:…,titel:…}])
  for (const m of js.matchAll(new RegExp(`([A-Z][A-Z0-9]{1,9}):[A-Za-z_$][\\w$]{0,3}\\((\\d+),\`(Theorie|Praxis)\`,${STR}`, "g"))) {
    const call = balanced(js, m.index! + m[0].indexOf("("));
    subjects[m[1]] = { name: "", field: Number(m[2]), part: m[3], exams: call ? examsIn(call) : [] };
  }
  // Other subjects: DEUT:{name:`Deutsch`,…,pruefungen:[…]}
  for (const m of js.matchAll(new RegExp(`([A-Z][A-Z0-9]{1,9}):\\{name:${STR}`, "g"))) {
    if (subjects[m[1]]) continue;
    const body = balanced(js, m.index! + m[1].length + 1);
    if (!body || !/beschreibung:/.test(body)) continue;
    subjects[m[1]] = { name: m[2].slice(0, 80), exams: examsIn(body) };
  }
  if (Object.keys(subjects).length) out.subjects = subjects;

  const hues = js.match(/\{"LF \d+":\d+(?:,(?:"[^"]{1,12}"|[A-Z][A-Z0-9]{0,9}):\d+)*\}/);
  if (hues) out.hues = Object.fromEntries([...hues[0].matchAll(/(?:"([^"]{1,12})"|([A-Z][A-Z0-9]{0,9})):(\d+)/g)].map((m) => [m[1] ?? m[2], Number(m[3]) % 360]));

  return out;
}

/** The profile, with what the site's script said taking the place of the snapshot's parts. */
export function mergeProfile(read: Partial<SchoolProfile>): { profile: SchoolProfile; live: boolean } {
  const ok = <T,>(v: T[] | undefined, min: number) => (v && v.length >= min ? v : undefined);
  const quarters = ok(read.quarters, 2);
  const breaks = ok(read.breaks, 3);
  const subjects = read.subjects && Object.keys(read.subjects).length >= 3 ? read.subjects : undefined;
  const profile: SchoolProfile = {
    quarters: quarters ?? PROFILE_SNAPSHOT.quarters,
    breaks: breaks ?? PROFILE_SNAPSHOT.breaks,
    bridgeDays: read.bridgeDays ?? PROFILE_SNAPSHOT.bridgeDays,
    fields: read.fields && Object.keys(read.fields).length ? read.fields : PROFILE_SNAPSHOT.fields,
    subjects: subjects ?? PROFILE_SNAPSHOT.subjects,
    hues: read.hues && Object.keys(read.hues).length ? read.hues : PROFILE_SNAPSHOT.hues,
  };
  return { profile, live: !!(quarters && breaks && subjects) };
}

// Turning the site's timetable into Blob's -------------------------------------------------------

type RawLesson = {
  id?: unknown;
  tag?: unknown;
  block?: unknown;
  laenge?: unknown;
  ueVon?: unknown;
  ueBis?: unknown;
  fach?: unknown;
  lehrer?: unknown;
  raum?: unknown;
  hinweis?: unknown;
  korrektur?: unknown;
};

type RawPlan = { tage?: unknown; bloecke?: unknown; stunden?: unknown; stand?: unknown };

const minutesOf = (hm: unknown) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** "B3P." → "B3P" */
export const subjectCode = (fach: string) => fach.replace(/\.+$/, "").trim().toUpperCase();

/** The rhythm a hint stands for: "14-tg." fortnightly (even weeks), "1. Quart." only in quarter 1. */
export function rhythmOf(hint: string | null, quarters: Quarter[]): Rhythm {
  const h = hint ?? "";
  if (/14\s*-?\s*t/i.test(h)) return { kind: "fortnightly", weeks: /ungerade|\bung\b|odd/i.test(h) ? "odd" : "even" };
  const q = /(\d)\.\s*Quart/i.exec(h);
  if (q) {
    const quarter = quarters.find((x) => x.nr === Number(q[1]));
    if (quarter) return { kind: "quarter", nr: quarter.nr, from: quarter.from, to: quarter.to };
  }
  return { kind: "weekly" };
}

/** What a hint says besides the rhythm. */
function restOfHint(hint: string | null): string | null {
  const rest = (hint ?? "").replace(/14\s*-?\s*tg\.*/gi, "").replace(/\d\.\s*Quart\.*/gi, "").trim();
  return /[a-z0-9]/i.test(rest) ? rest : null;
}

function hueOf(code: string, field: string | null, hues: Record<string, number>) {
  const known = (field ? hues[field] : undefined) ?? hues[code];
  if (known !== undefined) return known;
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Public holidays in Lower Saxony (where the school is) for a year: yyyy-mm-dd → name. */
export function publicHolidays(year: number): Record<string, string> {
  // Easter Sunday (Gauss, as the site computes it).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day, 12);
  const rel = (n: number) => ymd(addDays(easter, n));
  return {
    [`${year}-01-01`]: "Neujahr",
    [rel(-2)]: "Karfreitag",
    [rel(1)]: "Ostermontag",
    [`${year}-05-01`]: "Tag der Arbeit",
    [rel(39)]: "Christi Himmelfahrt",
    [rel(50)]: "Pfingstmontag",
    [`${year}-10-03`]: "Tag der Deutschen Einheit",
    [`${year}-10-31`]: "Reformationstag",
    [`${year}-12-25`]: "1. Weihnachtstag",
    [`${year}-12-26`]: "2. Weihnachtstag",
  };
}

/** The site's timetable (decoded) and school year as one `Timetable`. Throws when the timetable isn't usable. */
export function buildTimetable(raw: unknown, profile: SchoolProfile, live: boolean): Timetable {
  const plan = ((raw as { result?: unknown })?.result ?? raw) as RawPlan;
  if (!plan || !Array.isArray(plan.bloecke) || !Array.isArray(plan.stunden)) throw new Error("bta: no timetable");
  const blocks = (plan.bloecke as { von?: unknown; bis?: unknown }[]).slice(0, 12).map((b) => ({ from: text(b?.von, 5), to: text(b?.bis, 5) }));
  const blockMinutes = blocks.map((b) => ({ from: minutesOf(b.from), to: minutesOf(b.to) }));
  const days = Array.isArray(plan.tage) ? plan.tage.length : 5;

  // A block is two teaching units (UE) of 45 minutes; a lesson runs from its first unit to its last.
  const unit = (ue: number) => {
    const b = blockMinutes[Math.floor((ue - 1) / 2)];
    if (!b || b.from === null || b.to === null) return null;
    const mid = b.from + Math.round((b.to - b.from) / 2);
    return ue % 2 === 1 ? { start: b.from, end: mid } : { start: mid, end: b.to };
  };

  const lessons: TimetableLesson[] = [];
  for (const s of (plan.stunden as RawLesson[]).slice(0, 200)) {
    const day = Number(s?.tag);
    const block = Number(s?.block);
    const length = Number(s?.laenge) || 1;
    if (!Number.isInteger(day) || day < 0 || day >= Math.min(days, 7) || !Number.isInteger(block) || block < 0) continue;
    const first = block * 2 + 1;
    const last = (block + length) * 2;
    const ueFrom = Number(s.ueVon);
    const ueTo = Number(s.ueBis);
    const [u1, u2] = Number.isInteger(ueFrom) && Number.isInteger(ueTo) && ueFrom >= first && ueTo <= last && ueFrom <= ueTo ? [ueFrom, ueTo] : [first, last];
    const from = unit(u1);
    const to = unit(u2);
    const fach = text(s.fach, 16);
    if (!from || !to || to.end <= from.start || !fach) continue;
    const code = subjectCode(fach);
    const info = profile.subjects[code];
    const field = info?.field ? `LF ${info.field}` : null;
    const hint = typeof s.hinweis === "string" ? s.hinweis.slice(0, 120) : null;
    lessons.push({
      id: text(s.id, 40) || `${day}-${block}-${code}`,
      day,
      start: from.start,
      end: to.end,
      code,
      name: (info?.field ? profile.fields[info.field] : info?.name) || code,
      part: info?.part ?? null,
      field,
      teachers: Array.isArray(s.lehrer) ? s.lehrer.map((x) => text(x, 80)).filter(Boolean).slice(0, 6) : [],
      room: text(s.raum, 24),
      note: restOfHint(hint),
      correction: text(s.korrektur, 300) || null,
      rhythm: rhythmOf(hint, profile.quarters),
      hue: hueOf(code, field, profile.hues),
    });
  }
  if (!lessons.length) throw new Error("bta: empty timetable");
  lessons.sort((a, b) => a.day - b.day || a.start - b.start);

  const quarters = [...profile.quarters].sort((a, b) => a.from.localeCompare(b.from));
  const year = { from: quarters[0].from, to: quarters[quarters.length - 1].to };
  const daysOff: Record<string, string> = {};
  const firstYear = Number(year.from.slice(0, 4));
  const lastYear = Number(year.to.slice(0, 4));
  for (let y = firstYear; y <= lastYear; y++) Object.assign(daysOff, publicHolidays(y));
  Object.assign(daysOff, profile.bridgeDays);
  for (const d of Object.keys(daysOff)) if (d < year.from || d > year.to) delete daysOff[d];

  const codes = new Set(lessons.map((l) => l.code));
  const exams: TimetableExam[] = [];
  for (const [code, info] of Object.entries(profile.subjects)) {
    if (!codes.has(code)) continue;
    const name = (info.field ? profile.fields[info.field] : info.name) || code;
    for (const x of info.exams ?? []) exams.push({ code, name, date: x.date, title: x.title });
  }
  exams.sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));

  return {
    source: "bta",
    className: BTA_CLASS,
    updated: text(plan.stand, 40) || null,
    blocks,
    lessons,
    quarters,
    breaks: profile.breaks.filter((b) => b.to >= year.from && b.from <= addDaysYmd(year.to, 60)),
    daysOff,
    exams,
    year,
    live,
  };
}

const addDaysYmd = (d: string, n: number) => ymd(addDays(fromYmd(d)!, n));

/** The name of the break or day off on `day` (yyyy-mm-dd), if there's no school. */
export function dayOff(tt: Pick<Timetable, "breaks" | "daysOff">, day: string): string | null {
  return tt.breaks.find((b) => day >= b.from && day <= b.to)?.name ?? tt.daysOff[day] ?? null;
}
