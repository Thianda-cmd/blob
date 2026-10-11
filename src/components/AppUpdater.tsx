"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Download, ExternalLink, RotateCw, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { BlobMark } from "@/components/blob/BlobMark";
import { Button } from "@/components/ui/Button";
import { useLocale, useMessages } from "@/i18n/client";
import { nativeText } from "@/i18n/messages/native";
import { blobApp, isPhoneApp, openOutside } from "@/lib/native";
import {
  check,
  CHECK_EVERY_MS,
  download,
  install,
  later,
  retry,
  serverUpdateState,
  subscribeUpdate,
  tuck,
  updateState,
  whatsNew,
  type UpdatePhase,
} from "@/lib/update/store";
import { cn } from "@/lib/utils";

const noSubscribe = () => () => {};
const inDesktopApp = () => {
  const app = blobApp();
  return !!app && !isPhoneApp(app);
};

const MOODS: Partial<Record<UpdatePhase, BlobMood>> = {
  available: "happy",
  downloading: "thinking",
  ready: "excited",
  installing: "sleepy",
  error: "worried",
};

/** Pages where nothing may pop up (a presentation, a picture inside another page). */
const QUIET = /^\/(present|embed)(\/|$)/;

/**
 * Blob for computers tells you when there's a new version: a card in the corner with what's new,
 * and on "Update now" the app fetches it (a jelly progress bar, which can fold into a round button
 * in the corner), then restarts as the new version when you say so. Apps from before they could
 * update themselves get the download page instead. In a browser and on phones it does nothing.
 */
