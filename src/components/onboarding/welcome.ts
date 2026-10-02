/** The "Welcome to Blob" note created during onboarding, as Tiptap / ProseMirror JSON, in the student's language. */
import type { Locale } from "@/i18n/config";

type Mark = { type: "bold" | "italic" | "code" };
type TextNode = { type: "text"; text: string; marks?: Mark[] };
type Block = { type: string; attrs?: Record<string, unknown>; content?: (Block | TextNode)[] };

export const WELCOME_TITLES: Record<Locale, string> = {
  en: "Welcome to Blob 👋",
  de: "Willkommen bei Blob 👋",
};

const t = (text: string, ...marks: Mark["type"][]): TextNode =>
  marks.length ? { type: "text", text, marks: marks.map((type) => ({ type })) } : { type: "text", text };
const p = (...content: TextNode[]): Block => ({ type: "paragraph", content });
const h = (level: 2 | 3, text: string): Block => ({ type: "heading", attrs: { level }, content: [t(text)] });
const li = (...content: TextNode[]): Block => ({ type: "listItem", content: [p(...content)] });
const task = (text: string): Block => ({ type: "taskItem", attrs: { checked: false }, content: [p(t(text))] });
const bullets = (...items: Block[]): Block => ({ type: "bulletList", content: items });
const tasks = (...items: string[]): Block => ({ type: "taskList", content: items.map(task) });

function english(name?: string): Block[] {
  return [
    p(t(name ? `Hi ${name}! ` : "Hi! "), t("I'm Blob, your jelly study buddy. This is your space for notes, presentations and homework. Everything saves automatically, so you can focus on the work.")),
    h(2, "What you can do"),
    bullets(
      li(t("Notes", "bold"), t(": type "), t("/", "code"), t(" on an empty line to add headings, checklists, quotes and more.")),
      li(t("Presentations", "bold"), t(": build slides, then hit "), t("Present", "bold"), t(" to show them full screen.")),
      li(t("Tasks", "bold"), t(": add homework with natural dates, like "), t("essay due friday", "italic"), t(".")),
      li(t("Search", "bold"), t(": press "), t("⌘K", "code"), t(" (or "), t("Ctrl K", "code"), t(") to jump to anything.")),
      li(t("Blob helper", "bold"), t(": click me in the bottom corner for quick actions and tips.")),
    ),
    h(2, "Your first steps"),
    tasks("Create your first note", "Add a homework task", "Make a presentation"),
    h(3, "Good to know"),
    p(t("Put pages into subjects in the sidebar to keep each class tidy, and nest pages inside pages for bigger topics.")),
    p(t("Done with this note? Delete it anytime. It waits in the trash in case you want it back.")),
  ];
}

function german(name?: string): Block[] {
  return [
    p(t(name ? `Hi ${name}! ` : "Hi! "), t("Ich bin Blob, dein wabbeliger Lernbuddy. Hier ist dein Bereich für Notizen, Präsentationen und Hausaufgaben. Alles wird automatisch gespeichert, damit du dich ganz aufs Lernen konzentrieren kannst.")),
    h(2, "Was du hier machen kannst"),
    bullets(
      li(t("Notizen", "bold"), t(": Tippe "), t("/", "code"), t(" in eine leere Zeile, um Überschriften, Checklisten, Zitate und mehr einzufügen.")),
      li(t("Präsentationen", "bold"), t(": Bau deine Folien und klick dann auf "), t("Präsentieren", "bold"), t(", um sie im Vollbild zu zeigen.")),
      li(t("Aufgaben", "bold"), t(": Trag Hausaufgaben mit Datum in normalen Worten ein, z. B. "), t("Aufsatz bis Freitag", "italic"), t(".")),
      li(t("Suchen", "bold"), t(": Drück "), t("⌘K", "code"), t(" (oder "), t("Strg K", "code"), t("), um sofort alles zu finden.")),
      li(t("Blob-Helfer", "bold"), t(": Klick unten in der Ecke auf mich, dann gibt's schnelle Aktionen und Tipps.")),
    ),
    h(2, "Deine ersten Schritte"),
    tasks("Erstelle deine erste Notiz", "Trag eine Hausaufgabe ein", "Mach eine Präsentation"),
    h(3, "Gut zu wissen"),
    p(t("Ordne deine Seiten in der Seitenleiste Fächern zu, damit jedes Fach aufgeräumt bleibt. Für größere Themen kannst du Seiten in Seiten anlegen.")),
    p(t("Fertig mit dieser Notiz? Lösch sie einfach. Sie wartet dann im Papierkorb, falls du sie doch noch brauchst.")),
  ];
}

export function welcomeDoc(locale: Locale, name?: string) {
  const doc: Block = { type: "doc", content: locale === "de" ? german(name) : english(name) };
  return { title: WELCOME_TITLES[locale], doc, text: plainText(doc) };
}

/** Text of every block on its own line, for search. */
function plainText(node: Block | TextNode): string {
  if (node.type === "text") return (node as TextNode).text;
  const block = node as Block;
  const inner = (block.content ?? []).map(plainText);
  const isTextBlock = block.type === "paragraph" || block.type === "heading";
  return isTextBlock ? inner.join("") : inner.filter(Boolean).join("\n");
}
