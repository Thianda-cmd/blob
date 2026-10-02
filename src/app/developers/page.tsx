import { ArrowRight, Download, FileJson, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { SignInPreview } from "@/components/developers/SignInPreview";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { CodeBlock } from "@/components/oauth/CodeBlock";
import { CopyField } from "@/components/oauth/Copy";
import { developersText } from "@/i18n/messages/developers";
import { getMessages } from "@/i18n/server";
import { dataEndpoint, endpoints, issuer, SCOPES } from "@/lib/oauth/config";
import { authorizeExample, curlExchange, sdkFullExample, sdkQuickStart, tokenResponse } from "@/lib/oauth/snippets";

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getMessages(developersText);
  return { title: { absolute: meta.title }, description: meta.description };
}

const SECTIONS = ["how", "quick", "popup", "sdk", "scopes", "endpoints", "server", "tokens", "security"] as const;
const ENDPOINT_ORDER = ["authorization_endpoint", "token_endpoint", "userinfo_endpoint", "revocation_endpoint", "jwks_uri", "blob_data_endpoint"] as const;

/** Public docs for "Sign in with Blob" (linked from the discovery document's service_documentation). */
export default async function DevelopersPage() {
  const t = await getMessages(developersText);
  const iss = issuer();
  const urls = { ...endpoints(iss), blob_data_endpoint: dataEndpoint(iss) };
  const discovery = `${iss}/.well-known/openid-configuration`;
  const vars = { issuer: iss, clientId: "YOUR_CLIENT_ID", redirectUri: t.example.redirect };
  const copy = { copyLabel: t.copy, copiedLabel: t.copied };

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1160px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label={t.header.home} className="flex items-center gap-2">
            <BlobMark size={24} />
            <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
          </Link>
          <span className="h-5 w-px bg-line-2" aria-hidden />
          <span className="text-[14px] font-medium text-ink-2">{t.header.docs}</span>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitch compact />
            <Link href="/home" className="hidden h-8.5 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13.5px] font-medium text-paper hover:bg-ink/88 sm:flex">
              {t.header.open} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_70%_40%,#000_25%,transparent_75%)]" />
          <div className="relative mx-auto grid max-w-[1160px] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-16">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-blob-ink">{t.hero.eyebrow}</p>
              <h1 className="mt-3 font-display text-[clamp(34px,4.6vw,54px)] font-bold leading-[1.02] tracking-[-0.04em] text-balance">{t.hero.title}</h1>
              <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-ink-2">{t.hero.body}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="#quick" className="flex h-10 items-center gap-2 rounded-xl bg-ink px-4.5 text-[14.5px] font-medium text-paper hover:bg-ink/88">
                  {t.hero.start} <ArrowRight className="size-4" />
                </a>
                <a
                  href={discovery}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 items-center gap-2 rounded-xl border border-line bg-raised px-4 text-[14px] font-medium text-ink-2 shadow-card hover:text-ink"
                >
                  <FileJson className="size-4" /> {t.hero.discovery}
                </a>
              </div>
            </div>
            <SignInPreview />
          </div>
        </section>

        <div className="mx-auto grid max-w-[1160px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:py-16">
          <nav aria-label={t.toc.label} className="hidden lg:block">
            <div className="sticky top-24">
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t.toc.label}</div>
              <ul className="space-y-0.5 border-l border-line">
                {SECTIONS.map((id) => (
                  <li key={id}>
                    <a href={`#${id}`} className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-[13.5px] text-ink-2 transition-colors hover:border-blob hover:text-ink">
                      {t.toc[id]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0 max-w-[760px] space-y-16">
            <Section id="how" title={t.how.title}>
              <ol className="grid gap-3 sm:grid-cols-2">
                {t.how.steps.map((step, i) => (
                  <li key={step.title} className="rounded-xl border border-line bg-raised p-4 shadow-card">
                    <div className="flex items-center gap-2.5">
                      <Num>{i + 1}</Num>
                      <h3 className="text-[14.5px] font-semibold">{step.title}</h3>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{step.body}</p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="quick" title={t.quick.title} intro={t.quick.intro}>
              <ol className="space-y-8">
                <Step n={1} title={t.quick.register}>
                  <p>{t.quick.registerBody}</p>
                </Step>
                <Step n={2} title={t.quick.callback}>
                  <p>{t.quick.callbackBody}</p>
                  <a href="/sdk/blob-callback.html" download="blob-callback.html" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-blob-ink hover:underline">
                    <Download className="size-4" /> {t.quick.download}
                  </a>
                </Step>
                <Step n={3} title={t.quick.sdk}>
                  <p>{t.quick.sdkBody}</p>
                  <CodeBlock className="mt-3" code={`<button id="login">${t.notes.login}</button>\n\n${sdkQuickStart(vars)}`} lang="html" title="index.html" {...copy} />
                  <p className="mt-2 text-[12.5px] text-ink-3">{t.quick.placeholderNote}</p>
                </Step>
              </ol>
              <div className="mt-10">
                <h3 className="text-[15px] font-semibold">{t.quick.full}</h3>
                <p className="mt-1 text-[14px] text-ink-2">{t.quick.fullBody}</p>
                <CodeBlock className="mt-3" code={sdkFullExample(vars, t.notes)} lang="html" title="index.html" {...copy} />
              </div>
            </Section>

            <Section id="popup" title={t.popup.title}>
              <FlowStrip />
              <div className="mt-5 space-y-3 text-[14.5px] leading-relaxed text-ink-2">
                {t.popup.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </Section>

            <Section id="sdk" title={t.sdk.title} intro={t.sdk.intro}>
              <Rows
                head={[t.sdk.head.name, t.sdk.head.what]}
                cols="sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                rows={t.sdk.rows.map(([name, what]) => [<code key="n" className="break-words font-mono text-[12.5px] text-ink">{name}</code>, what])}
              />
            </Section>

            <Section id="scopes" title={t.scopes.title} intro={t.scopes.intro}>
              <Rows
                head={[t.scopes.head.scope, t.scopes.head.claims, t.scopes.head.meaning]}
                cols="sm:grid-cols-[130px_minmax(0,1fr)_minmax(0,1.3fr)]"
                rows={SCOPES.map((s) => [
                  <code key="s" className="font-mono text-[12.5px] font-medium text-ink">{s}</code>,
                  <code key="c" className="font-mono text-[12.5px] text-ink-2">{t.scopes.claims[s] ?? ""}</code>,
                  t.scopes.rows[s] ?? "",
                ])}
              />
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{t.scopes.note}</p>
            </Section>

            <Section id="endpoints" title={t.endpoints.title} intro={t.endpoints.intro}>
              <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-line bg-raised p-4 shadow-card sm:grid-cols-[170px_minmax(0,1fr)] sm:p-5">
                <Term>{t.endpoints.discovery}</Term>
                <dd className="min-w-0">
                  <CopyField value={discovery} label={t.copy} copiedLabel={t.copied} />
                </dd>
                <Term>{t.endpoints.issuer}</Term>
                <dd className="min-w-0">
                  <CopyField value={iss} label={t.copy} copiedLabel={t.copied} />
                </dd>
                {ENDPOINT_ORDER.map((k) => (
                  <Fragment key={k}>
                    <Term>{t.endpoints.names[k]}</Term>
                    <dd className="min-w-0">
                      <CopyField value={urls[k]} label={t.copy} copiedLabel={t.copied} />
                    </dd>
                  </Fragment>
                ))}
              </dl>
            </Section>

            <Section id="server" title={t.server.title} intro={t.server.body}>
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-[14px] font-semibold">{t.server.authorize}</h3>
                  <CodeBlock code={authorizeExample(vars)} lang="text" title="GET /oauth/authorize" {...copy} />
                </div>
                <div>
                  <h3 className="mb-2 text-[14px] font-semibold">{t.server.exchange}</h3>
                  <CodeBlock code={curlExchange(vars, t.notes)} lang="shell" title="POST /api/oauth/token" {...copy} />
                </div>
                <div>
                  <h3 className="mb-2 text-[14px] font-semibold">{t.server.response}</h3>
                  <CodeBlock code={tokenResponse} lang="json" title="200 OK · application/json" {...copy} />
                </div>
                <p className="text-[14px] leading-relaxed text-ink-2">{t.server.verify}</p>
              </div>
            </Section>

            <Section id="tokens" title={t.tokens.title}>
              <Rows
                head={[t.tokens.head.token, t.tokens.head.lifetime, t.tokens.head.notes]}
                cols="sm:grid-cols-[150px_100px_minmax(0,1fr)]"
                rows={t.tokens.rows.map(([name, life, notes]) => [<span key="n" className="font-medium text-ink">{name}</span>, <span key="l" className="text-ink">{life}</span>, notes])}
              />
            </Section>

            <Section id="security" title={t.security.title}>
              <ul className="space-y-2.5">
                {t.security.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-ink-2">
                    <ShieldCheck className="mt-1 size-4 shrink-0 text-blob-ink" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5 text-[12.5px] text-ink-3 sm:px-6">
          <span className="flex items-center gap-2">
            <BlobMark size={16} /> Blob · {t.footer.tagline}
          </span>
          <span>{t.footer.questions}</span>
          <LanguageSwitch compact className="ml-auto" />
        </div>
      </footer>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">
        {title}
      </h2>
      {intro && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{intro}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blob-soft text-[12px] font-semibold text-blob-ink">{children}</span>;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <Num>{n}</Num>
      <div className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink-2">
        <h3 className="mb-1 text-[15px] font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function Term({ children }: { children: ReactNode }) {
  return <dt className="pt-1.5 text-[13px] font-medium text-ink-2">{children}</dt>;
}

/** A small table that stacks into cards on phones. */
function Rows({ head, rows, cols }: { head: string[]; rows: ReactNode[][]; cols: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised shadow-card" role="table">
      <div role="row" className={`hidden gap-4 border-b border-line bg-surface px-4 py-2 text-[12px] font-medium text-ink-3 sm:grid ${cols}`}>
        {head.map((h) => (
          <div key={h} role="columnheader">
            {h}
          </div>
        ))}
      </div>
      {rows.map((cells, i) => (
        <div key={i} role="row" className={`grid gap-1 border-b border-line px-4 py-3 text-[13.5px] leading-relaxed text-ink-2 last:border-b-0 sm:gap-4 ${cols}`}>
          {cells.map((cell, j) => (
            <div key={j} role="cell" className="min-w-0">
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Your page → Blob popup → blob-callback.html → your page. */
async function FlowStrip() {
  const t = await getMessages(developersText);
  const steps = [
    { label: t.example.site, sub: "signIn()" },
    { label: "Blob", sub: "/oauth/authorize" },
    { label: "blob-callback.html", sub: "?code=…&state=…" },
    { label: t.example.site, sub: t.popup.flowEnd },
  ];
  return (
    <ol className="flex flex-wrap items-stretch gap-2" aria-label={t.popup.title}>
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-2">
          <div className={`rounded-xl border px-3 py-2 ${i === 1 ? "border-blob/40 bg-blob-soft/50" : "border-line bg-raised"} shadow-card`}>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              {i === 1 && <BlobMark size={16} />}
              {s.label}
            </div>
            <div className={`text-[11.5px] text-ink-3 ${i < steps.length - 1 ? "font-mono" : ""}`}>{s.sub}</div>
          </div>
          {i < steps.length - 1 && <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
