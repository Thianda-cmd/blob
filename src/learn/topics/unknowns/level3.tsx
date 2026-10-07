"use client";

import type { ComponentType } from "react";
import { tx } from "@/i18n/text";
import type { Frame, LevelLesson } from "@/learn/types";
import { FrameDrawing, FrameLab } from "./FrameLab";
import { PumpLab } from "./PumpLab";
import { consecStory, frameStory, innerStory, landingStory, quadExercise, quadFrames, rectPAStory, throwBoth, workQuad, workTogether } from "./stories3";
import { ThrowCurve } from "./ThrowCurve";

export { generate3 } from "./stories3";

// Level 3: quadratic word problems (frames, rectangles, numbers, throws) where you decide which
// solution makes sense, and work-rate problems that lead to fractional equations.

const visual = (component: unknown, props: Record<string, unknown>) => ({ component: component as ComponentType<Record<string, unknown>>, props });

const PICTURE = frameStory("picture", 30, 18, 3);
const RECT = rectPAStory(6, 8, "long");
const POOL = workQuad(0, 6, 6, "fast");

const throwFrames: Frame[] = (() => {
  const frames = [...throwBoth(1, 3).solution];
  frames.push(
    {
      math: "20#cb t#vb -#sa 5#ca t#va^{2#ea} =#eq 0#r",
      note: tx("And when does it land? On the ground the height is 0.", "Und wann landet er? Am Boden ist die Höhe 0."),
    },
    {
      math: "5#ca t#vb (4#k -#sa t#va)#B =#eq 0#r",
      note: tx("No pq formula needed: factor out $5t$.", "Hier brauchst du keine pq-Formel: Klammere $5t$ aus."),
    },
    {
      math: "\\strike{t_1#x1 =#eq1 0#v1} \\quad \\green{t_2#x2 =#eq2 4#v2}",
      note: tx(
        "A product is 0 when one factor is 0: $t = 0$ or $t = 4$. At $t = 0$ the ball is just being thrown. **It lands after 4 seconds.**",
        "Ein Produkt ist 0, wenn ein Faktor 0 ist: $t = 0$ oder $t = 4$. Bei $t = 0$ wird der Ball gerade erst geworfen. **Er landet nach 4 Sekunden.**",
      ),
    },
  );
  return frames;
})();

const togetherFrames = workTogether(0, 6, 3).solution;

