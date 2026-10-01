import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BlobMark } from "@/components/blob/BlobMark";
import { HeroBlob, QuickAddDemo } from "@/components/landing/Interactive";
import { getUser } from "@/lib/supabase/server";

export default async function LandingPage() {
  const user = await getUser();
  const primary = user ? { href: "/home", label: "Open Blob" } : { href: "/signup", label: "Create your free space" };

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-transparent bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2">
            <BlobMark size={24} />
            <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
          </Link>
          <nav className="hidden gap-5 text-[13.5px] text-ink-2 sm:flex">
            <a href="#notes" className="hover:text-ink">Notes</a>
            <a href="#presentations" className="hover:text-ink">Presentations</a>
            <a href="#tasks" className="hover:text-ink">Homework</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!user && (
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                Sign in
              </Link>
            )}
            <Link href={primary.href} className="flex h-8.5 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13.5px] font-medium text-paper hover:bg-ink/88">
              {user ? "Open Blob" : "Get started"} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_60%_40%,#000_30%,transparent_75%)]" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-6 px-6 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1 text-[12.5px] text-ink-2 shadow-card">
                <span className="size-1.5 rounded-full bg-blob" /> Made for students, saved automatically
              </p>
              <h1 className="font-display text-[clamp(44px,6.4vw,84px)] font-bold leading-[0.95] tracking-[-0.045em] text-balance">
                Your school,
                <br />
                <span className="relative inline-block">
                  saved.
                  <svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-4 w-full text-blob" preserveAspectRatio="none" aria-hidden>
                    <path d="M3 14 C 60 4, 120 4, 170 10 S 260 16, 297 6" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
              </h1>
              <p className="mt-7 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
                Notes, presentations and homework in one calm workspace. Blob, your jelly helper, keeps everything tidy and saved while you focus on learning.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href={primary.href} className="flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[15px] font-medium text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition-transform hover:bg-ink/88 active:scale-[0.98]">
                  {primary.label} <ArrowRight className="size-4" />
                </Link>
                {!user && (
                  <Link href="/login" className="flex h-11 items-center rounded-xl border border-line bg-raised px-5 text-[15px] font-medium text-ink-2 shadow-card hover:text-ink">
                    I have an account
                  </Link>
                )}
              </div>
              <p className="mt-4 text-[12.5px] text-ink-3">Free. No ads. Your notes stay private to you.</p>
            </div>
            <HeroBlob />
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid max-w-[1240px] gap-px overflow-hidden px-6 py-20 lg:grid-cols-3 lg:gap-6">
            <Feature
              id="notes"
              kicker="Notes"
              title="Write like it's paper. Organize like it's magic."
              body="Type / for headings, checklists, quotes, images and sub-pages. Everything is grouped by subject and searchable in a second with ⌘K."
            >
              <div className="space-y-2 rounded-xl border border-line bg-raised p-4 shadow-card">
                <div className="font-display text-[17px] font-semibold">Photosynthesis</div>
                <div className="h-1.5 w-[88%] rounded bg-line" />
                <div className="h-1.5 w-[70%] rounded bg-line" />
                <div className="mt-3 rounded-lg border border-line bg-surface p-1.5 text-[12.5px] shadow-pop">
                  {["Heading", "Checklist", "Quote", "Image"].map((item, i) => (
                    <div key={item} className={`rounded-md px-2 py-1 ${i === 1 ? "bg-hover text-ink" : "text-ink-2"}`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </Feature>
            <Feature
              id="presentations"
              kicker="Presentations"
              title="Slides that look good by default."
              body="Pick a layout, type your points, press Present. Three clean themes, speaker notes and smooth transitions, no design degree needed."
            >
              <div className="grid aspect-video place-items-center rounded-xl bg-ink p-6 shadow-card">
                <div className="w-full">
                  <div className="mb-3 h-1 w-8 rounded-full bg-blob" />
                  <div className="font-display text-[22px] font-bold leading-tight text-paper">The French Revolution</div>
                  <div className="mt-2 text-[12px] text-paper/60">History · 1789 – 1799</div>
                </div>
              </div>
            </Feature>
            <Feature
              id="tasks"
              kicker="Homework"
              title="Just type it. Blob figures out the date."
              body="“Bio test fri #biology” becomes an exam on Friday in Biology. Check things off and Blob celebrates with you."
            >
              <QuickAddDemo />
            </Feature>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-6 py-20 text-center">
          <h2 className="font-display text-[clamp(30px,4vw,46px)] font-bold tracking-[-0.035em]">Ready for a calmer school year?</h2>
          <p className="mx-auto mt-3 max-w-[460px] text-[15px] text-ink-2">Set up your subjects in under a minute. Blob will show you around.</p>
          <Link href={primary.href} className="mx-auto mt-7 flex h-11 w-fit items-center gap-2 rounded-xl bg-blob px-5 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-transform hover:bg-blob-deep active:scale-[0.98]">
            {primary.label} <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] items-center gap-2 px-6 py-6 text-[12.5px] text-ink-3">
          <BlobMark size={16} /> Blob · made for students
        </div>
      </footer>
    </div>
  );
}

function Feature({ id, kicker, title, body, children }: { id: string; kicker: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <article id={id} className="scroll-mt-20 py-6">
      <div className="mb-6 flex min-h-[224px] flex-col justify-center">{children}</div>
      <p className="text-[12px] font-medium uppercase tracking-wider text-blob-ink">{kicker}</p>
      <h3 className="mt-1.5 font-display text-[22px] font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
    </article>
  );
}
