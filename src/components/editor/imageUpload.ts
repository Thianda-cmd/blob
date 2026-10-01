import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { blob } from "@/components/blob/bus";
import { createClient } from "@/lib/supabase/client";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

const uploadKey = new PluginKey<DecorationSet>("imageUpload");

type UploadMeta = { add?: { id: string; pos: number; src: string }; remove?: { id: string } };

function placeholderDOM(src: string) {
  const wrap = document.createElement("div");
  wrap.className = "blob-upload";
  wrap.contentEditable = "false";
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.draggable = false;
  const veil = document.createElement("div");
  veil.className = "blob-upload-veil";
  const pill = document.createElement("span");
  pill.className = "blob-upload-pill";
  const dot = document.createElement("span");
  dot.className = "blob-upload-spinner";
  pill.append(dot, document.createTextNode("Uploading…"));
  veil.append(pill);
  wrap.append(img, veil);
  return wrap;
}

/**
 * Shows an "uploading" preview where an image is about to land, without touching
 * the document (so a half-finished upload is never autosaved).
 */
export const ImageUploadPlaceholder = Extension.create({
  name: "imageUploadPlaceholder",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: uploadKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(uploadKey) as UploadMeta | undefined;
            if (meta?.add) {
              const { id, pos, src } = meta.add;
              const deco = Decoration.widget(pos, () => placeholderDOM(src), { id, key: `upload-${id}`, side: -1 });
              next = next.add(tr.doc, [deco]);
            }
            if (meta?.remove) {
              const id = meta.remove.id;
              next = next.remove(next.find(undefined, undefined, (spec) => spec.id === id));
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            return uploadKey.getState(state);
          },
        },
      }),
    ];
  },
});

function findPlaceholder(state: EditorState, id: string) {
  const found = uploadKey.getState(state)?.find(undefined, undefined, (spec) => spec.id === id);
  return found?.length ? found[0].from : null;
}

/** A block boundary near the caret: before an empty line, otherwise after the current block. */
export function insertionPos(state: EditorState) {
  const { selection } = state;
  if (selection instanceof NodeSelection) return selection.to;
  const { $from } = selection;
  if ($from.depth === 0) return $from.pos;
  const top = $from.node(1);
  if (top.isTextblock && top.content.size === 0) return $from.before(1);
  return $from.after(1);
}

/** A block boundary near a drop point. */
export function dropPos(view: EditorView, event: DragEvent) {
  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!hit) return insertionPos(view.state);
  const $pos = view.state.doc.resolve(hit.pos);
  if ($pos.depth === 0) return hit.pos;
  const before = $pos.before(1);
  const after = $pos.after(1);
  const top = $pos.node(1);
  if (top.isTextblock && top.content.size === 0) return before;
  const dom = view.nodeDOM(before);
  if (dom instanceof HTMLElement) {
    const r = dom.getBoundingClientRect();
    return event.clientY < r.top + r.height / 2 ? before : after;
  }
  return after;
}

export function imageFiles(list: FileList | null | undefined) {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}

function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    setTimeout(resolve, 8000);
  });
}

async function uploadToStorage(file: File, userId: string) {
  const supabase = createClient();
  const fromName = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  const ext = /^(png|jpe?g|gif|webp)$/.test(fromName) ? fromName : file.type.split("/")[1] || "png";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return null;
  return supabase.storage.from("uploads").getPublicUrl(path).data.publicUrl;
}

/** Upload images and drop them into the document at `at` (or near the caret). */
export function uploadImages(view: EditorView, files: File[], userId: string, at?: number) {
  for (const file of files) {
    if (!IMAGE_TYPES.includes(file.type)) {
      blob.say("I can add PNG, JPG, GIF or WebP images.", { mood: "worried" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      blob.say("That image is over 10 MB. Try a smaller one?", { mood: "worried" });
      continue;
    }
    void uploadOne(view, file, userId, at);
  }
}

async function uploadOne(view: EditorView, file: File, userId: string, at?: number) {
  const id = crypto.randomUUID();
  const preview = URL.createObjectURL(file);
  const pos = at ?? insertionPos(view.state);
  view.dispatch(view.state.tr.setMeta(uploadKey, { add: { id, pos, src: preview } } satisfies UploadMeta));

  const url = await uploadToStorage(file, userId);
  if (url) await preload(url);
  if (view.isDestroyed) return URL.revokeObjectURL(preview);

  const { state } = view;
  const tr = state.tr.setMeta(uploadKey, { remove: { id } } satisfies UploadMeta);
  const target = findPlaceholder(state, id);
  if (url && target !== null) {
    const alt = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 120);
    tr.insert(target, state.schema.nodes.image.create({ src: url, alt }));
  }
  view.dispatch(tr);
  URL.revokeObjectURL(preview);
  if (!url) blob.say("That upload didn't work. Check your connection and try again?", { mood: "worried" });
}