export function AppUpdater() {
  const desktop = useSyncExternalStore(noSubscribe, inDesktopApp, () => false);
  const s = useSyncExternalStore(subscribeUpdate, updateState, serverUpdateState);
  const native = useMessages(nativeText);
  const t = native.update;
  const locale = useLocale();
  const pathname = usePathname();
  const blobRef = useRef<BlobHandle>(null);

  // Look a little after starting (the page first), then every few hours while Blob stays open.
  useEffect(() => {
    if (!desktop) return;
    const first = setTimeout(() => void check(), 5000);
    const every = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [desktop]);

  useEffect(() => {
    if (s.phase === "ready") blobRef.current?.celebrate();
    if (s.phase === "error") blobRef.current?.shake();
  }, [s.phase]);

  const update = s.update;
  const show = desktop && !!update && !s.hidden && !QUIET.test(pathname) && s.phase !== "checking";
  const mb = (bytes: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: bytes < 10 * 1048576 ? 1 : 0 }).format(bytes / 1048576);
  const pct = s.total > 0 ? Math.min(100, Math.round((s.downloaded / s.total) * 100)) : 0;
  const notes = update ? whatsNew(update.notes, locale) : [];
  const page = () => update && void openOutside(update.page);

  const title =
    s.phase === "downloading"
      ? t.downloadingTitle
      : s.phase === "ready"
        ? t.readyTitle
        : s.phase === "installing"
          ? t.installingTitle
          : s.phase === "error"
            ? t.errorTitle
            : t.newTitle;

  return (
    <AnimatePresence>
      {show && update && s.tucked && (
        <motion.button
          key="pill"
          type="button"
          onClick={() => tuck(false)}
          title={t.show}
          aria-label={`${t.show} (${pct} %)`}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed bottom-4 right-4 z-[70] grid size-13 place-items-center rounded-full border border-line bg-raised shadow-pop hover:bg-hover"
        >
          <Ring pct={pct} />
          <BlobMark size={26} />
        </motion.button>
      )}
      {show && update && !s.tucked && (
        <motion.aside
          key="card"
          role="dialog"
          aria-labelledby="app-update-title"
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96, transition: { duration: 0.18 } }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-32px))] origin-bottom-right overflow-hidden rounded-2xl border border-line bg-raised shadow-pop"
        >
          {/* Blob on a little stage, and where you're going: 0.2.0 → 0.3.0. */}
          <div className="relative flex h-[100px] items-end gap-1 overflow-hidden bg-[radial-gradient(120%_150%_at_0%_100%,var(--blob-soft),transparent_72%)] px-2">
            <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(var(--line-2)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
            <div className="relative -mb-2 shrink-0">
              <Blob ref={blobRef} size={96} mood={MOODS[s.phase] ?? "happy"} arms track />
            </div>
            <div className="relative mb-6 flex items-center gap-1.5 text-[12px] font-medium tabular-nums">
              <span className="rounded-full border border-line bg-raised/80 px-2.5 py-0.5 text-ink-3">{update.current}</span>
              <ArrowRight className="size-3.5 text-ink-3" />
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 500, damping: 18 }}
                className="rounded-full bg-blob px-2.5 py-0.5 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]"
              >
                {update.version}
              </motion.span>
            </div>
            {s.phase !== "installing" && (
              <button
                type="button"
                onClick={() => (s.phase === "downloading" ? tuck(true) : later())}
                aria-label={s.phase === "downloading" ? t.hide : native.close}
                className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="px-4 pb-4 pt-3">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={s.phase}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <h2 id="app-update-title" className="font-display text-[16.5px] font-semibold tracking-[-0.015em] text-ink">
                  {title}
                </h2>

                {s.phase === "available" && (
                  <>
                    <p className="mt-0.5 text-[13px] text-ink-2">
                      {update.installable ? t.newBody(update.version) : s.legacy ? t.legacyBody : t.systemBody}
                    </p>
                    {notes.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t.whatsNew}</div>
                        <ul className="mt-1.5 space-y-1.5">
                          {notes.slice(0, 3).map((n, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 + i * 0.07 }}
                              className="flex gap-2 text-[13px] leading-snug text-ink-2"
                            >
                              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-blob" />
                              <span className="line-clamp-2">
                                {n.title && <b className="font-medium text-ink">{n.title}</b>}
                                {n.title && n.text ? ": " : ""}
                                {n.text}
                              </span>
                            </motion.li>
                          ))}
                        </ul>
                        <button type="button" onClick={page} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-blob-ink hover:underline">
                          {notes.length > 3 ? `${t.more(notes.length - 3)} · ${t.allChanges}` : t.allChanges}
                          <ExternalLink className="size-3" />
                        </button>
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="md" onClick={later}>
                        {t.later}
                      </Button>
                      {update.installable ? (
                        <Button variant="blob" size="md" onClick={() => void download()}>
                          <Download className="size-4" />
                          {t.updateNow}
                          <span className="font-normal opacity-75">· {t.size(mb(update.size))}</span>
                        </Button>
                      ) : (
                        <Button variant="blob" size="md" onClick={page}>
                          <Download className="size-4" />
                          {t.download}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {s.phase === "downloading" && (
                  <>
                    <p className="mt-0.5 text-[13px] text-ink-2">{t.downloadingBody}</p>
                    <JellyBar pct={pct} />
                    <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-ink-3">
                      <span>{pct} %</span>
                      <span>{t.progress(mb(s.downloaded), mb(s.total))}</span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="md" onClick={() => tuck(true)}>
                        {t.hide}
                      </Button>
                    </div>
                  </>
                )}

                {s.phase === "ready" && (
                  <>
                    <p className="mt-0.5 text-[13px] text-ink-2">{t.readyBody(update.version)}</p>
                    <JellyBar pct={100} done />
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="md" onClick={later}>
                        {t.later}
                      </Button>
                      <Button variant="blob" size="md" onClick={() => void install()}>
                        <RotateCw className="size-4" />
                        {t.restart}
                      </Button>
                    </div>
                  </>
                )}

                {s.phase === "installing" && (
                  <>
                    <p className="mt-0.5 text-[13px] text-ink-2">{t.installingBody}</p>
                    <JellyBar pct={100} done busy />
                  </>
                )}

                {s.phase === "error" && (
                  <>
                    <p className="mt-0.5 text-[13px] text-ink-2">{t.errorBody}</p>
                    {s.error && <p className="mt-1.5 line-clamp-2 font-mono text-[11.5px] text-ink-3">{s.error}</p>}
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="md" onClick={page}>
                        {t.downloadPage}
                        <ExternalLink className="size-3.5" />
                      </Button>
                      <Button
                        variant="blob"
                        size="md"
                        onClick={() => {
                          retry();
                          void download();
                        }}
                      >
                        {t.retry}
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** The download as purple jelly filling up, with a shine running through it. */
function JellyBar({ pct, done, busy }: { pct: number; done?: boolean; busy?: boolean }) {
  return (
    <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-blob-soft" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <motion.div
        className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-[linear-gradient(90deg,var(--blob-light),var(--blob)_55%,var(--blob-deep))] shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]"
        initial={false}
        animate={{ width: `${Math.max(pct, 4)}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      >
        {(!done || busy) && (
          <motion.span
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ repeat: Infinity, duration: busy ? 1 : 1.6, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}

/** Progress around the folded button. */
function Ring({ pct }: { pct: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 52 52" className={cn("pointer-events-none absolute inset-0 size-full -rotate-90")} aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--blob-soft)" strokeWidth="3" />
      <motion.circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="var(--blob)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - pct / 100) }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
    </svg>
  );
}
