"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { Card, SavedBadge, Section } from "./primitives";

type Form = { full_name: string; school: string; grade: string };

export function ProfileSection() {
  const { profile, setProfile, email } = useWorkspace();
  const fromProfile = (): Form => ({
    full_name: profile.full_name ?? "",
    school: profile.school ?? "",
    grade: profile.grade ?? "",
  });
  const [form, setForm] = useState<Form>(fromProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const dirty =
    form.full_name.trim() !== (profile.full_name ?? "") ||
    form.school.trim() !== (profile.school ?? "") ||
    form.grade.trim() !== (profile.grade ?? "");

  const initial = (form.full_name.trim() || email || "?")[0]!.toUpperCase();
  const meta = [form.school.trim(), form.grade.trim()].filter(Boolean).join(" · ");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    const ok = await setProfile({
      full_name: form.full_name.trim() || null,
      school: form.school.trim() || null,
      grade: form.grade.trim() || null,
    });
    setSaving(false);
    if (!ok) return;
    setForm((f) => ({ full_name: f.full_name.trim(), school: f.school.trim(), grade: f.grade.trim() }));
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2400);
  }

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  return (
    <Section id="profile" title="Profile" description="How you show up in Blob.">
      <form onSubmit={save}>
        <Card
          footer={
            <>
              <p className="mr-auto text-[12.5px] text-ink-3">Your name is used in greetings and the sidebar.</p>
              <SavedBadge show={saved && !dirty} />
              {dirty && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm(fromProfile())} disabled={saving}>
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" size="sm" disabled={!dirty} loading={saving}>
                Save changes
              </Button>
            </>
          }
        >
          <div className="flex items-center gap-4 px-5 pt-5">
            <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-blob text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.12),inset_0_2px_0_rgb(255_255_255/0.25)]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={initial}
                  initial={{ y: 18, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -18, opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 520, damping: 22 }}
                  className="font-display text-[24px] font-bold leading-none"
                >
                  {initial}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-[16px] font-semibold tracking-[-0.01em]">{form.full_name.trim() || "Your name"}</div>
              <div className="truncate text-[12.5px] text-ink-3">{meta || email}</div>
            </div>
          </div>
          <div className="grid gap-4 px-5 pb-5 pt-5 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_0.8fr]">
            <Field label="Full name" htmlFor="profile-name">
              <Input id="profile-name" autoComplete="name" value={form.full_name} onChange={set("full_name")} maxLength={80} placeholder="Alex Morgan" />
            </Field>
            <Field label="School" htmlFor="profile-school">
              <Input
                id="profile-school"
                autoComplete="organization"
                value={form.school}
                onChange={set("school")}
                maxLength={120}
                placeholder="Optional"
              />
            </Field>
            <Field label="Grade or year" htmlFor="profile-grade">
              <Input id="profile-grade" value={form.grade} onChange={set("grade")} maxLength={40} placeholder="e.g. Year 11" />
            </Field>
          </div>
        </Card>
      </form>
    </Section>
  );
}
