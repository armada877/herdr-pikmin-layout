import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, spaces, panes, props, run, setAgentOrder, knownAgents } from "herdr";
import { wallLayout, ink, WALL, SLOT_W, SLOT_H, SCREEN, CATS, RUGS, r, icon, txt, hash, rng, pick, look, deskLook, clutter, seated, standing, cat, room } from "./art.js";

// A pixel-art office: every agent is a little worker at a desk, and each space gets its own
// group of desks on a rug. Idle workers wander, and everyone (the cat too) keeps to the walkways:
// the corridor along the wall, the aisle behind each row of desks, and the lanes past both ends
// of the rows and between the groups.
const wood = "#4e7a2c";
const DEMO = [["working", "fix login"], ["blocked", "migrate db"], ["done", "write tests"], ["idle", "docs"], ["working", "refactor api"], ["idle", "triage"], ["idle", "lunch"], ["done", "ship it"], ["working", "perf pass"], ["idle", "standup"], ["blocked", "deploy"], ["idle", "coffee"]]
  .map(([status, tab_name], i) => {
    const space_name = i < 5 ? "web" : i < 9 ? "api" : "infra";
    return { address: `demo${i}`, status, tab_name, space: space_name, space_name, title: "", program: null, focused: i === 0 };
  });
const THOUGHTS = ["?", "!", "♪", "♥", "...", "☼", "$", "#"];
const SPOTS = ["cooler", "cooler", "shelfL", "shelfR", "window", "door", "plant", "floor", "floor", "chat", "chat"];
const WALK = 0.11, CAT_WALK = 0.07; // px per ms
const busy = (a) => a.status === "working" || a.status === "blocked";

const GAP = 60; // the walkway between two spaces' desks, in slot units
const BAND = 70;
const DVD = ["#e05a8a", "#5ab0e0", "#e0c040", "#7ee0a0", "#c08ae0", "#f08a4a"];

function splitBands(sizes, n) {
  const total = sizes.reduce((a, b) => a + b, 0), out = [[]];
  let sum = 0;
  sizes.forEach((v, i) => {
    const bandsLeft = n - out.length, groupsLeft = sizes.length - i;
    if (out.at(-1).length && bandsLeft > 0 && (sum >= (total * out.length) / n || groupsLeft <= bandsLeft)) out.push([]);
    out.at(-1).push(i);
    sum += v;
  });
  return out;
}

// Two rows of desks (more only when two would get too small), one group of columns per space,
// and the groups wrap into more bands when that gives bigger desks. The scale snaps to whole
// half pixels per art pixel (s), so desks and workers grow together and stay crisp.
function fit(groups, w, h) {
  let best;
  for (let nb = 1; nb <= groups.length; nb++) {
    const bands = splitBands(groups, nb);
    for (let rows = 2; rows <= 6; rows++) {
      const cols = groups.map((n) => Math.max(groups.length > 1 ? 1 : 3, Math.ceil(n / rows)));
      const units = Math.max(...bands.map((b) => b.reduce((a, gi) => a + cols[gi], 0) * SLOT_W + (b.length - 1) * GAP));
      const k = Math.min(1, (w - 200) / units, (h - WALL) / (nb * rows * SLOT_H + (nb - 1) * BAND + 40));
      if (!best || k > best.k + 0.08) best = { k, cols, rows, bands };
    }
  }
  const s = Math.max(1, Math.floor(best.k * 6) / 2);
  return { ...best, k: s / 3, s, rowsOf: best.cols.map(() => best.rows), bandRows: best.bands.map(() => best.rows) };
}

