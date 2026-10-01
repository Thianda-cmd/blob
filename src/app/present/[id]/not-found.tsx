import Link from "next/link";
import { Blob } from "@/components/blob/Blob";

export default function PresentationNotFound() {
  return (
    <div data-theme="dark" className="fixed inset-0 grid place-items-center bg-[#0b0b0a] px-6 text-center text-[#f1efe8]">
      <div className="flex flex-col items-center">
        <Blob size={110} mood="worried" />
        <h1 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.02em]">This presentation isn&apos;t here</h1>
        <p className="mt-1 text-[14px] text-white/55">It may have been deleted, or the link is wrong.</p>
        <Link
          href="/home"
          className="mt-6 inline-flex h-8.5 items-center rounded-lg bg-blob px-3.5 text-[13.5px] font-medium text-white transition-colors hover:bg-blob-deep"
        >
          Back to Blob
        </Link>
      </div>
    </div>
  );
}
