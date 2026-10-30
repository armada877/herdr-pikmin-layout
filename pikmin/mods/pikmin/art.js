import { div, image, svg } from "gpui-kit";

export const PX = "PxPlus IBM VGA 8x16";
export const ink = "#2e2a1a";
export const WALL = 150;

export const r = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
export const icon = (p, s = 16) => p?.icon ? (p.tint ? svg(p.icon).text_color(p.color ?? ink) : image(p.icon)).size(s) : div().size(s);
export const txt = (s, size = 16, c = ink) => div().font_family(PX).text_size(size).line_height(`${size}px`).text_color(c).child(s);

export const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const pick = (R, list) => list[Math.floor(R() * list.length)];

export function sprite(rows, pal, s) {
  const out = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      let e = x;
      while (e < row.length && row[e] === row[x]) e++;
      if (pal[row[x]]) out.push(r(x * s, y * s, (e - x) * s, s, pal[row[x]]));
      x = e;
    }
  });
  return div().relative().w(rows[0].length * s).h(rows.length * s).children(out);
}

const RED = "#d8382e", YELLOW = "#f2c230", BLUE = "#3a6fd8", PURPLE = "#7a3fa8", WHITE = "#f2f2ee", PINK = "#f08ab0", ROCK = "#8a8f99";
const BODIES = [RED, YELLOW, BLUE, PURPLE, WHITE, PINK, ROCK];
const KIND = { claude: RED, codex: BLUE, gemini: YELLOW, cursor: PURPLE, opencode: PINK, grok: ROCK, copilot: WHITE };
const FLOWERS = ["#ffffff", "#f6a5c8", "#f2d64b"];

export function look(a, captain = false) {
  const R = rng(hash(a.address));
  const kind = `${a.app ?? ""} ${a.program?.name ?? ""}`.toLowerCase();
  const body = Object.entries(KIND).find(([k]) => kind.includes(k))?.[1] ?? pick(R, BODIES);
  return {
    captain, body, eye: body === WHITE ? "#c0282a" : "#1b1b1b",
    stage: pick(R, ["leaf", "bud", "flower"]), flower: pick(R, FLOWERS),
    bob: 280 + Math.floor(R() * 220), book: pick(R, ["#f2c230", "#d8382e", "#3a6fd8"]),
  };
}

const TOPS = {
  leaf: ["......LL........", ".....LLDL.......", "......LL........", ".......Y........", ".......Y........"],
  bud: ["................", ".......F........", "......FFF.......", ".......Y........", ".......Y........"],
  flower: ["......FFF.......", ".....FFfFF......", "......FFF.......", ".......Y........", ".......Y........"],
};
const HEAD_FRONT = ["......BBBB......", ".....BBBBBB.....", "....BWWBBWWB....", "....BWEBBWEB....", ".....BBBBBB.....", "......BBBB......"];
const HEAD_BACK = ["......BBBB......", ".....BBBBBB.....", "....BBBBBBBB....", "....BBBBBBBB....", ".....BBBBBB.....", "......BBBB......"];
const BODY = ["......BBBB......", ".....B.BB.B.....", ".......BB......."];
const BODY_LIFT = ["....B.BBBB.B....", "....B..BB..B....", ".......BB......."];

const CAPTAIN_FRONT = [
  ".......A........", ".......a........", ".......a........", ".....GGGGGG.....", "....GSSSSSSG....", "...GSSESSESSG...",
  "...GSSSNNSSSG...", "....GSSSSSSG....", ".....GGGGGG.....", "....UUUUUUUU....", "...UUUUQQUUUU...", "...UUUUUUUUUU...", "....UUUUUUUU....",
];
const CAPTAIN_BACK = [
  ".......A........", ".......a........", ".......a........", ".....GGGGGG.....", "....GSSSSSSG....", "...GSSSSSSSSG...",
  "...GSSSSSSSSG...", "....GSSSSSSG....", ".....GGGGGG.....", "....UUUUUUUU....", "...UUUUPPUUUU...", "...UUUUPPUUUU...", "....UUUUUUUU....",
];

const palette = (lk) => ({
  L: "#5cbf4a", D: "#2f7d32", Y: "#7cae3a", F: lk.flower, f: "#f2d64b", B: lk.body, W: "#ffffff", E: lk.eye,
  A: "#ff4a3a", a: "#b8b8b8", G: "#cfe8f5", S: "#f1c9a5", N: "#e0905a", U: "#f2e2a0", Q: "#d8382e", P: "#c8b070",
});

