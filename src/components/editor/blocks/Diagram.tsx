"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { CircleHelp, Pencil, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { noteBlocksText, type NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { caretAfter, openEditorAt } from "./insert";
import { themeColor, useDark } from "./useDark";

type Starter = keyof NoteBlocksText["diagram"]["starters"];
const STARTERS: Starter[] = ["mindmap", "flow", "timeline", "cycle", "sequence", "pie"];

// Rendering ---------------------------------------------------------------------------------------

/** "#rrggbb" mixed with another colour (t = share of `a`). */
function mixHex(a: string, b: string, t: number) {
  const parse = (raw: string) => {
    const h = raw.trim().replace("#", "");
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    const m = full.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    if (m) return [1, 2, 3].map((i) => parseInt(m[i], 16));
    const rgb = raw.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    return rgb ? [1, 2, 3].map((i) => Number(rgb[i])) : [128, 128, 128];
  };
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
}

const SECTION_VARS = ["--blob", "--subject-sky", "--subject-moss", "--subject-sand", "--subject-clay", "--subject-rose", "--subject-teal", "--subject-plum"];

/**
 * Colours for mind map and timeline sections. Mermaid darkens the ones it is given, so they are set
 * here with CSS instead: the drawing sits in the page, so Blob's variables (light or dark) apply.
 */
const SECTION_CSS = [
  `.node rect { rx: 8px; ry: 8px; }`,
  `.section-root rect, .section-root path, .section-root circle, .section-root polygon { fill: var(--blob) !important; stroke: none !important; }`,
  `.section-root text, .section-root tspan { fill: #fff !important; font-weight: 600; }`,
  ...Array.from({ length: 12 }, (_, i) => {
    const v = SECTION_VARS[i % SECTION_VARS.length];
    const k = i - 1;
    return [
      `.section-${k} rect, .section-${k} path, .section-${k} circle, .section-${k} polygon { fill: color-mix(in oklab, var(${v}) 18%, var(--raised)) !important; stroke: color-mix(in oklab, var(${v}) 50%, var(--raised)) !important; }`,
      `.section-${k} text, .section-${k} tspan { fill: var(--ink) !important; }`,
      `.section-edge-${k} { stroke: color-mix(in oklab, var(${v}) 55%, var(--raised)) !important; }`,
      `.section-${k} line { stroke: color-mix(in oklab, var(${v}) 55%, var(--raised)) !important; }`,
    ].join("\n");
  }),
].join("\n");

/** Mermaid's look, from Blob's theme (it needs real colours, not CSS variables). */
function mermaidConfig(dark: boolean) {
  const c = (name: string, fallback: string) => themeColor(name, fallback);
  const raised = c("--raised", dark ? "#22221f" : "#ffffff");
  const ink = c("--ink", dark ? "#edebe4" : "#1c1b18");
  const ink3 = c("--ink-3", "#8b8981");
  const blob = c("--blob", "#6d3df5");
  const subjects = ["--subject-sky", "--subject-moss", "--subject-sand", "--subject-clay", "--subject-rose", "--subject-teal", "--subject-plum"].map((n) => c(n, "#3f78b3"));
  const palette = [blob, ...subjects];
  const soft = (hex: string) => mixHex(hex, raised, dark ? 0.32 : 0.16);
  const fontFamily = typeof document === "undefined" ? "sans-serif" : getComputedStyle(document.body).fontFamily;
  const scale: Record<string, string> = {};
  palette.forEach((p, i) => {
    scale[`cScale${i}`] = soft(p);
    scale[`cScaleLabel${i}`] = ink;
    scale[`cScalePeer${i}`] = mixHex(p, raised, 0.6);
    scale[`pie${i + 1}`] = mixHex(p, raised, dark ? 0.75 : 0.85);
  });
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    theme: "base" as const,
    fontFamily,
    flowchart: { htmlLabels: false, curve: "basis" as const, padding: 12 },
    themeCSS: SECTION_CSS,
    themeVariables: {
      darkMode: dark,
      fontFamily,
      fontSize: "15px",
      background: raised,
      primaryColor: soft(blob),
      primaryTextColor: ink,
      primaryBorderColor: mixHex(blob, raised, dark ? 0.7 : 0.45),
      secondaryColor: soft(subjects[0]),
      tertiaryColor: c("--surface", raised),
      lineColor: ink3,
      textColor: ink,
      titleColor: ink,
      edgeLabelBackground: raised,
      clusterBkg: c("--surface", raised),
      noteBkgColor: soft(subjects[2]),
      noteTextColor: ink,
      actorBkg: soft(blob),
      actorBorder: mixHex(blob, raised, 0.5),
      actorTextColor: ink,
      signalColor: ink,
      signalTextColor: ink,
      pieStrokeColor: raised,
      pieOuterStrokeColor: raised,
      pieTitleTextColor: ink,
      pieSectionTextColor: dark ? "#ffffff" : "#ffffff",
      pieLegendTextColor: ink,
      ...scale,
    },
  };
}

/**
 * Mermaid's strict mode already cleans what people write; this second pass keeps anything active
 * (scripts, event handlers, outside links) out of the page no matter what.
 */
function sanitizeSvg(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "text/html");
  const root = doc.body.querySelector("svg");
  if (!root) return "";
  root.querySelectorAll("script, iframe, object, embed, link, meta").forEach((n) => n.remove());
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if ((name === "href" || name === "xlink:href" || name === "src") && !value.startsWith("#")) el.removeAttribute(attr.name);
      else if (name === "style" && /url\(|expression|javascript:/.test(value)) el.removeAttribute(attr.name);
    }
  }
  return root.outerHTML;
}

type Rendered = { svg: string | null; error: boolean };

