import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// A text cursor Blob draws itself: thick, in Blob's colour, blinking, gliding as you type. Some
// webviews (the desktop apps') draw the system's thin caret faintly or not at all; this one is
// always there. The system caret comes back while an input method composes (its own underline and
// candidates need it), and in fields inside blocks (formulas, diagrams).

export type CaretOptions = {
  enabled: () => boolean;
  /** Calls back when `enabled` may answer differently (the setting changed). */
  subscribe: (onChange: () => void) => () => void;
};

const key = new PluginKey("blobCaret");

class CaretView {
  private el: HTMLDivElement;
  private frame = 0;
  private blinkTimer: ReturnType<typeof setTimeout> | undefined;
  private observer: ResizeObserver | null = null;
  private last = "";
  private unsubscribe: () => void;

  constructor(
    private view: EditorView,
    private enabled: () => boolean,
    subscribe: CaretOptions["subscribe"],
  ) {
    this.el = document.createElement("div");
    this.el.className = "blob-caret";
    this.el.setAttribute("aria-hidden", "true");
    view.dom.parentElement?.appendChild(this.el);
    for (const type of ["focus", "blur", "compositionstart", "compositionend"]) view.dom.addEventListener(type, this.schedule);
    window.addEventListener("resize", this.schedule);
    document.addEventListener("selectionchange", this.schedule);
    // Text moving without an edit (images loading, fonts, the window's width) moves the caret too.
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.schedule);
      this.observer.observe(view.dom);
    }
    this.unsubscribe = subscribe(this.schedule);
    this.schedule();
  }

  update() {
    this.schedule();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.blinkTimer);
    for (const type of ["focus", "blur", "compositionstart", "compositionend"]) this.view.dom.removeEventListener(type, this.schedule);
    window.removeEventListener("resize", this.schedule);
    document.removeEventListener("selectionchange", this.schedule);
    this.observer?.disconnect();
    this.unsubscribe();
    this.view.dom.classList.remove("has-blob-caret");
    this.el.remove();
  }

  private schedule = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.draw);
  };

  /** Where the caret is, from the browser's own selection when it knows, else from the document. */
  private rect(head: number): { left: number; top: number; height: number } | null {
    const sel = document.getSelection();
    if (sel?.rangeCount && sel.isCollapsed && this.view.dom.contains(sel.anchorNode)) {
      const r = sel.getRangeAt(0).getClientRects()[0];
      if (r && r.height > 0) return { left: r.left, top: r.top, height: r.height };
    }
    try {
      const c = this.view.coordsAtPos(head);
      return { left: c.left, top: c.top, height: c.bottom - c.top };
    } catch {
      return null;
    }
  }

  private draw = () => {
    const { view, el } = this;
    const on = this.enabled() && view.editable;
    view.dom.classList.toggle("has-blob-caret", on && !view.composing);
    const sel = view.state.selection;
    const parent = el.parentElement;
    const show = on && !view.composing && view.hasFocus() && sel instanceof TextSelection && sel.empty && !!parent;
    if (!show) {
      el.style.display = "none";
      this.last = "";
      return;
    }
    const r = this.rect(sel.head);
    if (!r) {
      el.style.display = "none";
      return;
    }
    const box = parent!.getBoundingClientRect();
    const x = Math.round(r.left - box.left);
    const y = Math.round(r.top - box.top);
    const h = Math.max(12, Math.round(r.height));
    const at = `${x},${y},${h}`;
    el.style.display = "block";
    if (at === this.last) return;
    // A jump (a click, another line) moves at once; typing glides.
    const [lx, ly] = this.last.split(",").map(Number);
    el.classList.toggle("is-gliding", this.last !== "" && ly === y && Math.abs(lx - x) < 60);
    this.last = at;
    el.style.height = `${h}px`;
    el.style.transform = `translate(${x}px, ${y}px)`;
    // Solid while moving, blinking again once it rests.
    el.classList.remove("is-blinking");
    clearTimeout(this.blinkTimer);
    this.blinkTimer = setTimeout(() => el.classList.add("is-blinking"), 500);
  };
}

export const BlobCaret = Extension.create<CaretOptions>({
  name: "blobCaret",
  addOptions() {
    return { enabled: () => false, subscribe: () => () => {} };
  },
  addProseMirrorPlugins() {
    const { enabled, subscribe } = this.options;
    return [new Plugin({ key, view: (view) => new CaretView(view, enabled, subscribe) })];
  },
});
