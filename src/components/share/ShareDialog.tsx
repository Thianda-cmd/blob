"use client";

import { format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Copy, Link2, LogOut, RefreshCw, Trash2, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { dateLocale } from "@/i18n/format";
import { shareText } from "@/i18n/messages/share";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole, Invite, Member, MemberRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, personName, type Person } from "./Avatar";
import { loadMembers, type ShareTarget } from "./useMembers";

type Row = Member & {
  /** Pages: the member was added on a page above this one (title), so they are managed there. */
  via: string | null;
  /** Where the membership row lives (pages: this page or one above it). */
  at: string;
};

type Data = { role: AccessRole | null; members: Row[]; invite: Invite | null; people: Person[] };

/**
 * Share a page or project: who has access (owners change roles and remove people, members can leave),
 * an invite link (create with a role, copy, see when it expires, renew, delete) and adding people you
 * already work with. `onChanged` runs after every change (refresh the route there); `onLeft` after you left.
 */
export function ShareDialog({
  open,
  onClose,
  target,
  name,
  ancestors = [],
  onChanged,
  onLeft,
}: {
  open: boolean;
  onClose: () => void;
  target: ShareTarget;
  /** The page's or project's title, for the heading. */
  name: string;
  /** Pages: the pages above this one, nearest first, so members added there show where they come from. */
  ancestors?: { id: string; title: string }[];
  onChanged?: () => void;
  onLeft?: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="share-title" className="max-w-[520px]">
      {open && <SharePanel target={target} name={name} ancestors={ancestors} onClose={onClose} onChanged={onChanged} onLeft={onLeft} />}
    </Dialog>
  );
}

