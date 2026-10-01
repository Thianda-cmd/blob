/** The "Welcome to Blob" note created during onboarding, as Tiptap / ProseMirror JSON. */

type Mark = { type: "bold" | "italic" | "code" };
type TextNode = { type: "text"; text: string; marks?: Mark[] };
type Block = { type: string; attrs?: Record<string, unknown>; content?: (Block | TextNode)[] };

export const WELCOME_TITLE = "Welcome to Blob 👋";

const t = (text: string, ...marks: Mark["type"][]): TextNode =>
  marks.length ? { type: "text", text, marks: marks.map((type) => ({ type })) } : { type: "text", text };
const p = (...content: TextNode[]): Block => ({ type: "paragraph", content });
const h = (level: 2 | 3, text: string): Block => ({ type: "heading", attrs: { level }, content: [t(text)] });
const li = (...content: TextNode[]): Block => ({ type: "listItem", content: [p(...content)] });
const task = (text: string): Block => ({ type: "taskItem", attrs: { checked: false }, content: [p(t(text))] });

export function welcomeDoc(name?: string) {
  const hi = name ? `Hi ${name}! ` : "Hi! ";
  const doc: Block = {
    type: "doc",
    content: [
      p(t(hi), t("I'm Blob, your jelly study buddy. This is your space for notes, presentations and homework. Everything saves automatically, so you can focus on the work.")),
      h(2, "What you can do"),
      {
        type: "bulletList",
        content: [
          li(t("Notes", "bold"), t(": type "), t("/", "code"), t(" on an empty line to add headings, checklists, quotes and more.")),
          li(t("Presentations", "bold"), t(": build slides, then hit "), t("Present", "bold"), t(" to show them full screen.")),
          li(t("Tasks", "bold"), t(": add homework with natural dates, like "), t("essay due friday", "italic"), t(".")),
          li(t("Search", "bold"), t(": press "), t("⌘K", "code"), t(" (or "), t("Ctrl K", "code"), t(") to jump to anything.")),
          li(t("Blob helper", "bold"), t(": click me in the bottom corner for quick actions and tips.")),
        ],
      },
      h(2, "Your first steps"),
      {
        type: "taskList",
        content: [task("Create your first note"), task("Add a homework task"), task("Make a presentation")],
      },
      h(3, "Good to know"),
      p(t("Put pages into subjects in the sidebar to keep each class tidy, and nest pages inside pages for bigger topics.")),
      p(t("Done with this note? Delete it anytime. It waits in the trash in case you want it back.")),
    ],
  };
  return { doc, text: plainText(doc) };
}

/** Text of every block on its own line, for search. */
function plainText(node: Block | TextNode): string {
  if (node.type === "text") return (node as TextNode).text;
  const block = node as Block;
  const inner = (block.content ?? []).map(plainText);
  const isTextBlock = block.type === "paragraph" || block.type === "heading";
  return isTextBlock ? inner.join("") : inner.filter(Boolean).join("\n");
}
