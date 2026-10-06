/**
 * sin, cos and pow that give the same result on the server and in the browser.
 *
 * JavaScript engines compute these slightly differently (Node and Chrome disagree in the last bit
 * for a few percent of inputs), so a drawing's coordinates rendered on the server would not match
 * the ones computed while hydrating. Rounding to 10 significant digits makes both sides agree, far
 * below anything visible. Not for places where exactness matters, like checking answers.
 */
const stable = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(10)) : v);

export const sin = (x: number) => stable(Math.sin(x));
export const cos = (x: number) => stable(Math.cos(x));
export const pow = (x: number, y: number) => stable(Math.pow(x, y));