const pikminRows = (lk, facing, lift) => [...TOPS[lk.stage], ...(facing === "front" ? HEAD_FRONT : HEAD_BACK), ...(lift ? BODY_LIFT : BODY)];
const legColor = (lk) => (lk.captain ? "#8a7a50" : lk.body);

export function seated(lk, s, status) {
  const pal = palette(lk);
  if (status === "done" && !lk.captain) {
    return div().relative().w(16 * s).h(20 * s)
      .child(sprite(TOPS[lk.stage], pal, s).absolute().left(0).top(12 * s))
      .child(sprite(["....dddddddd....", "...dddddddddd..."], { d: "#7a5a32" }, s).absolute().left(0).top(17 * s));
  }
  const lift = !lk.captain && (status === "working" || status === "blocked");
  const rows = lk.captain ? CAPTAIN_FRONT : pikminRows(lk, "front", lift);
  const top = 20 * s - rows.length * s - 3 * s;
  const el = div().relative().w(16 * s).h(20 * s)
    .child(sprite(rows, pal, s).absolute().left(0).top(top))
    .child(r(6 * s, 17 * s, 2 * s, 3 * s, legColor(lk))).child(r(8 * s, 17 * s, 2 * s, 3 * s, legColor(lk)));
  if (status !== "working" || lk.captain) return el;
  return el.child(r(2 * s, top - 6 * s, 12 * s, 6 * s, lk.book)).child(r(4 * s, top - 7 * s, 8 * s, 1 * s, lk.book))
    .child(r(7 * s, top - 5 * s, 2 * s, 4 * s, "#ffffff"));
}

export function standing(lk, s, facing, walking, item, id) {
  const pal = palette(lk);
  const rows = lk.captain ? (facing === "front" ? CAPTAIN_FRONT : CAPTAIN_BACK) : pikminRows(lk, facing, false);
  const top = 13 * s - rows.length * s;
  const leg = (x, from, to) => {
    const el = r(x * s, 13 * s, 2 * s, 4 * s, legColor(lk)).id(`${id}-leg${x}`);
    return walking ? el.loop("height", { from: from * s, to: to * s, period: 300, easing: "linear" }) : el;
  };
  return div().relative().w(16 * s).h(17 * s)
    .child(leg(6, 4, 2)).child(leg(8, 2, 4))
    .child(sprite(rows, pal, s).absolute().left(0).top(top))
    .when(item === "cup", (e) => e.child(r(11 * s, 9 * s, 3 * s, 3 * s, "#ffd84a")).child(r(12 * s, 8 * s, 1 * s, 1 * s, "#fff6c0")))
    .when(item === "book", (e) => e.child(r(10 * s, 8 * s, 5 * s, 5 * s, lk.book)).child(r(12 * s, 9 * s, 1 * s, 3 * s, "#ffffff")));
}

const CRITTER = [".......WW.", ".......WE.", ".RRRRRRRR.", "RSRRRSRRRR", "RRRRRRRRRR", ".RRSRRRRR.", "..K...K..."];
export const CATS = ["#d8382e", "#e0913a", "#6a8ad8", "#e8e0d0"];
export const cat = (coat, s, left) => sprite(left ? CRITTER.map((row) => [...row].reverse().join("")) : CRITTER,
  { R: coat, S: "#fff6e8", W: "#ffffff", E: "#1b1b1b", K: "#3a2a1a" }, s);

function tree(x, R) {
  const fruit = ["#d8382e", "#f2c230", "#7a3fa8"];
  return r(x, 20, 76, 130, "#00000000")
    .child(r(30, 70, 16, 60, "#6b4423")).child(r(26, 120, 24, 10, "#5a3a1e"))
    .child(r(4, 18, 68, 56, "#3f7d32")).child(r(12, 4, 52, 20, "#4f9a3c")).child(r(0, 40, 76, 24, "#357029"))
    .children(Array.from({ length: 3 }, () => r(8 + Math.floor(R() * 56), 14 + Math.floor(R() * 44), 7, 7, pick(R, fruit))));
}

