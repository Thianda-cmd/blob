import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { MotionProvider } from "@/components/MotionProvider";
import { NativeBridge } from "@/components/NativeBridge";
import { LocaleProvider } from "@/i18n/client";
import { metaText } from "@/i18n/messages/meta";
import { getLocale, getMessages } from "@/i18n/server";
import { currentIssuer } from "@/lib/oauth/config";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
// Maths: upright numbers and italic variables, like a good textbook.
const mathSerif = Source_Serif_4({ variable: "--font-serif-math", subsets: ["latin"], style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  const [m, origin] = await Promise.all([getMessages(metaText), currentIssuer()]);
  // metadataBase: canonical and og:url links become full addresses (shared pictures, link previews).
  return { title: { default: m.title, template: "%s · Blob" }, description: m.description, applicationName: "Blob", metadataBase: new URL(origin) };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

// Runs before first paint: applies the saved theme and marks the intro as already played.
// An embedded picture (/embed/…?theme=dark) takes its theme from the address. Storage can throw inside a
// frame on another site, so the theme doesn't depend on it.
const bootScript = `(function(){var h=document.documentElement,t='system',q=location.pathname.indexOf('/embed/')===0?new URLSearchParams(location.search).get('theme'):null;try{t=localStorage.getItem('blob-theme')||'system'}catch(e){}if(q==='light'||q==='dark')t=q;var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);h.dataset.theme=d?'dark':'light';var b=false;try{b=!!sessionStorage.getItem('blob-booted')}catch(e){}if(b||matchMedia('(prefers-reduced-motion: reduce)').matches)h.dataset.booted='1'})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} ${mathSerif.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <style>{`[data-booted] .blob-boot{display:none}`}</style>
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        <LocaleProvider locale={locale}>
          <MotionProvider>{children}</MotionProvider>
        </LocaleProvider>
        <NativeBridge />
      </body>
    </html>
  );
}
