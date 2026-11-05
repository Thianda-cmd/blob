import {
  ArrowRight,
  BadgeQuestionMark,
  BarChart3,
  BellRing,
  CalendarDays,
  ChartScatter,
  FileDown,
  FileSpreadsheet,
  FileUser,
  FlaskConical,
  GraduationCap,
  Hand,
  Lasso,
  LayoutGrid,
  Link2,
  ListChecks,
  ListTodo,
  LogIn,
  Move,
  NotebookPen,
  NotebookText,
  PenLine,
  Presentation,
  Repeat,
  Search,
  Sheet,
  Sigma,
  Signature,
  Smartphone,
  SquareKanban,
  TableProperties,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BlobMark } from "@/components/blob/BlobMark";
import { BoardShowcase } from "@/components/landing/BoardShowcase";
import { CalendarShowcase } from "@/components/landing/CalendarShowcase";
import { CvShowcase } from "@/components/landing/CvShowcase";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { InkShowcase } from "@/components/landing/InkShowcase";
import { CtaBlob, HeroBlob, KnowledgeDemo, QuickAddDemo } from "@/components/landing/Interactive";
import { LearnDemo } from "@/components/landing/LearnDemo";
import { LearnStages, TopicGrid } from "@/components/landing/LearnFeatures";
import { NoteBlocks, NoteShowcase } from "@/components/landing/NoteShowcase";
import { PointList, type Point } from "@/components/landing/Points";
import { QuizShowcase } from "@/components/landing/QuizShowcase";
import { NewChip, Reveal, Section, SectionHead, SubFeature, TrustRow } from "@/components/landing/Section";
import { SheetShowcase } from "@/components/landing/SheetShowcase";
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

/** The page's one primary colour: violet (the deeper violet in the dark theme, for white text at 4.5:1 and more). */
const violet =
  "bg-blob text-white hover:bg-blob-deep dark:bg-blob-deep dark:hover:bg-[color-mix(in_srgb,var(--blob-deep)_88%,white)]";
/** The big way in ("Kostenlos loslegen" / "Blob öffnen"), the same in the hero and the closing panel. */
const cta = `flex h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-[15px] font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-transform active:scale-[0.98] sm:px-5 ${violet}`;
/** The quieter one next to it (an outlined button). */
const ctaSecondary = "flex h-11 items-center whitespace-nowrap rounded-xl border border-line bg-raised px-4 text-[15px] font-medium text-ink-2 shadow-card hover:text-ink sm:px-5";

/** A section's points: its icons, in order, with their copy. */
function points<K extends string>(copy: Record<K, { title: string; body: string }>, icons: Record<K, LucideIcon>): Point[] {
  return (Object.keys(icons) as K[]).map((key) => ({ key, Icon: icons[key], ...copy[key] }));
}