function signpost(x, now) {
  const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
  return r(x, 60, 54, 90, "#00000000")
    .child(r(24, 30, 6, 60, "#6b4423"))
    .child(r(0, 0, 54, 34, "#a8743a").border(3).border_color("#6b4423").flex().items_center().justify_center()
      .child(txt(`${hh}:${mm}`, 12, "#fff6dc")));
}

function mushroom(x, hour) {
  const glow = hour >= 19 || hour < 6;
  return r(x, 40, 98, 110, "#00000000")
    .child(r(36, 54, 26, 56, "#efe4cc")).child(r(30, 104, 38, 6, "#d8ccb0"))
    .child(r(0, 24, 98, 34, glow ? "#8a6ae0" : "#d8382e")).child(r(10, 12, 78, 14, glow ? "#9a7af0" : "#e04a3a"))
    .children([[14, 30], [44, 18], [70, 34], [28, 44], [58, 46]].map(([a, b]) => r(a, b, 10, 8, "#fff6e8")));
}

function sprout(x) {
  return r(x, 112, 30, 38, "#00000000")
    .child(r(13, 12, 4, 26, "#5a9a3a")).child(r(3, 8, 12, 8, "#5cbf4a")).child(r(15, 4, 12, 8, "#4caf50"));
}

function rock(x, R) {
  return r(x, 96, 58, 54, "#00000000")
    .child(r(4, 14, 50, 40, "#8a8f99")).child(r(12, 4, 32, 14, "#9aa0aa")).child(r(0, 30, 58, 24, "#7a7f89"))
    .child(r(10 + Math.floor(R() * 20), 20, 8, 6, "#a8aeb8"));
}

function nectarFlower(x) {
  return r(x, 60, 46, 90, "#00000000")
    .child(r(21, 40, 4, 50, "#4f8a34")).child(r(25, 60, 12, 6, "#5cbf4a"))
    .child(r(4, 10, 38, 30, "#f08ab0")).child(r(12, 2, 22, 46, "#f6a5c8")).child(r(15, 17, 16, 16, "#ffd84a"));
}

function onion(mid, open, color) {
  const el = r(mid - 40, 14, 80, WALL - 14, "#00000000")
    .child(r(38, 0, 4, 14, "#5a9a3a")).child(r(32, 0, 16, 6, "#f6a5c8"))
    .child(r(16, 14, 48, 10, color)).child(r(6, 24, 68, 30, color)).child(r(16, 54, 48, 10, color))
    .child(r(14, 30, 10, 14, "#ffffff55"))
    .child(r(10, 64, 6, WALL - 78, "#6b6b74")).child(r(37, 64, 6, WALL - 78, "#6b6b74")).child(r(64, 64, 6, WALL - 78, "#6b6b74"));
  return open ? el.child(r(22, 64, 36, WALL - 78, "#fff6a055")) : el;
}

function sky(w, hour) {
  const night = hour >= 19 || hour < 6, dusk = hour >= 17 && hour < 19;
  const col = night ? "#1d2547" : dusk ? "#f2a65a" : "#9fd8f5";
  const t = Math.max(0, Math.min(1, (hour - 6) / 13));
  const orb = night ? r(Math.round(w * 0.8), 18, 22, 22, "#f4f0c8") : r(Math.round(40 + t * (w - 120)), 14 + Math.round(Math.abs(t - 0.5) * 40), 28, 28, dusk ? "#ffb04a" : "#ffe46a");
  const clouds = night ? [] : [[0.18, 20], [0.55, 34], [0.78, 16]].map(([fx, y]) => r(Math.round(fx * w), y, 46, 12, "#ffffffcc"));
  return [r(0, 0, w, 90, col), orb, ...clouds];
}

function spread(from, to, items) {
  let list = items;
  while (list.length) {
    const sum = list.reduce((a, it) => a + it.w, 0), gap = (to - from - sum) / (list.length + 1);
    if (gap >= 10) {
      let x = from + gap;
      return Object.fromEntries(list.map((it) => { const at = Math.round(x); x += it.w + gap; return [it.key, at]; }));
    }
    const cut = list.reduce((a, b) => (b.cut > a.cut ? b : a));
    list = list.filter((it) => it !== cut);
  }
  return {};
}

