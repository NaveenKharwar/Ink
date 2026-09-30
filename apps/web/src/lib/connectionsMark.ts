// The mark for "Ink sees this too": three ink dots joined by threads, still. When the writer hovers, the
// dots come alive and drift a little while the threads strengthen; when they press, the threads gather into
// a small tripod and the mark turns to the accent. Its shape in each state, and how to move between two of
// them. Pure numbers, so it is tested without a screen. Coordinates are on a 24-point grid.

export type MarkState = "rest" | "hover" | "press" | "active";
export type Point = [number, number];
export type MarkShape = {
  a: Point; // the top dot
  b: Point; // the bottom-left dot
  c: Point; // the right dot
  /** Each dot's radius (joined, the dots are not all the same size). */
  ra: number;
  rb: number;
  rc: number;
  /** Where the three spokes meet. */
  hub: Point;
  /** How visible each spoke (dot to hub) is, 0 to 1. */
  sa: number;
  sb: number;
  sc: number;
  /** How visible the threads between the dots are, 0 to 1: top to bottom-left, top to right, bottom-left to right. */
  ab: number;
  ac: number;
  bc: number;
  /** How thick the threads between the dots are. */
  tw: number;
};

/** The thickness of a spoke: heavy, like the dots. */
export const SPOKE_WIDTH = 2.4;

// The three dots sit well apart, filling the mark.
const REST: MarkShape = { a: [12, 5.4], b: [5, 18.2], c: [19, 18.2], ra: 2, rb: 2, rc: 2, hub: [12, 13.6], sa: 0, sb: 0, sc: 0, ab: 1, ac: 1, bc: 1, tw: 1.6 };

export const SHAPES: Record<MarkState, MarkShape> = {
  // Three ink dots, well apart, joined by light threads. Still.
  rest: REST,
  // The dots move a little closer and the threads strengthen; they keep drifting while the pointer stays.
  hover: { a: [12.3, 6], b: [6.4, 17.4], c: [17.8, 17.6], ra: 2.2, rb: 2.2, rc: 2.2, hub: [12, 13.6], sa: 0, sb: 0, sc: 0, ab: 1, ac: 1, bc: 1, tw: 2 },
  // Pressed and open keep the same triangle as rest: the colour turns to the accent and the triangle fills softly.
  press: REST,
  active: REST
};

/** How long a change of state takes, in milliseconds. */
export const MARK_MS = 300;

const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const mixPoint = (from: Point, to: Point, t: number): Point => [mix(from[0], to[0], t), mix(from[1], to[1], t)];

/** Ease-out: fast at first, settling gently. */
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** The shape part of the way (0 to 1, already eased) from one shape to another. */
export function blend(from: MarkShape, to: MarkShape, t: number): MarkShape {
  return {
    a: mixPoint(from.a, to.a, t),
    b: mixPoint(from.b, to.b, t),
    c: mixPoint(from.c, to.c, t),
    ra: mix(from.ra, to.ra, t),
    rb: mix(from.rb, to.rb, t),
    rc: mix(from.rc, to.rc, t),
    hub: mixPoint(from.hub, to.hub, t),
    sa: mix(from.sa, to.sa, t),
    sb: mix(from.sb, to.sb, t),
    sc: mix(from.sc, to.sc, t),
    ab: mix(from.ab, to.ab, t),
    ac: mix(from.ac, to.ac, t),
    bc: mix(from.bc, to.bc, t),
    tw: mix(from.tw, to.tw, t)
  };
}

/** Joined (press, active) is the state that means "this leads to other writing", so it takes the accent. */
export const isJoined = (state: MarkState) => state === "press" || state === "active";

/** While hovered, each dot drifts gently around its place; one full drift takes this long. */
export const WOBBLE_PERIOD_MS = 2400;
const WOBBLE = 0.55;

/** How far each dot is nudged from its hover place `ms` milliseconds into the hover. Small, smooth, endless. */
export function wobble(ms: number): [Point, Point, Point] {
  const turn = (ms / WOBBLE_PERIOD_MS) * Math.PI * 2;
  // One and two turns per period, so the drift repeats exactly and never jumps.
  const offset = (phase: number): Point => [Math.sin(turn + phase) * WOBBLE, Math.cos(2 * turn + phase * 1.7) * WOBBLE];
  return [offset(0), offset(2.1), offset(4.2)];
}

/** The hover shape with the dots nudged by `wobble`; the threads follow the dots. */
export function hoverShape(ms: number): MarkShape {
  const [da, db, dc] = wobble(ms);
  const base = SHAPES.hover;
  const move = (p: Point, d: Point): Point => [p[0] + d[0], p[1] + d[1]];
  return { ...base, a: move(base.a, da), b: move(base.b, db), c: move(base.c, dc) };
}
