import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BlobMark } from "@/components/blob/BlobMark";
import { BoardShowcase, TogetherPoints } from "@/components/landing/BoardShowcase";
import { CvShowcase } from "@/components/landing/CvShowcase";
import { HeroBlob, KnowledgeDemo, QuickAddDemo, Reveal } from "@/components/landing/Interactive";
import { LearnDemo } from "@/components/landing/LearnDemo";
import { LearnStages, TopicGrid } from "@/components/landing/LearnFeatures";
import { NoteFeatures, NoteShowcase } from "@/components/landing/NoteShowcase";
import { SlidesShowcase } from "@/components/landing/SlidesShowcase";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { landingText } from "@/i18n/messages/landing";
import { getMessages } from "@/i18n/server";
import { getUser } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getMessages(landingText);
  return {
    title: { absolute: meta.title },
    description: meta.description,
    openGraph: { title: meta.title, description: meta.description, siteName: "Blob", type: "website" },
  };
}

export default async function LandingPage() {
  const [user, t] = await Promise.all([getUser(), getMessages(landingText)]);
  const primary = user ? { href: "/home", label: t.header.open } : { href: "/signup", label: t.hero.cta };
  const nav = [
    { href: "#learn", label: t.nav.learn },
    { href: "#notes", label: t.nav.notes },
    { href: "#together", label: t.nav.together },
    { href: "#homework", label: t.nav.homework },
    { href: "#presentations", label: t.nav.presentations },
    { href: "#cv", label: t.nav.cv },
  ];

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label={t.header.home} className="flex h-10 items-center gap-2">
            <BlobMark size={24} />
            <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
          </Link>
          <nav aria-label={t.header.nav} className="hidden gap-5 text-[13.5px] text-ink-2 lg:flex">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-ink">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitch compact />
            {!user && (
              <Link href="/login" className="hidden rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink sm:block">
                {t.header.signIn}
              </Link>
            )}
            <Link href={primary.href} className="flex h-8.5 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13.5px] font-medium text-paper hover:bg-ink/88">
              {user ? t.header.open : t.header.start} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_60%_40%,#000_30%,transparent_75%)]" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-4 px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-20 lg:pt-16">
            <div>
              <a
                href="#together"
                className="group mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-raised py-1.5 pl-3 pr-2.5 text-[12.5px] text-ink-2 shadow-card transition-colors hover:text-ink"
              >
                <span className="size-1.5 rounded-full bg-blob" /> {t.hero.badge}
                <ArrowRight className="size-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5" />
              </a>
              <h1 className="font-display text-[clamp(44px,6.4vw,84px)] font-bold leading-[0.95] tracking-[-0.045em] text-balance">
                {t.hero.titleA}
                <br />
                <span className="relative inline-block">
                  {t.hero.titleB}
                  <svg viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-4 w-full text-blob" preserveAspectRatio="none" aria-hidden>
                    <path d="M3 14 C 60 4, 120 4, 170 10 S 260 16, 297 6" stroke="currentColor" strokeWidth="6" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
              </h1>
              <p className="mt-6 max-w-[540px] text-[16px] leading-relaxed text-ink-2 sm:mt-7 sm:text-[17px]">{t.hero.body}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
                <Link
                  href={primary.href}
                  className="flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[15px] font-medium text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] transition-transform hover:bg-ink/88 active:scale-[0.98]"
                >
                  {primary.label} <ArrowRight className="size-4" />
                </Link>
                {!user && (
                  <Link href="/login" className="flex h-11 items-center rounded-xl border border-line bg-raised px-5 text-[15px] font-medium text-ink-2 shadow-card hover:text-ink">
                    {t.hero.haveAccount}
                  </Link>
                )}
              </div>
              <p className="mt-4 text-[12.5px] text-ink-3">{t.hero.fine}</p>
            </div>
            <HeroBlob />
          </div>
        </section>

        {/* Learning center */}
        <section id="learn" className="scroll-mt-14 border-t border-line bg-surface">
          <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <SectionHead kicker={t.learn.kicker} title={t.learn.title} body={t.learn.body} />
            <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-10">
              <Reveal className="lg:col-span-7">
                <LearnDemo className="h-full" />
              </Reveal>
              <LearnStages className="lg:col-span-5" />
            </div>
            <TopicGrid />
          </div>
        </section>

        {/* Notes: a note with its blocks, and what the Learn menu makes of it */}
        <section id="notes" className="scroll-mt-14 border-t border-line">
          <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <SectionHead kicker={t.notes.kicker} title={t.notes.title} body={t.notes.body} />
            <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-10">
              <Reveal className="lg:col-span-7">
                <NoteShowcase />
              </Reveal>
              <NoteFeatures className="lg:col-span-5" />
            </div>
          </div>
        </section>

        {/* Working together: sharing, presence, writing at once, project boards */}
        <section id="together" className="scroll-mt-14 border-t border-line bg-surface">
          <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <SectionHead kicker={t.together.kicker} title={t.together.title} body={t.together.body} />
            <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-10">
              <Reveal className="lg:order-2 lg:col-span-7">
                <BoardShowcase />
              </Reveal>
              <TogetherPoints className="content-center sm:grid-cols-2 lg:order-1 lg:col-span-5 lg:grid-cols-1" />
            </div>
          </div>
        </section>

        {/* Notes home and homework */}
        <section className="border-t border-line">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-2 lg:gap-8 lg:py-20">
            <Feature id="organize" kicker={t.organize.kicker} title={t.organize.title} body={t.organize.body}>
              <KnowledgeDemo />
            </Feature>
            <Feature id="homework" kicker={t.homework.kicker} title={t.homework.title} body={t.homework.body}>
              <QuickAddDemo />
            </Feature>
          </div>
        </section>

        {/* Presentations */}
        <section id="presentations" className="scroll-mt-14 border-t border-line bg-surface">
          <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <SectionHead kicker={t.slides.kicker} title={t.slides.title} body={t.slides.body} />
            <Reveal className="mt-8 lg:mt-10">
              <SlidesShowcase />
            </Reveal>
          </div>
        </section>

        {/* CV builder */}
        <section id="cv" className="scroll-mt-14 border-t border-line">
          <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <SectionHead kicker={t.cv.kicker} title={t.cv.title} body={t.cv.body} />
            <Reveal className="mt-8 lg:mt-10">
              <CvShowcase />
            </Reveal>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <Reveal className="mx-auto max-w-[1240px] px-4 py-14 text-center sm:px-6 sm:py-20">
            <h2 className="font-display text-[clamp(30px,4vw,46px)] font-bold tracking-[-0.035em] text-balance">{t.cta.title}</h2>
            <p className="mx-auto mt-3 max-w-[480px] text-[15px] text-ink-2 text-balance">{t.cta.body}</p>
            <Link
              href={primary.href}
              className="mx-auto mt-7 flex h-11 w-fit items-center gap-2 rounded-xl bg-blob px-5 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-transform hover:bg-blob-deep active:scale-[0.98]"
            >
              {primary.label} <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-[12.5px] text-ink-3 sm:px-6 sm:py-5">
          <span className="flex items-center gap-2">
            <BlobMark size={16} /> Blob · {t.footer.tagline}
          </span>
          <LanguageSwitch compact className="ml-auto lg:order-last" />
          {/* On phones the links get a row of their own, under the name and the language switch. */}
          <nav aria-label={t.header.nav} className="-mx-1 flex flex-wrap gap-x-2 max-lg:w-full">
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="px-1 py-2 transition-colors hover:text-ink">
                {item.label}
              </a>
            ))}
            <Link href="/show" className="px-1 py-2 transition-colors hover:text-ink">
              {t.footer.pictures}
            </Link>
            <Link href="/developers" className="px-1 py-2 transition-colors hover:text-ink">
              {t.footer.developers}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <Reveal className="grid items-end gap-x-10 gap-y-3 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <p className="text-[12px] font-medium uppercase tracking-wider text-blob-ink">{kicker}</p>
        <h2 className="mt-2 font-display text-[clamp(30px,3.6vw,46px)] font-bold leading-[1.02] tracking-[-0.035em] text-balance">{title}</h2>
      </div>
      <p className="max-w-[520px] text-[15.5px] leading-relaxed text-ink-2 lg:col-span-5">{body}</p>
    </Reveal>
  );
}

function Feature({ id, kicker, title, body, children }: { id: string; kicker: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <article id={id} className="scroll-mt-20">
      <Reveal className="mb-6 flex min-h-[224px] flex-col justify-center">{children}</Reveal>
      <p className="text-[12px] font-medium uppercase tracking-wider text-blob-ink">{kicker}</p>
      <h3 className="mt-1.5 font-display text-[22px] font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 max-w-[560px] text-[14.5px] leading-relaxed text-ink-2">{body}</p>
    </article>
  );
}
