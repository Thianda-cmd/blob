// The import's Web Worker: reads a spreadsheet file away from the page (readFile.ts), so a big or
// hostile file can't freeze the editor, and the page can stop it when it takes too long. Started
// by src/components/sheet/importFile.ts. It says "ready" first, so the page can tell a worker
// that couldn't load (then it reads the file itself) from one that failed while reading.

import { readSheetBytes, type ReadJob, type ReadReply } from "./readFile";

const reply = (message: ReadReply) => postMessage(message);

addEventListener("message", (e: MessageEvent<ReadJob>) => {
  const { bytes, name, locale, opts } = e.data;
  void readSheetBytes(new Uint8Array(bytes), name, locale, opts).then((result) => reply({ result }));
});
reply({ ready: true });
