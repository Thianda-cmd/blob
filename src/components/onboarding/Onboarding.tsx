"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, FileText, Folder, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FormError } from "@/components/auth/FormError";
import { Blob, type BlobAccessory, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { TypedText, useTypewriter } from "@/components/blob/speech";
import { resetBoot } from "@/components/blob/BlobBoot";
import { BlobMark } from "@/components/blob/BlobMark";
import { GooSpinner } from "@/components/blob/GooSpinner";
import { ThemePicker } from "@/components/settings/ThemePicker";
import { applyTheme } from "@/components/theme";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { SUBJECT_PRESETS } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";
import type { SubjectColor, Theme } from "@/lib/types";
import { cn, firstName } from "@/lib/utils";
import { SpacePreview } from "./SpacePreview";
import { SubjectChip, type Picked } from "./SubjectChip";
import { WELCOME_TITLE, welcomeDoc } from "./welcome";

const STEPS = ["About you", "Subjects", "Look"] as const;
const CUSTOM_COLORS: SubjectColor[] = ["sky", "clay", "moss", "plum", "sand", "rose", "teal"];
const CHEERS = ["Love it.", "Great pick.", "Ooh, nice.", "Yes!", "Good one.", "Noted!"];
const FIRST_TASK = "Try checking me off ✓";
const SETUP = ["Adding your subjects", "Writing your welcome note", "Making your first task", "Saving your preferences"];

type Initial = { name: string; school: string; grade: string; theme: Theme };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 56 }),
  center: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 360, damping: 34 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -56, transition: { duration: 0.16, ease: "easeIn" as const } }),
};