function gridFit(groups, w, h, width, lead, scroll) {
  const spaceCols = (n) => (n <= 2 ? 1 : Math.ceil(n / Math.max(2, Math.ceil(n / width))));
  const cols = groups.map((n, gi) => (lead && gi === 0 ? Math.max(1, Math.min(n, width)) : spaceCols(n)));
  const rowsOf = groups.map((n, gi) => Math.max(1, Math.ceil(n / cols[gi])));
  const bands = [];
  let used = width;
  groups.forEach((_n, gi) => {
    if (used + cols[gi] > width || (lead && gi <= 1)) { bands.push([]); used = 0; }
    bands.at(-1).push(gi);
    used += cols[gi];
  });
  const bandRows = bands.map((b) => Math.max(...b.map((gi) => rowsOf[gi])));
  const units = Math.max(...bands.map((b) => b.reduce((a, gi) => a + cols[gi], 0) * SLOT_W + (b.length - 1) * GAP));
  const height = bandRows.reduce((a, b) => a + b, 0) * SLOT_H + (bands.length - 1) * BAND + 40;
  const span = scroll ? Math.max(units, width * SLOT_W + GAP) : units;
  const k = Math.min(1, (w - 200) / span, scroll ? Infinity : (h - WALL) / height);
  const s = Math.max(1, Math.floor(k * 6) / 2);
  return { k: s / 3, s, cols, rowsOf, bands, bandRows, maxK: scroll ? (w - 40) / span : Infinity };
}

// The room (wall, floor, furniture) is half of everything drawn, and changes only with the size,
// the minute and the door: a retained view of its own, rebuilt only then.
class Room extends View {
  init(p) { this.p = p; }
  update(p) { this.p = p; }
  render() {
    const { w, h, seed, at, door } = this.p;
    return div().absolute().left(0).top(0).w(w).h(h).children(room(w, h, { seed, now: new Date(at), doorOpen: door }));
  }
}

export default class Office extends View {
  init(_p, cx) {
    this.size = { width: 1200, height: 420 };
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.trips = {};     // address → { phase: enter|going|there|back, path, i, until, spot, hurry }
    this.thoughts = {};  // address → { sym, until }
    this.seats = {};     // address → { x, y, row }
    this.geo = null;
    this.known = null;
    this.door = 0;
    this.hover = null;
    this.minute = -1;
    this.n = 0;
    this.cat = { coat: pick(rng(this.seed), CATS), path: null, i: 0, until: 0, left: false };
    this.list = [];
    if (props()?.role) return;
    this.roomView = cx.new(Room, this.roomProps());
    cx.timer.every(250, (cx) => { this.syncRoom(); if (this.tick()) cx.notify(); });
  }

  roomProps() {
    const { width: w, height } = this.size, h = Math.max(height, this.floorH ?? 0);
    return { w, h, left: this.wallLeft ?? 0, seed: this.seed, at: Math.floor(Date.now() / 60000) * 60000, door: this.door > Date.now() };
  }

  syncRoom() {
    const p = this.roomProps(), key = JSON.stringify(p);
    if (key !== this.roomKey) { this.roomKey = key; this.roomView.set_props(p); }
  }

  // ---- walkways -------------------------------------------------------------
  // A place is { r, x }: r = -1 is the corridor along the wall, r ≥ 0 the aisle behind desk row r.
  // A seat adds { seat: y }: one step up from its row's aisle.

  laneY(row, off = 0) { const g = this.geo; return off + (row < 0 ? g.topY : g.rowY[row] + Math.round(128 * g.k)); }

  // Everyone keeps to their own line in a walkway (off), so passers-by don't merge.
  path(from, to, speed = WALK, off = 0) {
    const g = this.geo, pts = [];
    const add = (x, y, row) => pts.push({ x: Math.round(x), y: Math.round(y), r: row });
    if (from.seat != null) add(from.x, this.laneY(from.r, off), from.r);
    if (from.r !== to.r) {
      const side = [...g.lanes].sort((a, b) => Math.abs(from.x - a) + Math.abs(to.x - a) - Math.abs(from.x - b) - Math.abs(to.x - b))[0];
      add(side, this.laneY(from.r, off), from.r);
      add(side, this.laneY(to.r, off), to.r);
    }
    add(to.x, this.laneY(to.r, off), to.r);
    if (to.seat != null) add(to.x, to.seat, to.r);
    let prev = { x: from.x, y: from.seat ?? this.laneY(from.r) };
    for (const p of pts) {
      p.ms = Math.max(16, Math.round(Math.hypot(p.x - prev.x, p.y - prev.y) / speed));
      p.facing = p.y > prev.y ? "front" : p.y < prev.y ? "back" : "front";
      p.left = p.x < prev.x;
      prev = p;
    }
    return pts;
  }

  off(addr) { return ((hash(addr) % 5) - 2) * Math.round(4 * this.geo.k); }

