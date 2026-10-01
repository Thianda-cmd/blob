"use client";

import { useEffect } from "react";
import { Blob } from "@/components/blob/Blob";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[70dvh] flex-1 place-items-center px-6">
      <div className="flex flex-col items-center text-center">
        <Blob size={140} mood="worried" />
        <h1 className="mt-2 font-display text-[26px] font-bold tracking-[-0.03em]">Oops, something went squish</h1>
        <p className="mt-1.5 max-w-[380px] text-[14px] text-ink-2">That wasn&apos;t supposed to happen. Your saved work is safe. Try again in a moment.</p>
        <button onClick={reset} className="mt-6 h-9 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-paper hover:bg-ink/88">
          Try again
        </button>
      </div>
    </div>
  );
}