export function Onboarding({
  userId,
  initial,
  existingSubjects,
}: {
  userId: string;
  initial: Initial;
  existingSubjects: Picked[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(initial.name);
  const [school, setSchool] = useState(initial.school);
  const [grade, setGrade] = useState(initial.grade);
  const [nameError, setNameError] = useState<string | null>(null);
  const [custom, setCustom] = useState<Picked[]>(() =>
    existingSubjects.filter((s) => !SUBJECT_PRESETS.some((p) => p.name.toLowerCase() === s.name.toLowerCase())),
  );
  const [picked, setPicked] = useState<Picked[]>(existingSubjects);
  const [customName, setCustomName] = useState("");
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [phase, setPhase] = useState<"steps" | "creating" | "done">("steps");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // --- Blob ------------------------------------------------------------------
  const deskBlob = useRef<BlobHandle>(null);
  const phoneBlob = useRef<BlobHandle>(null);
  const [flash, setFlash] = useState<BlobMood | null>(null);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const [speech, setSpeech] = useState(() => {
    const first = firstName(initial.name);
    return first ? `Hi ${first}! Nice to see you.` : "Hi there! Welcome to Blob.";
  });
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const greeted = useRef(firstName(initial.name));

  const blobDo = useCallback((fn: (b: BlobHandle) => void) => {
    if (deskBlob.current) fn(deskBlob.current);
    if (phoneBlob.current) fn(phoneBlob.current);
  }, []);

  const react = useCallback(
    (mood: BlobMood, text?: string, ms = 1400) => {
      clearTimeout(flashTimer.current);
      setFlash(mood);
      if (text) setSpeech(text);
      flashTimer.current = setTimeout(() => setFlash(null), ms);
    },
    [],
  );

  // A hello hop and a wave once everything has painted.
  useEffect(() => {
    const t = setTimeout(() => {
      blobDo((b) => b.jump(0.9));
      setTimeout(() => blobDo((b) => b.wave()), 500);
    }, 450);
    return () => {
      clearTimeout(t);
      clearTimeout(flashTimer.current);
    };
  }, [blobDo]);

  // Greet by name once they pause typing.
  useEffect(() => {
    const first = firstName(name);
    if (!first || first === greeted.current) return;
    const t = setTimeout(() => {
      greeted.current = first;
      react("love", `Nice to meet you, ${first}!`, 1800);
      blobDo((b) => b.poke(-Math.PI / 2, 0.8));
    }, 650);
    return () => clearTimeout(t);
  }, [name, react, blobDo]);

  const lookAtForm = {
    onFocus: () => setGaze({ x: -0.9, y: 0.2 }),
    onBlur: () => setGaze(null),
  };

  // --- Navigation --------------------------------------------------------------
  function go(next: number) {
    if (next === step) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError(null);
    const first = firstName(name);
    if (next === 0) setSpeech(first ? `Still ${first}? Change anything you like.` : "Tell me about you.");
    if (next === 1) {
      setSpeech(first ? `So ${first}, what are you studying?` : "What are you studying this year?");
      react("happy");
    }
    if (next === 2) {
      setSpeech("Light or dark? I look good in both.");
      react("excited", undefined, 900);
      blobDo((b) => b.jump(0.7));
    }
  }

  function submitStep(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== "steps") return;
    if (step === 0) {
      if (!name.trim()) {
        setNameError("What should I call you?");
        react("worried", "I'd love to know your name!", 1600);
        blobDo((b) => b.shake());
        document.getElementById("ob-name")?.focus();
        return;
      }
      setNameError(null);
      go(1);
    } else if (step === 1) {
      if (customName.trim()) addCustom();
      go(2);
    } else {
      create();
    }
  }

  // Enter continues, even when a chip or a theme tile has focus (Space still toggles them).
  function onFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-enter='submit']")) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.repeat) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      e.preventDefault();
      formRef.current?.requestSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Subjects ------------------------------------------------------------------
  const isPicked = (n: string) => picked.some((p) => p.name.toLowerCase() === n.toLowerCase());

  function toggle(subject: Picked) {
    if (isPicked(subject.name)) {
      setPicked((list) => list.filter((p) => p.name.toLowerCase() !== subject.name.toLowerCase()));
      blobDo((b) => b.squish(0.8));
      react("idle", `Bye, ${subject.name}.`, 700);
      return;
    }
    const next = [...picked, subject];
    setPicked(next);
    blobDo((b) => b.jump(0.55));
    const cheer = next.length === 6 ? "Busy year! I'll keep it tidy." : `${subject.name}! ${CHEERS[next.length % CHEERS.length]}`;
    react(next.length >= 6 ? "surprised" : "excited", cheer, 900);
  }

  function addCustom() {
    const value = customName.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!value) return;
    setCustomName("");
    if (isPicked(value)) {
      react("thinking", `${value} is already on your list.`, 1200);
      return;
    }
    const preset = SUBJECT_PRESETS.find((p) => p.name.toLowerCase() === value.toLowerCase());
    const subject: Picked = preset ?? { name: value, emoji: null, color: CUSTOM_COLORS[custom.length % CUSTOM_COLORS.length] };
    if (!preset) setCustom((c) => [...c, subject]);
    toggle(subject);
  }

  // --- Theme ------------------------------------------------------------------------
  function pickTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    blobDo((b) => b.poke(-Math.PI / 2, 1));
    if (next === "dark") react("love", "Cozy. Perfect for late-night studying.", 1600);
    else if (next === "light") react("happy", "Bright and fresh!", 1400);
    else react("thinking", "I'll follow your device.", 1400);
  }

  // --- Create ------------------------------------------------------------------------
  async function create() {
    if (phase === "creating") return;
    setPhase("creating");
    setProgress(0);
    setError(null);
    setSpeech("Setting up your space…");
    const supabase = createClient();
    const fail = (message: string) => {
      setPhase("steps");
      setError(message);
      react("worried", "Hmm, something went wrong. Try again?", 2200);
      blobDo((b) => b.shake());
    };
    // Each step lingers a moment so the checklist is readable.
    const run = async <T,>(index: number, work: () => Promise<T>) => {
      const [result] = await Promise.all([work(), sleep(420)]);
      setProgress(index + 1);
      return result;
    };

    try {
      // 1. Subjects, in the order they were picked (skipping ones that already exist).
      await run(0, async () => {
        // Ask the database, not the initial props: an earlier attempt may have added some already.
        const { data: have, error: haveError } = await supabase.from("subjects").select("name");
        if (haveError) throw haveError;
        const existing = new Set((have ?? []).map((s: { name: string }) => s.name.toLowerCase()));
        const rows = picked
          .filter((s) => !existing.has(s.name.toLowerCase()))
          .map((s, i) => ({ name: s.name, emoji: s.emoji, color: s.color, position: existing.size + i + 1 }));
        if (!rows.length) return;
        const { error } = await supabase.from("subjects").insert(rows);
        if (error) throw error;
      });

      // 2. The welcome note (once).
      await run(1, async () => {
        const { data: found, error: findError } = await supabase.from("pages").select("id").eq("title", WELCOME_TITLE).limit(1);
        if (findError) throw findError;
        if (found?.length) return;
        const { doc, text } = welcomeDoc(firstName(name));
        const { error } = await supabase
          .from("pages")
          .insert({ kind: "note", title: WELCOME_TITLE, content: doc, plain_text: text, position: 1 });
        if (error) throw error;
      });

      // 3. A first task to tick off, due tomorrow afternoon.
      await run(2, async () => {
        const { data: found, error: findError } = await supabase.from("tasks").select("id").eq("title", FIRST_TASK).limit(1);
        if (findError) throw findError;
        if (found?.length) return;
        const due = new Date();
        due.setDate(due.getDate() + 1);
        due.setHours(17, 0, 0, 0);
        const { error } = await supabase.from("tasks").insert({
          title: FIRST_TASK,
          kind: "reminder",
          due_at: due.toISOString(),
          details: "Tick the circle to complete your first task. Add your own with natural dates, like “essay due friday”.",
        });
        if (error) throw error;
      });

      // 4. Profile last, so a half-finished setup brings you back here.
      await run(3, async () => {
        const patch = {
          full_name: name.trim().slice(0, 80) || null,
          school: school.trim().slice(0, 120) || null,
          grade: grade.trim().slice(0, 40) || null,
          theme,
          onboarded: true,
        };
        const { data, error } = await supabase.from("profiles").update(patch).eq("id", userId).select("id");
        if (error) throw error;
        // The sign-up trigger normally creates the row; create it if it ever didn't.
        if (!data?.length) {
          const { error: insertError } = await supabase.from("profiles").insert({ id: userId, ...patch });
          if (insertError) throw insertError;
        }
      });
    } catch (err) {
      console.error("onboarding failed", err);
      return fail("I couldn't finish setting up your space. Check your connection and try again.");
    }

    applyTheme(theme);
    setPhase("done");
    setFlash("excited");
    setSpeech(`All set${firstName(name) ? `, ${firstName(name)}` : ""}! Let's go!`);
    blobDo((b) => b.celebrate());
    await sleep(1100);
    // Play the intro again as we fly into the workspace.
    resetBoot();
    delete document.documentElement.dataset.booted;
    router.replace("/home");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // --- Render ------------------------------------------------------------------------
  const busy = phase !== "steps";
  const mood: BlobMood = phase === "done" ? "excited" : phase === "creating" ? "thinking" : (flash ?? "happy");
  const accessory: BlobAccessory | null = phase === "done" ? "cap" : phase === "creating" ? "glasses" : null;
  const { shown: speechShown, typing } = useTypewriter(speech);
  const chips = [...SUBJECT_PRESETS, ...custom];

  let content: ReactNode;
  if (busy) {
    content = (
      <div aria-live="polite">
        <div className="mb-6 h-16">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "done" ? (
              <motion.div
                key="done"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 16 }}
                className="grid size-16 place-items-center rounded-full bg-blob text-white"
              >
                <Check className="size-8" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div key="spin" exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.15 } }}>
                <GooSpinner size={64} label="Setting up your space" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <h1 className="font-display text-[36px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[42px]">
          {phase === "done" ? "Your space is ready." : "Setting up your space…"}
        </h1>
        <ul className="mt-7 space-y-3">
          {SETUP.map((label, i) => {
            const state = progress > i ? "done" : progress === i && phase === "creating" ? "active" : "todo";
            return (
              <motion.li
                key={label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={cn("flex items-center gap-3 text-[14.5px] transition-colors", state === "todo" ? "text-ink-3" : "text-ink")}
              >
                <span className="relative grid size-5 place-items-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {state === "done" ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 700, damping: 18 }}
                        className="grid size-5 place-items-center rounded-full bg-blob text-white"
                      >
                        <Check className="size-3" strokeWidth={3.5} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="todo"
                        exit={{ scale: 0, opacity: 0 }}
                        className={cn("size-5 rounded-full border-2", state === "active" ? "animate-pulse border-blob" : "border-line-2")}
                      />
                    )}
                  </AnimatePresence>
                </span>
                {label}
              </motion.li>
            );
          })}
        </ul>
      </div>
    );
  } else if (step === 0) {
    content = (
      <>
        <StepHeading title="Hi, I'm Blob!">
          Your new home for notes, slides and homework. Let&apos;s set up your space. It takes about a minute.
        </StepHeading>
        <div className="mt-8 space-y-4">
          <Field label="What should I call you?" htmlFor="ob-name" error={nameError}>
            <Input
              id="ob-name"
              autoFocus
              autoComplete="name"
              placeholder="Your name"
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={!!nameError}
              className="h-11 text-[15px]"
              {...lookAtForm}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
            <Field label="School" htmlFor="ob-school" action={<Optional />}>
              <Input
                id="ob-school"
                autoComplete="organization"
                placeholder="e.g. Riverside High"
                maxLength={120}
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                {...lookAtForm}
              />
            </Field>
            <Field label="Grade or year" htmlFor="ob-grade" action={<Optional />}>
              <Input id="ob-grade" placeholder="e.g. Year 11" maxLength={40} value={grade} onChange={(e) => setGrade(e.target.value)} {...lookAtForm} />
            </Field>
          </div>
        </div>
      </>
    );
  } else if (step === 1) {
    content = (
      <>
        <StepHeading title="Pick your subjects">Tap the ones you&apos;re taking. Each one becomes a tidy folder in your sidebar.</StepHeading>
        <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Subjects">
          {chips.map((s) => (
            <SubjectChip key={s.name} subject={s} selected={isPicked(s.name)} onToggle={() => toggle(s)} />
          ))}
        </div>
        <div className="mt-4 flex max-w-[380px] gap-2">
          <Input
            icon={<Plus />}
            placeholder="Add your own"
            aria-label="Add your own subject"
            maxLength={60}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customName.trim()) {
                e.preventDefault();
                e.stopPropagation();
                addCustom();
              }
            }}
            {...lookAtForm}
          />
          <Button type="button" variant="secondary" className="h-9.5" onClick={addCustom} disabled={!customName.trim()}>
            Add
          </Button>
        </div>
        <p className="mt-3 h-5 text-[12.5px] text-ink-3" aria-live="polite">
          {picked.length === 0
            ? "Pick at least one to get started, or skip and add them later."
            : `${picked.length} selected · they'll show up in this order`}
        </p>
      </>
    );
  } else {
    content = (
      <>
        <StepHeading title="Make it yours">Pick a look. You can switch anytime in Settings.</StepHeading>
        <ThemePicker size="lg" value={theme} onChange={pickTheme} className="mt-7" />
        <div className="mt-6 rounded-xl border border-line bg-raised p-4 shadow-card">
          <div className="mb-2.5 text-[12.5px] font-medium text-ink-2">Here&apos;s what I&apos;ll set up for you</div>
          <ul className="space-y-2 text-[13.5px] text-ink-2">
            <SummaryItem icon={<Folder />}>
              {picked.length ? (
                <>
                  <span className="font-medium text-ink">
                    {picked.length} {picked.length === 1 ? "subject" : "subjects"}
                  </span>
                  : {picked.slice(0, 4).map((s) => s.name).join(", ")}
                  {picked.length > 4 ? ` and ${picked.length - 4} more` : ""}
                </>
              ) : (
                "No subjects yet. Add them anytime from the sidebar."
              )}
            </SummaryItem>
            <SummaryItem icon={<FileText />}>
              A <span className="font-medium text-ink">welcome note</span> with the basics
            </SummaryItem>
            <SummaryItem icon={<CircleCheck />}>
              Your <span className="font-medium text-ink">first task</span>, due tomorrow
            </SummaryItem>
          </ul>
        </div>
      </>
    );
  }

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      {/* Left: the flow */}
      <div className="relative flex min-h-dvh flex-col px-6 py-5 sm:px-12 lg:px-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BlobMark size={26} />
            <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="rounded-md px-2 py-1 text-[12.5px] text-ink-3 transition-colors hover:bg-hover hover:text-ink disabled:opacity-0"
          >
            Not you? Sign out
          </button>
        </header>

        {/* Phone: Blob sits on top */}
        <div className="mt-6 flex items-end gap-3 lg:hidden">
          <Blob ref={phoneBlob} size={96} mood={mood} look={gaze} talking={typing} accessory={accessory} className="shrink-0" />
          <SpeechBubble text={speech} shown={speechShown} side="left" />
        </div>

        <div className="flex flex-1 items-center py-8 lg:py-12">
          <div className="mx-auto w-full max-w-[560px]">
            <Progress step={busy ? STEPS.length : step} onJump={(i) => !busy && i < step && go(i)} />
            <form ref={formRef} onSubmit={submitStep} onKeyDown={onFormKeyDown} noValidate>
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={busy ? "setup" : step}
                  custom={dir}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  {content}
                </motion.div>
              </AnimatePresence>

              <div className="mt-5">
                <FormError message={error} />
              </div>

              <AnimatePresence initial={false}>
                {!busy && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    className="mt-5 flex items-center gap-2"
                  >
                    {step > 0 && (
                      <Button type="button" variant="ghost" size="lg" onClick={() => go(step - 1)} className="-ml-2">
                        <ArrowLeft className="size-4" /> Back
                      </Button>
                    )}
                    <Button type="submit" variant={step === 2 ? "blob" : "primary"} size="lg" className="min-w-[140px]">
                      {step === 2 ? (error ? "Try again" : "Create my space") : step === 1 && picked.length === 0 ? "Skip for now" : "Continue"}
                      <ArrowRight className="size-4" />
                    </Button>
                    <span className="ml-2 hidden items-center gap-1.5 text-[12px] text-ink-3 sm:flex">
                      or press <Kbd>Enter ↵</Kbd>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>

        <p className="text-[12px] text-ink-3">You can change all of this later in Settings.</p>
      </div>

      {/* Right: Blob's stage */}
      <aside className="relative hidden overflow-hidden border-l border-line bg-paper lg:block" aria-hidden>
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pb-[2vh]">
          <div className="relative flex flex-col items-center">
            <div className="relative z-10 -mb-14 flex h-[86px] items-end justify-center">
              <SpeechBubble text={speech} shown={speechShown} side="bottom" />
            </div>
            <Blob ref={deskBlob} size={260} mood={mood} look={gaze} talking={typing} accessory={accessory} />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 26 }}
          >
            <SpacePreview name={name} school={school} grade={grade} picked={picked} showNote={step === 2 || busy} />
          </motion.div>
        </div>
      </aside>
    </div>
  );
}

function StepHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-[-0.04em] text-balance sm:text-[48px]">{title}</h1>
      <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

function Optional() {
  return <span className="text-[11.5px] text-ink-3">Optional</span>;
}

function SummaryItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 text-ink-3 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Progress({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <motion.button
            key={label}
            type="button"
            tabIndex={i < step && step < STEPS.length ? 0 : -1}
            onClick={() => onJump(i)}
            aria-label={`Step ${i + 1}: ${label}`}
            aria-current={i === step ? "step" : undefined}
            initial={false}
            animate={{ width: i === step ? 28 : 8 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              "h-2 rounded-full transition-colors duration-300",
              i === step ? "bg-blob" : i < step ? "bg-ink-3 hover:bg-ink-2" : "bg-line-2",
              i < step && step < STEPS.length ? "cursor-pointer" : "cursor-default",
            )}
          />
        ))}
      </div>
      <span className="text-[12px] font-medium text-ink-3">
        {step < STEPS.length ? `Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}` : "Almost there"}
      </span>
    </div>
  );
}

function SpeechBubble({ text, shown, side }: { text: string; shown: string; side: "bottom" | "left" }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.96, transition: { duration: 0.12 } }}
        transition={{ type: "spring", stiffness: 500, damping: 26 }}
        style={{ transformOrigin: side === "bottom" ? "bottom center" : "bottom left" }}
        className={cn(
          "relative w-max rounded-2xl border border-line bg-raised px-4 py-2.5 text-[14px] leading-snug text-ink shadow-pop",
          side === "bottom" ? "max-w-[300px] text-center" : "mb-6 max-w-[220px] rounded-bl-md text-[13px]",
        )}
        role="status"
      >
        <TypedText text={text} shown={shown} />
        {side === "bottom" && (
          <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-line bg-raised" />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
