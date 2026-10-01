import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Blob — your school, saved", template: "%s · Blob" },
  description: "Notes, presentations and homework in one calm workspace, with a jelly friend who keeps everything saved.",
  applicationName: "Blob",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

// Runs before first paint: applies the saved theme and marks the intro as already played.
const bootScript = `(function(){try{var t=localStorage.getItem('blob-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(sessionStorage.getItem('blob-booted')||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.booted='1'}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${bricolage.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <style>{`[data-booted] .blob-boot{display:none}`}</style>
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
