"use client";

import { motion } from "motion/react";
import { ArrowRight, Check, Eye, FileText, Folder, FolderKanban, PenLine, Presentation, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { BlobMark } from "@/components/blob/BlobMark";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Button } from "@/components/ui/Button";
import { useLocale, useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import { shareText } from "@/i18n/messages/share";
import { createClient } from "@/lib/supabase/client";
import type { MemberRole, PageKind } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

/** What invite_preview returns (migration 0010). */
export type InvitePreview =
  | {
      ok: true;
      type: "page" | "project";
      id: string;
      title: string | null;
      kind: PageKind | "project";
      role: MemberRole;
      from: string;
      /** Your role there already, if any. */
      member: "owner" | MemberRole | null;
    }
  | { ok: false; reason: string };

const KIND_ICON: Record<string, LucideIcon> = { note: FileText, deck: Presentation, folder: Folder, cv: FileText, project: FolderKanban };

/** The invite page: what you're invited to, by whom and what you may do there, then "Join". */
export function JoinView({ token, preview, me }: { token: string; preview: InvitePreview; me: string }) {
  const t = useMessages(shareText);
  const j = t.join;
  const untitledProject = useMessages(projectsText).untitled;
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const ok = preview.ok;
  const href = ok ? (preview.type === "project" ? `/projects/${preview.id}` : `/p/${preview.id}`) : "/home";
  const title = ok ? (preview.kind === "project" ? preview.title?.trim() || untitledProject : pageTitle(preview.title, preview.kind, locale)) : "";
  const already = ok && preview.member !== null && !(preview.member === "viewer" && preview.role === "editor");
  const Icon = ok ? (KIND_ICON[preview.kind] ?? FileText) : FileText;

  async function join() {
    setBusy(true);
    setError(false);
    const { data, error } = await createClient().rpc("accept_invite", { p_token: token });
    const result = data as { ok?: boolean; type?: string; id?: string } | null;
    if (error || !result?.ok || !result.id) {
      setBusy(false);
      setError(true);
      return;
    }
    router.push(result.type === "project" ? `/projects/${result.id}` : `/p/${result.id}`);
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-paper">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]" />
      <header className="relative flex items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link href="/home" className="flex h-9 items-center gap-2 rounded-lg">
          <BlobMark size={26} />
          <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
        </Link>
        <LanguageSwitch compact />
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 pb-12 pt-2 sm:pt-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} className="w-full max-w-[420px]">
          <div className="flex justify-center">
            <Blob size={104} mood={ok ? (already ? "happy" : "excited") : "worried"} />
          </div>
          <section className="mt-2 rounded-3xl border border-line bg-raised p-6 shadow-pop sm:p-7">
            {ok ? (
              <>
                <p className="text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{j.metaTitle}</p>
                <h1 className="mt-1 text-balance text-center font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">
                  {preview.from.trim() ? j.invitedBy(preview.from.trim()) : j.invited}
                </h1>

                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink" title={title}>
                      {title}
                    </span>
                    <span className="block text-[12.5px] text-ink-3">{j.kinds[preview.kind] ?? ""}</span>
                  </span>
                </div>

                <p className="mt-3 flex items-start gap-2 px-1 text-[13.5px] leading-snug text-ink-2">
                  {already ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                  ) : preview.role === "editor" ? (
                    <PenLine className="mt-0.5 size-4 shrink-0 text-ink-3" />
                  ) : (
                    <Eye className="mt-0.5 size-4 shrink-0 text-ink-3" />
                  )}
                  {already ? j.alreadyIn : preview.member === "viewer" ? j.upgrade : j.youCan[preview.role]}
                </p>

                {error && (
                  <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
                    {j.errJoin}
                  </p>
                )}

                {already ? (
                  <Button variant="primary" size="lg" className="mt-5 w-full" onClick={() => router.push(href)}>
                    {j.open} <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button variant="blob" size="lg" className="mt-5 w-full" loading={busy} onClick={join} autoFocus>
                    {j.join} <ArrowRight className="size-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <h1 className="text-center font-display text-[21px] font-bold tracking-[-0.02em]">{j.problem}</h1>
                <p className="mt-2 text-balance text-center text-[14px] leading-relaxed text-ink-2">{j.reasons[preview.reason] ?? j.reasons.unknown}</p>
                <Button variant="primary" size="lg" className="mt-5 w-full" onClick={() => router.push("/home")}>
                  {j.toBlob}
                </Button>
              </>
            )}
          </section>
          <p className={cn("mt-4 text-center text-[12.5px] text-ink-3")}>
            {me && <>{j.signedInAs(me)} · </>}
            <button type="button" onClick={signOut} className="font-medium text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink hover:decoration-ink">
              {j.notYou}
            </button>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
