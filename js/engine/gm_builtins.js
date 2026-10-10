// GameMaker built-in functions (F.*) and built-in global variables (R.*).
// Every function receives (self, other, ...args) like translated GML calls.
'use strict';

(function () {
  const D = GM.draw, A = GM.audio, RT = GM.rt;
  const F = GM.F = {};
  const num = v => typeof v === 'boolean' ? +v : v;
  const DEG = Math.PI / 180;

  // ------------------------------------------------------------ built-in globals
  const startTime = performance.now();
  const R = GM.R = {
    room_width: 640, room_height: 480, room_speed: 30, room_persistent: 0, room_caption: '',
    fps: 30, fps_real: 30, delta_time: 33333, debug_mode: 0, os_type: 0, os_device: 0, os_browser: -1, os_version: 0,
    working_directory: '', program_directory: '', temp_directory: '', game_id: 0, game_display_name: 'DELTARUNE', game_project_name: 'DELTARUNE',
    application_surface: -1000, view_current: 0, health: 100, lives: -1, score: 0, async_load: -1, event_type: 0, event_number: 0,
    event_object: 0, cursor_sprite: -1, browser_width: 640, browser_height: 480, display_aa: 0, keyboard_string: '', mouse_button: 0,
    mouse_lastbutton: 0, iap_data: -1, secure_mode: 0, game_save_id: '', webgl_enabled: 1, gamemaker_version: 2023, error_last: '',
    error_occurred: 0, view_enabled: 1
  };
  Object.defineProperties(R, {
    room: { get: () => GM.room, set: v => F.room_goto(null, null, v) },
    room_first: { get: () => GM.roomOrder[0] },
    room_last: { get: () => GM.roomOrder[GM.roomOrder.length - 1] },
    current_time: { get: () => Math.floor(performance.now() - startTime) },
    current_year: { get: () => new Date().getFullYear() },
    current_month: { get: () => new Date().getMonth() + 1 },
    current_day: { get: () => new Date().getDate() },
    current_weekday: { get: () => new Date().getDay() },
    current_hour: { get: () => new Date().getHours() },
    current_minute: { get: () => new Date().getMinutes() },
    current_second: { get: () => new Date().getSeconds() },
    instance_count: { get: () => GM.instances.filter(i => !i.$dead && i.$active).length },
    keyboard_key: { get: () => (GM.input.held.size ? [...GM.input.held].pop() : 0) },
    keyboard_lastkey: { get: () => GM.input.lastKey, set: v => { GM.input.lastKey = v; } },
    mouse_x: { get: () => 0 }, mouse_y: { get: () => 0 },
    view_visible: { get: () => GM.views.map(v => +v.visible) },
    view_camera: { get: () => GM.views.map((v, i) => i) },
    view_xport: { get: () => GM.views.map(v => v.px) }, view_yport: { get: () => GM.views.map(v => v.py) },
    view_wport: { get: () => GM.views.map(v => v.pw) }, view_hport: { get: () => GM.views.map(v => v.ph) },
    background_colour: { get: () => GM.bgColor || 0, set: v => { GM.bgColor = v; } },
    background_color: { get: () => GM.bgColor || 0, set: v => { GM.bgColor = v; } }
  });
  GM.rt.R = R;

  // ------------------------------------------------------------ math
  F.abs = (s, o, x) => Math.abs(x);
  F.sign = (s, o, x) => Math.sign(x);
  F.ceil = (s, o, x) => Math.ceil(x);
  F.floor = (s, o, x) => Math.floor(x);
  F.round = (s, o, x) => { const r = Math.round(x); return (Math.abs(x % 1) === 0.5 && r % 2 !== 0) ? r - 1 : r; }; // banker's rounding like GM
  F.frac = (s, o, x) => x - Math.trunc(x);
  F.sqrt = (s, o, x) => Math.sqrt(x);
  F.sqr = (s, o, x) => x * x;
  F.power = (s, o, a, b) => Math.pow(a, b);
  F.exp = (s, o, x) => Math.exp(x);
  F.ln = (s, o, x) => Math.log(x);
  F.sin = (s, o, x) => Math.sin(x);
  F.cos = (s, o, x) => Math.cos(x);
  F.tan = (s, o, x) => Math.tan(x);
  F.arcsin = (s, o, x) => Math.asin(x);
  F.arccos = (s, o, x) => Math.acos(x);
  F.arctan = (s, o, x) => Math.atan(x);
  F.arctan2 = (s, o, y, x) => Math.atan2(y, x);
  F.dsin = (s, o, x) => Math.sin(x * DEG);
  F.dcos = (s, o, x) => Math.cos(x * DEG);
  F.degtorad = (s, o, x) => x * DEG;
  F.radtodeg = (s, o, x) => x / DEG;
  F.min = (s, o, ...a) => Math.min(...a.map(num));
  F.max = (s, o, ...a) => Math.max(...a.map(num));
  F.mean = (s, o, ...a) => a.reduce((p, c) => p + c, 0) / a.length;
  F.clamp = (s, o, v, a, b) => Math.max(a, Math.min(b, v));
  F.lerp = (s, o, a, b, t) => a + (b - a) * t;
  F.random = (s, o, n) => Math.random() * n;
  F.random_range = (s, o, a, b) => a + Math.random() * (b - a);
  F.irandom = (s, o, n) => Math.floor(Math.random() * (Math.floor(n) + 1));
  F.irandom_range = (s, o, a, b) => a + Math.floor(Math.random() * (b - a + 1));
  F.choose = (s, o, ...a) => a[Math.floor(Math.random() * a.length)];
  F.randomize = () => 0;
  F.random_set_seed = () => 0;
  F.lengthdir_x = (s, o, len, dir) => len * Math.cos(dir * DEG);
  F.lengthdir_y = (s, o, len, dir) => -len * Math.sin(dir * DEG);
  F.point_direction = (s, o, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return 0;
    let d = Math.atan2(-dy, dx) / DEG;
    if (d < 0) d += 360;
    return d;
  };
  F.point_distance = (s, o, x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  F.angle_difference = (s, o, a, b) => ((((a - b) % 360) + 540) % 360) - 180;
  F.real = (s, o, v) => { if (typeof v === 'number') return v; if (typeof v === 'boolean') return +v; const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  F.is_real = (s, o, v) => +(typeof v === 'number');
  F.is_string = (s, o, v) => +(typeof v === 'string');
  F.is_undefined = (s, o, v) => +(v === undefined);
  F.is_array = (s, o, v) => +Array.isArray(v);
  F.int64 = (s, o, v) => Math.trunc(v);

  // ------------------------------------------------------------ strings
  function gmString(v) {
    v = num(v);
    if (typeof v === 'string') return v;
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      if (!isFinite(v)) return v > 0 ? 'inf' : (v < 0 ? '-inf' : 'nan');
      let s = v.toFixed(2);
      if (s === '-0.00') s = '0.00';
      return s;
    }
    if (v === undefined) return 'undefined';
    if (Array.isArray(v)) return '[ ' + v.map(gmString).join(',') + ' ]';
    if (v instanceof GM.Instance) return String(v.id);
    return String(v);
  }
  GM.gmString = gmString;
  F.string = (s, o, v) => gmString(v);
  F.string_length = (s, o, str) => [...gmString(str)].length;
  F.string_byte_length = (s, o, str) => new TextEncoder().encode(gmString(str)).length;
  F.string_char_at = (s, o, str, i) => { const a = [...gmString(str)]; i = Math.floor(i); if (i < 1) i = 1; return a[i - 1] || ''; };
  F.string_copy = (s, o, str, i, n) => { const a = [...gmString(str)]; i = Math.max(1, Math.floor(i)); return a.slice(i - 1, i - 1 + Math.max(0, Math.floor(n))).join(''); };
  F.string_delete = (s, o, str, i, n) => { const a = [...gmString(str)]; i = Math.max(1, Math.floor(i)); a.splice(i - 1, Math.max(0, Math.floor(n))); return a.join(''); };
  F.string_insert = (s, o, sub, str, i) => { const a = [...gmString(str)]; i = Math.max(1, Math.floor(i)); a.splice(i - 1, 0, gmString(sub)); return a.join(''); };
  F.string_pos = (s, o, sub, str) => { const a = gmString(str), b = gmString(sub); const p = a.indexOf(b); return p < 0 ? 0 : [...a.slice(0, p)].length + 1; };
  F.string_replace_all = (s, o, str, a, b) => gmString(str).split(gmString(a)).join(gmString(b));
  F.string_replace = (s, o, str, a, b) => gmString(str).replace(gmString(a), gmString(b));
  F.string_lower = (s, o, str) => gmString(str).toLowerCase();
  F.string_upper = (s, o, str) => gmString(str).toUpperCase();
  F.string_split = (s, o, str, d) => gmString(str).split(gmString(d));
  F.string_hash_to_newline = (s, o, str) => gmString(str).replace(/\\#/g, '\u0001').replace(/#/g, '\n').replace(/\u0001/g, '#');
  F.string_repeat = (s, o, str, n) => gmString(str).repeat(Math.max(0, n));
  F.string_digits = (s, o, str) => gmString(str).replace(/[^0-9]/g, '');
  F.string_letters = (s, o, str) => gmString(str).replace(/[^A-Za-z]/g, '');
  F.chr = (s, o, c) => String.fromCodePoint(Math.floor(c));
  F.ord = (s, o, str) => { const c = gmString(str).codePointAt(0); return c === undefined ? 0 : c; };
  F.string_width = (s, o, str) => D.stringWidth(gmString(str));
  F.string_height = (s, o, str) => D.stringHeight(gmString(str));

  // ------------------------------------------------------------ arrays
  F.array_create = (s, o, n, v) => { const a = new Array(Math.max(0, Math.floor(n))); a.fill(v === undefined ? 0 : v); return a; };
  F.array_length = (s, o, a) => Array.isArray(a) ? a.length : 0;
  F.array_length_1d = F.array_length;
  F.array_height_2d = (s, o, a) => Array.isArray(a) ? a.length : 0;
  F.array_length_2d = (s, o, a, i) => Array.isArray(a) && Array.isArray(a[i]) ? a[i].length : 0;
  F.array_push = (s, o, a, ...v) => { a.push(...v); };

  // ------------------------------------------------------------ instances
  F.instance_create_depth = (s, o, x, y, depth, obj) => GM.createInstance(x, y, obj, depth, s);
  F.instance_create_layer = (s, o, x, y, layer, obj) => GM.createInstance(x, y, obj, GM.objects[obj] ? GM.objects[obj].depth : 0, s);
  F.instance_destroy = (s, o, id, runEvent) => {
    if (id === undefined) { GM.destroyInstance(s, true); return; }
    for (const i of GM.resolveAll(id, s, o, false)) GM.destroyInstance(i, runEvent === undefined ? true : RT.$t(runEvent));
  };
  F.instance_exists = (s, o, x) => +GM.instanceExists(x);
  F.instance_number = (s, o, obj) => GM.resolveAll(obj, s, o, false).length;
  F.instance_find = (s, o, obj, n) => { const l = GM.resolveAll(obj, s, o, false); return l[n] ? l[n].id : -4; };
  F.instance_nearest = (s, o, x, y, obj) => {
    let best = -4, bd = Infinity;
    for (const i of GM.resolveAll(obj, s, o, false)) { const d = Math.hypot(i.x - x, i.y - y); if (d < bd) { bd = d; best = i.id; } }
    return best;
  };
  F.instance_deactivate_all = (s, o, notme) => { for (const i of GM.instances) if (!(RT.$t(notme) && i === s)) i.$active = false; };
  F.instance_deactivate_object = (s, o, obj) => {
    const l = obj >= 100000 ? [GM.byId.get(obj)].filter(Boolean) : GM.instances.filter(i => GM.objects[obj] && GM.objects[obj].descSet.has(i.object_index));
    l.forEach(i => { i.$active = false; });
  };
  F.instance_activate_all = () => { for (const i of GM.instances) i.$active = true; };
  F.instance_activate_object = (s, o, obj) => {
    const l = obj >= 100000 ? [GM.byId.get(obj)].filter(Boolean) : GM.instances.filter(i => GM.objects[obj] && GM.objects[obj].descSet.has(i.object_index));
    l.forEach(i => { i.$active = true; });
  };
  F.event_user = (s, o, n) => { GM.perform(s, GM.EV.OTHER, 10 + n, o); };
  F.event_perform = (s, o, type, sub) => { GM.perform(s, type, sub, o); };
  F.script_execute = (s, o, scr, ...args) => RT.$callv(scr, s, o, ...args);
  F.object_get_sprite = (s, o, obj) => GM.objects[obj] ? GM.objects[obj].sprite : -1;
  F.object_get_name = (s, o, obj) => GM.objects[obj] ? GM.objects[obj].name : '<undefined>';
  F.object_get_parent = (s, o, obj) => GM.objects[obj] ? GM.objects[obj].parent : -1;
  F.object_is_ancestor = (s, o, obj, par) => +(GM.objects[obj] && obj !== par && GM.objects[obj].ancSet.has(par));
  F.variable_instance_exists = (s, o, id, name) => { const i = GM.resolveOne(id, s, o); return +(i !== GM.NULLI && i[name] !== undefined); };
  F.variable_instance_get = (s, o, id, name) => GM.resolveOne(id, s, o)[name];
  F.variable_instance_set = (s, o, id, name, v) => { GM.resolveOne(id, s, o)[name] = v; };
  F.variable_global_exists = (s, o, name) => +(GM.globals[name] !== undefined);
  F.variable_global_get = (s, o, name) => GM.globals[name];
  F.variable_global_set = (s, o, name, v) => { GM.globals[name] = v; };
  F.variable_struct_set = (s, o, st, k, v) => { st[k] = v; };
  F.variable_struct_get = (s, o, st, k) => st[k];

  // motion
  F.move_towards_point = (s, o, x, y, sp) => { s.direction = F.point_direction(s, o, s.x, s.y, x, y); s.speed = sp; };
  F.motion_set = (s, o, dir, sp) => { s.direction = dir; s.speed = sp; };
  F.motion_add = (s, o, dir, sp) => { s.hspeed = s.hspeed + sp * Math.cos(dir * DEG); s.vspeed = s.vspeed - sp * Math.sin(dir * DEG); };
  F.distance_to_point = (s, o, x, y) => {
    const b = GM.bbox(s);
    const dx = x < b.l ? b.l - x : (x > b.r ? x - b.r : 0), dy = y < b.t ? b.t - y : (y > b.b ? y - b.b : 0);
    return Math.hypot(dx, dy);
  };
  F.distance_to_object = (s, o, obj) => {
    let best = 1000000;
    const a = GM.bbox(s);
    for (const i of GM.resolveAll(obj, s, o, false)) {
      if (i === s) continue;
      const b = GM.bbox(i);
      const dx = a.l > b.r ? a.l - b.r : (b.l > a.r ? b.l - a.r : 0), dy = a.t > b.b ? a.t - b.b : (b.t > a.b ? b.t - a.b : 0);
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  };
  F.path_start = () => GM.warnOnce('path_start');
  F.path_end = () => 0;

  // collisions
  F.place_meeting = (s, o, x, y, obj) => {
    for (const i of GM.resolveAll(obj, s, o, false)) if (i !== s && GM.collideInstances(s, i, x, y)) return 1;
    return 0;
  };
  F.place_free = (s, o, x, y) => {
    for (const i of GM.instances) if (i !== s && !i.$dead && i.$active && i.solid && GM.collideInstances(s, i, x, y)) return 0;
    return 1;
  };
  F.place_empty = (s, o, x, y, obj) => 1 - F.place_meeting(s, o, x, y, obj === undefined ? -3 : obj);
  F.instance_place = (s, o, x, y, obj) => {
    for (const i of GM.resolveAll(obj, s, o, false)) if (i !== s && GM.collideInstances(s, i, x, y)) return i.id;
    return -4;
  };
  F.position_meeting = (s, o, x, y, obj) => {
    for (const i of GM.resolveAll(obj, s, o, false)) { const sp = GM.maskSprite(i); if (sp && GM.collisionPoint(i, sp, x, y, true)) return 1; }
    return 0;
  };
  function colQuery(s, o, obj, notme, test) {
    for (const i of GM.resolveAll(obj, s, o, false)) {
      if (RT.$t(notme) && i === s) continue;
      const sp = GM.maskSprite(i);
      if (sp && test(i, sp)) return i.id;
    }
    return -4;
  }
  F.collision_rectangle = (s, o, x1, y1, x2, y2, obj, prec, notme) => colQuery(s, o, obj, notme, (i, sp) => GM.collisionRect(i, sp, x1, y1, x2, y2, RT.$t(prec)));
  F.collision_point = (s, o, x, y, obj, prec, notme) => colQuery(s, o, obj, notme, (i, sp) => GM.collisionPoint(i, sp, x, y, RT.$t(prec)));
  F.collision_line = (s, o, x1, y1, x2, y2, obj, prec, notme) => colQuery(s, o, obj, notme, (i, sp) => GM.collisionLine(i, sp, x1, y1, x2, y2, RT.$t(prec)));
  F.collision_circle = (s, o, x, y, r, obj, prec, notme) => colQuery(s, o, obj, notme, (i) => {
    const b = GM.bbox(i);
    const dx = x < b.l ? b.l - x : (x > b.r ? x - b.r : 0), dy = y < b.t ? b.t - y : (y > b.b ? y - b.b : 0);
    return dx * dx + dy * dy <= r * r;
  });

  // ------------------------------------------------------------ drawing
  F.draw_self = (s) => {
    if (s.$spr < 0 || !GM.sprites[s.$spr]) return;
    D.sprite(s.$spr, s.$ii, s.x, s.y, s.image_xscale, s.image_yscale, s.image_angle, s.image_blend, s.image_alpha);
  };
  const sub = (s, i) => (num(i) < 0 ? s.$ii : i);
  F.draw_sprite = (s, o, spr, i, x, y) => D.sprite(spr, sub(s, i), x, y, 1, 1, 0, 0xFFFFFF, D.alpha);
  F.draw_sprite_ext = (s, o, spr, i, x, y, xs, ys, rot, col, a) => D.sprite(spr, sub(s, i), x, y, xs, ys, rot, col, a);
  F.draw_sprite_part = (s, o, spr, i, l, t, w, h, x, y) => D.spritePart(spr, sub(s, i), l, t, w, h, x, y, 1, 1, 0xFFFFFF, D.alpha);
  F.draw_sprite_part_ext = (s, o, spr, i, l, t, w, h, x, y, xs, ys, col, a) => D.spritePart(spr, sub(s, i), l, t, w, h, x, y, xs, ys, col, a);
  F.draw_sprite_stretched = (s, o, spr, i, x, y, w, h) => D.spriteStretched(spr, sub(s, i), x, y, w, h, 0xFFFFFF, D.alpha);
  F.draw_sprite_stretched_ext = (s, o, spr, i, x, y, w, h, col, a) => D.spriteStretched(spr, sub(s, i), x, y, w, h, col, a);
  F.draw_sprite_tiled = (s, o, spr, i, x, y) => D.spriteTiled(spr, sub(s, i), x, y, 1, 1, 0xFFFFFF, D.alpha);
  F.draw_sprite_tiled_ext = (s, o, spr, i, x, y, xs, ys, col, a) => D.spriteTiled(spr, sub(s, i), x, y, xs, ys, col, a);
  F.draw_sprite_general = (s, o, spr, i, l, t, w, h, x, y, xs, ys, rot, c1, c2, c3, c4, a) => D.spriteGeneral(spr, sub(s, i), l, t, w, h, x, y, xs, ys, rot, [c1, c2, c3, c4], a);
  F.draw_surface_ext = () => GM.warnOnce('draw_surface_ext');
  F.draw_surface = () => GM.warnOnce('draw_surface');

  F.draw_set_color = (s, o, c) => { D.color = num(c) & 0xFFFFFF; };
  F.draw_set_colour = F.draw_set_color;
  F.draw_get_color = () => D.color;
  F.draw_get_colour = F.draw_get_color;
  F.draw_set_alpha = (s, o, a) => { D.alpha = num(a); };
  F.draw_get_alpha = () => D.alpha;
  F.draw_set_font = (s, o, f) => { D.font = num(f); };
  F.draw_get_font = () => D.font;
  F.draw_set_halign = (s, o, h) => { D.halign = num(h); };
  F.draw_set_valign = (s, o, v) => { D.valign = num(v); };
  F.draw_set_circle_precision = (s, o, p) => { D.circlePrecision = Math.max(4, Math.min(64, Math.floor(p / 4) * 4)); };

  F.draw_rectangle = (s, o, x1, y1, x2, y2, outline) => D.rect(x1, y1, x2, y2, RT.$t(outline), D.color, D.color, D.color, D.color, D.alpha);
  F.draw_rectangle_color = (s, o, x1, y1, x2, y2, c1, c2, c3, c4, outline) => D.rect(x1, y1, x2, y2, RT.$t(outline), c1, c2, c3, c4, D.alpha);
  F.draw_rectangle_colour = F.draw_rectangle_color;
  F.draw_roundrect = (s, o, x1, y1, x2, y2, outline) => D.rect(x1, y1, x2, y2, RT.$t(outline), D.color, D.color, D.color, D.color, D.alpha);
  F.draw_roundrect_ext = (s, o, x1, y1, x2, y2, rx, ry, outline) => D.rect(x1, y1, x2, y2, RT.$t(outline), D.color, D.color, D.color, D.color, D.alpha);
  F.draw_roundrect_color = (s, o, x1, y1, x2, y2, c1, c2, outline) => D.rect(x1, y1, x2, y2, RT.$t(outline), c1, c1, c2, c2, D.alpha);
  F.draw_roundrect_colour = F.draw_roundrect_color;
  F.draw_roundrect_color_ext = (s, o, x1, y1, x2, y2, rx, ry, c1, c2, outline) => D.rect(x1, y1, x2, y2, RT.$t(outline), c1, c1, c2, c2, D.alpha);
  F.draw_roundrect_colour_ext = F.draw_roundrect_color_ext;
  F.draw_line = (s, o, x1, y1, x2, y2) => D.line(x1, y1, x2, y2, 1, D.color, D.color, D.alpha);
  F.draw_line_color = (s, o, x1, y1, x2, y2, c1, c2) => D.line(x1, y1, x2, y2, 1, c1, c2, D.alpha);
  F.draw_line_colour = F.draw_line_color;
  F.draw_line_width = (s, o, x1, y1, x2, y2, w) => D.line(x1, y1, x2, y2, w, D.color, D.color, D.alpha);
  F.draw_line_width_color = (s, o, x1, y1, x2, y2, w, c1, c2) => D.line(x1, y1, x2, y2, w, c1, c2, D.alpha);
  F.draw_line_width_colour = F.draw_line_width_color;
  F.draw_point = (s, o, x, y) => D.rect(Math.floor(x), Math.floor(y), Math.floor(x), Math.floor(y), false, D.color, D.color, D.color, D.color, D.alpha);
  F.draw_point_color = (s, o, x, y, c) => D.rect(Math.floor(x), Math.floor(y), Math.floor(x), Math.floor(y), false, c, c, c, c, D.alpha);
  F.draw_point_colour = F.draw_point_color;
  F.draw_circle = (s, o, x, y, r, outline) => D.circle(x, y, r, RT.$t(outline), D.color, D.color, D.alpha);
  F.draw_circle_color = (s, o, x, y, r, c1, c2, outline) => D.circle(x, y, r, RT.$t(outline), c1, c2, D.alpha);
  F.draw_circle_colour = F.draw_circle_color;
  F.draw_ellipse = (s, o, x1, y1, x2, y2, outline) => D.ellipse(x1, y1, x2, y2, RT.$t(outline), D.color, D.color, D.alpha);
  F.draw_ellipse_color = (s, o, x1, y1, x2, y2, c1, c2, outline) => D.ellipse(x1, y1, x2, y2, RT.$t(outline), c1, c2, D.alpha);
  F.draw_ellipse_colour = F.draw_ellipse_color;
  F.draw_triangle = (s, o, x1, y1, x2, y2, x3, y3, outline) => D.triangle(x1, y1, x2, y2, x3, y3, RT.$t(outline), D.color, D.color, D.color, D.alpha);
  F.draw_triangle_color = (s, o, x1, y1, x2, y2, x3, y3, c1, c2, c3, outline) => D.triangle(x1, y1, x2, y2, x3, y3, RT.$t(outline), c1, c2, c3, D.alpha);
  F.draw_triangle_colour = F.draw_triangle_color;
  F.draw_arrow = (s, o, x1, y1, x2, y2, size) => {
    D.line(x1, y1, x2, y2, 1, D.color, D.color, D.alpha);
    const a = Math.atan2(y2 - y1, x2 - x1);
    D.triangle(x2, y2, x2 - size * Math.cos(a - 0.5), y2 - size * Math.sin(a - 0.5), x2 - size * Math.cos(a + 0.5), y2 - size * Math.sin(a + 0.5), false, D.color, D.color, D.color, D.alpha);
  };
  F.draw_path = () => 0;
  F.draw_clear = (s, o, c) => D.clear(c, 1);
  F.draw_clear_alpha = (s, o, c, a) => D.clear(c, a);

  F.draw_text = (s, o, x, y, str) => D.text(x, y, gmString(str), 1, 1, 0, null, D.alpha);
  F.draw_text_color = (s, o, x, y, str, c1, c2, c3, c4, a) => D.text(x, y, gmString(str), 1, 1, 0, [c1, c2, c3, c4], a);
  F.draw_text_colour = F.draw_text_color;
  F.draw_text_transformed = (s, o, x, y, str, xs, ys, ang) => D.text(x, y, gmString(str), xs, ys, ang, null, D.alpha);
  F.draw_text_transformed_color = (s, o, x, y, str, xs, ys, ang, c1, c2, c3, c4, a) => D.text(x, y, gmString(str), xs, ys, ang, [c1, c2, c3, c4], a);
  F.draw_text_transformed_colour = F.draw_text_transformed_color;
  F.draw_text_ext = (s, o, x, y, str, sep, w) => D.text(x, y, gmString(str), 1, 1, 0, null, D.alpha, sep, w);
  F.draw_text_ext_transformed = (s, o, x, y, str, sep, w, xs, ys, ang) => D.text(x, y, gmString(str), xs, ys, ang, null, D.alpha, sep, w);

  F.merge_color = (s, o, c1, c2, a) => D.mergeCol(num(c1), num(c2), a);
  F.merge_colour = F.merge_color;
  F.make_color_rgb = (s, o, r, g, b) => (r & 255) | ((g & 255) << 8) | ((b & 255) << 16);
  F.make_colour_rgb = F.make_color_rgb;
  F.make_color_hsv = (s, o, h, sat, v) => {
    h = h / 255 * 360; sat /= 255; v /= 255;
    const c = v * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return Math.round((r + m) * 255) | (Math.round((g + m) * 255) << 8) | (Math.round((b + m) * 255) << 16);
  };
  F.make_colour_hsv = F.make_color_hsv;
  F.color_get_red = (s, o, c) => c & 255;
  F.color_get_green = (s, o, c) => (c >> 8) & 255;
  F.color_get_blue = (s, o, c) => (c >> 16) & 255;

  F.gpu_set_blendmode = (s, o, m) => D.setBlend(num(m));
  F.gpu_set_blendenable = (s, o, on) => D.setBlendEnable(RT.$t(on));
  F.gpu_set_fog = (s, o, on, col) => D.setFog(RT.$t(Array.isArray(on) ? on[0] : on), Array.isArray(on) ? on[1] : col);
  F.gpu_set_texfilter = () => 0;
  F.gpu_set_alphatestenable = () => 0;
  F.font_add_sprite_ext = (s, o, spr, map, prop, sep) => D.addSpriteFont(spr, gmString(map), RT.$t(prop), sep);
  F.font_add_sprite = (s, o, spr, first, prop, sep) => {
    const n = GM.sprites[spr].frames.length;
    let map = '';
    for (let i = 0; i < n; i++) map += String.fromCharCode(first + i);
    return D.addSpriteFont(spr, map, RT.$t(prop), sep);
  };

  // sprites & surfaces
  F.sprite_exists = (s, o, i) => +(i >= 0 && !!GM.sprites[i]);
  F.sprite_get_width = (s, o, i) => GM.sprites[i] ? GM.sprites[i].w : 0;
  F.sprite_get_height = (s, o, i) => GM.sprites[i] ? GM.sprites[i].h : 0;
  F.sprite_get_number = (s, o, i) => GM.sprites[i] ? GM.sprites[i].frames.length : 0;
  F.sprite_get_name = (s, o, i) => GM.sprites[i] ? GM.sprites[i].name : '<undefined>';
  F.sprite_get_xoffset = (s, o, i) => GM.sprites[i] ? GM.sprites[i].ox : 0;
  F.sprite_get_yoffset = (s, o, i) => GM.sprites[i] ? GM.sprites[i].oy : 0;
  F.sprite_delete = (s, o, i) => { const sp = GM.sprites[i]; if (sp && sp.name === 'captured') { GM.sprites[i] = null; } return 1; };
  F.sprite_create_from_surface = (s, o, surf, x, y, w, h, rb, sm, ox, oy) => D.captureSprite(x, y, w, h, ox, oy);
  F.surface_get_width = () => D.W;
  F.surface_get_height = () => D.H;
  F.surface_exists = () => 0;
  F.application_surface_enable = () => 0;
  F.application_surface_draw_enable = () => 0;
  F.texture_is_ready = () => 1;
  F.texture_prefetch = () => 0;
  F.texture_flush = () => 0;
  F.texturegroup_get_textures = () => [];
  F.texture_set_interpolation = () => 0;
  ['vertex_create_buffer', 'vertex_format_begin', 'vertex_format_add_position_3d', 'vertex_format_add_normal', 'vertex_format_add_colour',
    'vertex_format_add_textcoord', 'vertex_format_end'].forEach(n => { F[n] = () => 0; });

  // ------------------------------------------------------------ audio
  F.audio_play_sound = (s, o, snd, prio, loop, gain, offset, pitch) => A.play(num(snd), prio, RT.$t(loop), gain, offset, pitch);
  F.audio_stop_sound = (s, o, x) => A.stop(num(x));
  F.audio_stop_all = () => A.stopAll();
  F.audio_is_playing = (s, o, x) => +A.isPlaying(num(x));
  F.audio_sound_gain = (s, o, x, g, ms) => A.gain(num(x), g, ms);
  F.audio_sound_get_gain = (s, o, x) => A.getGain(num(x));
  F.audio_sound_pitch = (s, o, x, p) => A.pitch(num(x), p);
  F.audio_pause_sound = (s, o, x) => A.pause(num(x));
  F.audio_resume_sound = (s, o, x) => A.resumeVoice(num(x));
  F.audio_pause_all = () => A.pauseAll();
  F.audio_resume_all = () => A.resumeAll();
  F.audio_sound_get_track_position = (s, o, x) => A.trackPos(num(x));
  F.audio_sound_set_track_position = (s, o, x, p) => A.setTrackPos(num(x), p);
  F.audio_create_stream = (s, o, file) => A.createStream(gmString(file));
  F.audio_destroy_stream = (s, o, x) => { A.stop(num(x)); return 1; };
  F.audio_group_load = () => 1;
  F.audio_group_is_loaded = () => 1;
  F.audio_group_set_gain = (s, o, g, v) => { A.groupGain[g] = v; };
  F.audio_set_master_gain = (s, o, l, g) => A.setMaster(g);
  F.audio_exists = (s, o, x) => +(!!GM.sounds[x]);
  F.audio_channel_num = () => 0;

  // ------------------------------------------------------------ input
  F.keyboard_check = (s, o, k) => +GM.input.check(num(k));
  F.keyboard_check_pressed = (s, o, k) => +GM.input.checkPressed(num(k));
  F.keyboard_check_released = (s, o, k) => +GM.input.checkReleased(num(k));
  F.keyboard_check_direct = F.keyboard_check;
  F.keyboard_clear = (s, o, k) => { GM.input.held.delete(k); };
  F.io_clear = () => GM.input.clear();
  F.mouse_check_button = () => 0;
  F.mouse_check_button_pressed = () => 0;
  ['gamepad_axis_value', 'gamepad_button_check', 'gamepad_button_check_pressed', 'gamepad_button_check_released', 'gamepad_is_connected',
    'gamepad_get_device_count', 'gamepad_test_mapping', 'gamepad_set_axis_deadzone'].forEach(n => { F[n] = () => 0; });
  F.gamepad_get_description = () => '';
  F.gamepad_get_guid = () => '';

  // ------------------------------------------------------------ data structures
  const maps = [], lists = [];
  GM.dsMaps = maps; GM.dsLists = lists;
  function newMap() { maps.push(new Map()); return maps.length - 1; }
  function newList() { lists.push([]); return lists.length - 1; }
  F.ds_map_create = () => newMap();
  F.ds_map_destroy = (s, o, m) => { if (maps[m]) maps[m] = null; };
  F.ds_map_exists = (s, o, m, k) => +(!!maps[m] && maps[m].has(k));
  F.ds_map_add = (s, o, m, k, v) => { if (maps[m] && !maps[m].has(k)) maps[m].set(k, v); };
  F.ds_map_set = (s, o, m, k, v) => { if (maps[m]) maps[m].set(k, v); };
  F.ds_map_set_post = F.ds_map_set;
  F.ds_map_replace = F.ds_map_set;
  F.ds_map_delete = (s, o, m, k) => { if (maps[m]) maps[m].delete(k); };
  F.ds_map_find_value = (s, o, m, k) => maps[m] ? maps[m].get(k) : undefined;
  F.ds_map_size = (s, o, m) => maps[m] ? maps[m].size : 0;
  F.ds_map_clear = (s, o, m) => { if (maps[m]) maps[m].clear(); };
  F.ds_map_find_first = (s, o, m) => maps[m] && maps[m].size ? maps[m].keys().next().value : undefined;
  F.ds_map_find_next = (s, o, m, k) => {
    if (!maps[m]) return undefined;
    const keys = [...maps[m].keys()];
    const i = keys.indexOf(k);
    return i >= 0 && i + 1 < keys.length ? keys[i + 1] : undefined;
  };
  F.ds_map_keys_to_array = (s, o, m) => maps[m] ? [...maps[m].keys()] : [];
  F.ds_list_create = () => newList();
  F.ds_list_destroy = (s, o, l) => { if (lists[l]) lists[l] = null; };
  F.ds_list_add = (s, o, l, ...v) => { if (lists[l]) lists[l].push(...v); };
  F.ds_list_size = (s, o, l) => lists[l] ? lists[l].length : 0;
  F.ds_list_find_value = (s, o, l, i) => lists[l] ? lists[l][i] : undefined;
  F.ds_list_find_index = (s, o, l, v) => lists[l] ? lists[l].indexOf(v) : -1;
  F.ds_list_set = (s, o, l, i, v) => { if (lists[l]) lists[l][i] = v; };
  F.ds_list_delete = (s, o, l, i) => { if (lists[l]) lists[l].splice(i, 1); };
  F.ds_list_clear = (s, o, l) => { if (lists[l]) lists[l].length = 0; };
  F.ds_list_write = (s, o, l) => JSON.stringify(lists[l] || []);
  F.ds_list_read = (s, o, l, str) => { try { lists[l] = JSON.parse(str); } catch (e) { lists[l] = []; } };
  F.ds_exists = (s, o, id, type) => +(type === 1 ? !!maps[id] : type === 2 ? !!lists[id] : false);
  // JSON -> ds_map / ds_list like GameMaker
  function fromJson(v) {
    if (Array.isArray(v)) { const l = newList(); lists[l] = v.map(fromJson); return l; }
    if (v && typeof v === 'object') { const m = newMap(); for (const [k, x] of Object.entries(v)) maps[m].set(k, fromJson(x)); return m; }
    if (typeof v === 'boolean') return +v;
    if (v === null) return undefined;
    return v;
  }
  F.json_decode = (s, o, str) => {
    try {
      const v = JSON.parse(str);
      if (Array.isArray(v)) { const m = newMap(); maps[m].set('default', fromJson(v)); return m; }
      return fromJson(v);
    } catch (e) { return -1; }
  };
  F.json_encode = (s, o, m) => maps[m] ? JSON.stringify(Object.fromEntries(maps[m])) : '{}';
  F.json_parse = (s, o, str) => JSON.parse(str);
  F.json_stringify = (s, o, v) => JSON.stringify(v);

  // ------------------------------------------------------------ virtual files, ini, buffers
  const VFS = GM.vfs = new Map(); // path -> string
  const norm = p => gmString(p).replace(/\\/g, '/').replace(/^\.\//, '');
  GM.vfsGet = p => VFS.get(norm(p));
  function persistKey(p) { return 'jevilfight_vfs:' + norm(p); }
  GM.vfsLoadPersistent = function (p) { try { const v = localStorage.getItem(persistKey(p)); if (v !== null) VFS.set(norm(p), v); } catch (e) { /* no storage */ } };
  function vfsWrite(p, text) {
    VFS.set(norm(p), text);
    if (GM.persistFiles && GM.persistFiles.has(norm(p))) { try { localStorage.setItem(persistKey(p), text); } catch (e) { /* no storage */ } }
  }
  F.file_exists = (s, o, p) => +VFS.has(norm(p));
  F.file_delete = (s, o, p) => { VFS.delete(norm(p)); return 1; };
  F.file_copy = (s, o, a, b) => { if (VFS.has(norm(a))) vfsWrite(b, VFS.get(norm(a))); };
  const files = [];
  F.file_text_open_read = (s, o, p) => { if (!VFS.has(norm(p))) return -1; files.push({ lines: VFS.get(norm(p)).split(/\r?\n/), pos: 0, write: false }); return files.length - 1; };
  F.file_text_open_write = (s, o, p) => { files.push({ path: p, out: '', write: true }); return files.length - 1; };
  F.file_text_open_append = (s, o, p) => { files.push({ path: p, out: VFS.get(norm(p)) || '', write: true }); return files.length - 1; };
  F.file_text_close = (s, o, f) => { const h = files[f]; if (h && h.write) vfsWrite(h.path, h.out); files[f] = null; };
  F.file_text_eof = (s, o, f) => { const h = files[f]; return +(!h || h.pos >= h.lines.length || (h.pos === h.lines.length - 1 && h.lines[h.pos] === '')); };
  F.file_text_readln = (s, o, f) => { const h = files[f]; if (!h) return ''; const l = h.lines[h.pos] || ''; h.pos++; return l + '\n'; };
  F.file_text_read_string = (s, o, f) => { const h = files[f]; return h ? (h.lines[h.pos] || '') : ''; };
  F.file_text_read_real = (s, o, f) => { const h = files[f]; return h ? parseFloat(h.lines[h.pos]) || 0 : 0; };
  F.file_text_write_string = (s, o, f, str) => { const h = files[f]; if (h) h.out += gmString(str); };
  F.file_text_write_real = (s, o, f, v) => { const h = files[f]; if (h) h.out += gmString(v); };
  F.file_text_writeln = (s, o, f) => { const h = files[f]; if (h) h.out += '\n'; };
  let ini = null;
  function parseIni(text) {
    const data = {};
    let sec = '';
    for (const line of (text || '').split(/\r?\n/)) {
      const m = line.match(/^\s*\[(.*)\]\s*$/);
      if (m) { sec = m[1]; data[sec] = data[sec] || {}; continue; }
      const kv = line.match(/^\s*([^=]+?)\s*=\s*"?(.*?)"?\s*$/);
      if (kv && sec) data[sec][kv[1]] = kv[2];
    }
    return data;
  }
  function iniText(data) {
    return Object.entries(data).map(([sec, kv]) => `[${sec}]\n` + Object.entries(kv).map(([k, v]) => `${k}="${v}"`).join('\n')).join('\n') + '\n';
  }
  F.ini_open = (s, o, p) => { ini = { path: p, data: parseIni(VFS.get(norm(p))), dirty: false }; };
  F.ini_open_from_string = (s, o, str) => { ini = { path: null, data: parseIni(str), dirty: false }; };
  F.ini_close = () => { let out = ''; if (ini) { out = iniText(ini.data); if (ini.path && ini.dirty) vfsWrite(ini.path, out); } ini = null; return out; };
  F.ini_read_real = (s, o, sec, key, def) => { const v = ini && ini.data[sec] && ini.data[sec][key]; if (v === undefined) return def; const n = parseFloat(v); return isNaN(n) ? def : n; };
  F.ini_read_string = (s, o, sec, key, def) => { const v = ini && ini.data[sec] && ini.data[sec][key]; return v === undefined ? def : v; };
  F.ini_write_real = (s, o, sec, key, v) => { if (!ini) return; (ini.data[sec] = ini.data[sec] || {})[key] = gmString(v); ini.dirty = true; };
  F.ini_write_string = (s, o, sec, key, v) => { if (!ini) return; (ini.data[sec] = ini.data[sec] || {})[key] = gmString(v); ini.dirty = true; };
  F.ini_section_exists = (s, o, sec) => +(!!(ini && ini.data[sec]));
  F.ini_key_exists = (s, o, sec, key) => +(!!(ini && ini.data[sec] && ini.data[sec][key] !== undefined));
  const buffers = [];
  F.buffer_load = (s, o, p) => { buffers.push({ text: VFS.get(norm(p)) || '' }); return buffers.length - 1; };
  F.buffer_read = (s, o, b) => buffers[b] ? buffers[b].text : '';
  F.buffer_delete = (s, o, b) => { buffers[b] = null; };
  F.buffer_create = () => { buffers.push({ text: '' }); return buffers.length - 1; };
  F.buffer_write = (s, o, b, type, v) => { if (buffers[b]) buffers[b].text += gmString(v); };
  F.buffer_get_size = (s, o, b) => buffers[b] ? buffers[b].text.length : 0;
  ['buffer_async_group_begin', 'buffer_async_group_end', 'buffer_async_group_option', 'buffer_load_async', 'buffer_save_async'].forEach(n => { F[n] = () => -1; });

  // ------------------------------------------------------------ rooms & game
  F.room_goto = (s, o, r) => { GM.newRoom = num(r); };
  F.room_goto_next = () => { const i = GM.roomOrder.indexOf(GM.room); if (i >= 0 && i + 1 < GM.roomOrder.length) GM.newRoom = GM.roomOrder[i + 1]; };
  F.room_goto_previous = () => { const i = GM.roomOrder.indexOf(GM.room); if (i > 0) GM.newRoom = GM.roomOrder[i - 1]; };
  F.room_next = (s, o, r) => { const i = GM.roomOrder.indexOf(r); return i >= 0 && i + 1 < GM.roomOrder.length ? GM.roomOrder[i + 1] : -1; };
  F.room_previous = (s, o, r) => { const i = GM.roomOrder.indexOf(r); return i > 0 ? GM.roomOrder[i - 1] : -1; };
  F.room_restart = () => { GM.newRoom = GM.room; };
  F.room_get_name = (s, o, r) => GM.roomNames[r] || '';
  F.game_end = () => { GM.onGameEnd && GM.onGameEnd('end'); };
  F.game_restart = () => { GM.onGameEnd && GM.onGameEnd('restart'); };
  F.game_change = () => { GM.onGameEnd && GM.onGameEnd('change'); };
  F.asset_get_index = (s, o, name) => { const a = GM.assetIndex.get(gmString(name)); return a ? a.i : -1; };

  // ------------------------------------------------------------ views & cameras
  const cam = (c) => (GM.views[c] || GM.views[0]).cam;
  F.view_get_camera = (s, o, v) => v;
  F.view_set_camera = () => 0;
  F.view_get_visible = (s, o, v) => +GM.views[v].visible;
  F.view_set_visible = (s, o, v, on) => { GM.views[v].visible = RT.$t(on); };
  F.view_get_xport = (s, o, v) => GM.views[v].px; F.view_get_yport = (s, o, v) => GM.views[v].py;
  F.view_get_wport = (s, o, v) => GM.views[v].pw; F.view_get_hport = (s, o, v) => GM.views[v].ph;
  F.view_set_xport = (s, o, v, x) => { GM.views[v].px = x; }; F.view_set_yport = (s, o, v, x) => { GM.views[v].py = x; };
  F.view_set_wport = (s, o, v, x) => { GM.views[v].pw = x; }; F.view_set_hport = (s, o, v, x) => { GM.views[v].ph = x; };
  F.view_get_surface_id = () => -1; F.view_set_surface_id = () => 0;
  F.camera_create = () => 0;
  F.camera_get_view_x = (s, o, c) => cam(c).x;
  F.camera_get_view_y = (s, o, c) => cam(c).y;
  F.camera_get_view_width = (s, o, c) => cam(c).w;
  F.camera_get_view_height = (s, o, c) => cam(c).h;
  F.camera_get_view_angle = (s, o, c) => cam(c).angle;
  F.camera_get_view_border_x = (s, o, c) => cam(c).bx;
  F.camera_get_view_border_y = (s, o, c) => cam(c).by;
  F.camera_get_view_speed_x = (s, o, c) => cam(c).sx;
  F.camera_get_view_speed_y = (s, o, c) => cam(c).sy;
  F.camera_get_view_target = (s, o, c) => cam(c).target;
  F.camera_set_view_pos = (s, o, c, x, y) => { cam(c).x = x; cam(c).y = y; };
  F.camera_set_view_size = (s, o, c, w, h) => { cam(c).w = w; cam(c).h = h; };
  F.camera_set_view_angle = (s, o, c, a) => { cam(c).angle = a; };
  F.camera_set_view_border = (s, o, c, x, y) => { cam(c).bx = x; cam(c).by = y; };
  F.camera_set_view_speed = (s, o, c, x, y) => { cam(c).sx = x; cam(c).sy = y; };
  F.camera_set_view_target = (s, o, c, t) => { cam(c).target = t; };

  // ------------------------------------------------------------ layers (minimal model over the room's layers)
  const L = id => (GM.layers || []).find(l => l.id === id || l.name === id);
  F.layer_get_all = () => (GM.layers || []).map(l => l.id);
  F.layer_get_name = (s, o, id) => { const l = L(id); return l ? l.name : ''; };
  F.layer_get_depth = (s, o, id) => { const l = L(id); return l ? l.depth : 0; };
  F.layer_depth = (s, o, id, d) => { const l = L(id); if (l) l.depth = d; };
  F.layer_get_visible = (s, o, id) => { const l = L(id); return l ? +l.visible : 0; };
  F.layer_set_visible = (s, o, id, v) => { const l = L(id); if (l) l.visible = RT.$t(v); };
  F.layer_get_x = (s, o, id) => { const l = L(id); return l ? l.x : 0; };
  F.layer_get_y = (s, o, id) => { const l = L(id); return l ? l.y : 0; };
  F.layer_x = (s, o, id, v) => { const l = L(id); if (l) l.x = v; };
  F.layer_y = (s, o, id, v) => { const l = L(id); if (l) l.y = v; };
  F.layer_get_hspeed = (s, o, id) => { const l = L(id); return l ? l.hspeed : 0; };
  F.layer_get_vspeed = (s, o, id) => { const l = L(id); return l ? l.vspeed : 0; };
  F.layer_hspeed = (s, o, id, v) => { const l = L(id); if (l) l.hspeed = v; };
  F.layer_vspeed = (s, o, id, v) => { const l = L(id); if (l) l.vspeed = v; };
  // elements: we expose one element per layer with id = layer id * 10 + 1
  F.layer_get_all_elements = (s, o, id) => { const l = L(id); return l && l.type !== 2 ? [l.id * 10 + 1] : []; };
  F.layer_get_element_type = (s, o, el) => { const l = L(Math.floor(el / 10)); if (!l) return 0; return l.type === 1 ? 1 : l.type === 4 ? 5 : l.type === 3 ? 4 : 0; };
  const BL = el => L(Math.floor(el / 10));
  F.layer_background_exists = (s, o, id, el) => +(!!BL(el));
  F.layer_background_get_sprite = (s, o, el) => { const l = BL(el); return l && l.data && l.data.sprite ? F.asset_get_index(s, o, l.data.sprite) : -1; };
  F.layer_background_get_blend = (s, o, el) => { const l = BL(el); return l && l.data ? l.data.color & 0xFFFFFF : 0xFFFFFF; };
  F.layer_background_blend = (s, o, el, c) => { const l = BL(el); if (l && l.data) l.data.color = (l.data.color & 0xFF000000) | (c & 0xFFFFFF); };
  F.layer_background_get_alpha = (s, o, el) => { const l = BL(el); return l && l.data ? ((l.data.color >>> 24) & 255) / 255 : 1; };
  F.layer_background_alpha = (s, o, el, a) => { const l = BL(el); if (l && l.data) l.data.color = ((Math.round(a * 255) & 255) << 24 >>> 0) | (l.data.color & 0xFFFFFF); };
  F.layer_background_get_index = () => 0;
  F.layer_background_get_htiled = (s, o, el) => { const l = BL(el); return l && l.data ? +l.data.htiled : 0; };
  F.layer_background_get_vtiled = (s, o, el) => { const l = BL(el); return l && l.data ? +l.data.vtiled : 0; };
  F.layer_background_get_xscale = () => 1;
  F.layer_background_get_yscale = () => 1;
  F.layer_background_get_stretch = (s, o, el) => { const l = BL(el); return l && l.data ? +l.data.stretch : 0; };
  F.layer_background_htiled = (s, o, el, v) => { const l = BL(el); if (l && l.data) l.data.htiled = RT.$t(v); };
  F.layer_background_vtiled = (s, o, el, v) => { const l = BL(el); if (l && l.data) l.data.vtiled = RT.$t(v); };
  F.layer_background_xscale = () => 0; F.layer_background_yscale = () => 0;
  F.layer_background_stretch = (s, o, el, v) => { const l = BL(el); if (l && l.data) l.data.stretch = RT.$t(v); };
  F.layer_background_visible = (s, o, el, v) => { const l = BL(el); if (l && l.data) l.data.visible = RT.$t(v); };
  F.layer_background_change = (s, o, el, spr) => { const l = BL(el); if (l && l.data) l.data.sprite = GM.sprites[spr] ? GM.sprites[spr].name : null; };
  F.layer_create = (s, o, depth, name) => {
    const id = 900000 + (GM.layers || []).length;
    (GM.layers = GM.layers || []).push({ id, name: name || ('layer' + id), type: 1, depth, x: 0, y: 0, hspeed: 0, vspeed: 0, visible: true, data: { visible: true, color: 0xFFFFFFFF, sprite: null } });
    return id;
  };
  F.layer_background_create = (s, o, layer, spr) => { const l = L(layer); if (l) { l.type = 1; l.data.sprite = GM.sprites[spr] ? GM.sprites[spr].name : null; return l.id * 10 + 1; } return -1; };
  F.layer_destroy = (s, o, id) => { GM.layers = (GM.layers || []).filter(l => l.id !== id); };
  F.layer_force_draw_depth = () => 0;
  F.layer_sprite_get_sprite = () => -1;
  F.layer_sprite_destroy = () => 0;
  ['layer_tile_alpha', 'layer_tile_visible', 'layer_tile_x', 'layer_tile_y'].forEach(n => { F[n] = () => 0; });
  F.layer_tile_get_x = () => 0; F.layer_tile_get_y = () => 0;

  // ------------------------------------------------------------ os / window / misc
  F.os_get_language = () => 'en';
  F.os_get_region = () => 'US';
  F.os_get_info = () => -1;
  F.os_is_paused = () => 0;
  F.environment_get_variable = () => '';
  F.parameter_count = () => 0;
  F.parameter_string = () => '';
  F.window_get_width = () => D.W;
  F.window_get_height = () => D.H;
  F.window_get_fullscreen = () => +!!document.fullscreenElement;
  F.window_set_fullscreen = (s, o, on) => {
    try { if (RT.$t(on) && !document.fullscreenElement) document.documentElement.requestFullscreen(); else if (!RT.$t(on) && document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* not allowed */ }
  };
  ['window_set_caption', 'window_set_size', 'window_center', 'window_set_cursor', 'window_enable_borderless_fullscreen', 'window_set_position'].forEach(n => { F[n] = () => 0; });
  F.display_get_width = () => screen.width || 1920;
  F.display_get_height = () => screen.height || 1080;
  F.display_set_gui_size = () => 0;
  F.date_current_datetime = () => Date.now() / 86400000 + 25569;
  F.get_timer = () => Math.floor(performance.now() * 1000);
  F.show_debug_message = (s, o, m) => { if (GM.debug) console.log('[gml]', m); };
  F.event_show_debug_message = F.show_debug_message;
  F.show_error = (s, o, m) => { console.error('[gml error]', m); };
  F.show_message = (s, o, m) => { console.log('[gml message]', m); };
  F.enable_loading = () => 0;
  F.math_set_epsilon = () => 0;
  // trophies / consoles / platform stubs
  ['can_unlock_trophy', 'disable_trophies', 'enable_trophies', 'get_consumer_trophy', 'get_debug_obj', 'get_trophy_by_id', 'init_trophies',
    'is_trophy_unlocked', 'load_trophies', 'post_activity', 'psn_get_trophy_unlock_state', 'psn_init_np_libs', 'psn_init_trophy', 'psn_load_modules',
    'psn_np_commerce_dialog_tick', 'psn_post_uds_event', 'psn_tick', 'psn_unlock_trophy', 'queue_trophy', 'resolve_trophies', 'trophy_show_debug_message',
    'unlock_trophy', 'validate_trophy', 'switch_accounts_is_user_open', 'switch_accounts_open_user', 'switch_accounts_select_account',
    'switch_controller_set_supported_styles', 'switch_controller_support_get_selected_id', 'switch_controller_support_set_defaults',
    'switch_controller_support_set_singleplayer_only', 'switch_controller_support_show', 'switch_save_data_commit', 'switch_save_data_mount',
    'switch_show_store', 'trigger_event', 'init', '_callback', 'has_pending_trophies'].forEach(n => { F[n] = () => 0; });
  F.switch_language_get_desired_language = () => 'en';
  F.get_text = () => '';
  F.get_font = () => -1;

  // unknown names: a method variable on self (GMS 2.3 "name = function () {}"), otherwise warn once and return 0
  const fallbacks = new Map();
  GM.F = new Proxy(F, {
    get(t, name) {
      if (name in t) return t[name];
      if (typeof name === 'symbol') return undefined;
      let f = fallbacks.get(name);
      if (!f) {
        f = (s, o, ...a) => {
          const m = s && s[name];
          if (typeof m === 'function') return m(s, o, ...a);
          GM.warnOnce('missing builtin ' + String(name));
          return 0;
        };
        fallbacks.set(name, f);
      }
      return f;
    }
  });
})();
