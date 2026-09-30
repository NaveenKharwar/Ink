// A thread as a chain of points (verlet): each point keeps its own speed, gravity and a light
// breeze pull on it, and the links between points keep their length. The first point is pinned
// to what the thread hangs from until it lets go; the last one carries the note, so it is heavier.
export type Point = { x: number; y: number; px: number; py: number };
export type Thread = { points: Point[]; link: number; pinned: boolean; gravity: number; wind: number };

export function makeThread(x: number, y: number, count: number, link: number): Thread {
  // The points start laid out at full length, leaning a little, so the thread swings into place
  // while it fades in. (Bunched points fold up like an accordion and never hang out.)
  const points = Array.from({ length: count }, (_, i) => {
    const px = x - i * link * 0.3;
    const py = y + i * link * 0.95;
    return { x: px, y: py, px, py };
  });
  return { points, link, pinned: true, gravity: 0.12, wind: 0 };
}

// One step (about a frame). `breeze` scales the sway (0 = a still thread); `gust` is an extra
// sideways push, felt most by the free end.
export function stepThread(t: Thread, pin: { x: number; y: number }, time: number, breeze = 1, gust = 0) {
  const { points } = t;
  const n = points.length;
  points.forEach((p, i) => {
    const vx = (p.x - p.px) * 0.97;
    const vy = (p.y - p.py) * 0.97;
    p.px = p.x;
    p.py = p.y;
    const sway = (Math.sin(time / 1300 + i * 0.25) * 0.018 * i) / n;
    const weight = t.pinned && i === n - 1 ? 0.5 : t.gravity;
    p.x += vx + sway * breeze + t.wind + (gust * i) / n;
    p.y += vy + weight;
  });
  if (t.pinned) {
    points[0]!.x = pin.x;
    points[0]!.y = pin.y;
  }
  for (let round = 0; round < 20; round++) {
    for (let i = 0; i < n - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy) || 1;
      const push = (length - t.link) / length / 2;
      if (i > 0 || !t.pinned) {
        a.x += dx * push;
        a.y += dy * push;
      }
      b.x -= dx * push;
      b.y -= dy * push;
    }
  }
}

// The thread lets go: on desktop it drifts off to the right, on phone it falls.
export function letGo(t: Thread, way: "drift" | "fall") {
  t.pinned = false;
  t.gravity = way === "fall" ? 0.18 : 0.01;
  t.wind = way === "drift" ? 0.06 : 0;
}
