"use client";

import { Check, Code2, Copy, ExternalLink, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Popover } from "@/components/ui/Menu";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { showText } from "@/i18n/messages/show";
import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import type { TopicMeta } from "@/learn/catalog";
import { embedHref, showHref } from "@/learn/showcase";
import type { Level } from "@/learn/types";
import { cn } from "@/lib/utils";

/**
 * The code a teacher pastes into their own site: the iframe (in the language they share it in) and an optional
 * script that lets the frame grow with the picture (public/sdk/blob-embed.js). Without the script the frame
 * keeps its height and scrolls.
 */
export function embedCode(origin: string, path: string, title: string, locale: Locale) {
  const safe = title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return (
    `<iframe src="${origin}${path}?lang=${locale}" title="${safe} · Blob" width="100%" height="720" ` +
    `style="border:0;border-radius:16px;max-width:960px" loading="lazy" allow="fullscreen" data-blob-embed></iframe>\n` +
    `<script src="${origin}/sdk/blob-embed.js" async></script>`
  );
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share a lesson picture: its public page (no sign-in needed), opening it, and the embed code.
 * `compact` shows only the icon (next to a lesson step's title).
 */
export function ShareVisual({
  topic,
  level,
  id,
  title,
  compact,
  className,
}: {
  topic: Pick<TopicMeta, "subject" | "slug">;
  level: Level;
  id: string;
  title: Text;
  compact?: boolean;
  className?: string;
}) {
  const t = useMessages(showText);
  const tt = useText();
  const name = tt(title);
  return (
    <Popover
      align="end"
      role="dialog"
      label={t.shareTitle}
      className="w-[min(360px,calc(100vw-24px))] p-0"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-haspopup="dialog"
          aria-label={t.shareLabel(name)}
          title={compact ? t.share : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink",
            compact ? "size-9 justify-center" : "h-8.5 px-2.5",
            className,
          )}
        >
          <Share2 className="size-4" />
          {!compact && <span className="hidden sm:inline">{t.share}</span>}
        </button>
      )}
    >
      <SharePanel topic={topic} level={level} id={id} name={name} />
    </Popover>
  );
}

function SharePanel({ topic, level, id, name }: { topic: Pick<TopicMeta, "subject" | "slug">; level: Level; id: string; name: string }) {
  const t = useMessages(showText);
  const locale = useLocale();
  // Rendered only once the popover opens, so `window` is there.
  const origin = window.location.origin;
  const url = origin + showHref(topic, level, id);
  const code = embedCode(origin, embedHref(topic, level, id), name, locale);
  const field = useRef<HTMLInputElement>(null);
  // Focus goes into the panel (after it has found its place), so keys here belong to the panel.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [done, setDone] = useState<"link" | "code" | null>(null);
  const [showCode, setShowCode] = useState(false);
  const canShare = typeof navigator.share === "function";

  async function copyIt(what: "link" | "code") {
    if (await copy(what === "link" ? url : code)) {
      setDone(what);
      window.setTimeout(() => setDone((d) => (d === what ? null : d)), 1800);
    }
  }

  return (
    // data-own-keys and data-share-panel: while it is open, arrow keys and Enter don't move the lesson on.
    <div data-own-keys data-share-panel className="p-3.5 text-[13.5px]">
      <div className="font-semibold text-ink">{t.shareTitle}</div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{t.shareText}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <input
          ref={field}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t.publicLink}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 font-mono text-[12px] text-ink-2 outline-none focus:border-blob/60"
        />
        <button
          type="button"
          onClick={() => copyIt("link")}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-paper hover:bg-ink/88"
        >
          {done === "link" ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" />}
          <span aria-live="polite">{done === "link" ? t.copied : t.copyLink}</span>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <ExternalLink className="size-3.5" /> {t.openPage}
        </a>
        <button
          type="button"
          aria-expanded={showCode}
          onClick={() => setShowCode((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink aria-expanded:border-blob/50 aria-expanded:text-ink"
        >
          <Code2 className="size-3.5" /> {t.embed}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title: `${name} · Blob`, url }).catch(() => {})}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Share2 className="size-3.5" /> {t.shareVia}
          </button>
        )}
      </div>
      {showCode && (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] leading-snug text-ink-3">{t.embedHint}</p>
          <textarea
            readOnly
            value={code}
            rows={5}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t.embed}
            className="w-full resize-none rounded-lg border border-line bg-surface p-2 font-mono text-[11px] leading-snug text-ink-2 outline-none focus:border-blob/60"
          />
          <button
            type="button"
            onClick={() => copyIt("code")}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-paper hover:bg-ink/88"
          >
            {done === "code" ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" />}
            <span aria-live="polite">{done === "code" ? t.copied : t.copyEmbed}</span>
          </button>
        </div>
      )}
    </div>
  );
}
