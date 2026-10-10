// Minimal GameMaker runtime core: values, instances, objects, events, step loop, motion, collisions, rooms.
// Semantics follow GameMaker 2023 (VM) with "fast collision compatibility" enabled, as used by Deltarune ch1.
'use strict';

const GM = window.GM = {
  EPS: 1e-5,
  fps: 30,
  sprites: [], objects: [], sounds: [], fonts: [], backgrounds: [], rooms: {}, roomNames: [], roomOrder: [], scripts: [],
  assetIndex: new Map(), // name -> {kind, i}
  instances: [], byId: new Map(), lastId: 300000,
  room: -1, newRoom: -1, roomData: null,
  globals: {}, // G
  frame: 0,
  log: (...a) => { if (GM.debug) console.log('[gm]', ...a); },
  warned: new Set(),
  warnOnce(key, ...msg) {
    if (!this.warned.has(key)) {
      this.warned.add(key);
      console.warn('[gm]', key, ...msg);
      if (this.traceWarnings) {
        const t = new Error('trace ' + key).stack.split('\n').slice(2, 7).join('\n');
        (this.traces = this.traces || []).push(key + '\n' + t);
        console.warn(t);
      }
    }
  }
};

// ------------------------------------------------------------------ value helpers used by generated code
const EPS = 1e-5;
function $num(v) { return typeof v === 'boolean' ? +v : v; }
const RT = GM.rt = {
  G: GM.globals,
  $eq(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a === b || Math.abs(a - b) <= EPS;
    a = $num(a); b = $num(b);
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= EPS;
    if (a instanceof Instance) a = a.id;
    if (b instanceof Instance) b = b.id;
    return a === b;
  },
  $ne(a, b) { return !RT.$eq(a, b); },
  $lt(a, b) { a = $num(a); b = $num(b); if (typeof a === 'number' && typeof b === 'number') return b - a > EPS; return a < b; },
  $le(a, b) { a = $num(a); b = $num(b); if (typeof a === 'number' && typeof b === 'number') return a - b <= EPS; return a <= b; },
  $gt(a, b) { a = $num(a); b = $num(b); if (typeof a === 'number' && typeof b === 'number') return a - b > EPS; return a > b; },
  $ge(a, b) { a = $num(a); b = $num(b); if (typeof a === 'number' && typeof b === 'number') return b - a <= EPS; return a >= b; },
  $t(v) {
    if (typeof v === 'number') return v > 0.5;
    if (typeof v === 'boolean') return v;
    if (v instanceof Instance) return true;
    return false;
  },
  $sw(v) { return typeof v === 'boolean' ? +v : v; },
  $rep(n) { n = $num(n); return Math.floor(n + 0.5); },
  $div(a, b) { return Math.trunc(a / b); },
  $mod(a, b) { return a % b; },
  $A(o, k) { let a = o[k]; if (!Array.isArray(a)) { a = []; o[k] = a; } return a; },
  $A2(arr, i) { let a = arr[i]; if (!Array.isArray(a)) { a = []; arr[i] = a; } return a; },
  $AL(v) { return Array.isArray(v) ? v : []; },
  $W(target, self, other) { return GM.resolveAll(target, self, other, false); },
  $IS(target, self, other) { return GM.resolveAll(target, self, other, true); },
  $I(target, self, other) { return GM.resolveOne(target, self, other); },
  $new(name, self, other, args) {
    const fn = GM.S[name];
    const o = {};
    if (fn) fn(o, self, ...args); else GM.warnOnce('new:' + name);
    return o;
  },
  $callv(f, self, other, ...args) {
    if (typeof f === 'function') return f(self, other, ...args);
    if (typeof f === 'number') { const s = GM.scriptByIndex(f); if (s) return s(self, other, ...args); }
    GM.warnOnce('callv:' + f);
    return undefined;
  },
  $callm(obj, name, other, ...args) {
    const f = obj && obj[name];
    if (typeof f === 'function') return f(obj, other, ...args);
    GM.warnOnce('callm:' + name);
    return undefined;
  },
  $fn(name) { const f = GM.S[name]; return f || 0; },
  $struct(o) { return o; },
  $mapget(m, k) { return GM.F.ds_map_find_value(null, null, m, k); },
  $listget(l, i) { return GM.F.ds_list_find_value(null, null, l, i); }
};