export default async function LandingPage() {
  const [user, t] = await Promise.all([getUser(), getMessages(landingText)]);
  const primary = user ? { href: "/home", label: t.header.open } : { href: "/signup", label: t.hero.cta };
  const nav = [
    { href: "#features", label: t.nav.features },
    { href: "#notes", label: t.nav.notes },
    { href: "#sheets", label: t.nav.sheets, fresh: true },
    { href: "#learn", label: t.nav.learn },
    { href: "#calendar", label: t.nav.calendar },
  ];
  const f = t.footer.links;
  const footer = [
    {
      title: t.footer.columns.write,
      links: [
        { href: "#notes", label: f.notes },
        { href: "#sheets", label: f.sheets },
        { href: "#handwriting", label: f.handwriting },
      ],
    },
    {
      title: t.footer.columns.plan,
      links: [
        { href: "#learn", label: f.learn },
        { href: "#quiz", label: f.quiz },
        { href: "#calendar", label: f.calendar },
        { href: "#homework", label: f.tasks },
      ],
    },
    {
      title: t.footer.columns.together,
      links: [
        { href: "#together", label: f.projects },
        { href: "#presentations", label: f.presentations },
        { href: "#cv", label: f.cv },
      ],
    },
    {
      title: t.footer.columns.more,
      links: [
        { href: "/show", label: f.pictures },
        { href: "/developers", label: f.developers },
        // Signed in: back into the app, never a sign-in link.
        ...(user
          ? [{ href: "/home", label: t.header.open }]
          : [
              { href: "/login", label: f.signIn },
              { href: "/signup", label: f.signUp },
            ]),
      ],
    },
  ];

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper">
      {/* Header, hero and footer use the sections' two insets (px-2/3 outside, 1240 px, px-4/6 inside), so everything lines up. */}
      <header className="safe-top safe-x sticky top-0 z-30 border-b border-line/60 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1264px] items-center gap-2 px-6 sm:gap-4 sm:px-9">
          <Link href="/" aria-label={t.header.home} className="flex h-10 shrink-0 items-center gap-2">
            <BlobMark size={24} />
            <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
          </Link>
          <nav aria-label={t.header.nav} className="hidden items-center gap-0.5 lg:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
              >
                {item.label}
                {item.fresh && <span className="rounded-full bg-blob-soft px-1.5 text-[10.5px] font-semibold leading-[18px] text-blob-ink">{t.newChip}</span>}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LanguageSwitch compact />
            {!user && (
              // Phones: a sign-in icon (the label stays for screen readers); from sm the word.
              <Link
                href="/login"
                aria-label={t.header.signIn}
                className="flex h-8.5 items-center rounded-lg px-2 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink sm:px-3"
              >
                <LogIn className="size-4 sm:hidden" aria-hidden />
                <span className="hidden sm:inline">{t.header.signIn}</span>
              </Link>
            )}
            <Link
              href={primary.href}
              className={`flex h-8.5 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13.5px] font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] sm:px-3.5 ${violet}`}
            >
              {user ? t.header.open : t.header.start} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="safe-x">
        {/* Hero: what Blob is in two sentences, the way in, and Blob (above the fold on phones too). */}
        <section className="relative overflow-hidden px-2 sm:px-3">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_60%_40%,#000_30%,transparent_75%)]" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-4 px-4 pb-6 pt-8 sm:px-6 sm:pb-12 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-16 lg:pt-16">
            <div className="min-w-0">
              <a
                href="#sheets"
                className="group mb-5 inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-line bg-raised pl-1 pr-2.5 text-[12.5px] text-ink-2 shadow-card transition-colors hover:text-ink"
              >
                <NewChip label={t.newChip} className="shrink-0" />
                <span className="truncate sm:hidden">{t.hero.badgeShort}</span>
                <span className="truncate max-sm:hidden">{t.hero.badge}</span>
                <ArrowRight className="size-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
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
              <div className="mt-7 flex flex-wrap items-center gap-2.5 sm:mt-8">
                <Link href={primary.href} className={cta}>
                  {primary.label} <ArrowRight className="size-4" aria-hidden />
                </Link>
                {!user && (
                  <Link href="/login" className={ctaSecondary}>
                    <span className="sm:hidden">{t.hero.signInShort}</span>
                    <span className="max-sm:hidden">{t.hero.haveAccount}</span>
                  </Link>
                )}
              </div>
              <TrustRow items={t.hero.trust} className="mt-5" />
            </div>
            <HeroBlob />
          </div>
        </section>

        {/* Everything at a glance, each tile a way into its section. */}
        <Section id="features" tight>
          <SectionHead icon={LayoutGrid} kicker={t.features.kicker} title={t.features.title} body={t.features.body} />
          <FeatureGrid tiles={t.features.tiles} fresh={t.newChip} />
        </Section>

        {/* Notes: a note and what the Learn menu makes of it; the "/" blocks and the notes home next to it. */}
        <Section id="notes" panel>
          <SectionHead icon={NotebookPen} kicker={t.notes.kicker} title={t.notes.title} body={t.notes.body} />
          <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:order-2 lg:col-span-7">
              <NoteShowcase />
            </Reveal>
            <div className="flex flex-col gap-8 lg:order-1 lg:col-span-5">
              <Reveal>
                <NoteBlocks />
              </Reveal>
              <SubFeature id="organize" icon={Search} kicker={t.organize.kicker} title={t.organize.title} body={t.organize.body}>
                <KnowledgeDemo />
              </SubFeature>
            </div>
          </div>
          <PointList
            className="mt-12 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
            points={points(t.notes.points, { learn: GraduationCap, links: Link2, export: FileDown })}
          />
        </Section>

        {/* Blobxcel: a calibration table becomes a smart table, a chart with a trendline, and lands in a note. */}
        <Section
          id="sheets"
          backdrop={
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-55 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:96px_28px] [mask-image:radial-gradient(ellipse_at_28%_22%,#000_8%,transparent_62%)]"
            />
          }
        >
          <SectionHead icon={Sheet} kicker={t.sheets.kicker} fresh={t.newChip} title={t.sheets.title} body={t.sheets.body} />
          <Reveal className="mt-8 lg:mt-12">
            <SheetShowcase />
          </Reveal>
          <PointList
            className="mt-12 gap-x-10 gap-y-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3"
            points={points(t.sheets.points, {
              smart: TableProperties,
              charts: ChartScatter,
              functions: Sigma,
              live: Link2,
              excel: FileSpreadsheet,
              templates: FlaskConical,
            })}
          />
        </Section>

        {/* Handwriting: a note written by itself on a tablet's page. */}
        <Section id="handwriting" panel>
          <SectionHead icon={Signature} kicker={t.handwriting.kicker} title={t.handwriting.title} body={t.handwriting.body} />
          <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:order-2 lg:col-span-7">
              <InkShowcase />
            </Reveal>
            <PointList
              className="content-center sm:grid-cols-2 lg:order-1 lg:col-span-5 lg:grid-cols-1"
              points={points(t.handwriting.points, { pens: PenLine, shapes: Lasso, tablet: Hand, together: FileDown })}
            />
          </div>
        </Section>

        {/* Learning center */}
        <Section id="learn">
          <SectionHead icon={GraduationCap} kicker={t.learn.kicker} title={t.learn.title} body={t.learn.body} />
          <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:col-span-7">
              <LearnDemo className="h-full" />
            </Reveal>
            <LearnStages className="lg:col-span-5" />
          </div>
          <TopicGrid />
        </Section>

        {/* Live quiz: the big screen and a phone playing one question. */}
        <Section id="quiz" panel>
          <SectionHead icon={BadgeQuestionMark} kicker={t.quiz.kicker} title={t.quiz.title} body={t.quiz.body} />
          <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:order-2 lg:col-span-7">
              <QuizShowcase />
            </Reveal>
            <PointList
              className="content-center sm:grid-cols-2 lg:order-1 lg:col-span-5 lg:grid-cols-1"
              points={points(t.quiz.points, { join: Smartphone, types: ListChecks, notes: NotebookText, results: BarChart3 })}
            />
          </div>
        </Section>

        {/* Calendar: a school week that plans itself; homework typed in plain words next to it. */}
        <Section id="calendar">
          <SectionHead icon={CalendarDays} kicker={t.calendar.kicker} title={t.calendar.title} body={t.calendar.body} />
          <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:col-span-7">
              <CalendarShowcase />
            </Reveal>
            <SubFeature id="homework" icon={ListTodo} kicker={t.homework.kicker} title={t.homework.title} body={t.homework.body} className="self-center lg:col-span-5">
              <QuickAddDemo />
            </SubFeature>
          </div>
          <PointList
            className="mt-12 gap-x-10 gap-y-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3"
            points={points(t.calendar.points, { drag: Move, timetable: Repeat, reminders: BellRing })}
          />
        </Section>

        {/* Working together: sharing, presence, project boards. */}
        <Section id="together" panel>
          <SectionHead icon={SquareKanban} kicker={t.together.kicker} title={t.together.title} body={t.together.body} />
          <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-10">
            <Reveal className="lg:order-2 lg:col-span-7">
              <BoardShowcase />
            </Reveal>
            <PointList
              className="content-center sm:grid-cols-2 lg:order-1 lg:col-span-5 lg:grid-cols-1"
              points={points(t.together.points, { share: Link2, presence: Users, boards: SquareKanban, tasks: ListTodo })}
            />
          </div>
        </Section>

        {/* Presentations */}
        <Section id="presentations">
          <SectionHead icon={Presentation} kicker={t.slides.kicker} title={t.slides.title} body={t.slides.body} />
          <Reveal className="mt-8 lg:mt-10">
            <SlidesShowcase />
          </Reveal>
        </Section>

        {/* CV builder */}
        <Section id="cv" panel>
          <SectionHead icon={FileUser} kicker={t.cv.kicker} title={t.cv.title} body={t.cv.body} />
          <Reveal className="mt-8 lg:mt-10">
            <CvShowcase />
          </Reveal>
        </Section>

        {/* The closing call: Blob waves, the way in once more. */}
        <section className="px-2 pb-2 pt-8 sm:px-3 sm:pb-3 sm:pt-12">
          {/* The reveal sits on the panel: inside it (overflow hidden is a scroll container) it would never run. */}
          <div className="reveal relative mx-auto max-w-[1416px] overflow-hidden rounded-2xl border border-blob/15 bg-blob-soft">
            <div className="bg-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_50%_40%,#000_20%,transparent_70%)]" />
            <div className="relative mx-auto flex max-w-[720px] flex-col items-center px-4 py-14 text-center sm:py-20">
              <CtaBlob />
              <h2 className="mt-4 font-display text-[clamp(30px,4vw,48px)] font-bold leading-[1.05] tracking-[-0.035em] text-balance">{t.cta.title}</h2>
              <p className="mx-auto mt-3 max-w-[480px] text-[15px] text-ink-2 text-balance">{t.cta.body}</p>
              <div className="mt-7 flex flex-wrap justify-center gap-2.5">
                <Link href={primary.href} className={cta}>
                  {primary.label} <ArrowRight className="size-4" aria-hidden />
                </Link>
                {!user && (
                  <Link href="/login" className={ctaSecondary}>
                    <span className="sm:hidden">{t.hero.signInShort}</span>
                    <span className="max-sm:hidden">{t.hero.haveAccount}</span>
                  </Link>
                )}
              </div>
              <TrustRow items={t.hero.trust} className="mt-5 justify-center" />
            </div>
          </div>
        </section>
      </main>

      <footer className="safe-x safe-bottom">
        <div className="mx-auto grid max-w-[1264px] grid-cols-2 gap-x-6 gap-y-8 px-6 py-12 sm:px-9 md:grid-cols-4 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" aria-label={t.header.home} className="flex h-8 w-fit items-center gap-2">
              <BlobMark size={22} />
              <span className="font-display text-[17px] font-bold tracking-[-0.03em]">Blob</span>
            </Link>
            <p className="mt-1.5 text-[13.5px] text-ink-2">{t.footer.tagline}</p>
            <LanguageSwitch compact className="mt-4" />
          </div>
          <nav aria-label={t.footer.nav} className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-8 md:col-span-4 md:grid-cols-4 lg:col-span-4">
            {footer.map((column) => (
              <div key={column.title}>
                <p className="text-[12px] font-medium text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]">{column.title}</p>
                <ul className="mt-1.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith("#") ? (
                        <a href={link.href} className="flex h-8 w-fit items-center text-[13.5px] text-ink-2 transition-colors hover:text-ink">
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="flex h-8 w-fit items-center text-[13.5px] text-ink-2 transition-colors hover:text-ink">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mx-auto max-w-[1264px] px-6 sm:px-9">
          <p className="border-t border-line py-5 text-[12.5px] text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]">{t.footer.fine}</p>
        </div>
      </footer>
    </div>
  );
}