  // Someone (or the cat) is standing at, or heading for, the spot p: wait a moment.
  crowded(self, p) {
    const near = (q) => q && Math.abs(q.x - p.x) < 12 * this.geo.s && Math.abs(q.y - p.y) < 8 * this.geo.s;
    if (self !== "cat" && near(this.cat.path?.[this.cat.i])) return true;
    return Object.entries(this.trips).some(([addr, t]) => addr !== self && t.phase !== "enter" && near(t.path[t.i]));
  }

  seatPlace(addr) { const s = this.seats[addr]; return s && { r: s.row, x: s.x, seat: s.y }; }

  spotPlace(sp) {
    const { width: w } = this.size, g = this.geo, mid = Math.round(w / 2);
    const L = wallLayout(w, this.wallLeft ?? 0), shift = { cooler: -38, shelfL: 10, shelfR: 10, window: 20 }[sp.key];
    const wall = sp.key === "door" ? mid - 24 : shift != null && L[sp.key] != null ? L[sp.key] + shift : shift != null ? mid - 24 : null;
    if (wall != null) return { r: -1, x: Math.round(wall + sp.jx) };
    if (sp.key === "chat" && this.seats[sp.other]) { const o = this.seats[sp.other]; return { r: o.row, x: o.x + Math.round(30 * g.k) }; }
    if (sp.key === "plant") return { r: g.rows - 1, x: Math.max(g.rightX, w - 150) };
    return { r: Math.floor(sp.fy * (g.rows + 1)) - 1, x: Math.round(8 + sp.fx * (w - 70)) };
  }