// ------------------------------------------------------------------ instances
const DEG = Math.PI / 180;
function snap(v) { const r = Math.round(v); return Math.abs(v - r) < 0.0001 ? r : v; }

class Instance {
  constructor(id, obj) {
    this.id = id;
    this.object_index = obj.index;
    this.$obj = obj;
    this.x = 0; this.y = 0; this.xstart = 0; this.ystart = 0; this.xprevious = 0; this.yprevious = 0;
    this.$hs = 0; this.$vs = 0; this.$spd = 0; this.$dir = 0;
    this.friction = 0; this.gravity = 0; this.gravity_direction = 270;
    this.$spr = obj.sprite; this.$ii = 0; this.image_speed = 1;
    this.image_xscale = 1; this.image_yscale = 1; this.image_angle = 0; this.image_alpha = 1; this.image_blend = 0xFFFFFF;
    this.mask_index = obj.mask;
    this.$depth = obj.depth; this.$seq = ++GM.drawSeq;
    this.visible = obj.visible; this.solid = obj.solid; this.persistent = obj.persistent;
    this.alarm = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
    this.$dead = false; this.$active = true;
    this.path_index = -1; this.timeline_index = -1;
    this.layer = -1;
  }
  get hspeed() { return this.$hs; }
  set hspeed(v) { this.$hs = $num(v); this.$speed1(); }
  get vspeed() { return this.$vs; }
  set vspeed(v) { this.$vs = $num(v); this.$speed1(); }
  get speed() { return this.$spd; }
  set speed(v) { this.$spd = $num(v); this.$speed2(); }
  get direction() { return this.$dir; }
  set direction(v) { v = $num(v) % 360; if (v < 0) v += 360; this.$dir = v; this.$speed2(); }
  // components -> speed/direction
  $speed1() {
    const h = this.$hs, v = this.$vs;
    let d;
    if (h === 0) d = v > 0 ? 270 : (v < 0 ? 90 : this.$dir);
    else { d = Math.atan2(-v, h) * 180 / Math.PI; if (d < 0) d += 360; }
    d = snap(d) % 360;
    this.$dir = d;
    this.$spd = snap(Math.sqrt(h * h + v * v));
  }
  // speed/direction -> components
  $speed2() {
    this.$hs = snap(this.$spd * Math.cos(this.$dir * DEG));
    this.$vs = snap(-this.$spd * Math.sin(this.$dir * DEG));
  }
  get sprite_index() { return this.$spr; }
  set sprite_index(v) { v = $num(v); if (v !== this.$spr) { this.$spr = v; } }
  get image_index() { return this.$ii; }
  set image_index(v) { this.$ii = $num(v); }
  get image_number() { const s = GM.sprites[this.$spr]; return s ? s.frames.length : 0; }
  get image_single() { return this.image_speed === 0 ? this.$ii : -1; }
  set image_single(v) { if (v < 0) this.image_speed = 1; else { this.image_speed = 0; this.$ii = v; } }
  get sprite_width() { const s = GM.sprites[this.$spr]; return s ? s.w * this.image_xscale : 0; }
  get sprite_height() { const s = GM.sprites[this.$spr]; return s ? s.h * this.image_yscale : 0; }
  get sprite_xoffset() { const s = GM.sprites[this.$spr]; return s ? s.ox * this.image_xscale : 0; }
  get sprite_yoffset() { const s = GM.sprites[this.$spr]; return s ? s.oy * this.image_yscale : 0; }
  get depth() { return this.$depth; }
  set depth(v) { v = $num(v); if (v !== this.$depth) { this.$depth = v; this.$seq = ++GM.drawSeq; } }
  get bbox_left() { return GM.bbox(this).l; }
  get bbox_right() { return GM.bbox(this).r; }
  get bbox_top() { return GM.bbox(this).t; }
  get bbox_bottom() { return GM.bbox(this).b; }
  get instance_id() { return this.id; }
}
GM.Instance = Instance;
GM.drawSeq = 0;