/** Level 3: quadratic word problems, which solution makes sense, and work-rate problems. */
export const level3: LevelLesson = {
  summary: [
    {
      title: tx("Quadratic word problems", "Quadratische Textaufgaben"),
      body: tx(
        "**Let $x$ be …**, set up the equation, bring it to the normal form $x^2 + px + q = 0$ and solve it with the pq formula.",
        "**Sei $x$ …**, stell die Gleichung auf, bring sie in die Normalform $x^2 + px + q = 0$ und löse sie mit der pq-Formel.",
      ),
      examples: ["(30 + 2x)(18 + 2x) = 864", "x^2 + 24x - 81 = 0", "x_{1,2} = -12 \\pm 15"],
      tone: "rule",
    },
    {
      title: tx("Which solution makes sense?", "Welche Lösung ist sinnvoll?"),
      body: tx(
        "Check **every** solution in the story. Lengths, times and natural numbers are never negative, and a positive solution can still be too big: what's left inside must stay positive. Sometimes both make sense: on the way up and down, or the same rectangle twice.",
        "Prüf **jede** Lösung an der Geschichte. Längen, Zeiten und natürliche Zahlen sind nie negativ, und auch eine positive Lösung kann zu groß sein: Was innen übrig bleibt, muss positiv bleiben. Manchmal sind beide sinnvoll: auf dem Weg nach oben und nach unten, oder zweimal dasselbe Rechteck.",
      ),
      examples: ["\\green{x_1 = 3} \\quad \\strike{x_2 = -27}", "\\strike{x_1 = 16} \\quad \\green{x_2 = 2}"],
      tone: "warning",
    },
    {
      title: tx("Frames, paths, rectangles", "Rahmen, Wege, Rechtecke"),
      body: tx(
        "A strip all around adds $x$ on **both** sides: each length grows by $2x$. A strip inside takes $2x$ away. With perimeter and area, half the perimeter is one length plus one width.",
        "Ein Streifen ringsherum kommt auf **beiden** Seiten dazu: Jede Länge wächst um $2x$. Ein Streifen innen nimmt $2x$ weg. Bei Umfang und Fläche ist der halbe Umfang eine Länge plus eine Breite.",
      ),
      examples: ["(a + 2x)(b + 2x)", "(a - 2x)(b - 2x)", "x(14 - x) = 48"],
      tone: "tip",
    },
    {
      title: tx("Thrown upwards", "Senkrechter Wurf"),
      body: tx(
        "On the ground: $h(t) = 0$. A height $h(t) = H$ is usually reached **twice**, on the way up and on the way down. Negative times lie before the throw.",
        "Am Boden: $h(t) = 0$. Eine Höhe $h(t) = H$ wird meist **zweimal** erreicht, auf dem Weg nach oben und nach unten. Negative Zeiten liegen vor dem Wurf.",
      ),
      examples: [tx('20t - 5t^2 = 15 \\quad \\Rightarrow \\quad t = 1 \\; "or" \\; t = 3', '20t - 5t^2 = 15 \\quad \\Rightarrow \\quad t = 1 \\; "oder" \\; t = 3')],
      tone: "rule",
    },
    {
      title: tx("Working together", "Gemeinsam arbeiten"),
      body: tx(
        "Per hour (or minute) the **parts of the job** add up, not the times: $\\frac{1}{a} + \\frac{1}{b} = \\frac{1}{t}$. Together is always faster than the faster one alone.",
        "Pro Stunde (oder Minute) addieren sich die **Anteile der Arbeit**, nicht die Zeiten: $\\frac{1}{a} + \\frac{1}{b} = \\frac{1}{t}$. Zusammen geht es immer schneller als mit dem Schnelleren allein.",
      ),
      examples: ["\\frac{1}{6} + \\frac{1}{3} = \\frac{1}{2}"],
      tone: "rule",
    },
    {
      title: tx("Fractional equations", "Bruchgleichungen"),
      body: tx(
        "If the time alone is unknown, $x$ ends up in a denominator. State the domain first, then multiply **every** term by the common denominator.",
        "Ist die Zeit allein unbekannt, steht $x$ im Nenner. Gib zuerst die Definitionsmenge an und multipliziere dann **jeden** Term mit dem Hauptnenner.",
      ),
      examples: ["\\frac{1}{x} + \\frac{1}{x + 6} = \\frac{1}{4}", "4(x + 6) + 4x = x(x + 6)"],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("A frame around a picture", "Ein Rahmen um ein Bild"),
      blob: tx("Now x shows up squared. Two solutions, but do both make sense?", "Jetzt kommt x im Quadrat vor. Zwei Lösungen, aber sind beide sinnvoll?"),
      body: tx(
        "**A picture is 30 cm wide and 18 cm high. It gets a frame that is equally wide all around. Picture and frame together cover 864 cm². How wide is the frame?** The frame adds its width on **both** sides, so $x$ appears in both lengths, and the area equation becomes quadratic.",
        "**Ein Bild ist 30 cm breit und 18 cm hoch. Es bekommt einen Rahmen, der ringsherum gleich breit ist. Bild und Rahmen bedecken zusammen 864 cm². Wie breit ist der Rahmen?** Der Rahmen kommt auf **beiden** Seiten dazu, also steckt $x$ in beiden Längen, und die Flächengleichung wird quadratisch.",
      ),
      visual: visual(FrameDrawing, { a: 30, b: 18, x: 3 }),
      frames: quadFrames(PICTURE).frames,
    },
    {
      type: "widget",
      title: tx("Slide the frame", "Schieb den Rahmen"),
      blob: tx("Find the width that gives exactly 864 cm². Then peek at the graph!", "Finde die Breite für genau 864 cm². Dann wirf einen Blick auf den Graphen!"),
      body: tx(
        "Change the width $x$ of the frame and watch the area outside grow. Find the width for exactly 864 cm². Then show the graph of the area: the equation has a second solution, but it isn't a real frame.",
        "Ändere die Breite $x$ des Rahmens und beobachte, wie die Fläche außen wächst. Finde die Breite für genau 864 cm². Dann blende den Graphen der Fläche ein: Die Gleichung hat noch eine zweite Lösung, aber die ist kein echter Rahmen.",
      ),
      widget: FrameLab,
    },
    {
      type: "check",
      blob: tx("Two even numbers in a row. Which solution counts?", "Zwei gerade Zahlen hintereinander. Welche Lösung zählt?"),
      exercise: quadExercise(consecStory("even", 12, "small")),
    },
    {
      type: "explain",
      title: tx("Perimeter and area", "Umfang und Flächeninhalt"),
      blob: tx("Sometimes both solutions make sense. Watch!", "Manchmal sind beide Lösungen sinnvoll. Schau mal!"),
      body: tx(
        "**A rectangle has a perimeter of 28 cm and an area of 48 cm². How long are its sides?** Half the perimeter, 14 cm, is one side plus the other. If one side is $x$, the other is $14 - x$.",
        "**Ein Rechteck hat einen Umfang von 28 cm und einen Flächeninhalt von 48 cm². Wie lang sind seine Seiten?** Der halbe Umfang, 14 cm, ist eine Seite plus die andere. Ist eine Seite $x$, dann ist die andere $14 - x$.",
      ),
      frames: quadFrames(RECT).frames,
    },
    {
      type: "check",
      blob: tx("A path inside a garden this time. Check **both** solutions in the story!", "Diesmal ein Weg innen im Garten. Prüf **beide** Lösungen an der Geschichte!"),
      exercise: quadExercise(innerStory("garden", 20, 16, 2)),
    },
    {
      type: "explain",
      title: tx("Thrown upwards: up and down", "Senkrechter Wurf: hoch und runter"),
      blob: tx("What goes up must come down. And it passes every height twice!", "Was hochfliegt, kommt wieder runter. Und jede Höhe erreicht es zweimal!"),
      body: tx(
        "**A ball is thrown straight up. Its height (in m) after $t$ seconds is $h(t) = 20t - 5t^2$. When is it exactly 15 m high? When does it land?** Set $h(t)$ equal to the height you want and solve.",
        "**Ein Ball wird senkrecht nach oben geworfen. Seine Höhe (in m) nach $t$ Sekunden ist $h(t) = 20t - 5t^2$. Wann ist er genau 15 m hoch? Wann landet er?** Setz $h(t)$ gleich der gesuchten Höhe und löse die Gleichung.",
      ),
      visual: visual(ThrowCurve, { v: 20, h0: 0, height: 15 }),
      frames: throwFrames,
    },
    {
      type: "check",
      blob: tx("From a tower this time. Which time is the real one?", "Diesmal von einem Turm. Welche Zeit ist die echte?"),
      exercise: quadExercise(landingStory(3, 1, 0)),
    },
    {
      type: "explain",
      title: tx("Working together", "Gemeinsam arbeiten"),
      blob: tx("Two pumps, one pool. Is it 4.5 hours? Nope!", "Zwei Pumpen, ein Becken. Sind es 4,5 Stunden? Nö!"),
      body: tx(
        "**Pump A alone fills a pool in 6 hours, pump B alone in 3 hours. How long do they need together?** Don't add the times. Think **per hour**: what part of the pool does each pump fill?",
        "**Pumpe A allein füllt ein Becken in 6 Stunden, Pumpe B allein in 3 Stunden. Wie lange brauchen beide zusammen?** Addiere nicht die Zeiten. Denk **pro Stunde**: Welchen Teil des Beckens füllt jede Pumpe?",
      ),
      frames: togetherFrames,
    },
    {
      type: "widget",
      title: tx("Two pumps, one pool", "Zwei Pumpen, ein Becken"),
      blob: tx("Guess first, then press play!", "Erst schätzen, dann auf Start drücken!"),
      body: tx(
        "Set how long each pump would need alone, switch them on and off, and fill the pool. The colours show how much water came from which pump. Together they're always faster than the faster pump alone.",
        "Stell ein, wie lange jede Pumpe allein bräuchte, schalte sie ein und aus und füll das Becken. Die Farben zeigen, wie viel Wasser von welcher Pumpe kommt. Zusammen sind sie immer schneller als die schnellere Pumpe allein.",
      ),
      widget: PumpLab,
    },
    {
      type: "explain",
      title: tx("When the time alone is unknown", "Wenn die Zeit allein unbekannt ist"),
      blob: tx("x in the denominator? Multiply it away!", "x im Nenner? Multiplizier ihn weg!"),
      body: tx(
        "**Together, pump A and pump B fill the pool in 4 hours. Alone, pump B would need 6 hours longer than pump A. How long does pump A need alone?** Now $x$ is in a denominator: a **fractional equation**. Note the domain, multiply by the common denominator, and you get a quadratic equation.",
        "**Zusammen füllen Pumpe A und Pumpe B das Becken in 4 Stunden. Allein bräuchte Pumpe B 6 Stunden länger als Pumpe A. Wie lange braucht Pumpe A allein?** Jetzt steht $x$ im Nenner: eine **Bruchgleichung**. Notier die Definitionsmenge, multipliziere mit dem Hauptnenner, und es entsteht eine quadratische Gleichung.",
      ),
      frames: quadFrames(POOL).frames,
    },
    {
      type: "check",
      blob: tx("Last one! Lea and Tom paint a fence.", "Die letzte! Lea und Tom streichen einen Zaun."),
      exercise: { ...quadExercise(workQuad(3, 3, 3, "slow")), instruction: tx("Solve the work problem", "Löse die Arbeitsaufgabe") },
    },
  ],
};
