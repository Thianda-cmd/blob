"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, type Text } from "@/i18n/text";
import { parseDisplay, type DNode, type StyleName } from "@/learn/engine/display";
import { cn } from "@/lib/utils";

const SIZES = { inline: "1.05em", sm: "18px", md: "24px", lg: "34px", xl: "46px" } as const;
export type MathSize = keyof typeof SIZES;

const leafMotion = {
  initial: { opacity: 0, scale: 0.6, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.18 } },
  transition: { type: "spring" as const, stiffness: 380, damping: 30, mass: 0.8 },
};

type Ctx = { scope: string; highlight: Set<string>; animate: boolean };

const RELATIONS = new Set(["=", "<", ">", "≤", "≥", "≠", "≈", "⇒", "⇔", "→", "⇌", "∈"]);
const BINARY = new Set(["+", "−", "·", "×", ":", "/", "±"]);

/**
 * Renders the display language (see engine/display.ts). Change `src` and the
 * tokens animate to their new places. `highlight` takes token keys like "x#1".
 */
export function MathView({
  src,
  size = "md",
  highlight,
  arrows,
  scope,
  animate = true,
  className,
}: {
  /** Display-language maths; bilingual only when it contains words. */
  src: Text;
  size?: MathSize;
  highlight?: string[];
  arrows?: [string, string][];
  scope?: string;
  animate?: boolean;
  className?: string;
}) {
  const auto = useId();
  const locale = useLocale();
  const source = resolveText(src, locale);
  const nodes = useMemo(() => parseDisplay(source), [source]);
  const ctx: Ctx = { scope: scope ?? auto, highlight: new Set(highlight ?? []), animate };
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <LayoutGroup id={ctx.scope}>
      <span
        ref={ref}
        className={cn("blob-math relative inline-flex max-w-full flex-wrap items-center", className)}
        style={{ fontSize: SIZES[size] }}
        aria-label={spoken(source)}
        role="math"
      >
        <Children nodes={nodes} ctx={ctx} />
        {arrows && arrows.length > 0 && <Arrows root={ref} arrows={arrows} signature={source} />}
      </span>
    </LayoutGroup>
  );
}