// null object for reads of missing instances
GM.NULLI = new Proxy({}, { get: () => undefined, set: () => true });

// ------------------------------------------------------------------ objects & events
// event keys: type * 1000 + subtype for non-collision; collision handled separately
const EV = GM.EV = { CREATE: 0, DESTROY: 1, ALARM: 2, STEP: 3, COLLISION: 4, KEYBOARD: 5, MOUSE: 6, OTHER: 7, DRAW: 8, KEYPRESS: 9, KEYRELEASE: 10, CLEANUP: 12, PRECREATE: 14 };
function evKey(type, sub) { return type * 1000 + sub; }
GM.evKey = evKey;

GM.setupObjects = function (list, codeTable) {
  const idx = (name, table) => name == null ? -1 : (GM.assetIndex.get(name) ? GM.assetIndex.get(name).i : -1);
  GM.objects = list.map((o, i) => ({
    index: i, name: o.name, sprite: idx(o.sprite), mask: idx(o.mask), parentName: o.parent,
    parent: -1, visible: o.visible, solid: o.solid, depth: o.depth, persistent: o.persistent,
    own: o.events, ev: new Map(), col: [], children: [], desc: null, anc: null
  }));
  for (const o of GM.objects) {
    if (o.parentName) { o.parent = GM.assetIndex.get(o.parentName).i; GM.objects[o.parent].children.push(o.index); }
  }
  // ancestors (self first) and descendants (self included)
  for (const o of GM.objects) {
    const anc = [];
    for (let p = o.index; p >= 0; p = GM.objects[p].parent) anc.push(p);
    o.anc = anc;
    o.ancSet = new Set(anc);
  }
  for (const o of GM.objects) {
    const desc = [];
    const walk = (i) => { desc.push(i); GM.objects[i].children.forEach(walk); };
    walk(o.index);
    o.desc = desc;
    o.descSet = new Set(desc);
  }
  // resolve events with inheritance: own events override parent's
  const missing = new Set();
  for (const o of GM.objects) {
    const chain = o.anc.slice().reverse(); // root ancestor first
    const colMap = new Map();
    for (const ai of chain) {
      const a = GM.objects[ai];
      for (const [key, codeName] of Object.entries(a.own)) {
        const [type, sub] = key.split(':').map(Number);
        const fn = codeName ? codeTable[codeName] : null;
        if (codeName && !fn) missing.add(codeName);
        const f = fn || (() => {});
        if (type === EV.COLLISION) colMap.set(sub, f);
        else o.ev.set(evKey(type, sub), f);
      }
    }
    o.col = [...colMap.entries()]; // [targetObjIndex, fn]
  }
  if (missing.size) console.warn('[gm] event code missing:', [...missing].slice(0, 20));
};

GM.perform = function (inst, type, sub, other) {
  const f = inst.$obj.ev.get(evKey(type, sub));
  if (!f) return false;
  f(inst, other || inst);
  return true;
};

// event_inherited would need the parent's handler; not used by Deltarune ch1.

// ------------------------------------------------------------------ instance resolution
GM.isInstanceOf = function (inst, objIndex) { return inst.$obj.ancSet.has(objIndex); };

GM.resolveAll = function (target, self, other, forWrite) {
  if (target instanceof Instance) return target.$dead && !forWrite ? [] : [target];
  if (typeof target === 'object' && target !== null) return [target]; // struct
  target = $num(target);
  if (typeof target !== 'number') return [];
  if (target === -1) return self ? [self] : [];
  if (target === -2) return other ? [other] : [];
  if (target === -3) return GM.instances.filter(i => !i.$dead && i.$active);
  if (target === -4) return [];
  if (target >= 100000) {
    const i = GM.byId.get(target);
    return i && (!i.$dead || forWrite) && i.$active ? [i] : [];
  }
  const o = GM.objects[target];
  if (!o) return [];
  const out = [];
  for (const i of GM.instances) if (!i.$dead && i.$active && o.descSet.has(i.object_index)) out.push(i);
  return out;
};