let queue: Promise<unknown> = Promise.resolve();
let counter = 0;

/** Draw a diagram (one at a time: Mermaid's settings are global). Mermaid itself loads on first use. */
function renderDiagram(src: string, dark: boolean): Promise<Rendered> {
  const run = async (): Promise<Rendered> => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize(mermaidConfig(dark));
    const valid = await mermaid.parse(src, { suppressErrors: true });
    if (!valid) return { svg: null, error: true };
    const id = `blob-mermaid-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, src);
      return { svg: sanitizeSvg(svg), error: false };
    } catch {
      return { svg: null, error: true };
    } finally {
      // Mermaid leaves its scratch element behind when it fails.
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** The latest drawing of `src` (the last good one stays while a newer one is wrong or loading). */
function useDiagram(src: string, delay: number) {
  const dark = useDark();
  const [state, setState] = useState<{ key: string; svg: string | null; error: boolean }>({ key: "", svg: null, error: false });
  const key = `${dark ? "d" : "l"}:${src}`;
  useEffect(() => {
    if (!src.trim()) return;
    let alive = true;
    const timer = setTimeout(() => {
      void renderDiagram(src, dark).then((r) => {
        if (!alive) return;
        setState((prev) => ({ key, svg: r.svg ?? prev.svg, error: r.error }));
      });
    }, delay);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [src, dark, key, delay]);
  const empty = !src.trim();
  return { svg: empty ? null : state.svg, error: !empty && state.key === key && state.error, loading: !empty && state.key !== key && !state.svg };
}

// The block ---------------------------------------------------------------------------------------

function DiagramView({ node, updateAttributes, editor, getPos, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText);
  const { canEdit } = useNoteBlocks();
  const src = (node.attrs.src as string) ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(src);
  const area = useRef<HTMLTextAreaElement>(null);
  const shown = editing ? draft : src;
  const { svg, error, loading } = useDiagram(shown, editing ? 350 : 0);

  // Save while typing (a moment after the last key), so nothing is lost and the others see it.
  useEffect(() => {
    if (!editing || draft === src) return;
    const timer = setTimeout(() => updateAttributes({ src: draft }), 700);
    return () => clearTimeout(timer);
  }, [editing, draft, src, updateAttributes]);

  const open = () => {
    if (!canEdit) return;
    setDraft(src);
    setEditing(true);
    requestAnimationFrame(() => area.current?.focus());
  };

  const finish = () => {
    setEditing(false);
    const pos = getPos();
    if (typeof pos !== "number" || editor.isDestroyed) return;
    if (!draft.trim()) {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      return;
    }
    if (draft !== src) updateAttributes({ src: draft });
    caretAfter(editor, pos);
  };

  const starter = (id: Starter) => {
    const code = t.diagram.starters[id];
    setDraft(code);
    requestAnimationFrame(() => area.current?.focus());
  };

  const preview = (
    <div className={cn("blob-diagram-canvas", error && "has-error")} aria-live="polite">
      {svg ? (
        <div className={cn("blob-diagram-svg", (error || loading) && "is-stale")} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="blob-diagram-placeholder">{loading ? t.diagram.loading : editing ? t.diagram.empty : null}</div>
      )}
      {error && <div className="blob-diagram-error">{t.diagram.error}</div>}
    </div>
  );

  return (
    <NodeViewWrapper className={cn("blob-diagram blob-object", editing && "is-editing", selected && !editing && "blob-node-selected")} data-drag-handle={editing ? undefined : ""}>
      {editing ? (
        <div contentEditable={false} className="@container">
          <div className="blob-diagram-bar">
            <span className="blob-diagram-title">
              <Workflow className="size-3.5" />
              {t.diagram.label}
            </span>
            <div className="blob-diagram-chips" role="group" aria-label={t.diagram.templates}>
              {STARTERS.map((id) => (
                <button key={id} type="button" onClick={() => starter(id)} className="blob-chip">
                  {t.diagram.t[id]}
                </button>
              ))}
            </div>
            <a href="https://mermaid.js.org/intro/syntax-reference.html" target="_blank" rel="noopener noreferrer" className="blob-diagram-help" title={t.diagram.help} aria-label={t.diagram.help}>
              <CircleHelp className="size-4" />
            </a>
            <button type="button" onClick={finish} className="blob-done">
              {t.done}
            </button>
          </div>
          <div className="grid gap-2 @min-[600px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <textarea
              ref={area}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
                  e.preventDefault();
                  finish();
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const at = el.selectionStart;
                  setDraft(draft.slice(0, at) + "  " + draft.slice(el.selectionEnd));
                  requestAnimationFrame(() => el.setSelectionRange(at + 2, at + 2));
                }
              }}
              aria-label={t.diagram.source}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={Math.min(16, Math.max(6, draft.split("\n").length + 1))}
              className="blob-diagram-code"
            />
            {preview}
          </div>
        </div>
      ) : (
        <div contentEditable={false} className="relative" onDoubleClick={open}>
          {src.trim() ? preview : <div className="blob-diagram-placeholder">{t.diagram.empty}</div>}
          {canEdit && (
            <button type="button" data-open-editor onClick={open} className="blob-block-edit" aria-label={t.diagram.edit} title={t.diagram.edit}>
              <Pencil className="size-3.5" />
              <span>{t.edit}</span>
            </button>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** A Mermaid diagram (mind map, process, timeline…), drawn from its code. */
export const Diagram = Node.create({
  name: "diagram",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-src") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-src": attrs.src }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-diagram]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-diagram": "" }), ["pre", {}, node.attrs.src as string]];
  },

  renderText() {
    return "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiagramView);
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name || !editor.isEditable) return false;
        openEditorAt(editor, sel.from, 0);
        return true;
      },
    };
  },
});
