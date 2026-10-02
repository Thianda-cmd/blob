import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import type { SlashItem } from "./items";

export type SlashSnapshot = {
  open: boolean;
  /** Increments every time the menu opens, so it can replay its entrance. */
  session: number;
  query: string;
  items: SlashItem[];
  placement: "top" | "bottom";
};

const CLOSED: SlashSnapshot = { open: false, session: 0, query: "", items: [], placement: "bottom" };

/**
 * Bridges the Suggestion plugin (imperative, lives inside ProseMirror) and the
 * React menu (declarative). The menu subscribes with useSyncExternalStore and
 * registers a key handler; the plugin positions the host element at the caret.
 */
export class SlashController {
  private snapshot: SlashSnapshot = CLOSED;
  private listeners = new Set<() => void>();
  private unmount: (() => void) | null = null;
  private hostEl: HTMLDivElement | null = null;
  private select: ((item: SlashItem) => void) | null = null;
  /** Set by the React menu: returns true when it handled the key. */
  private keyHandler: ((event: KeyboardEvent) => boolean) | null = null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => CLOSED;

  /** The element the menu is portalled into (created lazily in the browser). */
  get host() {
    if (!this.hostEl && typeof document !== "undefined") {
      const el = document.createElement("div");
      el.className = "blob-slash-host";
      el.style.position = "fixed";
      el.style.zIndex = "60";
      el.style.left = "0";
      el.style.top = "0";
      this.hostEl = el;
    }
    return this.hostEl;
  }

  setKeyHandler(fn: ((event: KeyboardEvent) => boolean) | null) {
    this.keyHandler = fn;
  }

  choose(item: SlashItem) {
    this.select?.(item);
  }

  private set(patch: Partial<SlashSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private place = ({ x, y, placement }: { x: number; y: number; placement: string }) => {
    const host = this.host;
    if (!host) return;
    const width = host.offsetWidth || 320;
    const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
    host.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(y)}px, 0)`;
    host.style.visibility = "visible";
    const side = placement.startsWith("top") ? "top" : "bottom";
    if (side !== this.snapshot.placement) this.set({ placement: side });
  };

  renderer = () => ({
    onStart: (props: SuggestionProps<SlashItem, SlashItem>) => {
      const host = this.host;
      if (!host) return;
      host.style.visibility = "hidden";
      this.unmount?.();
      this.unmount = props.mount(host, { onPosition: this.place });
      this.select = props.command;
      this.set({ open: true, session: this.snapshot.session + 1, query: props.query, items: props.items, placement: "bottom" });
    },
    onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => {
      if (props.loading) return;
      this.select = props.command;
      this.set({ query: props.query, items: props.items });
    },
    onExit: () => {
      this.unmount?.();
      this.unmount = null;
      this.select = null;
      this.set({ open: false, query: "", items: [] });
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "Escape") return true;
      return this.keyHandler?.(event) ?? false;
    },
  });
}

export const slashPluginKey = new PluginKey("slashCommand");

type SlashOptions = {
  controller: SlashController | null;
  run: (item: SlashItem, editor: Editor, range: Range) => void;
  /** The commands matching what was typed after "/", in the reader's language. */
  items: (query: string) => SlashItem[];
  /** Hint shown after a lone "/" ("Type to filter…"). */
  emptyHint: () => string;
};

/** "/" opens the block menu. Only at the start of a line or after a space, never in code. */
export const SlashCommand = Extension.create<SlashOptions>({
  name: "slashCommand",

  addOptions() {
    return { controller: null, run: () => {}, items: () => [], emptyHint: () => "" };
  },

  addProseMirrorPlugins() {
    const { controller, run, items, emptyHint } = this.options;
    if (!controller) return [];
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: "/",
        allowedPrefixes: [" ", " "],
        initialItems: items(""),
        decorationClass: "blob-slash-query",
        // Shown by CSS (NoteEditor.module.css) while the query is empty.
        decorationContent: emptyHint(),
        decorationEmptyClass: "is-query-empty",
        placement: "bottom-start",
        offset: { mainAxis: 8, crossAxis: -4 },
        floatingUi: { strategy: "fixed" },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.spec.code) return false;
          return !$from.marks().some((m) => m.type.name === "code");
        },
        items: ({ query }) => items(query),
        command: ({ editor, range, props }) => run(props, editor, range),
        render: controller.renderer,
      }),
    ];
  },
});