GM.resolveOne = function (target, self, other) {
  if (target instanceof Instance) return target;
  if (typeof target === 'object' && target !== null) return target;
  target = $num(target);
  if (target === -1) return self;
  if (target === -2) return other;
  if (target >= 100000) {
    const i = GM.byId.get(target);
    if (i) return i;
    GM.warnOnce('noinst:' + target, 'read from missing instance');
    return GM.NULLI;
  }
  const o = GM.objects[target];
  if (o) {
    for (const i of GM.instances) if (!i.$dead && i.$active && o.descSet.has(i.object_index)) return i;
    // GM falls back to deactivated/destroyed? no: error. Return null object.
    GM.warnOnce('noobj:' + o.name, 'read from object with no instances');
  } else GM.warnOnce('badref:' + target, 'bad instance reference');
  return GM.NULLI;
};

GM.instanceExists = function (target) {
  if (target instanceof Instance) return !target.$dead && target.$active;
  target = $num(target);
  if (typeof target !== 'number' || target < 0) return false;
  if (target >= 100000) { const i = GM.byId.get(target); return !!i && !i.$dead && i.$active; }
  const o = GM.objects[target];
  if (!o) return false;
  for (const i of GM.instances) if (!i.$dead && i.$active && o.descSet.has(i.object_index)) return true;
  return false;
};

// ------------------------------------------------------------------ create / destroy
GM.createInstance = function (x, y, objIndex, depth, creator, roomInst) {
  const obj = GM.objects[objIndex];
  if (!obj) { GM.warnOnce('createbad:' + objIndex); return -4; }
  const id = roomInst ? roomInst.id : ++GM.lastId;
  const inst = new Instance(id, obj);
  inst.x = inst.xstart = inst.xprevious = x;
  inst.y = inst.ystart = inst.yprevious = y;
  if (depth !== undefined) inst.$depth = depth;
  if (roomInst) {
    inst.image_xscale = roomInst.sx; inst.image_yscale = roomInst.sy; inst.image_angle = roomInst.rot;
    if (roomInst.color !== undefined && roomInst.color !== 4294967295) inst.image_blend = roomInst.color & 0xFFFFFF;
    if (roomInst.imageSpeed !== undefined) inst.image_speed = roomInst.imageSpeed;
    if (roomInst.imageIndex !== undefined) inst.$ii = roomInst.imageIndex;
  }
  GM.instances.push(inst);
  GM.byId.set(id, inst);
  if (roomInst && roomInst.pre && GM.C[roomInst.pre]) GM.C[roomInst.pre](inst, inst);
  GM.perform(inst, EV.CREATE, 0, creator || inst);
  if (roomInst && roomInst.code && GM.C[roomInst.code]) GM.C[roomInst.code](inst, inst);
  return id;
};

GM.destroyInstance = function (inst, runEvent = true) {
  if (!inst || inst.$dead) return;
  inst.$dead = true;
  if (runEvent) GM.perform(inst, EV.DESTROY, 0, inst);
  GM.perform(inst, EV.CLEANUP, 0, inst);
};

GM.removeMarked = function () {
  let j = 0;
  const arr = GM.instances;
  for (let i = 0; i < arr.length; i++) {
    const inst = arr[i];
    if (inst.$dead) GM.byId.delete(inst.id);
    else arr[j++] = inst;
  }
  arr.length = j;
};

