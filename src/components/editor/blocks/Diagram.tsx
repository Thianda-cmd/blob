"use client";

import { NodeSelection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { ArrowDownToLine, ArrowRightToLine, CircleHelp, Download, Maximize2, Pencil, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import { noteBlocksText, type NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { cn } from "@/lib/utils";
import { useNoteBlocks } from "./context";
import { DiagramGallery, DiagramRows, KIND_ICONS, fromDraft, toDraft, type Draft } from "./DiagramBuilder";
import { DIAGRAM_KINDS, SECTION_VARS, convertModel, hasContent, modelFromMermaid, readModel, starterModel, toMermaid, type DiagramKind, type DiagramModel } from "./diagramModel";
import { DiagramViewer, diagramFileName, downloadDiagram, type DiagramFormat } from "./DiagramZoom";
import { caretAfter, openEditorAt } from "./insert";
import { themeColor, useDark, type ColorSource } from "./useDark";
import { DiagramSpec } from "./schema";

type Starter = keyof NoteBlocksText["diagram"]["starters"];
const STARTERS: Starter[] = ["mindmap", "flow", "timeline", "cycle", "sequence", "pie"];

/** Editing a diagram: picking its kind (a new one), in the builder, or as Mermaid code. */
type Mode = "gallery" | "builder" | "code";

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

/**
 * Mermaid's look, from Blob's theme (it needs real colours, not CSS variables). `plain`: labels as
 * SVG text only (no HTML inside), for turning a drawing into a PNG.
 */
function mermaidConfig(dark: boolean, plain = false, color: ColorSource = themeColor) {
  const c = color;
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
    ...(plain && { htmlLabels: false }),
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
function renderDiagram(src: string, dark: boolean, plain = false, color?: ColorSource): Promise<Rendered> {
  const run = async (): Promise<Rendered> => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize(mermaidConfig(dark, plain, color));
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

/** A drawing of `src` in the light theme with its labels as SVG text (the Word export, in withLightTheme). */
export const plainDiagramSvg = (src: string, color: ColorSource) => renderDiagram(src, false, true, color).then((r) => r.svg);

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

const sameModel = (a: DiagramModel | null, b: DiagramModel | null) => JSON.stringify(a) === JSON.stringify(b);

/** What the diagram is called in file names and the large view: its title or first row. */
function diagramTitle(model: DiagramModel | null) {
  if (!model) return "";
  if (model.title?.trim()) return model.title.trim();
  if (model.kind === "sequence") return "";
  return model.rows.find((r) => r.text.trim())?.text.trim() ?? "";
}

function DiagramView({ node, updateAttributes, editor, getPos, selected }: ReactNodeViewProps) {
  const t = useMessages(noteBlocksText);
  const locale = useLocale();
  const dark = useDark();
  const { canEdit } = useNoteBlocks();
  const src = (node.attrs.src as string) ?? "";
  // The builder's rows, when the diagram was made with it.
  const stored = useMemo(() => readModel(node.attrs.model), [node.attrs.model]);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>("code");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [code, setCode] = useState(src);
  /** The code was changed by hand: the diagram becomes a code diagram (no builder rows). */
  const [codeEdited, setCodeEdited] = useState(false);
  /** Asking whether the builder may start over (it can't read this code). */
  const [fresh, setFresh] = useState(false);
  const [large, setLarge] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const model = useMemo(() => (draft ? fromDraft(draft) : null), [draft]);
  const built = useMemo(() => (model ? toMermaid(model) : ""), [model]);
  const shown = !editing ? src : mode === "builder" ? built : mode === "code" ? code : "";
  const { svg, error, loading } = useDiagram(shown, editing ? 350 : 0);

  /** What editing has made of the node so far (null: nothing to save). */
  const pendingAttrs = (): { src: string; model: DiagramModel | null } | null => {
    if (mode === "builder" && model) return built !== src || !sameModel(model, stored) ? { src: built, model } : null;
    if (mode === "code" && codeEdited) return code !== src || stored ? { src: code, model: null } : null;
    return null;
  };

  // Save while typing (a moment after the last key), so nothing is lost and the others see it.
  const next = editing ? pendingAttrs() : null;
  const nextKey = next ? JSON.stringify(next) : "";
  useEffect(() => {
    if (!nextKey) return;
    const timer = setTimeout(() => updateAttributes(JSON.parse(nextKey)), 700);
    return () => clearTimeout(timer);
  }, [nextKey, updateAttributes]);

  const focusCode = () => requestAnimationFrame(() => area.current?.focus());

  const open = () => {
    if (!canEdit) return;
    setFresh(false);
    setCodeEdited(false);
    setCode(src);
    if (stored) {
      setDraft(toDraft(stored));
      setMode("builder");
    } else if (src.trim()) {
      setDraft(null);
      setMode("code");
      focusCode();
    } else {
      setDraft(null);
      setMode("gallery");
    }
    setEditing(true);
  };

  const finish = () => {
    setEditing(false);
    setFresh(false);
    const pos = getPos();
    if (typeof pos !== "number" || editor.isDestroyed) return;
    const empty = mode === "builder" ? !model || !hasContent(model) : mode === "code" ? !code.trim() : !src.trim();
    if (empty) {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      return;
    }
    const attrs = pendingAttrs();
    if (attrs) updateAttributes(attrs);
    caretAfter(editor, pos);
  };

  /** A kind picked in the gallery: the builder with its example, or the code. */
  const pick = (kind: DiagramKind | "code") => {
    setFresh(false);
    if (kind === "code") {
      setMode("code");
      focusCode();
      return;
    }
    setDraft(toDraft(starterModel(kind, locale)));
    setMode("builder");
  };

  const toCode = () => {
    setFresh(false);
    setCode(built);
    setCodeEdited(false);
    setMode("code");
    focusCode();
  };

  const toBuilder = () => {
    // Straight back when the code wasn't changed since the builder made it.
    if (!codeEdited && draft) return setMode("builder");
    if (!code.trim()) return setMode("gallery");
    const read = modelFromMermaid(code);
    if (!read) return setFresh(true);
    setDraft(toDraft(read));
    setCodeEdited(false);
    setMode("builder");
  };

  const switchKind = (kind: DiagramKind) => {
    if (!draft || kind === draft.kind) return;
    setDraft(toDraft(convertModel(fromDraft(draft), kind, locale)));
  };

  const starter = (id: Starter) => {
    setCode(t.diagram.starters[id]);
    setCodeEdited(true);
    focusCode();
  };

  const title = diagramTitle(stored);
  const download = (format: DiagramFormat) => {
    if (!svg) return;
    const name = diagramFileName(title, t.diagram.label);
    downloadDiagram(svg, format, name, () => renderDiagram(src, dark, true).then((r) => r.svg)).catch(() => blob.say(t.diagram.downloadFailed, { mood: "worried" }));
  };

  const preview = (
    <div className={cn("blob-diagram-canvas", error && "has-error")} aria-live="polite">
      {svg ? (
        <div className={cn("blob-diagram-svg", (error || loading) && "is-stale")} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="blob-diagram-placeholder">{loading ? t.diagram.loading : editing ? (mode === "builder" ? t.diagram.startEmpty : t.diagram.empty) : null}</div>
      )}
      {error && <div className="blob-diagram-error">{t.diagram.error}</div>}
    </div>
  );

  /** Processes and cycles go down or to the right. */
  const dir = mode === "builder" && (draft?.kind === "flow" || draft?.kind === "cycle") ? (draft.dir ?? (draft.kind === "cycle" ? "right" : "down")) : null;

  const kindBar = draft && mode === "builder" && (
    <div className="blob-diagram-chips" role="group" aria-label={t.diagram.kind}>
      {DIAGRAM_KINDS.map((kind) => {
        const Icon = KIND_ICONS[kind];
        const on = draft.kind === kind;
        return (
          <button key={kind} type="button" onClick={() => switchKind(kind)} className={cn("blob-chip gap-1", on && "is-on")} aria-pressed={on}>
            <Icon className="size-3" />
            {t.diagram.kinds[kind].name}
          </button>
        );
      })}
    </div>
  );

  return (
    <NodeViewWrapper className={cn("blob-diagram blob-object", editing && "is-editing", selected && !editing && "blob-node-selected")} data-drag-handle={editing ? undefined : ""}>
      {editing ? (
        <div
          contentEditable={false}
          className="@container"
          onKeyDown={(e) => {
            // Escape anywhere in the editor (a button, a chip) finishes, like in the rows and the code.
            if (e.key === "Escape" && !e.defaultPrevented) {
              e.preventDefault();
              finish();
            }
          }}
        >
          <div className="blob-diagram-bar">
            <span className="blob-diagram-title">
              <Workflow className="size-3.5" />
              {t.diagram.label}
            </span>
            {kindBar}
            {mode === "code" && (
              <div className="blob-diagram-chips" role="group" aria-label={t.diagram.templates}>
                {STARTERS.map((id) => (
                  <button key={id} type="button" onClick={() => starter(id)} className="blob-chip">
                    {t.diagram.t[id]}
                  </button>
                ))}
              </div>
            )}
            {mode === "gallery" && <span className="flex-1" />}
            {dir && draft && (
              <button
                type="button"
                className="blob-diagram-help"
                onClick={() => setDraft({ ...draft, dir: dir === "down" ? "right" : "down" })}
                aria-label={`${t.diagram.direction.label}: ${t.diagram.direction[dir]}`}
                title={`${t.diagram.direction.label}: ${t.diagram.direction[dir]}`}
              >
                {dir === "down" ? <ArrowDownToLine className="size-4" /> : <ArrowRightToLine className="size-4" />}
              </button>
            )}
            {mode !== "gallery" && (
              <div className="blob-seg" role="group">
                <button type="button" aria-pressed={mode === "builder"} onClick={mode === "builder" ? undefined : toBuilder} title={t.diagram.builderTitle}>
                  {t.diagram.builder}
                </button>
                <button type="button" aria-pressed={mode === "code"} onClick={mode === "code" ? undefined : toCode} title={t.diagram.codeTitle}>
                  {t.diagram.code}
                </button>
              </div>
            )}
            {mode === "code" && (
              <a href="https://mermaid.js.org/intro/syntax-reference.html" target="_blank" rel="noopener noreferrer" className="blob-diagram-help" title={t.diagram.help} aria-label={t.diagram.help}>
                <CircleHelp className="size-4" />
              </a>
            )}
            <button type="button" onClick={finish} className="blob-done" data-diagram-done>
              {t.done}
            </button>
          </div>
          {fresh && (
            <div className="blob-diagram-fresh" role="alert">
              <span>{t.diagram.fresh}</span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  className="blob-done"
                  onClick={() => {
                    setFresh(false);
                    setMode("gallery");
                  }}
                >
                  {t.diagram.freshYes}
                </button>
                <button type="button" className="blob-chip" onClick={() => setFresh(false)}>
                  {t.diagram.freshNo}
                </button>
              </span>
            </div>
          )}
          {mode === "gallery" ? (
            <DiagramGallery onPick={pick} onDone={finish} />
          ) : (
            <div className="grid gap-2 @min-[600px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              {mode === "builder" && draft ? (
                <DiagramRows draft={draft} onChange={setDraft} onDone={finish} />
              ) : (
                <div className="min-w-0">
                  {draft && !codeEdited && <p className="blob-diagram-note">{t.diagram.codeNote}</p>}
                  <textarea
                    ref={area}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setCodeEdited(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
                        e.preventDefault();
                        finish();
                      }
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const el = e.currentTarget;
                        const at = el.selectionStart;
                        setCode(code.slice(0, at) + "  " + code.slice(el.selectionEnd));
                        setCodeEdited(true);
                        requestAnimationFrame(() => el.setSelectionRange(at + 2, at + 2));
                      }
                    }}
                    aria-label={t.diagram.source}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    rows={Math.min(16, Math.max(6, code.split("\n").length + 1))}
                    className="blob-diagram-code"
                  />
                </div>
              )}
              {preview}
            </div>
          )}
        </div>
      ) : (
        <div contentEditable={false} className="relative" onDoubleClick={open}>
          {src.trim() ? preview : <div className="blob-diagram-placeholder">{t.diagram.empty}</div>}
          <div className="blob-diagram-actions">
            {svg && (
              <>
                <button type="button" onClick={() => setLarge(true)} className="blob-block-edit is-icon" aria-label={t.diagram.enlarge} title={t.diagram.enlarge}>
                  <Maximize2 className="size-3.5" />
                </button>
                <Popover
                  align="end"
                  className="w-[220px]"
                  trigger={(props) => (
                    <button {...props} type="button" className="blob-block-edit is-icon" aria-label={t.diagram.download} title={t.diagram.download}>
                      <Download className="size-3.5" />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      {(["svg", "png"] as const).map((format) => (
                        <MenuItem
                          key={format}
                          icon={<Download />}
                          shortcut={format === "svg" ? t.diagram.svgHint : t.diagram.pngHint}
                          onSelect={() => {
                            close();
                            download(format);
                          }}
                        >
                          {format === "svg" ? t.diagram.svg : t.diagram.png}
                        </MenuItem>
                      ))}
                    </>
                  )}
                </Popover>
              </>
            )}
            {canEdit && (
              <button type="button" data-open-editor onClick={open} className="blob-block-edit" aria-label={t.diagram.edit} title={t.diagram.edit}>
                <Pencil className="size-3.5" />
                <span>{t.edit}</span>
              </button>
            )}
          </div>
        </div>
      )}
      {large && svg && !editing && <DiagramViewer svg={svg} title={title} onClose={() => setLarge(false)} onDownload={download} />}
    </NodeViewWrapper>
  );
}

/** A Mermaid diagram (mind map, process, timeline…), drawn from its code. */
export const Diagram = DiagramSpec.extend({
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
      // A click on the editor's buttons leaves the caret in the note (buttons there don't take focus):
      // Escape then still finishes the diagram being edited.
      Escape: ({ editor }) => {
        const sel = editor.state.selection;
        if (!(sel instanceof NodeSelection) || sel.node.type.name !== this.name) return false;
        const done = (editor.view.nodeDOM(sel.from) as HTMLElement | null)?.querySelector?.<HTMLElement>(".is-editing [data-diagram-done]");
        if (!done) return false;
        done.click();
        return true;
      },
    };
  },
});