export function wallLayout(w, left = 0) {
  const mid = Math.round(w / 2);
  return {
    mid,
    ...spread(left, mid - 44, [{ key: "shelfL", w: 76, cut: 2 }, { key: "clock", w: 54, cut: 3 }]),
    ...spread(mid + 44, w - 8, [{ key: "window", w: 98, cut: 4 }, { key: "memo", w: 30, cut: 6 }, { key: "picture", w: 58, cut: 5 },
      { key: "shelfR", w: 76, cut: 1 }, { key: "cooler", w: 46, cut: 0 }]),
  };
}

export function room(w, h, { seed, now, doorOpen, left }) {
  const R = rng(seed);
  const L = wallLayout(w, left), mid = L.mid, hour = now.getHours();
  const at = (key, make) => (L[key] == null ? [] : [make(L[key])]);
  const blades = Array.from({ length: Math.floor(w * (h - WALL) / 9000) }, () =>
    r(Math.floor(R() * w), WALL + 8 + Math.floor(R() * (h - WALL - 12)), 2, 6, R() < 0.5 ? "#5e9a3a" : "#8cc456"));
  const flowers = Array.from({ length: Math.floor(w * (h - WALL) / 45000) }, () =>
    r(Math.floor(R() * w), WALL + 12 + Math.floor(R() * (h - WALL - 16)), 4, 4, pick(R, ["#ffffff", "#f6a5c8", "#f2d64b", "#b8a0f0"])));
  return [
    ...sky(w, hour),
    r(0, 60, w, WALL - 60, "#7fb069"),
    ...Array.from({ length: Math.ceil(w / 120) + 1 }, (_, i) => r(i * 120 - 40, 50 + (i % 2) * 10, 140, 40, "#6a9e58")),
    r(0, WALL - 12, w, 12, "#4e8a34"),
    r(0, WALL, w, h - WALL, "#79b04a"),
    ...blades, ...flowers,
    onion(mid, doorOpen, "#d8382e"),
    ...at("shelfL", (x) => tree(x, R)), ...at("shelfR", (x) => tree(x, R)),
    ...at("clock", (x) => signpost(x, now)),
    ...at("memo", (x) => sprout(x)),
    ...at("window", (x) => mushroom(x, hour)),
    ...at("picture", (x) => rock(x, R)),
    ...at("cooler", (x) => nectarFlower(x)),
    r(w - 96, h - 70, 60, 30, "#6b4423"), r(w - 92, h - 76, 52, 8, "#8a5a30"), r(w - 70, h - 96, 6, 22, "#5a9a3a"), r(w - 76, h - 104, 18, 10, "#f2d64b"),
  ];
}

export const SLOT_W = 170, SLOT_H = 190;
export const RUGS = [["#9c7a44", "#6e5228"], ["#7fa04a", "#5a7a30"], ["#b08a5a", "#86643a"], ["#6f9a6a", "#4f7a4a"], ["#a8945a", "#7e6a3a"], ["#8a7a9a", "#6a5a7a"]];

export const SCREEN = { working: "#3f6b2a", blocked: "#a8322a", done: "#2f5a7a", idle: "#5a4a3a", unknown: "#5a4a3a" };

export function deskLook(i, seed) {
  const R = rng(hash(`desk${i}`) ^ seed);
  return {
    mug: pick(R, ["#d8382e", "#f2c230", "#3a6fd8", "#7a3fa8", "#f08ab0"]),
    lamp: pick(R, ["#ffe46a", "#c8f0ff", "#ffd0f0"]),
    clutter: pick(R, ["papers", "plant", "photo", "duck", "none", "papers", "cactus"]),
    tower: R() < 0.5,
  };
}

export function clutter(kind, R2) {
  switch (kind) {
    case "papers": return [R2(124, 50, 8, 6, "#9aa0aa"), R2(132, 52, 6, 4, "#8a8f99")];
    case "plant": return [R2(126, 46, 6, 6, "#4caf50"), R2(132, 46, 6, 6, "#5cbf4a"), R2(129, 42, 6, 6, "#3f9a3a")];
    case "cactus": return [R2(130, 44, 4, 10, "#efe4cc"), R2(125, 40, 14, 6, "#d8382e"), R2(128, 41, 3, 2, "#fff6e8")];
    case "photo": return [R2(126, 46, 6, 6, "#7a3fa8"), R2(132, 48, 6, 6, "#5a2a88")];
    case "duck": return [R2(126, 46, 10, 6, "#c9a23a"), R2(132, 42, 6, 6, "#e0b84a"), R2(124, 50, 4, 2, "#8a6a2a")];
    default: return [];
  }
}