function SharePanel({
  target,
  name,
  ancestors,
  onClose,
  onChanged,
  onLeft,
}: {
  target: ShareTarget;
  name: string;
  ancestors: { id: string; title: string }[];
  onClose: () => void;
  onChanged?: () => void;
  onLeft?: () => void;
}) {
  const t = useMessages(shareText);
  const { userId } = useWorkspace();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ancestorKey = ancestors.map((a) => a.id).join(",");
  const ancestorsRef = useRef(ancestors);
  useEffect(() => {
    ancestorsRef.current = ancestors;
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const chain = [target.id, ...ancestorKey.split(",").filter(Boolean)];
    const [access, invites, people, rows] = await Promise.all([
      loadMembers(target),
      supabase
        .from("invites")
        .select("*")
        .eq("target_type", target.type)
        .eq("target_id", target.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.rpc("my_collaborators"),
      target.type === "page"
        ? supabase.from("page_members").select("page_id, user_id").in("page_id", chain)
        : Promise.resolve({ data: [] as { page_id: string; user_id: string }[] }),
    ]);
    const at = new Map<string, string>();
    for (const r of (rows.data ?? []) as { page_id: string; user_id: string }[]) {
      // The nearest page wins (this page before the ones above it).
      const prev = at.get(r.user_id);
      if (!prev || chain.indexOf(r.page_id) < chain.indexOf(prev)) at.set(r.user_id, r.page_id);
    }
    const members: Row[] = access.members.map((m) => {
      const where = target.type === "page" ? (at.get(m.user_id) ?? target.id) : target.id;
      const via = where !== target.id ? (ancestorsRef.current.find((a) => a.id === where)?.title ?? null) : null;
      return { ...m, at: where, via };
    });
    const inside = new Set(members.map((m) => m.user_id));
    const seen = new Set<string>();
    const others = ((people.data ?? []) as Person[]).filter((p) => !inside.has(p.user_id) && !seen.has(p.user_id) && seen.add(p.user_id));
    setData({ role: access.role, members, invite: ((invites.data ?? [])[0] as Invite | undefined) ?? null, people: others });
  }, [target, ancestorKey]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Run a change, then reload and tell the caller. */
  async function run(key: string, fn: () => Promise<boolean>, success?: string) {
    setBusy(key);
    const ok = await fn().catch(() => false);
    setBusy(null);
    if (!ok) {
      blob.say(t.error, { mood: "worried" });
      blob.react("shake", "worried");
    } else if (success) {
      blob.say(success, { mood: "happy" });
    }
    await load();
    if (ok) onChanged?.();
    return ok;
  }

  const supabase = createClient();
  const table = target.type === "page" ? "page_members" : "project_members";
  const key = target.type === "page" ? "page_id" : "project_id";
  const manager = data?.role === "owner" || data?.role === "editor";
  const owner = data?.role === "owner";

  const createInvite = (role: MemberRole) =>
    run("invite", async () => {
      const { error } = await supabase.from("invites").insert({ target_type: target.type, target_id: target.id, role });
      return !error;
    });

  /**
   * Delete the links you may delete here: the owner every link of the page or project (older ones
   * too, which the dialog doesn't show), an editor the links they made.
   */
  const deleteLinks = async () => !(await supabase.from("invites").delete().eq("target_type", target.type).eq("target_id", target.id)).error;

  const renewInvite = (old: Invite) =>
    run("renew", async () => {
      if (!(await deleteLinks())) return false;
      const res = await supabase.from("invites").insert({ target_type: target.type, target_id: target.id, role: old.role });
      return !res.error;
    });

  const deleteInvite = () => run("revoke", deleteLinks, t.linkDeleted);

  const setInviteRole = (old: Invite, role: MemberRole) =>
    run("invite-role", async () => !(await supabase.from("invites").update({ role }).eq("token", old.token)).error);

  const addPerson = (p: Person, role: MemberRole) =>
    run(
      `add:${p.user_id}`,
      async () => {
        const { data: ok, error } = await supabase.rpc("add_member", { p_type: target.type, p_target: target.id, p_user: p.user_id, p_role: role });
        return !error && ok === true;
      },
      t.added(personName(p, t.someone)),
    );

  const setRole = (m: Row, role: MemberRole) =>
    run(`role:${m.user_id}`, async () => !(await supabase.from(table).update({ role }).eq(key, m.at).eq("user_id", m.user_id)).error);

  const removeMember = (m: Row) =>
    run(`remove:${m.user_id}`, async () => !(await supabase.from(table).delete().eq(key, m.at).eq("user_id", m.user_id)).error, t.removed(personName(m, t.someone)));

  async function leave(m: Row) {
    setBusy("leave");
    const { error } = await supabase.from(table).delete().eq(key, m.at).eq("user_id", userId);
    setBusy(null);
    if (error) {
      blob.say(t.error, { mood: "worried" });
      return;
    }
    onClose();
    onLeft?.();
  }

  return (
    <div className="flex max-h-[calc(100dvh-12vh-16px)] flex-col max-sm:max-h-[calc(100dvh-24px)]">
      <header className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-4">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-blob-soft text-blob-ink">
          <Users className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="share-title" className="line-clamp-2 break-words font-display text-[18px] font-bold leading-snug tracking-[-0.015em]" title={t.title(name)}>
            {t.title(name)}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{target.type === "page" ? t.explainPage : t.explainProject}</p>
        </div>
        <IconButton label={t.close} onClick={onClose} className="-mr-1.5 -mt-1">
          <X className="size-4" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        {!data ? (
          <LoadingRows />
        ) : (
          <>
            {manager && (
              <InviteSection
                invite={data.invite}
                canManage={!!data.invite && (owner || data.invite.created_by === userId)}
                busy={busy}
                onCreate={createInvite}
                onRenew={renewInvite}
                onDelete={deleteInvite}
                onRole={setInviteRole}
              />
            )}

            <section aria-labelledby="share-members">
              <SectionTitle id="share-members" count={data.members.length}>
                {t.membersTitle}
              </SectionTitle>
              <ul className="-mx-1.5 space-y-0.5">
                <AnimatePresence initial={false}>
                  {data.members.map((m) => (
                    <motion.li
                      key={m.user_id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    >
                      <MemberRow
                        member={m}
                        me={m.user_id === userId}
                        canManage={owner && m.role !== "owner" && !m.via && m.user_id !== userId}
                        busy={busy}
                        onRole={(role) => setRole(m, role)}
                        onRemove={() => removeMember(m)}
                        onLeave={() => leave(m)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>

            {manager && data.people.length > 0 && (
              <section aria-labelledby="share-people">
                <SectionTitle id="share-people">{t.peopleTitle}</SectionTitle>
                <ul className="-mx-1.5 space-y-0.5">
                  {data.people.map((p) => (
                    <li key={p.user_id}>
                      <PersonRow person={p} busy={busy === `add:${p.user_id}`} onAdd={(role) => addPerson(p, role)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!manager && <p className="rounded-xl bg-hover/70 px-3 py-2.5 text-[12.5px] text-ink-2">{t.viewerNote}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ id, children, count }: { id: string; children: ReactNode; count?: number }) {
  return (
    <h3 id={id} className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
      {children}
      {count !== undefined && <span className="rounded-full bg-hover px-1.5 text-[11px] font-medium tabular-nums leading-[18px] text-ink-3">{count}</span>}
    </h3>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 pt-1" aria-hidden>
      <div className="h-[104px] rounded-xl bg-hover/70" />
      {[0.5, 0.36].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-hover" />
          <div className="h-3 rounded bg-hover" style={{ width: `${w * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Invite link
   --------------------------------------------------------------------------- */

function InviteSection({
  invite,
  canManage,
  busy,
  onCreate,
  onRenew,
  onDelete,
  onRole,
}: {
  invite: Invite | null;
  /** The owner manages every link; an editor only the links they made. */
  canManage: boolean;
  busy: string | null;
  onCreate: (role: MemberRole) => void;
  onRenew: (invite: Invite) => void;
  onDelete: () => void;
  onRole: (invite: Invite, role: MemberRole) => void;
}) {
  const t = useMessages(shareText);
  const locale = useLocale();
  const [role, setRole] = useState<MemberRole>("editor");
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const url = invite && typeof window !== "undefined" ? `${window.location.origin}/join/${invite.token}` : "";

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      blob.say(t.linkCopied, { mood: "happy" });
      blob.react("jump", "happy");
    } catch {
      // No clipboard (an old browser, a frame): select the text so a long press copies it.
      input.current?.select();
    }
  }

  return (
    <section aria-labelledby="share-link" className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-blob-ink" />
        <h3 id="share-link" className="text-[13.5px] font-semibold text-ink">
          {t.linkTitle}
        </h3>
      </div>
      {invite ? (
        <>
          <div className="mt-2.5 flex gap-1.5">
            <input
              ref={input}
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t.linkLabel}
              className="h-9 min-w-0 flex-1 truncate rounded-lg border border-line bg-raised px-2.5 font-mono text-[12px] text-ink-2 outline-none focus:border-blob"
            />
            <Button variant="blob" size="md" onClick={copy} className="h-9 shrink-0 px-3" aria-live="polite">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t.copied : t.copy}
            </Button>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-[12.5px] text-ink-2">
            <span>{t.linkRole}</span>
            {canManage ? (
              <RoleMenu value={invite.role} onChange={(r) => onRole(invite, r)} busy={busy === "invite-role"} compact />
            ) : (
              <span className="font-medium text-ink">{t.linkRoleShort[invite.role]}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[12px] text-ink-3">
            <span>
              {t.validUntil(format(new Date(invite.expires_at), t.expiryFormat, { locale: dateLocale(locale) }))}
              {invite.uses > 0 && ` · ${t.used(invite.uses)}`}
            </span>
            {canManage && (
              <span className="ml-auto flex items-center gap-0.5">
                <button
                  onClick={() => onRenew(invite)}
                  disabled={busy === "renew"}
                  title={t.newLinkHint}
                  className="flex h-7 items-center gap-1 rounded-md px-1.5 text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-50 [@media(hover:none)]:h-8"
                >
                  <RefreshCw className={cn("size-3.5", busy === "renew" && "animate-spin")} /> {t.newLink}
                </button>
                <button
                  onClick={onDelete}
                  disabled={busy === "revoke"}
                  className="flex h-7 items-center gap-1 rounded-md px-1.5 text-ink-3 hover:bg-danger/10 hover:text-danger disabled:opacity-50 [@media(hover:none)]:h-8"
                >
                  <Trash2 className="size-3.5" /> {t.deleteLink}
                </button>
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{t.linkHint}</p>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-3" aria-label={t.howTitle}>
            {t.how.map((step, i) => (
              <li key={step} className="flex items-center gap-2 rounded-lg bg-raised px-2 py-1.5 text-[12px] leading-tight text-ink-2 shadow-card">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-blob-soft text-[11px] font-bold text-blob-ink">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
            <Button variant="blob" onClick={() => onCreate(role)} loading={busy === "invite"}>
              <Link2 className="size-4" /> {t.createLink}
            </Button>
            <span className="flex items-center gap-1 text-[12.5px] text-ink-2">
              {t.linkRole}
              <RoleMenu value={role} onChange={setRole} compact />
            </span>
          </div>
        </>
      )}
    </section>
  );
}

/** "can edit ▾" / "kann bearbeiten ▾": a small menu with the two roles and what they mean. */
export function RoleMenu({
  value,
  onChange,
  busy,
  compact,
  label,
}: {
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  busy?: boolean;
  /** Lowercase verb after "People with the link can" instead of the full role name. */
  compact?: boolean;
  label?: string;
}) {
  const t = useMessages(shareText);
  return (
    <Popover
      align="end"
      // Above the share dialog (z-70).
      className="z-[80]! w-[230px]"
      trigger={(props) => (
        <button
          {...props}
          aria-label={label}
          disabled={busy}
          className="flex h-7 items-center gap-1 rounded-md px-1.5 font-medium text-ink hover:bg-hover disabled:opacity-50 aria-expanded:bg-hover [@media(hover:none)]:h-8"
        >
          {compact ? t.linkRoleShort[value] : t.roles[value]}
          <ChevronDown className="size-3.5 text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <div role="none">
          {(["editor", "viewer"] as const).map((r) => (
            <button
              key={r}
              role="menuitemradio"
              aria-checked={value === r}
              onClick={() => {
                close();
                if (r !== value) onChange(r);
              }}
              className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover"
            >
              <span className="grid size-4 shrink-0 place-items-center pt-0.5">{value === r && <Check className="size-3.5 text-blob" strokeWidth={2.5} />}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{t.roles[r]}</span>
                <span className="block text-[11.5px] text-ink-3">{t.roleHints[r]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/* ---------------------------------------------------------------------------
   People
   --------------------------------------------------------------------------- */

function MemberRow({
  member,
  me,
  canManage,
  busy,
  onRole,
  onRemove,
  onLeave,
}: {
  member: Row;
  me: boolean;
  canManage: boolean;
  busy: string | null;
  onRole: (role: MemberRole) => void;
  onRemove: () => void;
  onLeave: () => void;
}) {
  const t = useMessages(shareText);
  const [asking, setAsking] = useState(false);
  const name = personName(member, t.someone);
  return (
    <div className="flex min-h-11 items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-hover/50">
      <Avatar person={member} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-ink" title={name}>
          {name}
          {me && <span className="font-normal text-ink-3"> ({t.you})</span>}
        </div>
        {member.via && <div className="truncate text-[11.5px] text-ink-3">{t.via(member.via)}</div>}
      </div>
      {asking ? (
        <span className="flex shrink-0 items-center gap-1 text-[12.5px]">
          <span className="text-ink-2 max-sm:sr-only">{me ? t.leaveAsk : t.removeAsk(name)}</span>
          <Button
            size="sm"
            variant="danger"
            loading={busy === "leave" || busy === `remove:${member.user_id}`}
            onClick={() => {
              setAsking(false);
              if (me) onLeave();
              else onRemove();
            }}
          >
            {me ? t.leave : t.remove}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
            {t.no}
          </Button>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-0.5 text-[12.5px]">
          {canManage ? (
            <RoleMenu value={member.role as MemberRole} onChange={onRole} busy={busy === `role:${member.user_id}`} label={t.changeRole(name)} />
          ) : (
            <span className="px-1.5 text-ink-3">{t.roles[member.role]}</span>
          )}
          {canManage && (
            <IconButton label={t.remove} onClick={() => setAsking(true)} className="hover:bg-danger/10 hover:text-danger">
              <X className="size-4" />
            </IconButton>
          )}
          {me && member.role !== "owner" && (
            <IconButton label={t.leave} onClick={() => setAsking(true)} className="hover:bg-danger/10 hover:text-danger">
              <LogOut className="size-4" />
            </IconButton>
          )}
        </span>
      )}
    </div>
  );
}

function PersonRow({ person, busy, onAdd }: { person: Person; busy: boolean; onAdd: (role: MemberRole) => void }) {
  const t = useMessages(shareText);
  const [role, setRole] = useState<MemberRole>("editor");
  const name = personName(person, t.someone);
  return (
    <div className="flex min-h-11 items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-hover/50">
      <Avatar person={person} size={32} />
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink" title={name}>
        {name}
      </span>
      <RoleMenu value={role} onChange={setRole} />
      <Button size="sm" onClick={() => onAdd(role)} loading={busy} aria-label={t.addAs(name)}>
        <UserPlus className="size-3.5" /> <span className="max-sm:sr-only">{t.add}</span>
      </Button>
    </div>
  );
}