// ------------------------------------------------------------------ bounding boxes & collisions (compatibility mode)
function gmRound(v) { return v < 0 ? -Math.round(-v) : Math.round(v); }
GM.maskSprite = function (inst) {
  const m = inst.mask_index >= 0 ? inst.mask_index : inst.$spr;
  return m >= 0 ? GM.sprites[m] : null;
};
GM.bbox = function (inst, px, py) {
  const s = GM.maskSprite(inst);
  const x = px === undefined ? inst.x : px, y = py === undefined ? inst.y : py;
  if (!s) return { l: x, r: x, t: y, b: y, none: true };
  const xs = inst.image_xscale, ys = inst.image_yscale, ang = inst.image_angle;
  let l, r, t, b;
  if (Math.abs(ang) <= EPS || ang === 0) {
    l = x + xs * (s.ml - s.ox);
    r = l + xs * ((s.mr + 1) - s.ml);
    t = y + ys * (s.mt - s.oy);
    b = t + ys * ((s.mb + 1) - s.mt);
    if (l > r) { const q = l; l = r; r = q; }
    if (t > b) { const q = t; t = b; b = q; }
    l = gmRound(l); r = gmRound(r) - 1; t = gmRound(t); b = gmRound(b) - 1;
  } else {
    const ss = Math.sin(ang * DEG), cc = Math.cos(ang * DEG);
    const x0 = xs * (s.ml - s.ox), x1 = xs * ((s.mr + 1) - s.ox);
    const y0 = ys * (s.mt - s.oy), y1 = ys * ((s.mb + 1) - s.oy);
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const px2 of [x0, x1]) for (const py2 of [y0, y1]) {
      const rx = cc * px2 + ss * py2, ry = -ss * px2 + cc * py2;
      if (rx < minx) minx = rx; if (rx > maxx) maxx = rx; if (ry < miny) miny = ry; if (ry > maxy) maxy = ry;
    }
    l = Math.floor(x + minx + 0.5); r = Math.floor(x + maxx - 0.5);
    t = Math.floor(y + miny + 0.5); b = Math.floor(y + maxy - 0.5);
  }
  return { l, r, t, b };
};

// test one pixel (integer room coords) against an instance's mask, compatibility (Orig) algorithm
function pixelIn(inst, s, img, ix, iy, i, j) {
  const xs = inst.image_xscale, ys = inst.image_yscale, ang = inst.image_angle;
  let xx, yy;
  if (xs === 1 && ys === 1 && ang === 0) { xx = i - ix + s.ox; yy = j - iy + s.oy; }
  else if (ang === 0) { xx = Math.floor((i - ix) / xs + s.ox); yy = Math.floor((j - iy) / ys + s.oy); }
  else {
    const ss = Math.sin(-ang * DEG), cc = Math.cos(-ang * DEG);
    xx = Math.floor((cc * (i - ix) + ss * (j - iy)) / xs + s.ox);
    yy = Math.floor((cc * (j - iy) - ss * (i - ix)) / ys + s.oy);
  }
  if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h) return false;
  if (s.sep !== 1 || !s.maskData) return xx >= s.ml && xx <= s.mr && yy >= s.mt && yy <= s.mb;
  const m = s.maskData[img % s.maskData.length];
  if (!m) return true;
  const mx = xx - s.maskOx, my = yy - s.maskOy;
  if (mx < 0 || my < 0 || mx >= s.mw || my >= s.mh) return false;
  return (m[my * s.mstride + (mx >> 3)] & (0x80 >> (mx & 7))) !== 0;
}
GM.pixelIn = pixelIn;

function needsPixels(s, inst) { return s.sep === 1 || (s.sep === 2 && inst.image_angle !== 0); }

GM.collideInstances = function (a, b, ax, ay) {
  if (a === b || a.$dead || b.$dead) return false;
  const sa = GM.maskSprite(a), sb = GM.maskSprite(b);
  if (!sa || !sb) return false;
  const ba = GM.bbox(a, ax, ay), bb = GM.bbox(b);
  if (ba.l > bb.r || ba.r < bb.l || ba.t > bb.b || ba.b < bb.t) return false;
  const pa = needsPixels(sa, a), pb = needsPixels(sb, b);
  if (!pa && !pb) return true;
  const l = Math.max(ba.l, bb.l), r = Math.min(ba.r, bb.r), t = Math.max(ba.t, bb.t), bt = Math.min(ba.b, bb.b);
  const axr = gmRound(ax === undefined ? a.x : ax), ayr = gmRound(ay === undefined ? a.y : ay);
  const bxr = gmRound(b.x), byr = gmRound(b.y);
  const ia = Math.floor(a.$ii) | 0, ib = Math.floor(b.$ii) | 0;
  for (let i = l; i <= r; i++) {
    for (let j = t; j <= bt; j++) {
      if (pa && !pixelIn(a, sa, ia, axr, ayr, i, j)) continue;
      if (pb && !pixelIn(b, sb, ib, bxr, byr, i, j)) continue;
      return true;
    }
  }
  return false;
};

