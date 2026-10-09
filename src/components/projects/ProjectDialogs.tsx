"use client";

import { ArrowRight, CalendarDays, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { DuePicker } from "@/components/tasks/pickers";
import { Button, IconButton } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Textarea } from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { projectsText, type ProjectsText } from "@/i18n/messages/projects";
import { subjectColor } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";
import { formatDueLong } from "@/lib/tasks";
import type { Project } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { PROJECT_ICONS, STEP, TEMPLATES, TEMPLATE_IDS, boardColor, formatLabel, type TemplateId } from "./model";
import { ColorSwatches } from "./pickers";

/* ---------------------------------------------------------------------------
   Creating a project from a template
   --------------------------------------------------------------------------- */

type NewProject = { title: string; color: string; icon: string; subject_id: string | null; due_at: string | null; template: TemplateId };

/** Insert the project, its columns and the template's cards (in `t`'s language). Returns the id, or null. */
export async function createProject(input: NewProject, t: ProjectsText): Promise<string | null> {
  const supabase = createClient();
  const words = t.templates[input.template];
  const spec = TEMPLATES[input.template];
  const { data, error } = await supabase
    .from("projects")
    .insert({ title: input.title.trim().slice(0, 120), color: input.color, icon: input.icon, subject_id: input.subject_id, due_at: input.due_at })
    .select("id")
    .single();
  if (error || !data) return null;
  const projectId = (data as { id: string }).id;
  const columns = spec.columns.map((c, i) => ({
    id: uid(),
    project_id: projectId,
    title: (words.columns[c.key] ?? c.key).slice(0, 60),
    color: c.color,
    position: (i + 1) * STEP,
    done: !!c.done,
  }));
  const cols = await supabase.from("project_columns").insert(columns);
  if (cols.error) return projectId;
  const counters = columns.map(() => 0);
  const cards = spec.cards.map((card) => {
    const column = columns[card.column];
    counters[card.column] += 1;
    return {
      title: (words.cards[card.key] ?? card.key).slice(0, 200),
      kind: "project",
      project_id: projectId,
      column_id: column.id,
      position: counters[card.column] * STEP,
      done: column.done,
      priority: card.priority ?? 0,
      labels: (card.labels ?? []).map((l) => formatLabel(words.labels[l.key] ?? l.key, l.color)),
      checklist: (words.checklists[card.key] ?? []).slice(0, card.checklist ?? 0).map((text) => ({ id: uid(), text, done: false })),
      due_at: card.dueWithProject ? input.due_at : null,
    };
  });
  if (cards.length) await supabase.from("tasks").insert(cards);
  return projectId;
}

/* ---------------------------------------------------------------------------
   Pieces
   --------------------------------------------------------------------------- */

export function ProjectIcon({ project, size = 40, className }: { project: Pick<Project, "icon" | "color">; size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-[28%] leading-none", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        background: `color-mix(in oklab, ${boardColor(project.color)} 16%, var(--raised))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${boardColor(project.color)} 26%, transparent)`,
      }}
      aria-hidden
    >
      {project.icon || "📋"}
    </span>
  );
}

function IconGrid({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  const t = useMessages(projectsText).dialog;
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t.look}>
      {PROJECT_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          aria-label={t.icon(icon)}
          onClick={() => onChange(icon)}
          className={cn("grid size-9 place-items-center rounded-lg text-[18px] transition-[transform,background] hover:scale-105 hover:bg-hover", value === icon && "ring-2 ring-offset-1 ring-offset-raised")}
          style={value === icon ? { background: `color-mix(in oklab, ${boardColor(color)} 16%, transparent)`, ["--tw-ring-color" as string]: boardColor(color) } : undefined}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function SubjectSelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const t = useMessages(projectsText).dialog;
  const { subjects } = useWorkspace();
  const list = subjects.filter((s) => s.kind !== "notebook");
  return (
    <div className="relative">
      {value && (
        <span
          className="pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full"
          style={{ background: subjectColor(subjects.find((s) => s.id === value)?.color) }}
        />
      )}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={t.subject}
        className={cn(
          "h-9.5 w-full appearance-none rounded-lg border border-line bg-raised pr-8 text-[14px] text-ink outline-none transition-[border,box-shadow] hover:border-line-2 focus:border-blob",
          value ? "pl-7" : "pl-3",
        )}
      >
        <option value="">{t.noSubject}</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {s.emoji ? `${s.emoji} ` : ""}
            {s.name}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-ink-3" aria-hidden>
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function DueField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const t = useMessages(projectsText).dialog;
  const locale = useLocale();
  return (
    <DuePicker
      value={value}
      kind="project"
      align="start"
      onChange={onChange}
      // Above the dialog (z-70).
      className="z-[80]!"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex h-9.5 w-full items-center gap-2 rounded-lg border border-line bg-raised px-3 text-left text-[14px] text-ink hover:border-line-2 aria-expanded:border-blob"
        >
          <CalendarDays className="size-4 text-ink-3" />
          <span className={cn("truncate", !value && "text-ink-3")}>{value ? formatDueLong(value, locale) : t.noDue}</span>
        </button>
      )}
    />
  );
}

