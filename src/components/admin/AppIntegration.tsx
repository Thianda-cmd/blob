"use client";

import { ArrowUpRight, Check, Download } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CodeBlock } from "@/components/oauth/CodeBlock";
import { CopyField } from "@/components/oauth/Copy";
import { useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";
import { developersText } from "@/i18n/messages/developers";
import type { AdminApp } from "@/lib/oauth/admin-types";
import { authorizeExample, curlExchange, sdkQuickStart } from "@/lib/oauth/snippets";
import { Panel, TypeBadge } from "./parts";

const ENDPOINT_ORDER = ["authorization_endpoint", "token_endpoint", "userinfo_endpoint", "revocation_endpoint", "jwks_uri", "blob_data_endpoint"];

/** The Integration tab: copy-paste setup with the real issuer and this app's client id. */
export function AppIntegration({ app, issuer, endpoints }: { app: AdminApp; issuer: string; endpoints: Record<string, string> }) {
  const t = useMessages(adminText);
  const d = useMessages(developersText);
  const i = t.integration;
  const redirect = app.redirect_uris[0] ?? "https://your-site.org/blob-callback.html";
  const vars = { issuer, clientId: app.client_id, redirectUri: redirect };
  const copy = { label: t.copy, copiedLabel: t.copied };
  const discovery = `${issuer}/.well-known/openid-configuration`;

  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-ink-2">{i.intro(app.name)}</p>

      <Panel title={i.details}>
        <dl className="grid gap-x-6 gap-y-3 px-4 pb-4 pt-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:px-5 sm:pb-5">
          <Term>{i.clientId}</Term>
          <dd className="min-w-0">
            <CopyField value={app.client_id} {...copy} />
          </dd>
          <Term>{t.form.type}</Term>
          <dd>
            <TypeBadge confidential={app.confidential} />
          </dd>
          <Term>{i.issuer}</Term>
          <dd className="min-w-0">
            <CopyField value={issuer} {...copy} />
          </dd>
          <Term>{i.discovery}</Term>
          <dd className="min-w-0">
            <CopyField value={discovery} {...copy} />
          </dd>
          <Term>{i.redirects}</Term>
          <dd className="min-w-0 space-y-1.5">
            {app.redirect_uris.length ? app.redirect_uris.map((uri) => <CopyField key={uri} value={uri} {...copy} />) : <p className="text-[13px] text-ink-3">{i.noRedirect}</p>}
          </dd>
        </dl>
      </Panel>

      {app.confidential ? (
        <>
          <Panel title={i.serverTitle} sub={i.serverBody}>
            <div className="space-y-4 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              <div>
                <h3 className="mb-2 text-[13px] font-medium text-ink-2">1. {i.step1}</h3>
                <CodeBlock code={authorizeExample(vars)} lang="text" title="GET /oauth/authorize" copyLabel={t.copy} copiedLabel={t.copied} />
              </div>
              <div>
                <h3 className="mb-2 text-[13px] font-medium text-ink-2">2. {i.step2}</h3>
                <CodeBlock code={curlExchange(vars, d.notes)} lang="shell" title="POST /api/oauth/token" copyLabel={t.copy} copiedLabel={t.copied} />
              </div>
            </div>
          </Panel>
          <Checklist title={i.checklist} items={[i.keepSecret, i.usePkce, i.verifyId, i.exactRedirect]} />
        </>
      ) : (
        <>
          <Panel title={i.sdkTitle} sub={i.sdkBody}>
            <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
              <CodeBlock code={`<button id="login">${d.notes.login}</button>\n\n${sdkQuickStart(vars)}`} lang="html" title="index.html" copyLabel={t.copy} copiedLabel={t.copied} />
            </div>
          </Panel>
          <Checklist
            title={i.checklist}
            items={[
              <>
                {i.callback} <code className="break-all font-mono text-[12px] text-ink">{redirect}</code>
                <a
                  href={`${issuer}/sdk/blob-callback.html`}
                  download="blob-callback.html"
                  className="mt-1.5 flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-blob-ink hover:underline"
                >
                  <Download className="size-3.5" /> {i.callbackDownload}
                </a>
              </>,
              i.handleRedirect,
              i.accessToken,
              i.test,
            ]}
          />
        </>
      )}

      <Panel title={i.endpoints}>
        <dl className="grid gap-x-6 gap-y-3 px-4 pb-4 pt-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:px-5 sm:pb-5">
          {ENDPOINT_ORDER.filter((k) => endpoints[k]).map((k) => (
            <EndpointRow key={k} label={i.endpoint[k] ?? k} value={endpoints[k]} copy={copy} />
          ))}
        </dl>
      </Panel>

      <Link href="/developers" target="_blank" className="inline-flex items-center gap-1 text-[13px] font-medium text-blob-ink hover:underline">
        {i.fullDocs} <ArrowUpRight className="size-3.5" />
      </Link>
    </div>
  );
}

function Term({ children }: { children: ReactNode }) {
  return <dt className="pt-1.5 text-[12.5px] font-medium text-ink-2">{children}</dt>;
}

function EndpointRow({ label, value, copy }: { label: string; value: string; copy: { label: string; copiedLabel: string } }) {
  return (
    <>
      <Term>{label}</Term>
      <dd className="min-w-0">
        <CopyField value={value} {...copy} />
      </dd>
    </>
  );
}

function Checklist({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <Panel title={title}>
      <ol className="space-y-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {items.map((item, n) => (
          <li key={n} className="flex gap-3 text-[13px] leading-relaxed text-ink-2">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-blob-soft text-blob-ink">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <div className="min-w-0">{item}</div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