// candidates for collision queries
GM.candidates = function (target, self) {
  return GM.resolveAll(target, self, self, false);
};

GM.collisionRect = function (inst, s, x1, y1, x2, y2, prec) {
  const bb = GM.bbox(inst);
  if (x1 > x2) { const q = x1; x1 = x2; x2 = q; }
  if (y1 > y2) { const q = y1; y1 = y2; y2 = q; }
  if (bb.l > x2 || bb.r < x1 || bb.t > y2 || bb.b < y1) return false;
  if (!prec || !needsPixels(s, inst)) return true;
  const l = Math.max(bb.l, Math.ceil(x1)), r = Math.min(bb.r, Math.floor(x2));
  const t = Math.max(bb.t, Math.ceil(y1)), b = Math.min(bb.b, Math.floor(y2));
  const ix = gmRound(inst.x), iy = gmRound(inst.y), img = Math.floor(inst.$ii) | 0;
  for (let i = l; i <= r; i++) for (let j = t; j <= b; j++) if (pixelIn(inst, s, img, ix, iy, i, j)) return true;
  return false;
};

GM.collisionPoint = function (inst, s, x, y, prec) {
  const bb = GM.bbox(inst);
  const px = Math.floor(x), py = Math.floor(y);
  if (px < bb.l || px > bb.r || py < bb.t || py > bb.b) return false;
  if (!prec || !needsPixels(s, inst)) return true;
  return pixelIn(inst, s, Math.floor(inst.$ii) | 0, gmRound(inst.x), gmRound(inst.y), px, py);
};

GM.collisionLine = function (inst, s, x1, y1, x2, y2, prec) {
  const bb = GM.bbox(inst);
  // clip segment to bbox (Liang-Barsky)
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!(clip(-dx, x1 - bb.l) && clip(dx, bb.r + 1 - x1) && clip(-dy, y1 - bb.t) && clip(dy, bb.b + 1 - y1))) return false;
  if (!prec || !needsPixels(s, inst)) return true;
  const len = Math.max(Math.abs(dx), Math.abs(dy)) * (t1 - t0);
  const steps = Math.max(1, Math.ceil(len));
  const ix = gmRound(inst.x), iy = gmRound(inst.y), img = Math.floor(inst.$ii) | 0;
  for (let k = 0; k <= steps; k++) {
    const tt = t0 + (t1 - t0) * (k / steps);
    if (pixelIn(inst, s, img, ix, iy, Math.floor(x1 + dx * tt), Math.floor(y1 + dy * tt))) return true;
  }
  return false;
};

// ------------------------------------------------------------------ step phases
GM.updateImages = function () {
  for (const inst of GM.instances) {
    if (inst.$dead || !inst.$active) continue;
    const s = GM.sprites[inst.$spr];
    if (!s) continue;
    const n = s.frames.length;
    const f = s.speedType === 1 ? s.speed : s.speed / GM.fps;
    inst.$ii += inst.image_speed * f;
    if (inst.$ii >= n) { inst.$ii -= n; GM.perform(inst, EV.OTHER, 7); }
    else if (inst.$ii < 0) { inst.$ii += n; GM.perform(inst, EV.OTHER, 7); }
  }
};

GM.eventAll = function (type, sub) {
  const list = GM.instances.slice();
  for (const inst of list) {
    if (inst.$dead || !inst.$active) continue;
    GM.perform(inst, type, sub);
    if (GM.newRoom !== -1 && GM.roomChangeAbort) return;
  }
};

GM.handleAlarms = function () {
  const list = GM.instances.slice();
  for (const inst of list) {
    if (inst.$dead || !inst.$active) continue;
    const al = inst.alarm;
    for (let i = 0; i < 12; i++) {
      if (al[i] > 0) {
        al[i] -= 1;
        if (al[i] <= 0) {
          al[i] = -1;
          GM.perform(inst, EV.ALARM, i);
          if (inst.$dead) break;
        }
      }
    }
  }
};

