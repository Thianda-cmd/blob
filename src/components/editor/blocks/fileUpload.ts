import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { blob } from "@/components/blob/bus";
import type { NoteBlocksText } from "@/i18n/messages/noteBlocks";
import { MAX_FILE_BYTES, uploadFile } from "@/lib/files";
import { insertionPos } from "../imageUpload";

// Files attached to a note (PDFs, worksheets, audio…) live in the private files bucket under the
// note ("page/<id>/…"), so everyone the note is shared with can open them, and nobody else.

type FileText = NoteBlocksText["file"];

/** What the files bucket takes (migration 0010), by type or, when the browser gives none, by ending. */
const ALLOWED =
  /^(image\/|audio\/|video\/(mp4|webm|quicktime)$|application\/pdf$|text\/(plain|csv|markdown)$|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml|spreadsheetml|presentationml)\.|vnd\.ms-excel$|vnd\.ms-powerpoint$|vnd\.oasis\.opendocument\.(text|spreadsheet|presentation)$|zip$|x-zip-compressed$|vnd\.apple\.(pages|numbers|keynote)$))/;
const BY_ENDING: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  zip: "application/zip",
  pages: "application/vnd.apple.pages",
  numbers: "application/vnd.apple.numbers",
  key: "application/vnd.apple.keynote",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  heic: "image/heic",
};

/**
 * A name storage accepts: object keys must be plain ASCII ("Brüche.pdf" would be refused). The note
 * keeps showing the real name.
 */
export function storageName(name: string) {
  const plain = name
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ ()-]/g, "_")
    .trim();
  return plain || "file";
}

/** The file with a type the bucket accepts, or null when it can't be attached. */
export function attachable(file: File): File | null {
  const ending = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = file.type || BY_ENDING[ending] || "";
  if (!ALLOWED.test(type)) return null;
  return file.type ? file : new File([file], file.name, { type });
}

const key = new PluginKey<DecorationSet>("fileUpload");
type Meta = { add?: { id: string; pos: number; name: string; label: string }; remove?: { id: string } };

function placeholderDOM(name: string, label: string) {
  const card = document.createElement("div");
  card.className = "blob-file-uploading";
  card.contentEditable = "false";
  const spin = document.createElement("span");
  spin.className = "blob-upload-spinner";
  const title = document.createElement("span");
  title.className = "blob-file-uploading-name";
  title.textContent = name;
  const note = document.createElement("span");
  note.className = "blob-file-uploading-note";
  note.textContent = label;
  card.append(spin, title, note);
  return card;
}

/** Shows "Uploading…" where a file is about to land, without touching the document. */
export const FileUploadPlaceholder = Extension.create({
  name: "fileUploadPlaceholder",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            let next = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(key) as Meta | undefined;
            if (meta?.add) {
              const { id, pos, name, label } = meta.add;
              next = next.add(tr.doc, [Decoration.widget(pos, () => placeholderDOM(name, label), { id, key: `file-${id}`, side: -1 })]);
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
            return key.getState(state);
          },
        },
      }),
    ];
  },
});

/** Upload files to the note and drop them in as file blocks at `at` (or near the caret). */
export function uploadNoteFiles(view: EditorView, files: File[], pageId: string, text: FileText, at?: number) {
  for (const raw of files) {
    if (raw.size > MAX_FILE_BYTES) {
      blob.say(text.tooBig, { mood: "worried" });
      continue;
    }
    const file = attachable(raw);
    if (!file) {
      blob.say(text.badType, { mood: "worried" });
      continue;
    }
    void uploadOne(view, file, pageId, text, at);
  }
}

async function uploadOne(view: EditorView, file: File, pageId: string, text: FileText, at?: number) {
  const id = crypto.randomUUID();
  const pos = at ?? insertionPos(view.state);
  view.dispatch(view.state.tr.setMeta(key, { add: { id, pos, name: file.name, label: text.uploading } } satisfies Meta));
  const stored = await uploadFile({ type: "page", id: pageId }, new File([file], storageName(file.name), { type: file.type }));
  if (view.isDestroyed) return;
  const { state } = view;
  const tr = state.tr.setMeta(key, { remove: { id } } satisfies Meta);
  const found = key.getState(state)?.find(undefined, undefined, (spec) => spec.id === id);
  const target = found?.length ? found[0].from : null;
  if (stored && target !== null) {
    tr.insert(target, state.schema.nodes.file.create({ path: stored.path, name: file.name.slice(0, 200), size: stored.size, mime: stored.mime }));
  }
  view.dispatch(tr);
  if (!stored) {
    blob.say(text.failed, { mood: "worried" });
    blob.react("shake", "worried");
  }
}