  // Four times a second: walkers turn corners. About once a second: who gets up, thoughts, the cat.
  tick() {
    if (!this.geo) return false;
    const now = Date.now(), slow = this.n++ % 4 === 0;
    let changed = false;
    const minute = new Date().getMinutes();
    if (minute !== this.minute) { this.minute = minute; changed = true; }
    for (const a of this.list) {
      const t = this.trips[a.address];
      if (t) {
        if (busy(a) && t.phase === "there") this.headBack(a, t, t.path[t.i], now), changed = true;
        else if (busy(a) && t.phase === "going") t.hurry = true;
        if (now < t.until) continue;
        changed = true;
        if (t.i < t.path.length - 1 && !(t.hurry && t.phase === "going")) {
          if ((t.wait ?? 0) < 6 && this.crowded(a.address, t.path[t.i + 1])) { t.wait = (t.wait ?? 0) + 1; t.until = now + 250; continue; }
          t.wait = 0; t.i++; t.until = now + t.path[t.i].ms; continue;
        }
        const at = t.path[t.i];
        if (t.phase === "going" && !t.hurry) Object.assign(t, { phase: "there", until: now + 3000 + Math.random() * 8000 });
        else if (t.phase === "back") delete this.trips[a.address];
        else this.headBack(a, t, at, now);
      } else if (slow && !busy(a) && Math.random() < (a.status === "done" ? 0.015 : 0.035) * (this.demo ? 4 : 1)) {
        const others = this.list.filter((o) => o.address !== a.address && !this.trips[o.address]);
        let key = SPOTS[Math.floor(Math.random() * SPOTS.length)];
        if (key === "chat" && !others.length) key = "floor";
        const spot = { key, other: key === "chat" ? others[Math.floor(Math.random() * others.length)].address : null,
          jx: Math.random() * 30 - 15, fx: Math.random(), fy: Math.random() };
        const path = this.path(this.seatPlace(a.address), this.spotPlace(spot), WALK, this.off(a.address));
        this.trips[a.address] = { phase: "going", spot, path, i: 0, until: now + path[0].ms };
        changed = true;
      } else if (slow && !this.thoughts[a.address] && Math.random() < (busy(a) ? 0.006 : 0.025)) {
        this.thoughts[a.address] = { sym: THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)], until: now + 2500 + Math.random() * 3000 };
        changed = true;
      }
    }
    for (const [k, t] of Object.entries(this.thoughts)) if (now >= t.until) { delete this.thoughts[k]; changed = true; }
    changed = this.moveCat(now) || changed;
    if (this.door && now >= this.door) { this.door = 0; changed = true; }
    return changed;
  }

  headBack(a, t, at, now) {
    const path = this.path({ r: at.r, x: at.x }, this.seatPlace(a.address), WALK, this.off(a.address));
    Object.assign(t, { phase: "back", path, i: 0, until: now + path[0].ms, hurry: false });
  }

  moveCat(now) {
    const c = this.cat, g = this.geo;
    if (now < c.until) return false;
    if (c.path && c.i < c.path.length - 1) {
      if ((c.wait ?? 0) < 8 && this.crowded("cat", c.path[c.i + 1])) { c.wait = (c.wait ?? 0) + 1; c.until = now + 250; return false; }
      c.wait = 0; c.i++; c.until = now + c.path[c.i].ms; c.left = c.path[c.i].left; return true; }
    const at = c.path?.[c.i] ?? { r: -1, x: Math.round(this.size.width / 3) };
    if (c.path && !c.resting) { c.resting = true; c.until = now + (Math.random() < 0.4 ? 8000 + Math.random() * 15000 : 1000 + Math.random() * 3000); return false; }
    const to = { r: Math.floor(Math.random() * (g.rows + 1)) - 1, x: Math.round(8 + Math.random() * (this.size.width - 60)) };
    c.path = this.path({ r: at.r, x: at.x }, to, CAT_WALK, Math.round((Math.random() * 16 - 8) * g.k));
    Object.assign(c, { i: 0, until: now + c.path[0].ms, left: c.path[0].left, resting: false });
    return true;
  }

  // ---- drawing --------------------------------------------------------------

  desk(a, i, x, y, k, night, space) {
    const q = (v) => Math.round(v * k), R2 = (x, y, w, h, c) => r(q(x), q(y), q(w), q(h), c);
    const dl = deskLook(i, this.seed), status = a?.status;
    const lit = a && (a.focused || night);
    const el = div().absolute().left(x).top(y).w(q(SLOT_W)).h(q(130))
      .child(R2(44, 100, 82, 12, "#6a9e3e")).child(R2(54, 96, 62, 4, "#6a9e3e"))
      .when(status === "idle" || status === "unknown", (e) => e.child(R2(124, 64, 3, 40, "#4f8a34")).child(R2(127, 84, 8, 4, "#5cbf4a"))
        .child(R2(114, 50, 24, 18, dl.mug)).child(R2(120, 46, 12, 26, dl.mug)).child(R2(121, 54, 10, 10, "#fff6e8")))
      .when(lit, (e) => e.child(R2(24, 40, 20, 20, `${dl.lamp}44`)).child(R2(31, 47, 6, 6, dl.lamp)))
      .children(clutter(dl.clutter, (cx, cy, cw, ch, c) => R2(cx - 100, cy + 50, cw, ch, c)));
    if (!a) {
      el.child(R2(83, 64, 4, 18, "#5a9a3a")).child(R2(73, 60, 12, 8, "#5cbf4a")).child(R2(87, 56, 12, 8, "#4caf50"));
      if (this.demo) return el;
      return el.id(`empty-${i}`).cursor_pointer().on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => cx.spawn(async () => {
          const ag = (await knownAgents()).find((x) => x.installed);
          run("tab.new", { ...(space ? { space } : {}), ...(ag ? { argv: ag.run } : {}) });
        }));
    }
    return el.id(`desk-${a.address}`).cursor_pointer()
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(() => !this.demo && run("agent.focus", { terminal: a.address }))
      .on_hover((hov, cx) => {
        // Only a real change redraws: a redraw re-reports hover, and notifying again would loop.
        const next = hov ? a.address : this.hover === a.address ? null : this.hover;
        if (next !== this.hover) { this.hover = next; cx.notify(); }
      });
  }

  label(a, x, y, k) {
    const q = (v) => Math.round(v * k);
    return h_flex().absolute().left(x).top(y + q(130)).w(q(SLOT_W)).justify_center().gap(q(6)).items_center()
      .child(icon(a.program, q(14))).child(txt(a.tab_name.slice(0, 16), Math.max(8, q(12)), a.focused ? "#fff8e1" : ink));
  }

  screen(a, k) {
    const q = (v) => Math.round(v * k);
    const s = r(q(6), q(5), q(54), q(34), SCREEN[a.status] ?? SCREEN.idle);
    if (a.status === "working")
      return s.children([0, 1, 2, 3].map((i) => r(q(5), q(5 + i * 7), q(10), Math.max(1, q(3)), "#7ee0a0")
        .id(`code-${a.address}-${i}`).loop("width", { from: q(6), to: q(40 - i * 6), period: 600 + ((i * 337) % 700) + (a.address.length * 53) % 300 })));
    if (a.status === "blocked") {
      const fs = Math.max(8, q(12)), roomy = q(34) >= 2 * fs + 2;
      return s.flex().items_center().justify_center().child(v_flex().items_center().id(`need-${a.address}`).loop("opacity", { from: 0.25, to: 1, period: 700 })
        .children(roomy ? [txt("NEEDS", fs, "#fff8e1"), txt("YOU", fs, "#fff8e1")] : [txt("!", fs, "#fff8e1")]));
    }
    if (a.status === "done") return s.flex().items_center().justify_center().child(txt("OK", Math.max(8, q(16)), "#bfe0ff"));
    // Idle: a screensaver logo bouncing off the edges.
    const R = rng(hash(a.address)), lw = Math.max(14, q(24)), lh = Math.max(8, q(12)), fs = Math.max(8, q(10));
    return s.child(div().absolute().top(0).w(lw).h(q(34)).id(`dvd-x-${a.address}`)
      .loop("left", { from: 0, to: q(54) - lw, period: 3600 + Math.floor(R() * 2400), easing: "linear" })
      .child(div().absolute().left(0).w(lw).h(lh).bg(pick(R, DVD)).flex().items_center().justify_center().id(`dvd-y-${a.address}`)
        .loop("top", { from: 0, to: q(34) - lh, period: 2200 + Math.floor(R() * 1600), easing: "linear" })
        .child(txt("DVD", fs, "#36404c"))));
  }

  // The worker, at their seat or out walking. Each leg of a walk animates natively.
  worker(a, k, s) {
    const lk = look(a, !!this.lead && a.space_name === this.lead), t = this.trips[a.address], id = `w-${a.address}`, seat = this.seats[a.address];
    let pos = seat, ms = 16, body;
    if (!t) {
      body = seated(lk, s, a.status).id(`${id}-sit`);
      if (a.status === "working") body.loop("top", { from: 0, to: -Math.max(1, Math.round(s * 0.7)), period: lk.bob });
      if (a.status === "blocked") body.loop("top", { from: 0, to: -4 * s, period: 700 });
    } else {
      const p = t.path[t.i], there = t.phase === "there", enter = t.phase === "enter";
      pos = p;
      ms = enter ? 16 : p.ms;
      const wall = t.spot.key in { cooler: 1, shelfL: 1, shelfR: 1, window: 1, door: 1 };
      const facing = enter ? "front" : there ? (wall ? "back" : "front") : p.facing;
      const item = there && t.spot.key === "cooler" ? "cup" : there && t.spot.key.startsWith("shelf") ? "book" : null;
      body = standing(lk, s, facing, !there && !enter, item, id);
    }
    const th = this.thoughts[a.address];
    const chatting = t?.phase === "there" && t.spot.key === "chat";
    return div().id(id).absolute().left(pos.x).top(pos.y).w(16 * s).h(20 * s)
      .transition("left", { duration: ms, easing: "linear" }).transition("top", { duration: ms, easing: "linear" })
      .cursor_pointer().on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(() => !this.demo && run("agent.focus", { terminal: a.address }))
      .child(body)
      .when(chatting, (e) => e.child(bubble(txt(".", 12, ink).id(`${id}-chat`).frames([".", "..", "..."], 400)).left(10 * s).top(-6 * s)))
      .when(!t && a.status === "blocked" && !lk.captain, (e) => e.child(bubble(txt("!", 12, "#d8382e")).left(12 * s).top(-6 * s).id(`${id}-need`).loop("opacity", { from: 0.3, to: 1, period: 600 })))
      .when(!!th && !chatting, (e) => e.child(bubble(txt(th.sym, 12, ink)).left(11 * s).top(-6 * s)));
  }

  render() {
    const p = props() ?? {};
    this.demo = !!p.demo;
    this.lead = p.lead;
    if (p.role === "pane") {
      const pane = panes().find((x) => x.pane === p.pane);
      const st = pane?.status;
      return h_flex().size_full().px(10).gap(8).items_center().bg("#7fa04a")
        .child(icon(pane?.program)).child(txt(pane?.program?.name ?? "Terminal", 12, ink))
        .child(div().flex_1())
        .child(txt(st === "blocked" ? "NEEDS YOU" : (st ?? "").toUpperCase(), 12, st === "blocked" ? "#a8322a" : ink));
    }
    if (p.role === "rail") {
      const s = spaces().find((s) => s.active), tab = s?.tabs.find((t) => t.active);
      return h_flex().size_full().bg(wood).px(16).items_center()
        .child(txt(`${s?.name ?? ""} / ${tab?.name ?? ""}`, Math.round(12 * (p.scale ?? 1)), "#fff1d6"));
    }
    // props.demo fills the desks with sample workers in every state (for previews).
    const list = p.demo ? DEMO : agents();
    if (!p.demo) setAgentOrder(list.map((a) => a.address));
    this.list = list;

    const { width: w, height: h } = this.size, now = new Date(), hour = now.getHours();
    const night = hour >= 19 || hour < 6;
    // Agents come in space order: one group of desks per space.
    const groups = [];
    for (const a of list) {
      const g = groups.at(-1);
      if (g && g.space === a.space) g.agents.push(a);
      else groups.push({ space: a.space, name: a.space_name, agents: [a] });
    }
    if (!groups.length) groups.push({ space: null, name: "", agents: [] });
    const leadAt = p.grid && p.lead ? groups.findIndex((g) => g.name === p.lead) : -1;
    if (leadAt > 0) groups.unshift(...groups.splice(leadAt, 1));
    // A rug colour per space, fixed by its id, never the same as the group beside it.
    groups.forEach((g, gi) => {
      g.rug = hash(g.space ?? g.name) % RUGS.length;
      if (gi && g.rug === groups[gi - 1].rug) g.rug = (g.rug + 1) % RUGS.length;
    });
    const sizes = groups.map((g) => g.agents.length);
    const fitted = p.grid ? gridFit(sizes, w, h, p.grid, leadAt >= 0, p.scroll) : fit(sizes, w, h);
    const scale = Math.min(p.scale ?? 1, (fitted.maxK ?? Infinity) / fitted.k), k = fitted.k * scale, s = fitted.s * scale;
    const { cols, rowsOf, bands, bandRows } = fitted;
    const sw = Math.round(SLOT_W * k), sh = Math.round(SLOT_H * k), gap = Math.round(GAP * k), q = (v) => Math.round(v * k);
    const top = WALL + q(40), lanes = [], rowY = [];
    const desks = []; // { a, x, y, row, space }
    let by = top;
    bands.forEach((band, bi) => {
      const base = rowY.length;
      for (let ri = 0; ri < bandRows[bi]; ri++) rowY.push(by + ri * sh);
      const bw = band.reduce((a, gi) => a + cols[gi] * sw, 0) + (band.length - 1) * gap;
      let x0 = Math.round((w - bw) / 2);
      band.forEach((gi, j) => {
        const g = groups[gi];
        Object.assign(g, { x: x0, y: by, w: cols[gi] * sw, rows: rowsOf[gi] });
        for (let d = 0; d < cols[gi] * rowsOf[gi]; d++) {
          const ri = Math.floor(d / cols[gi]);
          desks.push({ a: g.agents[d], x: x0 + (d % cols[gi]) * sw, y: by + ri * sh, row: base + ri, space: g.space });
        }
        x0 += g.w + gap;
        if (j < band.length - 1) lanes.push(x0 - gap + Math.round((gap - 16 * s) / 2));
      });
      by += bandRows[bi] * sh + Math.round(BAND * k);
    });
    const H = Math.max(h, by);
    this.floorH = H;
    this.wallLeft = Math.round(30 + 120 * scale);
    const left = Math.min(...groups.map((g) => g.x)), right = Math.max(...groups.map((g) => g.x + g.w));
    const leftX = Math.max(4, left - 16 * s - 6), rightX = Math.min(w - 16 * s - 4, right + 6);
    this.geo = { k, s, sh, top, rowY, rows: rowY.length, topY: WALL - 40, leftX, rightX, lanes: [leftX, ...lanes, rightX] };
    const taken = desks.filter((d) => d.a);

    // Newcomers walk in through the door.
    const ts = Date.now();
    for (const d of taken) {
      const a = d.a;
      this.seats[a.address] = { x: d.x + q(61), y: d.y + q(50), row: d.row };
      if (this.known && !this.known.has(a.address)) {
        const door = this.spotPlace({ key: "door", jx: 0 });
        const path = [{ x: door.x, y: this.laneY(-1), r: -1, ms: 16 }, ...this.path(door, this.seatPlace(a.address), WALK, this.off(a.address))];
        this.trips[a.address] = { phase: "enter", spot: { key: "door" }, path, i: 0, until: ts + 700 };
        this.door = ts + 4000;
      }
    }
    this.known = new Set(list.map((a) => a.address));
    for (const key of Object.keys(this.trips)) if (!this.known.has(key)) delete this.trips[key];
    for (const t of Object.values(this.trips)) if (t.phase === "enter" && ts >= t.until) t.phase = "back";

    const c = this.cat, cp = c.path?.[c.i] ?? { x: Math.round(w / 3), y: this.geo.topY, ms: 16 };
    const hd = taken.find((d) => d.a.address === this.hover), hovered = hd?.a;
    const floor = div().id("office-root").relative().w(w).h(H).overflow_hidden().bg("#e2a465")
      .child(this.roomView)
      .children(groups.filter((g) => g.name).map((g) => {
        const [col, edge] = RUGS[g.rug], rw = g.w + q(16), rh = g.rows * sh + q(4);
        return r(g.x - q(8), g.y - q(8), rw, rh, col).border(3).border_color(edge)
          .child(r(q(6), q(6), rw - q(12) - 6, rh - q(12) - 6, col).border(1).border_color(`${edge}aa`));
      }))
      .children(desks.map((d, i) => this.desk(d.a, i, d.x, d.y, k, night, d.space)))
      .children(taken.map((d) => this.label(d.a, d.x, d.y, k)))
      .children(groups.filter((g) => g.name).map((g) => {
        const edge = RUGS[g.rug][1], ts = Math.max(8, q(16));
        return div().absolute().left(g.x - q(8)).top(g.y - q(8) - ts - 8).px(8).py(4).bg(edge)
          .child(txt(g.name.slice(0, 20), ts, "#fff8e1"));
      }))
      .child(div().id("cat").absolute().left(cp.x).top(cp.y + Math.round(30 * k))
        .transition("left", { duration: cp.ms, easing: "linear" }).transition("top", { duration: cp.ms, easing: "linear" })
        .child(cat(c.coat, s, c.left)))
      .children(list.map((a) => this.worker(a, k, s)))
      .when(night, (e) => e.child(r(0, 0, w, H, "#0b123650")))
      .when(hour >= 17 && hour < 19, (e) => e.child(r(0, 0, w, H, "#f2a65a1a")))
      .when(!!hovered, (e) => {
        const x = Math.min(hd.x + sw - 10, w - Math.round(200 * scale));
        return e.child(v_flex().absolute().left(x).top(hd.y).w(Math.round(180 * scale)).p(8).gap(4).bg("#fff27a").border(2).border_color("#d8c440")
          .child(txt(hovered.tab_name, Math.round(12 * scale), ink).truncate())
          .child(txt(hovered.space_name ?? "", Math.round(12 * scale), "#6b5a4a").truncate())
          .when(!!hovered.title, (e) => e.child(txt(hovered.title, Math.round(12 * scale), "#6b5a4a").truncate()))
          .child(txt(hovered.status.toUpperCase(), Math.round(12 * scale), hovered.status === "blocked" ? "#a8322a" : ink)));
      })
      .child(v_flex().absolute().left(16).top(14).gap(4).p(8).bg("#fff6dc").border(3).border_color("#4e7a2c")
        .child(txt("PIKMIN", Math.round(16 * scale), "#d8382e"))
        .child(txt(`Day ${Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)} · ${list.length} in the field`, Math.round(12 * scale), "#5a4a3a")));
    return div().id("office-scroll").size_full().overflow_y_scrollbar().bg("#e2a465")
      .on_size_change((size, cx) => { this.size = size; this.syncRoom(); cx.notify(); })
      .child(floor);
  }
}

const bubble = (content) => div().absolute().px(4).py(2).bg("#ffffff").border(2).border_color(ink).child(content);