GM.updatePositions = function () {
  for (const inst of GM.instances) {
    if (inst.$dead || !inst.$active) continue;
    if (inst.friction !== 0) {
      const sp = inst.$spd;
      if (sp !== 0) {
        let ns = sp > 0 ? sp - inst.friction : sp + inst.friction;
        if ((sp > 0 && ns < 0) || (sp < 0 && ns > 0)) ns = 0;
        inst.speed = ns;
      }
    }
    if (inst.gravity !== 0) {
      inst.$hs += inst.gravity * Math.cos(inst.gravity_direction * DEG);
      inst.$vs -= inst.gravity * Math.sin(inst.gravity_direction * DEG);
      inst.$speed1();
    }
    if (inst.$hs !== 0 || inst.$vs !== 0) { inst.x += inst.$hs; inst.y += inst.$vs; }
  }
};

GM.handleCollisions = function () {
  const list = GM.instances.slice();
  for (const a of list) {
    if (a.$dead || !a.$active || a.$obj.col.length === 0) continue;
    for (const [target, fn] of a.$obj.col) {
      const tobj = GM.objects[target];
      for (const b of list) {
        if (b === a || b.$dead || !b.$active || !tobj.descSet.has(b.object_index)) continue;
        if (GM.collideInstances(a, b)) {
          if (a.solid || b.solid) { a.x = a.xprevious; a.y = a.yprevious; b.x = b.xprevious; b.y = b.yprevious; }
          fn(a, b);
          if (a.$dead) break;
        }
      }
      if (a.$dead) break;
    }
  }
};

GM.step = function () {
  GM.frame++;
  if (GM.beforeStep) GM.beforeStep();
  GM.input.beginStep();
  for (const inst of GM.instances) { inst.xprevious = inst.x; inst.yprevious = inst.y; }
  GM.updateImages();
  if (GM.checkRoom()) return;
  GM.eventAll(EV.STEP, 1);
  if (GM.checkRoom()) return;
  GM.handleAlarms();
  if (GM.checkRoom()) return;
  GM.eventAll(EV.STEP, 0);
  if (GM.checkRoom()) return;
  GM.updatePositions();
  GM.handleCollisions();
  if (GM.checkRoom()) return;
  GM.eventAll(EV.STEP, 2);
  GM.removeMarked();
  if (GM.checkRoom()) return;
  GM.updateCamera();
  GM.draw.frame();
  GM.audio.update();
};

// room change happens at the end of the current event phase
GM.checkRoom = function () {
  if (GM.newRoom === -1) return false;
  const r = GM.newRoom;
  GM.newRoom = -1;
  GM.removeMarked();
  GM.gotoRoomNow(r);
  return true;
};

// ------------------------------------------------------------------ rooms
GM.gotoRoomNow = function (roomIndex) {
  // room end events
  if (GM.room >= 0) {
    for (const inst of GM.instances.slice()) if (!inst.$dead) GM.perform(inst, EV.OTHER, 5);
    // remove non-persistent instances (no Destroy event on room change, Clean Up runs)
    for (const inst of GM.instances) if (!inst.persistent && !inst.$dead) { inst.$dead = true; GM.perform(inst, EV.CLEANUP, 0, inst); }
    GM.removeMarked();
  }
  const name = GM.roomNames[roomIndex];
  const rd = GM.rooms[name];
  if (!rd) { console.error('[gm] room not exported:', name); GM.onMissingRoom && GM.onMissingRoom(name); return; }
  GM.room = roomIndex;
  GM.roomData = rd;
  GM.R.room_width = rd.w; GM.R.room_height = rd.h;
  GM.setupRoomLayers(rd);
  GM.setupViews(rd);
  const isFirst = !GM.started;
  GM.started = true;
  const order = rd.order && rd.order.length ? rd.order : rd.instances.map(i => i.id);
  const byId = new Map(rd.instances.map(i => [i.id, i]));
  const created = [];
  for (const id of order) {
    const ri = byId.get(id);
    if (!ri || !ri.obj) continue;
    const oi = GM.assetIndex.get(ri.obj).i;
    // persistent instance already present? (same object persistent survives) - GM skips duplicates by id
    if (GM.byId.has(ri.id)) continue;
    const layerDepth = GM.instanceLayerDepth(rd, ri.id);
    GM.createInstance(ri.x, ri.y, oi, layerDepth !== undefined ? layerDepth : GM.objects[oi].depth, null, ri);
    created.push(ri.id);
  }
  if (isFirst) GM.eventAll(EV.OTHER, 2);
  if (rd.creationCode && GM.C[rd.creationCode]) GM.C[rd.creationCode](GM.globalSelf, GM.globalSelf);
  GM.eventAll(EV.OTHER, 4);
  GM.onRoomStart && GM.onRoomStart(name);
};