function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
      {children}
    </label>
  );
}

/* ---------------------------------------------------------------------------
   New project
   --------------------------------------------------------------------------- */

export function NewProjectDialog({ open, onClose, template }: { open: boolean; onClose: () => void; template?: TemplateId }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="new-project-title" className="max-w-[640px]! overflow-hidden">
      {open && <NewProjectForm key={template ?? "none"} onClose={onClose} initialTemplate={template ?? "referat"} />}
    </Dialog>
  );
}

function NewProjectForm({ onClose, initialTemplate }: { onClose: () => void; initialTemplate: TemplateId }) {
  const t = useMessages(projectsText);
  const d = t.dialog;
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string>(TEMPLATES[initialTemplate].color);
  const [icon, setIcon] = useState<string>(TEMPLATES[initialTemplate].icon);
  const [touched, setTouched] = useState(false);
  const [subject, setSubject] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spec = TEMPLATES[template];
  const words = t.templates[template];

  function pick(id: TemplateId) {
    setTemplate(id);
    // Until you choose your own look, the template's comes along.
    if (!touched) {
      setColor(TEMPLATES[id].color);
      setIcon(TEMPLATES[id].icon);
    }
  }

  async function create() {
    if (busy) return;
    setBusy(true);
    const name = title.trim() || (template === "blank" ? t.untitled : words.name);
    const id = await createProject({ title: name, color, icon, subject_id: subject, due_at: due, template }, t);
    if (!id) {
      setBusy(false);
      blob.say(t.errCreate, { mood: "worried" });
      blob.react("shake", "worried");
      return;
    }
    blob.react("jump", "excited", 1400);
    blob.say(t.created, { mood: "excited" });
    router.push(`/projects/${id}`);
  }

  return (
    <form
      className="flex max-h-[calc(100dvh-12vh-16px)] flex-col max-sm:max-h-[calc(100dvh-24px)]"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 pb-3.5 pt-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id="new-project-title" className="font-display text-[21px] font-bold tracking-[-0.015em]">
            {d.title}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-ink-2">{d.intro}</p>
        </div>
        <IconButton type="button" label={d.close} onClick={onClose} className="-mr-1.5 -mt-1">
          <X className="size-4" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
        <div>
          <Label htmlFor="new-project-name">{d.name}</Label>
          <div className="flex items-center gap-2.5">
            <ProjectIcon project={{ icon, color }} size={38} />
            <Input
              id="new-project-name"
              autoFocus
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={template === "blank" ? d.namePlaceholder : `${words.name} …`}
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-ink-2">{d.template}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMPLATE_IDS.map((id) => {
              const s = TEMPLATES[id];
              const on = template === id;
              return (
                <label key={id} className="relative block cursor-pointer">
                  <input type="radio" name="template" checked={on} onChange={() => pick(id)} className="peer sr-only" />
                  <span
                    className={cn(
                      "flex h-full min-h-[86px] flex-col rounded-xl border p-2.5 transition-[border,background,box-shadow] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blob",
                      on ? "border-blob bg-blob-soft/50 shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_14%,transparent)]" : "border-line hover:border-line-2 hover:bg-hover/40",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[18px] leading-none">{s.icon}</span>
                      <span className="min-w-0 truncate text-[13.5px] font-semibold text-ink">{t.templates[id].name}</span>
                      {on && <Check className="ml-auto size-4 shrink-0 text-blob" strokeWidth={2.5} />}
                    </span>
                    <span className="mt-1 text-[12px] leading-snug text-ink-2">{t.templates[id].blurb}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {/* What you'll get: the columns, like little board headers. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl bg-hover/50 px-2.5 py-2 text-[12px] text-ink-2">
            <span className="mr-0.5 font-medium text-ink-3">{d.columns}:</span>
            {spec.columns.map((c) => (
              <span key={c.key} className="flex items-center gap-1 rounded-md bg-raised px-1.5 py-0.5 shadow-card">
                <span className="size-2 rounded-full" style={{ background: boardColor(c.color) }} />
                {words.columns[c.key]}
              </span>
            ))}
            {spec.cards.length > 0 && <span className="ml-auto text-ink-3">{d.cards(spec.cards.length)}</span>}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-ink-2">{d.look}</legend>
          <ColorSwatches
            value={color}
            onChange={(c) => {
              setColor(c);
              setTouched(true);
            }}
            label={d.look}
          />
          <div className="mt-2.5">
            <IconGrid
              value={icon}
              color={color}
              onChange={(i) => {
                setIcon(i);
                setTouched(true);
              }}
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-[12.5px] font-medium text-ink-2">{d.details}</legend>
          <div>
            <Label>{d.subject}</Label>
            <SubjectSelect value={subject} onChange={setSubject} />
          </div>
          <div>
            <Label>{d.due}</Label>
            <DueField value={due} onChange={setDue} />
          </div>
        </fieldset>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3 sm:px-6">
        <Button type="button" variant="ghost" onClick={onClose}>
          {d.cancel}
        </Button>
        <Button type="submit" variant="blob" loading={busy} className="max-sm:flex-1">
          {d.create} <ArrowRight className="size-4" />
        </Button>
      </footer>
    </form>
  );
}

/* ---------------------------------------------------------------------------
   Settings
   --------------------------------------------------------------------------- */

export function ProjectSettingsDialog({
  open,
  onClose,
  project,
  owner,
  onSave,
  onArchive,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  owner: boolean;
  onSave: (patch: Partial<Pick<Project, "title" | "description" | "color" | "icon" | "subject_id" | "due_at">>) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="project-settings-title" className="max-w-[560px] overflow-hidden">
      {open && <SettingsForm project={project} owner={owner} onClose={onClose} onSave={onSave} onArchive={onArchive} onDelete={onDelete} />}
    </Dialog>
  );
}

function SettingsForm({
  project,
  owner,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: {
  project: Project;
  owner: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Pick<Project, "title" | "description" | "color" | "icon" | "subject_id" | "due_at">>) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const t = useMessages(projectsText);
  const s = t.settingsDialog;
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [color, setColor] = useState(project.color);
  const [icon, setIcon] = useState(project.icon ?? "📋");
  const [subject, setSubject] = useState(project.subject_id);
  const [due, setDue] = useState(project.due_at);

  return (
    <form
      className="flex max-h-[calc(100dvh-12vh-16px)] flex-col max-sm:max-h-[calc(100dvh-24px)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title: title.trim() || project.title,
          description,
          color,
          icon,
          due_at: due,
          // The subject is one of the owner's subjects: only they can set it.
          ...(owner && { subject_id: subject }),
        });
        onClose();
      }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3.5">
        <ProjectIcon project={{ icon, color }} size={34} />
        <h2 id="project-settings-title" className="min-w-0 flex-1 truncate font-display text-[19px] font-bold tracking-[-0.015em]">
          {s.title}
        </h2>
        <IconButton type="button" label={s.close} onClick={onClose} className="-mr-1.5">
          <X className="size-4" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <Label htmlFor="project-name">{s.name}</Label>
          <Input id="project-name" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="project-description">{s.description}</Label>
          <Textarea id="project-description" value={description} maxLength={4000} rows={3} onChange={(e) => setDescription(e.target.value)} placeholder={t.descriptionPlaceholder} />
        </div>
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-ink-2">{s.look}</legend>
          <ColorSwatches value={color} onChange={setColor} label={s.look} />
          <div className="mt-2.5">
            <IconGrid value={icon} color={color} onChange={setIcon} />
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          {owner && (
            <div>
              <Label>{s.subject}</Label>
              <SubjectSelect value={subject} onChange={setSubject} />
            </div>
          )}
          <div>
            <Label>{s.due}</Label>
            <DueField value={due} onChange={setDue} />
          </div>
        </div>
        <section className="rounded-xl border border-line p-3">
          <h3 className="text-[12.5px] font-semibold text-ink-2">{s.danger}</h3>
          {owner ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-[12.5px] text-ink-3">{s.archiveHint}</p>
                <Button type="button" size="sm" onClick={onArchive}>
                  {project.archived_at ? t.unarchive : t.archiveAction}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 text-[12.5px] text-ink-3">{s.deleteHint}</p>
                <Button type="button" size="sm" variant="danger" onClick={onDelete}>
                  {t.delete}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[12.5px] text-ink-3">{s.ownerOnly}</p>
          )}
        </section>
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          {s.cancel}
        </Button>
        <Button type="submit" variant="primary">
          {s.save}
        </Button>
      </footer>
    </form>
  );
}

/* ---------------------------------------------------------------------------
   Confirm
   --------------------------------------------------------------------------- */

export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirm,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useMessages(projectsText);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} labelledBy="confirm-title" className="max-w-[420px]">
      <div className="p-5">
        <h2 id="confirm-title" className="font-display text-[18px] font-bold tracking-[-0.01em] [overflow-wrap:anywhere]">
          {title}
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              onClose();
            }}
          >
            {confirm}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
