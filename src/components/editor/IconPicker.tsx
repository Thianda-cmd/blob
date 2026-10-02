"use client";

import { Shuffle, SmilePlus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { editorText } from "@/i18n/messages/editor";
import { cn } from "@/lib/utils";

export const SCHOOL_EMOJIS = [
  "📚", "📖", "📝", "✏️", "🖊️", "🖍️", "📐", "📏", "🧮", "📊",
  "📈", "📅", "⏰", "📌", "📎", "🔖", "🗂️", "💡", "🧠", "🎓",
  "🔬", "🧪", "⚗️", "🧬", "🦠", "🌱", "🌿", "🍎", "🌍", "🗺️",
  "🌋", "🪐", "🔭", "⚛️", "🧲", "⚡", "💧", "🔥", "🌊", "☀️",
  "🏛️", "📜", "⚖️", "🗳️", "🎨", "🎭", "🎵", "🎸", "💻", "🤖",
  "🧩", "🎯", "🏆", "⭐", "✅", "❤️", "🚀", "🌈", "🦉", "🏃",
];

function Grid({ current, onPick, close }: { current: string | null; onPick: (emoji: string | null) => void; close: () => void }) {
  const t = useMessages(editorText).icon;
  return (
    <div className="w-[332px] p-1.5">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[11px] font-medium text-ink-3">{t.pick}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              const pool = SCHOOL_EMOJIS.filter((e) => e !== current);
              onPick(pool[Math.floor(Math.random() * pool.length)]);
              close();
            }}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] text-ink-2 hover:bg-hover hover:text-ink"
          >
            <Shuffle className="size-3.5" /> {t.random}
          </button>
          {current && (
            <button
              type="button"
              onClick={() => {
                onPick(null);
                close();
              }}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] text-ink-2 hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-3.5" /> {t.remove}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-10 gap-0.5">
        {SCHOOL_EMOJIS.map((emoji, i) => (
          <motion.button
            key={emoji}
            type="button"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 700, damping: 26, delay: Math.min(i * 0.004, 0.2) }}
            whileHover={{ scale: 1.18 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              onPick(emoji);
              close();
            }}
            className={cn("grid size-8 place-items-center rounded-lg text-[19px] leading-none hover:bg-hover", current === emoji && "bg-blob-soft")}
            aria-label={t.use(emoji)}
          >
            {emoji}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** The big page icon above the title, or an "Add icon" affordance when there is none. */
export function IconPicker({ icon, onChange }: { icon: string | null; onChange: (icon: string | null) => void }) {
  const t = useMessages(editorText).icon;
  if (icon) {
    return (
      <Popover
        align="start"
        className="p-0"
        trigger={(props) => (
          <button
            {...props}
            type="button"
            className="-ml-1.5 grid size-[72px] place-items-center rounded-xl text-[54px] leading-none transition-[background,transform] duration-150 hover:bg-hover active:scale-95"
            aria-label={t.change}
            title={t.change}
          >
            <motion.span key={icon} initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 520, damping: 14 }}>
              {icon}
            </motion.span>
          </button>
        )}
      >
        {(close) => <Grid current={icon} onPick={onChange} close={close} />}
      </Popover>
    );
  }
  return (
    <Popover
      align="start"
      className="p-0"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className="-ml-1.5 flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-ink-3 opacity-0 transition-[opacity,background,color] duration-150 hover:bg-hover hover:text-ink-2 focus-visible:opacity-100 group-hover/header:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <SmilePlus className="size-4" /> {t.add}
        </button>
      )}
    >
      {(close) => <Grid current={null} onPick={onChange} close={close} />}
    </Popover>
  );
}
