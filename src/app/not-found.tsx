import Link from "next/link";
import { Blob } from "@/components/blob/Blob";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh flex-1 place-items-center bg-paper px-6">
      <div className="flex flex-col items-center text-center">
        <Blob size={150} mood="surprised" />
        <h1 className="mt-2 font-display text-[28px] font-bold tracking-[-0.03em]">This page wobbled away</h1>
        <p className="mt-1.5 max-w-[360px] text-[14px] text-ink-2">It may have been deleted, or the link is wrong. Your other notes are safe.</p>
        <Link href="/home" className="mt-6 flex h-9 items-center rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper hover:bg-ink/88">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
