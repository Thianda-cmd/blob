"use client";

import { useEffect } from "react";
import { Blob } from "@/components/blob/Blob";
import { buttonClass } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { errorsText } from "@/i18n/messages/errors";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useMessages(errorsText).error;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[70dvh] flex-1 place-items-center px-6">
      <div className="flex flex-col items-center text-center">
        <Blob size={140} mood="worried" />
        <h1 className="mt-2 font-display text-[26px] font-bold tracking-[-0.03em] text-balance">{t.title}</h1>
        <p className="mt-1.5 max-w-[380px] text-[14px] text-ink-2">{t.body}</p>
        <button type="button" onClick={reset} className={buttonClass("blob", "lg", "mt-6")}>
          {t.retry}
        </button>
      </div>
    </div>
  );
}
