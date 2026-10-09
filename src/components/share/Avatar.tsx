"use client";

import { peerColor } from "@/lib/live";
import { cn } from "@/lib/utils";

export type Person = { user_id: string; full_name?: string | null; name?: string | null; avatar_url: string | null };

export const personName = (p: Pick<Person, "full_name" | "name">, fallback = "?") => (p.full_name ?? p.name ?? "").trim() || fallback;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 1)).toUpperCase();
}

/**
 * Someone's picture, or their initials on their own colour (the same colour as their cursor and
 * presence dot, so you recognise people everywhere). `ring` draws a coloured ring: "here right now".
 */
export function Avatar({
  person,
  size = 24,
  ring,
  className,
  title,
}: {
  person: Person;
  size?: number;
  /** A ring in the person's colour (they are here right now). */
  ring?: boolean;
  className?: string;
  title?: string;
}) {
  const name = personName(person);
  const color = peerColor(person.user_id);
  const style = { width: size, height: size, ...(ring ? { boxShadow: `0 0 0 2px var(--raised), 0 0 0 3.5px ${color}` } : {}) };
  if (person.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar from storage
      <img src={person.avatar_url} alt="" title={title ?? name} className={cn("shrink-0 rounded-full object-cover", className)} style={style} />
    );
  }
  return (
    <span
      title={title ?? name}
      aria-hidden
      className={cn("grid shrink-0 select-none place-items-center rounded-full font-semibold leading-none text-white", className)}
      style={{ ...style, background: color, fontSize: Math.max(9, Math.round(size * 0.4)) }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatars, at most `max` of them, then "+3". */
export function AvatarStack({
  people,
  size = 22,
  max = 4,
  here,
  className,
  label,
}: {
  people: Person[];
  size?: number;
  max?: number;
  /** User ids that are here right now (ringed). */
  here?: Set<string>;
  className?: string;
  label?: string;
}) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className={cn("flex items-center", className)} aria-label={label} role={label ? "img" : undefined}>
      {shown.map((p, i) => (
        <Avatar
          key={p.user_id}
          person={p}
          size={size}
          ring={here?.has(p.user_id)}
          className={cn(i > 0 && "-ml-1.5", !here?.has(p.user_id) && "ring-2 ring-raised")}
        />
      ))}
      {more > 0 && (
        <span
          className="-ml-1.5 grid shrink-0 place-items-center rounded-full bg-hover font-semibold tabular-nums text-ink-2 ring-2 ring-raised"
          style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) }}
        >
          +{more}
        </span>
      )}
    </span>
  );
}
