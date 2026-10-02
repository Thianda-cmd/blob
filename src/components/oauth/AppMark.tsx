import { cn } from "@/lib/utils";

type Props = {
  app: { name: string; logo_url: string | null; mark: string; color: string };
  size?: number;
  className?: string;
};

/** An app's logo, or its emoji / initials on its colour. */
export function AppMark({ app, size = 48, className }: Props) {
  const radius = Math.round(size * 0.28);
  if (app.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos live on the apps' own domains
      <img
        src={app.logo_url}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 border border-line bg-raised object-cover", className)}
        style={{ borderRadius: radius }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const text = app.mark || initials(app.name);
  const emoji = /\p{Extended_Pictographic}/u.test(text);
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center font-display font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]", className)}
      style={{ width: size, height: size, borderRadius: radius, background: app.color, fontSize: size * (emoji ? 0.5 : 0.38) }}
    >
      {text}
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";
