import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { MotionProvider } from "@/components/MotionProvider";
import { LocaleProvider } from "@/i18n/client";
import { metaText } from "@/i18n/messages/meta";
import { getLocale, getMessages } from "@/i18n/server";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
// Maths: upright numbers and italic variables, like a good textbook.
const mathSerif = Source_Serif_4({ variable: "--font-serif-math", subsets: ["latin"], style: ["normal", "italic"] });

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMessages(metaText);
  return { title: { default: m.title, template: "%s · Blob" }, description: m.description, applicationName: "Blob" };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

// Runs before first paint: applies the saved theme and marks the intro as already played.
const bootScript = `(function(){try{var t=localStorage.getItem('blob-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(sessionStorage.getItem('blob-booted')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.booted='1'}catch(e){}})()`;

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
      </body>
    </html>
  );
}
