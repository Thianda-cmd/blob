import Link from "next/link";
import { BlobMark } from "@/components/blob/BlobMark";
import { LanguageSwitch } from "@/components/LanguageSwitch";

/** A calm, centred frame for "Sign in with Blob": works as a popup (≈480px) and as a full page. */
export default function OAuthLayout({ children }: LayoutProps<"/oauth">) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-paper">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <header className="relative flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" target="_blank" className="flex items-center gap-2 rounded-lg">
          <BlobMark size={24} />
          <span className="font-display text-[17px] font-bold tracking-[-0.03em]">Blob</span>
        </Link>
        <LanguageSwitch compact />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:items-center sm:pt-0">{children}</main>
    </div>
  );
}