/** Screen-reader text: drops animation keys ("7#a x#ax" → "7 x"), commands and braces. */
const spoken = (source: string) =>
  source
    .replace(/#[A-Za-z0-9_-]+/g, "")
    .replace(/\\[a-z]+|[{}#"]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Labels like "(I)" or "a:" behave like the start of an expression: a minus after them is a sign. */
const LABEL = /^\(.*\)$|:$/;

/** The token a sign looks back at: skips spaces, so "| \, -1" still reads as a negative number. */
function previous(nodes: DNode[], i: number): DNode | undefined {
  for (let j = i - 1; j >= 0; j--) {
    const n = nodes[j];
    if (n.type !== "space" || n.v === "br") return n;
  }
  return undefined;
}

function Children({ nodes, ctx }: { nodes: DNode[]; ctx: Ctx }) {
  return (
    <AnimatePresence initial={false}>
      {nodes.map((n, i) => (
        <Node key={n.k} node={n} ctx={ctx} prev={previous(nodes, i)} />
      ))}
    </AnimatePresence>
  );
}

function Leaf({ k, ctx, className, children, style }: { k: string; ctx: Ctx; className?: string; children: ReactNode; style?: React.CSSProperties }) {
  const lit = ctx.highlight.has(k);
  if (!ctx.animate) {
    return (
      <span data-mk={k} className={cn("mv-leaf", lit && "mv-lit", className)} style={style}>
        {children}
      </span>
    );
  }
  return (
    <motion.span
      layout="position"
      layoutId={`${ctx.scope}:${k}`}
      data-mk={k}
      className={cn("mv-leaf", lit && "mv-lit", className)}
      style={style}
      {...leafMotion}
    >
      {children}
    </motion.span>
  );
}

function Node({ node, ctx, prev }: { node: DNode; ctx: Ctx; prev?: DNode }) {
  switch (node.type) {
    case "num":
      return <Leaf k={node.k} ctx={ctx} className="mv-num">{node.v}</Leaf>;
    case "var":
      return <Leaf k={node.k} ctx={ctx} className="mv-var">{node.v}</Leaf>;
    case "sym":
      return <Leaf k={node.k} ctx={ctx} className="mv-num">{node.v}</Leaf>;
    case "text":
      return <Leaf k={node.k} ctx={ctx} className="mv-text">{node.v}</Leaf>;
    case "space":
      if (node.v === "br") return <span className="block h-0 basis-full" />;
      return <span className={node.v === "quad" ? "inline-block w-[1em]" : node.v === "med" ? "inline-block w-[0.28em]" : "inline-block w-[0.18em]"} />;
    case "op": {
      const signLike = node.v === "−" || node.v === "±";
      const unary =
        (node.v === "+" && (!prev || (prev.type === "op" && RELATIONS.has(prev.v)))) ||
        (signLike &&
        (!prev ||
          (prev.type === "op" && !["!", "%", "°"].includes(prev.v) && (node.v === "−" || RELATIONS.has(prev.v))) ||
          (prev.type === "space" && prev.v === "br") ||
          (node.v === "−" && prev.type === "text" && LABEL.test(prev.v))));
      const cls = RELATIONS.has(node.v) ? "mv-rel" : BINARY.has(node.v) && !unary ? "mv-bin" : node.v === "," || node.v === ";" ? "mv-punct" : "mv-op";
      return <Leaf k={node.k} ctx={ctx} className={cls}>{node.v}</Leaf>;
    }
    case "frac":
      return (
        // No exit animation: a fraction that is going away must unmount at once, so its tokens
        // can glide to their new places instead of being duplicated while it fades.
        <motion.span
          layout={ctx.animate ? "position" : false}
          className="mv-frac"
          {...(ctx.animate ? { initial: leafMotion.initial, animate: leafMotion.animate, transition: leafMotion.transition } : {})}
        >
          <span className="mv-row">
            <Children nodes={node.num} ctx={ctx} />
          </span>
          <Leaf k={`${node.k}-bar`} ctx={ctx} className="mv-bar">{""}</Leaf>
          <span className="mv-row">
            <Children nodes={node.den} ctx={ctx} />
          </span>
        </motion.span>
      );
    case "pow":
      return (
        <span className="mv-pow">
          <span className="mv-row">
            <Children nodes={node.base} ctx={ctx} />
          </span>
          <span className="mv-sup">
            <Children nodes={node.exp} ctx={ctx} />
          </span>
        </span>
      );
    case "sub":
      return (
        <span className="mv-pow">
          <span className="mv-row">
            <Children nodes={node.base} ctx={ctx} />
          </span>
          <span className="mv-subscript">
            <Children nodes={node.sub} ctx={ctx} />
          </span>
        </span>
      );
    case "sqrt":
      return (
        <span className="mv-sqrt">
          {node.index && (
            <span className="mv-root-index">
              <Children nodes={node.index} ctx={ctx} />
            </span>
          )}
          <Leaf k={`${node.k}-rad`} ctx={ctx} className="mv-radical">
            <svg viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden>
              <path d="M0 12 L2.6 10.6 L5.6 19 L10 0.6" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </svg>
          </Leaf>
          <span className="mv-radicand">
            <Children nodes={node.body} ctx={ctx} />
          </span>
        </span>
      );
    case "paren":
      return (
        <span className="mv-paren">
          <Leaf k={`${node.k}(`} ctx={ctx} className="mv-fence">
            <Fence kind={node.open} />
          </Leaf>
          <span className="mv-row">
            <Children nodes={node.body} ctx={ctx} />
          </span>
          <Leaf k={`${node.k})`} ctx={ctx} className="mv-fence">
            <Fence kind={node.close} />
          </Leaf>
        </span>
      );
    case "style":
      return (
        <span className={cn("mv-style", `mv-${node.style as StyleName}`)}>
          <Children nodes={node.body} ctx={ctx} />
        </span>
      );
  }
}

function Fence({ kind }: { kind: string }) {
  const d =
    kind === "("
      ? "M8 0 C2 5 2 15 8 20"
      : kind === ")"
        ? "M2 0 C8 5 8 15 2 20"
        : kind === "["
          ? "M8 0 L3 0 L3 20 L8 20"
          : "M2 0 L7 0 L7 20 L2 20";
  return (
    <svg viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/** Curved arrows between tokens, e.g. a factor reaching into each term of a bracket. */
function Arrows({ root, arrows, signature }: { root: React.RefObject<HTMLSpanElement | null>; arrows: [string, string][]; signature: string }) {
  const [paths, setPaths] = useState<{ d: string; key: string }[]>([]);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const find = (k: string) => el.querySelector<HTMLElement>(`[data-mk="${CSS.escape(k)}"]`)?.getBoundingClientRect();
      const out: { d: string; key: string }[] = [];
      for (const [from, to] of arrows) {
        const a = find(from);
        const b = find(to);
        if (!a || !b) continue;
        const x1 = a.left + a.width / 2 - base.left;
        const x2 = b.left + b.width / 2 - base.left;
        const y = Math.min(a.top, b.top) - base.top - 2;
        const lift = Math.max(14, Math.abs(x2 - x1) * 0.35);
        out.push({ key: `${from}->${to}`, d: `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - lift} ${x2} ${y}` });
      }
      setBox({ w: base.width, h: base.height });
      setPaths(out);
    };
    // Wait for the layout animation to settle before measuring.
    const t = setTimeout(measure, 450);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [root, arrows, signature]);

  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={box.w} height={box.h} aria-hidden>
      <defs>
        <marker id="mv-arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--blob)" />
        </marker>
      </defs>
      {paths.map((p, i) => (
        <Fragment key={p.key}>
          <motion.path
            d={p.d}
            fill="none"
            stroke="var(--blob)"
            strokeWidth={2}
            strokeLinecap="round"
            markerEnd="url(#mv-arrowhead)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.25, duration: 0.5, ease: "easeOut" }}
          />
        </Fragment>
      ))}
    </svg>
  );
}
