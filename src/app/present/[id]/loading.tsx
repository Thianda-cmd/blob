"use client";

import { GooSpinner } from "@/components/blob/GooSpinner";
import { useMessages } from "@/i18n/client";
import { presentText } from "@/i18n/messages/present";

export default function Loading() {
  const t = useMessages(presentText);
  return (
    <div data-theme="dark" className="fixed inset-0 grid place-items-center bg-[#0b0b0a]">
      <GooSpinner size={56} label={t.loading} />
    </div>
  );
}