GM.instanceLayerDepth = function (rd, id) {
  for (const l of rd.layers) if (l.type === 2 && Array.isArray(l.data) && l.data.includes(id)) return l.depth;
  return undefined;
};

GM.setupRoomLayers = function (rd) {
  GM.layers = rd.layers.map(l => ({
    id: l.id, name: l.name, type: l.type, depth: l.depth, x: l.xo, y: l.yo, hspeed: l.hs, vspeed: l.vs, visible: l.visible,
    data: l.data, bgAlpha: 1, bgBlend: 0xFFFFFF
  }));
  const colorLayer = rd.layers.find(l => l.type === 1);
  GM.bgColor = rd.drawBgColor ? (rd.bgColor & 0xFFFFFF) : null;
  if (colorLayer && colorLayer.data) {
    GM.bgColor = colorLayer.data.color & 0xFFFFFF;
    GM.bgLayer = colorLayer.data;
  }
};

GM.setupViews = function (rd) {
  GM.views = [];
  for (let i = 0; i < 8; i++) {
    const v = rd.views[i] || { enabled: false, x: 0, y: 0, w: 640, h: 480, px: 0, py: 0, pw: 640, ph: 480, bx: 0, by: 0, sx: -1, sy: -1, obj: null };
    GM.views.push({
      visible: !!v.enabled, cam: { x: v.x, y: v.y, w: v.w, h: v.h, angle: 0, bx: v.bx, by: v.by, sx: v.sx, sy: v.sy, target: v.obj ? GM.assetIndex.get(v.obj).i : -1 },
      px: v.px, py: v.py, pw: v.pw, ph: v.ph
    });
  }
};

GM.updateCamera = function () {
  const v = GM.views && GM.views[0];
  if (!v || !v.visible) return;
  const c = v.cam;
  if (c.target >= 0) {
    const t = GM.resolveOne(c.target, null, null);
    if (t && t !== GM.NULLI) {
      let nx = c.x, ny = c.y;
      if (t.x - c.x < c.bx) nx = t.x - c.bx;
      if (c.x + c.w - t.x < c.bx) nx = t.x + c.bx - c.w;
      if (t.y - c.y < c.by) ny = t.y - c.by;
      if (c.y + c.h - t.y < c.by) ny = t.y + c.by - c.h;
      nx = Math.max(0, Math.min(nx, GM.R.room_width - c.w));
      ny = Math.max(0, Math.min(ny, GM.R.room_height - c.h));
      c.x = nx; c.y = ny;
    }
  }
};

// ------------------------------------------------------------------ input
GM.input = {
  held: new Set(), downEvents: new Set(), upEvents: new Set(), pressed: new Set(), released: new Set(), lastKey: 0,
  beginStep() {
    this.pressed = this.downEvents; this.released = this.upEvents;
    this.downEvents = new Set(); this.upEvents = new Set();
  },
  keyDown(code) { if (!this.held.has(code)) { this.held.add(code); this.downEvents.add(code); this.lastKey = code; } },
  keyUp(code) { if (this.held.has(code)) { this.held.delete(code); this.upEvents.add(code); } },
  check(k) { if (k === 1) return this.held.size > 0; if (k === 0) return this.held.size === 0; return this.held.has(k); },
  checkPressed(k) { if (k === 1) return this.pressed.size > 0; return this.pressed.has(k); },
  checkReleased(k) { if (k === 1) return this.released.size > 0; return this.released.has(k); },
  clear() { this.held.clear(); this.downEvents.clear(); this.upEvents.clear(); this.pressed.clear(); this.released.clear(); }
};
